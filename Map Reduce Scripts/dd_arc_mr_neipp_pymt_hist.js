/**
 * CONFIDENTIAL AND PROPRIETARY SOURCE CODE.
 *
 * Use and distribution of this code is subject to applicable
 * licenses and the permission of the code owner. This notice
 * does not indicate the actual or intended publication of
 * this source code.
 *
 * Portions developed for DoorDash, Inc. by CBIZ ARC
 * and are the property of DoorDash, Inc.
 * ===================================================================
 * Version    Date            Author           Remarks
 * 1.0.0      21 Oct 2021     Bruce Do      	Initial version
  */
/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define([
        'N/log',
        'N/runtime',
        'N/file',
        'N/search',
        'N/query',
        'N/record',
        'N/format',
        '../../lib/dd_lib_import',
        '../../lib/lodash.min'
    ],
    function (log, runtime, file, search, query, record, format, libImport,_) {

        /**
         * Marks the beginning of the Map/Reduce process and generates input data.
         *
         * @typedef {Object} ObjectRef
         * @property {number} id - Internal ID of the record instance
         * @property {string} type - Record type id
         *
         * @return {Array|Object|Search|RecordRef} inputSummary
         * @since 2015.1
         */
        const getInputData = () => {
            let title  = 'dd_arc_mr_neipp_pymt_hist.getInputData';
            log.debug(title, "Function started.");
            let pymtHdrSearch = search.load({
                id: "customsearch_dd_non_eipp_pymt_hist_hdr_4"
            });
            try {
                let DDIntSetupRec = libImport.getNonEIPPPymtHistConfig();
                // log.debug(title, 'DDIntSetupRec: ' + JSON.stringify(DDIntSetupRec));
                if (libImport.isEmpty(DDIntSetupRec)) return;
                // wrap up the last run timestamp and add it to search criteria
                let lastRun = DDIntSetupRec.nonEIPPPymtHistLastRun;
                log.debug(title, 'lastRun: ' + lastRun);
                let filters = [];
                if (!libImport.isEmpty(lastRun)) {
                    let fromDateTime = libImport.getLastRunDateTime(lastRun);
                    log.debug(title, 'fromDateTime: ' + fromDateTime);
                    filters.push(
                        "AND",
                        [["payingtransaction.lastmodifieddate","onorafter",fromDateTime],
                        "OR",
                        ["payingtransaction.linelastmodifieddate","onorafter",fromDateTime],
                        "OR",
                        ["lastmodifieddate","onorafter",fromDateTime],
                        "OR",
                        ["linelastmodifieddate","onorafter",fromDateTime]]
                    );
                    pymtHdrSearch.filterExpression = pymtHdrSearch.filterExpression.concat(filters);
                }
                // capture this run timestamp before searching for JE records
                let thisRun = new Date();
                thisRun = format.parse({value:thisRun, type: format.Type.DATETIME});
                thisRun = format.format({value: thisRun, type: format.Type.DATETIME});
                // Save this run timestamp to Config record
                let getDDIntSetupId = record.submitFields({
                    type: 'customrecord_dd_eipp_int_setup',
                    id: DDIntSetupRec.internalid,
                    values  : {custrecord_dd_noneipp_pymt_hist_last_run:thisRun}
                });
            } catch (e) {
                log.error(title, "ERROR: " + e);
            }
            return pymtHdrSearch;
        }

        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1
         */
        const map = (context) => {
            let title = 'dd_arc_mr_neipp_pymt_hist.map';
            log.debug(title, "Function started.");
            let DDIntSetupRec = libImport.getNonEIPPPymtHistConfig();
            const numOfTransPerFile = DDIntSetupRec.nonEIPPPymtHistNumOfTransPerfile;
            let mapKey = Math.floor(parseInt(context.key) / numOfTransPerFile);
            log.debug(title, "mapKey: " + mapKey);
            let value = JSON.parse(context.value);
            log.debug(title, "key: " + context.key + ". value: " + JSON.stringify(value));
            let values = value.values;
            log.debug(title, "values: " + JSON.stringify(values));
            let recordTypes = {
                'Payment' : 'customerpayment',
                'Credit_Memo' : 'creditmemo',
                'Journal' : 'journalentry' || 'advintercompanyjournalentry'
            }
            let paymentMethods = {
                'Credit_Memo' : 'CREDIT APPLIED',
                'Journal' : 'journal offset' 
            }
            let dataArray = [];
            try {
                let pymtNumber = values["GROUP(transactionnumber.payingTransaction)"];
                let pymtLine = values["GROUP(line.payingTransaction)"];
                let invLine = values["GROUP(line)"];
                let currency = values["MAX(symbol.Currency)"];
                let payingAmount = values["MAX(payingamount)"] || '0';
                let payer = values["MAX(internalid.customer)"];
                log.debug(title, 'payer: ' + payer);
                let paymentDate = values["MAX(trandate.payingTransaction)"];
                let invInternalId = values["GROUP(internalid)"].value;
                log.debug(title, 'invInternalId: ' + invInternalId);
                let pymtType = values["MAX(type.payingTransaction)"] ? values["MAX(type.payingTransaction)"].replace(/[ ]+/g, '_') : '';
                log.debug(title,'pymtType: ' + pymtType);
                let pymtInternalId = values["GROUP(internalid.payingTransaction)"].value;
                log.debug(title, 'pymtInternalId: ' + pymtInternalId);
                let pymtObj = record.load({type: recordTypes[pymtType],id: pymtInternalId});
                let paymentMethod = pymtType === 'Payment' ? pymtObj.getText({fieldId:"paymentmethod"}) : paymentMethods[pymtType];
                if (!paymentMethod || paymentMethod === '') paymentMethod = 'UNKNOWN';
                log.debug(title, 'paymentMethod: ' + paymentMethod);
                let pymtHeader = {
                    "transactionId" : pymtNumber + "_" + pymtLine + "_" + pymtType + "_" + invInternalId + "_" + invLine,// "_JEPayment",
                    "recordType" : "6",
                    "transactionAmount" : payingAmount,
                    "currency" : currency,
                    "payer" : payer,
                    "paymentMethod" : paymentMethod,
                    "paymentDate" : paymentDate,
                    "paymentStatus" : "SUCCESS",
                    "paymentAmount" : "NULL",
                    "invoiceUniqueIdentifier" : "NULL"
                }
                log.debug(title, "pymtHeader: " + JSON.stringify(pymtHeader));
                dataArray.push(pymtHeader);
                let pymtDetail = {
                    "transactionId" : pymtNumber + "_" + pymtLine + "_" + pymtType + "_" + invInternalId + "_" + invLine,// "_JEPayment",
                    "recordType" : "4",
                    "transactionAmount" : "NULL",
                    "currency" : currency,
                    "payer" : payer,
                    "paymentMethod" : paymentMethod,
                    "paymentDate" : paymentDate,
                    "paymentStatus" : "SUCCESS",
                    "paymentAmount" : payingAmount,
                    "invoiceUniqueIdentifier" : invInternalId
                }
                dataArray.push(pymtDetail);
                log.audit(title, 'Payment Hist Data: ' + JSON.stringify(dataArray));
            } catch (e) {
                log.error(title, "ERROR: " + e);
            }
            context.write({
                key: mapKey,
                value: JSON.stringify(dataArray)
            });
       }

        /**
         * Executes when the reduce entry point is triggered and applies to each group.
         *
         * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
         * @since 2015.1
         */
        const reduce = (context) => {
            let title = 'dd_arc_mr_neipp_pymt_hist.reduce';
            log.debug(title, "Function started.");
            log.debug(title, "context key: " + context.key);
            log.debug(title, "context values: " + JSON.stringify(context.values));
            try {
                let csvContent = "TRANSACTION_ID,RECORD_TYPE,TRANSACTION_AMOUNT,CURRENCY,PAYER,PAYMENT_METHOD,PAYMENT_DATE,PAYMENT_STATUS,PAYMENT_AMOUNT,INVOICE_UNIQUE_IDENTIFIER" + '\n';
                let values = context.values;
                if (_.isArray(values) && values.length > 0) {
                    for (let n=0;n<values.length;n++) {
                        let pymtHistData = JSON.parse(values[n]);
                        if (_.isArray(pymtHistData) && pymtHistData.length > 0) {
                            for (let i = 0; i < pymtHistData.length; i++) {
                                let transactionId = libImport.escapeHtml('"' + pymtHistData[i].transactionId + '"');
                                let recordType = libImport.escapeHtml('"' + pymtHistData[i].recordType + '"');
                                let transactionAmount = libImport.escapeHtml('"' + pymtHistData[i].transactionAmount + '"');
                                let currency = libImport.escapeHtml('"' + pymtHistData[i].currency + '"');
                                let payer = libImport.escapeHtml('"' + pymtHistData[i].payer + '"');
                                let paymentMethod = libImport.escapeHtml('"' + pymtHistData[i].paymentMethod + '"');
                                let paymentDate = libImport.escapeHtml('"' + pymtHistData[i].paymentDate + '"');
                                let paymentStatus = libImport.escapeHtml('"' + pymtHistData[i].paymentStatus + '"');
                                let paymentAmount = libImport.escapeHtml('"' + pymtHistData[i].paymentAmount + '"');
                                let invoiceUniqueIdentifier = libImport.escapeHtml('"' + pymtHistData[i].invoiceUniqueIdentifier + '"');
                                csvContent += transactionId + ',' + recordType + ',' + transactionAmount + ',' + currency + ',' + payer + ',' + paymentMethod + ',' + paymentDate + ',' + paymentStatus + ',' + paymentAmount + ',' + invoiceUniqueIdentifier + '\n';
                            }
                        }
                    }
                    let DDIntSetupRec = libImport.getNonEIPPPymtHistConfig();
                    // log.debug(title, 'DDIntSetupRec: ' + JSON.stringify(DDIntSetupRec));
                    if (libImport.isEmpty(DDIntSetupRec)) return;
                    log.debug(title, "csvContent: " + csvContent);
                    let fileId = generateCSV(csvContent, DDIntSetupRec.nonEIPPPymtHistNSFolder);
                    log.audit(title, 'File Generated, ID is: ' + fileId);
                    delayMilliseconds(1000);
                    if (!libImport.isEmpty(fileId)) {
                        // upload CSV File to SFTP Server
                        log.debug(title,'Uploading file ' + fileId);
                        let sftpConfig = libImport.getHRCsftpConfig();
                        log.debug(title, "sftpConfig: " + JSON.stringify(sftpConfig));
                        if (!libImport.isEmpty(sftpConfig)) {
                            log.debug(title, 'Connecting to SFTP Server at ' + DDIntSetupRec.nonEIPPPymtHistSftpFolder);
                            let uploadedFile = file.load(fileId);
                            libImport.sftpFileUploadWithRetries(sftpConfig.sftpUrl, sftpConfig.userName, sftpConfig.hostKey, sftpConfig.keyId, DDIntSetupRec.nonEIPPPymtHistSftpFolder, uploadedFile, '/');
                        } else {
                            log.error(title, "HRC SFTP Config is not set");
                        }
                    }
                }
            } catch (e) {
                log.error(title,"ERROR: " + e);
            }
        }

        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        const summarize = (summary) => {
            let title = 'dd_arc_mr_neipp_pymt_hist.summarize';
            log.debug(title, "Function started.summarize");
            log.debug(title, "summary: " + summary);
        }
        const generateCSV = (csvContent,nsFolder) => {
            log.audit('generateCSV', 'Saving CSV To Folder');
            //creating CSV file
            let dateTimeStamp = libImport.getDateTimeStamp();
            let fileName = runtime.accountId + '_PaymentHistory_' + dateTimeStamp + '.csv';
            log.debug("generateCSV", "fileName: " + fileName);
            let fileObj = file.create({
                name: fileName,
                fileType: file.Type.CSV,
                contents: csvContent,
                folder: nsFolder
            });
            let fileId = fileObj.save();
            return fileId
        }
        const delayMilliseconds = (milliseconds) => {
            var startTime = new Date().getTime();
            while (true) {
                var elapseTime = new Date().getTime() - startTime;
                if (elapseTime > milliseconds) {
                    break;
                }
            }
        }
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };

    });