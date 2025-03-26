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
            let title  = 'dd_arc_mr_ar_pymt_hist.getInputData';
            log.debug(title, "Function started.");
            let pymtHdrSearch = search.load({
                id: "customsearch_dd_ar_pymt_hist_hdr"
            });
            try {
                let DDIntSetupRec = libImport.getARPymtHistConfig();
                log.debug(title, 'DDIntSetupRec: ' + JSON.stringify(DDIntSetupRec));
                if (libImport.isEmpty(DDIntSetupRec)) return;
                // wrap up the last run timestamp and add it to search criteria
                let lastRun = DDIntSetupRec.ARPymtHistLastRun;
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
                    values  : {custrecord_dd_ar_pymt_hist_last_run:thisRun}
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
            let title = 'dd_arc_mr_ar_pymt_hist.map';
            log.debug(title, "Function started.");
            let DDIntSetupRec = libImport.getARPymtHistConfig();
            const numOfTransPerFile = DDIntSetupRec.ARPymtHistNumOfTransPerFile;
            let mapKey = Math.floor(parseInt(context.key) / numOfTransPerFile);
            log.debug(title, "mapKey: " + mapKey);
            let value = JSON.parse(context.value);
            // log.debug(title, "key: " + context.key + ". value: " + JSON.stringify(value));
            let values = value.values;
            // log.debug(title, "values: " + JSON.stringify(values));
            let recordTypes = {
                'Payment' : 'customerpayment',
                'Credit Memo' : 'creditmemo',
                'Journal' : 'journalentry'
            }
            let paymentMethods = {
                'Credit_Memo' : 'CREDIT APPLIED',
                'Journal' : 'journal offset'
            }
            let paymentTypes = {
                'CustPymt' : 'Payment',
                'CustCred' :'Credit Memo',
                'Journal' : 'Journal'
            }
            let dataArray = [];
            try {
                let pymtNumber = values["GROUP(tranid.payingTransaction)"];
                let pymtLine = values["GROUP(line.payingTransaction)"];
                let currency = values["MAX(symbol.Currency)"];
                let pymtType = values["MAX(type.payingTransaction)"];//.replace(/[ ]+/g, '_');
                let pymtInternalId = values["GROUP(internalid.payingTransaction)"].value;
                let pymtObj = record.load({type: recordTypes[pymtType],id: pymtInternalId});
                let paymentMethod = pymtType === 'Payment' ? pymtObj.getText({fieldId:"paymentmethod"}) : paymentMethods[pymtType];
                log.debug(title, 'paymentMethod: ' + paymentMethod);
                let pymtHeader = {
                    "transactionId" : pymtNumber + "_" + pymtLine + "_" + pymtType,
                    "recordType" : "6",
                    "transactionAmount" : values["MAX(creditfxamount.payingTransaction)"] || '0',
                    "currency" : currency,
                    "payer" : values["MAX(internalid.customer)"],
                    "paymentMethod" : paymentMethod,
                    "paymentDate" : values["MAX(trandate.payingTransaction)"],
                    "paymentStatus" : "SUCCESS",
                    "paymentAmount" : "NULL",
                    "invoiceUniqueIdentifier" : "NULL"
                }
                log.debug(title, "pymtHeader: " + JSON.stringify(pymtHeader));
                // dataArray.push(pymtHeader);
                let filters = [
                    ["payingtransaction.internalid","anyof",pymtInternalId], //6062839
                    "AND",
                    ["payingtransaction.line","equalto",pymtLine]
                    // ["payingtransaction.lastmodifieddate","onorafter",fromDateTime],
                    // "OR",
                    // ["payingtransaction.linelastmodifieddate","onorafter",fromDateTime]
                ];
                let tempFilters = [
                    "AND"
                ];
                tempFilters.push(filters);
                let pymtDetailSearch = search.load({
                    id: "customsearch_dd_ar_pymt_hist_det"
                });
                pymtDetailSearch.filterExpression = pymtDetailSearch.filterExpression.concat(tempFilters);
                let pagedPymtDetailData = pymtDetailSearch.runPaged({'pageSize' : 1000});
                if (pagedPymtDetailData.pageRanges.length > 0) {
                    for(let i=0; i < pagedPymtDetailData.pageRanges.length; i++ ) {
                        let currentPymtDetailPage = pagedPymtDetailData.fetch(i);
                        currentPymtDetailPage.data.forEach( function(result) {
                            let pymtInternalId = result.getValue({
                                "name": "internalid",
                                "join": "payingtransaction",
                            });
                            let pymtNumber = result.getValue({
                                "name": "tranid",
                                "join": "payingtransaction",
                            });
                            let applyingLineNumber = result.getValue({
                                "name": "line",
                                "join": "payingtransaction",
                            });
                            let lineNumber = result.getValue({
                                "name": "line",
                            });
                            let amount = "-" + result.getValue({
                                name: "creditamount",
                                join: "payingTransaction"
                            }) || '0';
                            let amountFX = "($" + (result.getValue({
                                name: "creditfxamount",
                                join: "payingTransaction"
                            }) || '0') + ")";
                            let unappliedAmount = result.getValue({
                                name: "amountremaining",
                                join: "payingTransaction"
                            }) || '0';
                            let unappliedAmountFX = result.getValue({
                                name: "fxamountremaining",
                                join: "payingTransaction"
                            }) || '0';
                            let currency = result.getValue({
                                name: "symbol",
                                join: "Currency"
                            }) || 'USD';
                            // let exchangeRate = result.getValue({
                            //     name: "exchangerate",
                            //     join: "payingTransaction"
                            // }) || '1';
                            let tmpAmountFX = result.getValue({
                                name: "creditfxamount",
                                join: "payingTransaction"
                            }) || 0;
                            let tmpAmount = result.getValue({
                                name: "creditamount",
                                join: "payingTransaction"
                            }) || 0;
                            let exchangeRate = parseFloat(tmpAmountFX)/parseFloat(tmpAmount);
                            let customerInternalId = result.getValue({
                                name: "internalid",
                                join: "customer"
                            });
                            let custName = result.getValue({
                                name: "altname",
                                join: "customer"
                            });
                            let paymentDate = result.getValue({
                                name: "trandate",
                                join: "payingTransaction"
                            });
                            paymentDate = libImport.getHRCFormatedDate(paymentDate);
                            let appliedDate = result.getValue({
                                name: "datecreated",
                                join: "payingTransaction"
                            });
                            appliedDate = libImport.getHRCFormatedDate(appliedDate);
                            let internalId = result.getValue({
                                "name": "internalid"
                            });
                            let refNo = result.getValue({
                                "name": "tranid"
                            });
                            let appliedAmountFX = result.getValue({
                                name: "payingamount"
                            }) || '0';
                            let type = result.getValue({
                                name: "type",
                                join: "payingTransaction"
                            });
                            // let appliedAmounts = getAppliedAmounts(type,pymtInternalId,internalId,applyingLineNumber,lineNumber) || '0';
                            let appliedAmount = appliedAmountFX/exchangeRate;
                            if (appliedAmount > 0) {
                                dataArray.push({
                                    "paymentNumber" : pymtNumber,
                                    "invoiceInternalId" : pymtInternalId,
                                    "applyingLineNumber" : applyingLineNumber,
                                    "lineNumber" : lineNumber,
                                    "amount" : amount,
                                    "amountFX" : amountFX,
                                    "unappliedAmount" : unappliedAmount,
                                    "unappliedAmountFX" : unappliedAmountFX,
                                    "currency": currency,
                                    "exchangeRate" : exchangeRate,
                                    "customerInternalId" : customerInternalId,
                                    "custName" : custName,
                                    "paymentDate" : paymentDate,
                                    "appliedDate" : appliedDate,
                                    "internalId" : internalId,
                                    "refNo" : refNo,
                                    "appliedAmount" : appliedAmount.toFixed(3), //appliedAmounts["appliedAmount"],
                                    "appliedAmountFX" : appliedAmountFX, // appliedAmounts["appliedAmountFX"],
                                    "type" : paymentTypes[type]
                                });
                            }
                        });
                    }
                    log.audit(title, 'Payment Hist Data: ' + JSON.stringify(dataArray));
                }
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
            let title = 'dd_arc_mr_ar_pymt_hist.reduce';
            log.debug(title, "Function started.");
            log.debug(title, "context key: " + context.key);
            log.debug(title, "context values: " + JSON.stringify(context.values));
            try {
                let csvContent = "PAYMENT_NUMBER,INVOICE_INTERNAL_ID,APPLYING_LINE_NUMBER,LINE_NUMBER,AMOUNT,AMOUNT_FX,UNAPPLIED_AMOUNT,UNAPPLIED_AMOUNT_FX,CURRENCY,EXCHANGE_RATE,CUSTOMER_INTERNAL_ID," +
                    "CUST_NAME,PAYMENT_DATE,APPLIED_DATE,INTERNAL_ID,REF_NO,APPLIED_AMOUNT,APPLIED_AMOUNT_FX,TYPE" + '\n';
                let values = context.values;
                if (_.isArray(values) && values.length > 0) {
                    for (let n=0;n<values.length;n++) {
                        let pymtHistData = JSON.parse(values[n]);
                        if (_.isArray(pymtHistData) && pymtHistData.length > 0) {
                            for (let i = 0; i < pymtHistData.length; i++) {
                                let paymentNumber = libImport.escapeHtml('"' + pymtHistData[i].paymentNumber + '"');
                                let invoiceInternalId = libImport.escapeHtml('"' + pymtHistData[i].invoiceInternalId + '"');
                                let applyingLineNumber = libImport.escapeHtml('"' + pymtHistData[i].applyingLineNumber + '"');
                                let lineNumber = libImport.escapeHtml('"' + pymtHistData[i].lineNumber + '"');
                                let amount = libImport.escapeHtml('"' + pymtHistData[i].amount + '"');
                                let amountFX = libImport.escapeHtml('"' + pymtHistData[i].amountFX + '"');
                                let unappliedAmount = libImport.escapeHtml('"' + pymtHistData[i].unappliedAmount + '"');
                                let unappliedAmountFX = libImport.escapeHtml('"' + pymtHistData[i].unappliedAmountFX + '"');
                                let currency = libImport.escapeHtml('"' + pymtHistData[i].currency + '"');
                                let exchangeRate = libImport.escapeHtml('"' + pymtHistData[i].exchangeRate + '"');
                                let customerInternalId = libImport.escapeHtml('"' + pymtHistData[i].customerInternalId + '"');
                                let custName = libImport.escapeHtml('"' + pymtHistData[i].custName + '"');
                                let paymentDate = libImport.escapeHtml('"' + pymtHistData[i].paymentDate + '"');
                                let appliedDate = libImport.escapeHtml('"' + pymtHistData[i].appliedDate + '"');
                                let internalId = libImport.escapeHtml('"' + pymtHistData[i].internalId + '"');
                                let refNo = libImport.escapeHtml('"' + pymtHistData[i].refNo + '"');
                                let appliedAmount = libImport.escapeHtml('"' + pymtHistData[i].appliedAmount + '"');
                                let appliedAmountFX = libImport.escapeHtml('"' + pymtHistData[i].appliedAmountFX + '"');
                                let type = libImport.escapeHtml('"' + pymtHistData[i].type + '"');
                                csvContent += paymentNumber + ',' + invoiceInternalId + ',' + applyingLineNumber + ',' + lineNumber + ',' + amount + ',' + amountFX + ',' + unappliedAmount + ',' + unappliedAmountFX + ',' +
                                    currency + ',' + exchangeRate + ',' + customerInternalId + ',' + custName + ',' + paymentDate + ',' + appliedDate + ',' + internalId + ',' + refNo + ',' + appliedAmount + ',' +
                                    appliedAmountFX + ',' + type + '\n';
                            }
                        }
                    }
                    let DDIntSetupRec = libImport.getARPymtHistConfig();
                    // log.debug(title, 'DDIntSetupRec: ' + JSON.stringify(DDIntSetupRec));
                    if (libImport.isEmpty(DDIntSetupRec)) return;
                    log.debug(title, "csvContent: " + csvContent);
                    let fileId = generateCSV(csvContent, DDIntSetupRec.ARPymtHistNSFolder);
                    log.audit(title, 'File Generated, ID is: ' + fileId);
                    delayMilliseconds(1000);
                    if (!libImport.isEmpty(fileId)) {
                        // upload CSV File to SFTP Server
                        log.debug(title,'Uploading file ' + fileId);
                        let sftpConfig = libImport.getHRCsftpConfig();
                        log.debug(title, "sftpConfig: " + JSON.stringify(sftpConfig));
                        if (!libImport.isEmpty(sftpConfig)) {
                            log.debug(title, 'Connecting to SFTP Server at ' + DDIntSetupRec.ARPymtHistSFTPFolder);
                            let uploadedFile = file.load(fileId);
                            libImport.sftpFileUploadWithRetries(sftpConfig.sftpUrl, sftpConfig.userName, sftpConfig.hostKey, sftpConfig.keyId, DDIntSetupRec.ARPymtHistSftpFolder, uploadedFile, '/');
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
            let title = 'dd_arc_mr_ar_pymt_hist.summarize';
            log.debug(title, "Function started.summarize");
            log.debug(title, "summary: " + summary);
        }
        const generateCSV = (csvContent,nsFolder) => {
            log.audit('generateCSV', 'Saving CSV To Folder');
            //creating CSV file
            let dateTimeStamp = libImport.getDateTimeStamp();
            let fileName = runtime.accountId + '_ARPaymentHistory_' + dateTimeStamp + '.csv';
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
            let startTime = new Date().getTime();
            while (true) {
                let elapseTime = new Date().getTime() - startTime;
                if (elapseTime > milliseconds) {
                    break;
                }
            }
        }
        const getAppliedAmounts = (type,pymtInternalId,internalId,applyingLineNumber,lineNumber) => {
            log.debug('getAppliedAmounts','type: ' + type);
            let searchObj = search.create({
                type: "transaction",
                filters:
                    [
                        ["type","anyof",type],
                        "AND",
                        ["internalid","anyof",pymtInternalId],
                        "AND",
                        ["appliedtotransaction.internalid","anyof",internalId],
                        "AND",
                        ["appliedtotransaction.line","equalto",lineNumber],
                        "AND",
                        ["line","equalto",applyingLineNumber]
                    ],
                columns:
                    [
                        search.createColumn({name: "appliedtoforeignamount", label: "Applied To Link Amount (Foreign Currency)"}),
                        search.createColumn({name: "appliedtolinkamount", label: "Applied To Link Amount"})
                    ]
            });
            let appliedAmounts = {};
            let searchResultCount = searchObj.runPaged().count;
            if (searchResultCount == 0) return appliedAmounts;
            let result = searchObj.run().getRange(0,1);
            if (!result) return appliedAmounts;
            appliedAmounts.appliedAmount = result[0].getValue({name: "appliedtolinkamount"});
            appliedAmounts.appliedAmountFX = result[0].getValue({name: "appliedtoforeignamount"});
            // searchObj.run().each(function(result){
            //     appliedAmounts.appliedAmount = result.getValue({name: "appliedtolinkamount"});
            //     appliedAmounts.appliedAmountFX = result.getValue({name: "appliedtoforeignamount"});
            //     return true;
            // });
            log.debug('appliedAmounts',JSON.stringify(appliedAmounts));
            return appliedAmounts;
        }
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };

    });