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
            let fileContents = [];
            try {
                let DDIntSetupRec = libImport.getARPymtHistConfig();
                log.debug(title, 'DDIntSetupRec: ' + JSON.stringify(DDIntSetupRec));
                if (libImport.isEmpty(DDIntSetupRec)) return;
                let inputFolderId = DDIntSetupRec.ARPymtHistNSFolder;
                log.debug(title, "inputFolderId: " + inputFolderId);
                let fileList = libImport.searchFileStartWith(search, 'ARPaymentHist_', inputFolderId, file.Type.CSV);
                let processingFiles = [];
                if (fileList.length > 0) {
                    for (let index = 0; index < fileList.length; index++) {
                        let impFile = file.load(fileList[index]);
                        log.audit(title, "Processing file: " + impFile.name);
                        let contents = libImport.csvToJSON(impFile.getContents(),',', '\n');
                        log.debug(title, "Number of rows: " + contents.length);
                        log.debug(title + " - contents: " , contents);
                        if (contents.length > 0) {
                            // attach fileId and fileName to each of the file lines
                            for (let i = 0; i < contents.length; i++) {
                                contents[i].fileId = fileList[index];
                                contents[i].fileName = impFile.name;
                                // log.debug(title, "fileList[index]: " + fileList[index]);
                                // log.debug(title, "contents[i]: " + JSON.stringify(contents[i]));
                            }
                            processingFiles.push(impFile);
                            if (fileContents.length == 0) {
                                fileContents = contents;
                            } else {
                                // fileContents = fileContents.push.apply(contents);
                                for (let i=0;i<contents.length;i++) {
                                    fileContents.push(contents[i]);
                                }
                                // log.debug(title, 'new fileContents: ' + fileContents);
                            }
                            log.debug(title, "Added " + contents.length + " rows into processing queue.");
                        } else {
                            impFile.name = "processed_" + impFile.name;
                            impFile.folder = '1415372', // '1876094';
                            impFile.save();
                        }
                    }
                }
                for (let i = 0; i < processingFiles.length; i++) {
                    log.debug(title, "Marked file as processed in File Cabinet: " + processingFiles[i].name);
                    processingFiles[i].name = "processed_" + processingFiles[i].name;
                    processingFiles[i].folder = "1415372", // '1876094';
                    processingFiles[i].save();
                }
                // if (importModule && importModule.processingInputData && fileContents.length > 0) {
                //     fileContents = importModule.processingInputData(fileContents);
                // }
                log.audit(title, "Total rows to import: " + fileContents.length);
                // log.audit(title, "fileContents to import: " + fileContents);
                return fileContents;
            } catch (e) {
                log.error(title, "ERROR: " + e);
            }
            return fileContents;
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
            log.debug(title, "key: " + context.key + ". value: " + JSON.stringify(value));
            // let values = value.values;
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
                // let pymtNumber = value.SS_PAYMENT_NUMBER;
                let pymtLine = value.SS_APPLYING_LINE_NUMBER;
                // let currency = value.SS_CURRENCY;
                // let pymtType = value.SS_TYPE;//.replace(/[ ]+/g, '_');
                let pymtInternalId = value.SS_INVOICE_INTERNAL_ID;
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
                            log.debug(title, 'Processing invoice line page ' + i + '. line :' + JSON.stringify(result));
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
                            // let appliedAmounts = getAppliedAmounts(type,pymtInternalId,internalId,applyingLineNumber,lineNumber);
                            // let pymtObj = record.load({type: recordTypes[pymtType],id: pymtInternalId});
                            // let paymentMethod = pymtType === 'Payment' ? pymtObj.getText({fieldId:"paymentmethod"}) : paymentMethods[pymtType];
                            // log.debug(title, 'paymentMethod: ' + paymentMethod);
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
                                    "appliedAmount" : appliedAmount.toFixed(3), // appliedAmounts["appliedAmount"] ? appliedAmounts["appliedAmount"] : '0',
                                    "appliedAmountFX" : appliedAmountFX, // appliedAmounts["appliedAmountFX"] ? appliedAmounts["appliedAmountFX"] : '0',
                                    "type" : type
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
            let paymentTypes = {
                'CustPymt' : 'Payment',
                'CustCred' :'Credit Memo',
                'Journal' : 'Journal'
            }
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
                                let type = libImport.escapeHtml('"' + paymentTypes[pymtHistData[i].type] + '"');
                                let appliedAmount = libImport.escapeHtml('"' + pymtHistData[i].appliedAmount + '"');
                                let appliedAmountFX = libImport.escapeHtml('"' + pymtHistData[i].appliedAmountFX + '"');
                                // let appliedAmount = libImport.escapeHtml('"' + appliedAmounts["appliedAmount"] ? appliedAmounts["appliedAmount"] : '0' + '"');
                                // let appliedAmountFX = libImport.escapeHtml('"' + appliedAmounts["appliedAmountFX"] ? appliedAmounts["appliedAmountFX"] : '0' + '"');
                                csvContent += paymentNumber + ',' + invoiceInternalId + ',' + applyingLineNumber + ',' + lineNumber + ',' + amount + ',' + amountFX + ',' + unappliedAmount + ',' + unappliedAmountFX + ',' +
                                    currency + ',' + exchangeRate + ',' + customerInternalId + ',' + custName + ',' + paymentDate + ',' + appliedDate + ',' + internalId + ',' + refNo + ',' + appliedAmount + ',' +
                                    appliedAmountFX + ',' + type + '\n';
                            }
                        }
                    }
                    // let appliedAmounts = getAppliedAmounts(pymtHistData[i].type,pymtHistData[i].invoiceInternalId,pymtHistData[i].internalId,pymtHistData[i].applyingLineNumber,pymtHistData[i].lineNumber);
                    let scriptObj = runtime.getCurrentScript();
                    log.audit(title, 'Remaining governance units: ' + scriptObj.getRemainingUsage());
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
            let appliedAmounts = {};
            try {
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
                // log.debug('getAppliedAmounts', 'searchObj: ' + JSON.stringify(searchObj));
                let searchResultCount = searchObj.runPaged().count;
                // log.debug('getAppliedAmounts', 'searchResultCount: ' + searchResultCount);
                if (searchResultCount == 0) return appliedAmounts;
                let result = searchObj.run().getRange(0,1);
                if (!result) return appliedAmounts;
                appliedAmounts.appliedAmount = result[0].getValue({name: "appliedtolinkamount"});
                appliedAmounts.appliedAmountFX = result[0].getValue({name: "appliedtoforeignamount"});
                // searchObj.run().each(function(result){
                //     let testAppliedAmount = result.getValue({name: "appliedtolinkamount"});
                //     let testAppliedAmountFX = result.getValue({name: "appliedtoforeignamount"});
                //     return true;
                // });
            } catch (e) {
                log.error('appliedAmounts','Error occurs searching for applied amounts:' + e);
            }
            log.debug('appliedAmounts',JSON.stringify(appliedAmounts));
            return appliedAmounts;
        }
        return {
            config:{
                retryCount: 3,
                exitOnError: false
            },
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };

    });