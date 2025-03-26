/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url', "N/redirect", "N/log", "N/task", 'N/record', 'N/file', 'N/format',
        '../856 ASN/asnLibrary', "N/encode", "../DD_Constant"],

    (runtime, search, url, redirect, log, task, record, file, format, ddt,
     encode, DD_CONSTANT) => {
        'use strict';


        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Obje····ct|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            try {
                const configureInfo = ddt.getDoorDashConfigInfo();
                const reprocessFileInfo = ddt.getPermanentSkippedFiles(configureInfo);
                let fileArr = ddt.getNew856AsnFiles(configureInfo, reprocessFileInfo);
                log.audit("fileArr", fileArr);
                let asnInfoArr = [];
                const fileIdInfo = {};
                const historicalAsnNumInfo = {};
                let asnNumInfo = {};
                let exceedUsage = ddt.getAsnInfo(fileArr, asnInfoArr, configureInfo, fileIdInfo,
                    historicalAsnNumInfo, asnNumInfo);
                if (exceedUsage) {
                    log.error("SSS_USAGE_LIMIT_EXCEEDED", "Please run again after script completed this time");
                }
                // log.debug("asnInfoArr", asnInfoArr);
                log.audit("asnInfoArr length", asnInfoArr.length);
                return asnInfoArr;
                // return [];
            } catch (e) {
                log.error("Exception on getInputData", e.message || e.type);
            }
        }

        /**
         * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
         * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
         * context.
         * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
         *     is provided automatically based on the results of the getInputData stage.
         * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
         *     function on the current key-value pair
         * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
         *     pair
         * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} mapContext.key - Key to be processed during the map stage
         * @param {string} mapContext.value - Value to be processed during the map stage
         * @since 2015.2
         */

        const map = (mapContext) => {
            let processedHistoryRecId = "";
            let processStatusRecInfo = "";
            let fileId = "";
            const startTime = new Date().getTime();
            try {
                // Usage limit 1000
                const asnInfo = mapContext.value && JSON.parse(mapContext.value);
                if (!asnInfo){
                    return "";
                }
                const vendorInfo = ddt.getVendorInfo(asnInfo.vendorId);
                fileId = asnInfo.fileId;
                const senderId = asnInfo.senderId, separator = asnInfo.separator, asnLineInfoArr = asnInfo.asnLineInfoArr;
                const configureInfo = asnInfo.configureInfo;
                // let fileName = asnInfo.fileName;
                let fileOriginalName = ddt.conversionFileName(asnInfo.fromFileName, vendorInfo.name, asnInfo.asnNum);
                const matchedFileInfo = ddt.getMatchedFileRecordInfo(fileOriginalName, asnInfo.asnNum, senderId);
                const successAsnInfo = matchedFileInfo && matchedFileInfo.successAsnInfo && JSON.parse(matchedFileInfo.successAsnInfo);
                const matchedProcessedHistoryRecInfo = ddt.getMatchedProcessedHistoryRecInfo(fileOriginalName, asnInfo.asnNum, senderId);
                const forceToBillDays = asnInfo.days;
                const duplicateAsn = asnInfo.duplicateAsn;
                const duplicateHandled = asnInfo.duplicateHandled;
                const newFile = asnInfo.newFile;
                const asnEdiFile = fileId && file.load({id: fileId});
                const daysBeforeStop = configureInfo && configureInfo.daysBeforeStop;
                // File date created
                const fileCreated = asnInfo.fileCreated && new Date(asnInfo.fileCreated);
                processStatusRecInfo = {
                    name: "",
                    fileId: fileId,
                    oldFileId: matchedFileInfo ? matchedFileInfo.fileId : "",
                    fileInfoId: matchedFileInfo ? matchedFileInfo.id : "",
                    fileName: fileOriginalName,
                    fromFileId: asnInfo.fromFileId,
                    fromFileName: asnInfo.fromFileName,
                    headerInfo: asnInfo.headerInfo,
                    columnInfo: asnInfo.columnInfo,
                    retryCabinetId: asnInfo.retryCabinetId,
                    successCabinetId: asnInfo.successCabinetId,
                    //Success
                    processStatus: DD_CONSTANT.HISTORY_PROCESS_STATUS.SUCCESS,
                    failReason: "",
                    count: 1,
                    firstAsn: asnInfo.firstAsn,
                    asnNumber: asnInfo.asnNum,
                    asnDateString: asnInfo.asnDateString,
                    duplicateAsn: duplicateAsn,
                    duplicateHandled: duplicateHandled,
                    newFile: newFile,
                    poNumber: "",
                    poId: "",
                    buyerEmail: "",
                    vendorId: asnInfo.vendorId,
                    typeCode: "",
                    asnId: "",
                    asnIdArr: [],
                    asnIdInfo: {},
                    errorCode: "",
                    configureInfo: configureInfo,
                    senderId: senderId,
                    comeFromSPS: ddt.comeFromSPS(senderId),
                    comeFromFinTech: ddt.comeFromFinTech(senderId),
                    matchedProcessedHistoryRecInfo: matchedProcessedHistoryRecInfo,
                    vendorInfo: vendorInfo,
                    reprocess: asnInfo.reprocess,
                    sourceKeyInfo: {
                        vendorCodeInfo: {},
                        vendorCodeArr: [],
                        upcInfo: {},
                        upcArr: [],
                        skuInfo: {},
                        skuArr: []
                    },
                    warning: ""
                };
                if (processStatusRecInfo.fromFileName != processStatusRecInfo.fileName) {
                    processStatusRecInfo.fileNameChanged = true;
                }
                let saveProcessHistoryRecord;
                try {
                    saveProcessHistoryRecord = ddt.mainProcessForAsn({
                        asnInfo: asnInfo,
                        fileId: fileId,
                        fileOriginalName: fileOriginalName,
                        successAsnInfo: successAsnInfo,
                        forceToBillDays: forceToBillDays,
                        separator: separator,
                        senderId: senderId,
                        asnLineInfoArr: asnLineInfoArr,
                        asnEdiFile: asnEdiFile,
                        configureInfo: configureInfo,
                        daysBeforeStop: daysBeforeStop,
                        // File date created
                        fileCreated: fileCreated,
                        processStatusRecInfo: processStatusRecInfo,
                        duplicateAsn: duplicateAsn,
                        duplicateHandled: duplicateHandled,
                        newFile: newFile
                    });
                } catch (e) {
                    //Failure
                    processStatusRecInfo.processStatus = DD_CONSTANT.HISTORY_PROCESS_STATUS.FAILURE;
                    processStatusRecInfo.failReason = "Failed to process, " + e.message + "\n\n" + JSON.stringify(e);
                    // processStatusRecInfo.failReason = "Failed to process, " + e.message;
                    saveProcessHistoryRecord = true;
                }
              log.audit({title:"saveProcessHistoryRecord return",details:saveProcessHistoryRecord});
                if (saveProcessHistoryRecord) {
                    try {
                        // Save processed info as history record.
                        if (processStatusRecInfo.processStatus == DD_CONSTANT.HISTORY_PROCESS_STATUS.FAILURE && !processStatusRecInfo.errorCode) {
                            processStatusRecInfo.errorCode = DD_CONSTANT.ERROR_CODE.DEFAULT;
                        }

                        if (processStatusRecInfo.unitTypeInfo) {
                            delete processStatusRecInfo.unitTypeInfo;
                        }
                        processedHistoryRecId = ddt.saveProcessedInfo({
                            asnEdiFile: asnEdiFile,
                            daysBeforeStop: daysBeforeStop,
                            // File date created
                            fileCreated: fileCreated,
                            processStatusRecInfo: processStatusRecInfo
                        });
                        if (processStatusRecInfo.reprocess) {
                            try{
                                record.submitFields({
                                    type: record.Type.VENDOR,
                                    id: processStatusRecInfo.vendorId,
                                    values: {
                                        custentity_dd_edi_reprocess_back_x_days: ""
                                    },
                                    options: {
                                        ignoreMandatoryFields: true
                                    }
                                });
                            }catch (err) {
                                log.error("Clear Back X Days Part1", e.message);
                            }
                        }
                    } catch (e) {
                        log.error("Part2: Exception on save process status record", e.message || e.type);
                    }
                } else {
                    try {
                        record.submitFields({
                            type: record.Type.VENDOR,
                            id: processStatusRecInfo.vendorId,
                            values: {
                                custentity_dd_edi_reprocess_back_x_days: ""
                            },
                            options: {
                                ignoreMandatoryFields: true
                            }
                        });
                    }catch (e) {
                        log.error("Clear Back X Days Part2", e.message || e.type);
                    }
                }

                if (processStatusRecInfo.fileNameChanged && processStatusRecInfo.fileName) {
                    asnEdiFile.name = processStatusRecInfo.fileName;
                    // file name has been renamed
                    asnEdiFile.save();
                }
            } catch (e) {
                log.error("Part1: Exception on save process status record", e.message || e.type);
            } finally {
                ddt.logForProcessHistory(processStatusRecInfo, startTime);
                if (fileId) {
                    mapContext.write({
                        key: fileId,
                        value: {
                            processStatusRecInfo: processStatusRecInfo,
                            processedHistoryRecId: processedHistoryRecId
                        }
                    });
                }
            }
        }

        /**
         * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
         * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
         * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
         *     provided automatically based on the results of the map stage.
         * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
         *     reduce function on the current group
         * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
         * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {string} reduceContext.key - Key to be processed during the reduce stage
         * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
         *     for processing
         * @since 2015.2
         */
        const reduce = (reduceContext) => {
            try {
                // Usage limit 5000
                const fileId = reduceContext.key;
                const processedRecArr = reduceContext.values;
                let generatedRecordIdArr = [],generatedRecordInfo = {},generatedRecordAsnInfoArr = [];
                let originalFileName = "",allAsnSuccess = true,failCount = 0,successCount = 0,totalCounts = 0;
                let matchedFileInfo = "",failedAsnInfo = {},successAsnInfo = {},processedTime = 0;
                let matchedFileRecId = "",successCabinetId = "",searchMatchedFileInfo = true;
                let hasSuccessProcessedRec = false,processedHistoryRecIdArr = [],configureInfo = "";
                // image that one file with one vendor
                let vendorId = "",vendorName = "",allSkipped = true,poNum = "",poId = "",location="",invoiceNum="";
                let duplicateAsnProcessHisArr = [],errorCodeInfo = {},duplicateNewFile = false;
                const typeCodeArr = [],asnNumArr = [],tdsTotalArr = [];
                let successProcessedRec = "";
                try {
                    processedRecArr && processedRecArr.length > 0 && processedRecArr.forEach(processInfoString => {
                        const processedInfo = JSON.parse(processInfoString);
                        const processStatusInfo = processedInfo.processStatusRecInfo;
                        const processedHistoryRecId = processedInfo.processedHistoryRecId;
                        processedHistoryRecId && processedHistoryRecIdArr.push(processedHistoryRecId);
                        originalFileName = processStatusInfo.fileName;
                        successCabinetId = processStatusInfo.successCabinetId;
                        vendorId = processStatusInfo.vendorId;
                        vendorName = processStatusInfo.vendorName;
                        poNum = processStatusInfo.poNumber;
                        poId = processStatusInfo.poId;
                        processStatusInfo.typeCode && typeCodeArr.push(processStatusInfo.typeCode);
                        processStatusInfo.asnNumber && asnNumArr.push(processStatusInfo.asnNumber);
                        processStatusInfo.asnTotal && tdsTotalArr.push(processStatusInfo.asnTotal);
                      location = processStatusInfo.locationInfo ? processStatusInfo.locationInfo.id : "";
                      invoiceNum = processStatusInfo.asnNumber;
                        const errorCode = processStatusInfo.errorCode;
                        if (!errorCodeInfo[errorCode]) {
                            errorCodeInfo[errorCode] = 1;
                        } else {
                            errorCodeInfo[errorCode] += 1;
                        }
                        // duplicate asn information
                        processStatusInfo.duplicateAsn && duplicateAsnProcessHisArr.push({
                            processHistoryInfo: processStatusInfo
                        });
                        configureInfo = processStatusInfo.configureInfo;
                        // load matched file info
                        if (searchMatchedFileInfo){
                            searchMatchedFileInfo = false;
                            matchedFileInfo = ddt.getMatchedFileRecordInfo(originalFileName, processStatusInfo.asnNumber, processStatusInfo.senderId);
                            if (matchedFileInfo){
                                matchedFileRecId = matchedFileInfo.id;
                                successCount = Number(matchedFileInfo.successCount);
                                failCount = Number(matchedFileInfo.failureCount);
                                totalCounts = Number(matchedFileInfo.totalCount);
                                processedTime = Number(matchedFileInfo.processedTime);
                                failedAsnInfo = matchedFileInfo.failureAsnInfo && JSON.parse(matchedFileInfo.failureAsnInfo);
                                successAsnInfo = matchedFileInfo.successAsnInfo && JSON.parse(matchedFileInfo.successAsnInfo);
                            }
                        }
                        if (processStatusInfo.processStatus != DD_CONSTANT.HISTORY_PROCESS_STATUS.SKIPPED) {
                            allSkipped = false;
                        }
                        if (processStatusInfo.duplicateAsn && processStatusInfo.newFile && !processStatusInfo.duplicateHandled) {
                            duplicateNewFile = true;
                        }
                        if (processStatusInfo.processStatus != DD_CONSTANT.HISTORY_PROCESS_STATUS.SKIPPED && (!processStatusInfo.duplicateAsn
                            || processStatusInfo.duplicateHandled)){
                            // Append current processed info for asn file
                            if (processStatusInfo.processStatus == DD_CONSTANT.HISTORY_PROCESS_STATUS.SUCCESS){
                                hasSuccessProcessedRec = true;
                                successProcessedRec = processStatusInfo;
                                generatedRecordIdArr = generatedRecordIdArr.concat(processStatusInfo.asnIdArr);
                                if (processStatusInfo.asnIdInfo){
                                    for (const id in processStatusInfo.asnIdInfo) {
                                        generatedRecordInfo[id] = processStatusInfo.asnIdInfo[id];
                                    }
                                }
                                generatedRecordAsnInfoArr.push(processStatusInfo);
                                if (!successAsnInfo[processStatusInfo.asnNumber]) {
                                    successAsnInfo[processStatusInfo.asnNumber] = true;
                                    successCount++;
                                }
                                if (matchedFileInfo){
                                    // remove success processed asn from failure list
                                    if (failedAsnInfo[processStatusInfo.asnNumber]){
                                        delete failedAsnInfo[processStatusInfo.asnNumber];
                                        failCount > 0 && failCount--;
                                    }
                                }
                            } else {
                                // Only store new failed asn
                                if (!failedAsnInfo[processStatusInfo.asnNumber]){
                                    failedAsnInfo[processStatusInfo.asnNumber] = true;
                                    failCount++;
                                }
                                allAsnSuccess = false;
                            }
                        }
                    });
                } catch (e) {
                    log.error("Reduce Exception Part1", e.message || e.type);
                }

                // Calculate total count for file
                totalCounts = successCount + failCount;
                let fileStatus = "";
                // Move file process
                const asnEdiFile = fileId && file.load({id: fileId});
                if (errorCodeInfo[DD_CONSTANT.ERROR_CODE.PERMANENT_FAIL] && Object.keys(errorCodeInfo).length == 1) {
                    // Move file to Permanent Folder
                    ddt.saveToCabinet(asnEdiFile, configureInfo.permanentCabinetId, vendorName, originalFileName);
                    fileStatus = DD_CONSTANT.FILE_PROCESS_STATUS.PERMANENT_FAIL;
                } else {
                    if (allSkipped) {
                        const skippedCabinetId = configureInfo.skippedCabinetId;
                        // Move to skipped folder
                        ddt.saveToCabinet(asnEdiFile, skippedCabinetId, vendorName, originalFileName);
                        fileStatus = DD_CONSTANT.FILE_PROCESS_STATUS.SKIPPED;
                    } else {
                        if ((successCount == totalCounts && totalCounts > 0) || duplicateNewFile){
                            // Move to success folder
                            ddt.saveToCabinet(asnEdiFile, successCabinetId, vendorName, originalFileName);
                        }
                        fileStatus = successCount == totalCounts ? DD_CONSTANT.FILE_PROCESS_STATUS.SUCCESS : DD_CONSTANT.FILE_PROCESS_STATUS.FAILURE;
                    }
                }

                // Create File Info Record
                const fileInfoRecType = DD_CONSTANT.CUSTOM_RECORD_TYPE_ID.EDI_FILE_INFO_RECORD_TYPE_ID;
                let fileInfoRecord = "";
                if (matchedFileRecId){
                    fileInfoRecord = record.load({type: fileInfoRecType, id: matchedFileRecId});
                    fileInfoRecord.setValue({fieldId: "name", value: originalFileName});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_edi_type", value: DD_CONSTANT.EDI_TYPE["856"]});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_file_process_status", value: fileStatus});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_file", value: fileId});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_file_vendor", value: vendorId});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_processed_time", value: ++processedTime});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_invoice_count", value: totalCounts});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_success_count", value: successCount});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_failure_count", value: failCount});
                    fileInfoRecord.setValue({fieldId: "custrecord_success_invoice_info", value: successAsnInfo ? JSON.stringify(successAsnInfo) : ""});
                    fileInfoRecord.setValue({fieldId: "custrecord_failure_invoice_info", value: failedAsnInfo ? JSON.stringify(failedAsnInfo) : ""});
                } else {
                    fileInfoRecord = record.create({type: fileInfoRecType});
                    fileInfoRecord.setValue({fieldId: "name", value: originalFileName});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_edi_type", value: DD_CONSTANT.EDI_TYPE["856"]});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_file", value: fileId});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_file_vendor", value: vendorId});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_file_process_status", value: fileStatus});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_processed_time", value: ++processedTime});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_invoice_count", value: totalCounts});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_success_count", value: successCount});
                    fileInfoRecord.setValue({fieldId: "custrecord_dd_failure_count", value: failCount});
                    fileInfoRecord.setValue({fieldId: "custrecord_success_invoice_info", value: successAsnInfo ? JSON.stringify(successAsnInfo) : ""});
                    fileInfoRecord.setValue({fieldId: "custrecord_failure_invoice_info", value: failedAsnInfo ? JSON.stringify(failedAsnInfo) : ""});
                }
                const fileInfoRecId = fileInfoRecord.save({ignoreMandatoryFields: true});

                // Create Processed History Record for success    one success record for each executing (Contains multiple successful asns, generated 856 ASN fields is multiple select)
                if (hasSuccessProcessedRec){
                  log.audit({title:"generatedRecordIdArr",details:generatedRecordIdArr.toString()});
                    const processStatusRec = record.create({type: DD_CONSTANT.CUSTOM_RECORD_TYPE_ID.EDI_HISTORY_RECORD_TYPE_ID, isDynamic: true});
                    processStatusRec.setValue({fieldId: "custrecord_dd_his_edi_type", value: DD_CONSTANT.EDI_TYPE["856"]});
                    processStatusRec.setValue({fieldId: "custrecord_dd_source_file", value: fileId});
                    const successStatus = successProcessedRec.successCode == DD_CONSTANT.SUCCESS_CODE.WARNING ? DD_CONSTANT.HISTORY_PROCESS_STATUS.SUCCESS_WITH_WARNING : DD_CONSTANT.HISTORY_PROCESS_STATUS.SUCCESS;
                    processStatusRec.setValue({fieldId: "custrecord_dd_process_status", value: successStatus});
                    processStatusRec.setValue({fieldId: "custrecord_dd_generated_vendor_bills", value: generatedRecordIdArr});
                  processStatusRec.setValue({fieldId: "custrecord_dd_txn_internal_id", value: generatedRecordIdArr.length==1?generatedRecordIdArr.toString():""});
                    processStatusRec.setValue({fieldId: "custrecord_dd_source_file_name", value: originalFileName});
                    processStatusRec.setValue({fieldId: "custrecord_dd_record_counts", value: generatedRecordIdArr.length});
                    processStatusRec.setValue({fieldId: "custrecord_dd_edi_file_info_parent", value: fileInfoRecId});
                    processStatusRec.setValue({fieldId: "custrecord_dd_purchase_order_number", value: poNum});
                    processStatusRec.setValue({fieldId: "custrecord_dd_matched_netsuite_po", value: poId || ""});
                    processStatusRec.setValue({fieldId: "custrecord_dd_asn_number", value: asnNumArr.length == 1 ? asnNumArr[0] : ""});
                   processStatusRec.setValue({fieldId: "custrecord_dd_invoice_number", value: invoiceNum});  
                  processStatusRec.setValue({fieldId: "custrecord_dd_pro_his_location", value: location});
                    processStatusRec.setValue({fieldId: "custrecord_dd_vendor", value: vendorId});
                    processStatusRec.setValue({fieldId: "custrecord_dd_transaction_type_code", value: typeCodeArr.length == 1 ? typeCodeArr[0] : ""});
                    processStatusRec.setValue({fieldId: "custrecord_dd_tds_total", value: tdsTotalArr.length == 1 ? tdsTotalArr[0] : ""});
                    successProcessedRec.successCode == DD_CONSTANT.SUCCESS_CODE.WARNING && processStatusRec.setValue({fieldId: "custrecord_dd_reason_for_failure", value: successProcessedRec.warning});
                    processStatusRec.save({ignoreMandatoryFields: true});
                    try {
                        // Attach file to corresponding ASN record
                        if (generatedRecordIdArr && generatedRecordIdArr.length > 0) {
                            generatedRecordIdArr.forEach(recordId => {
                                const recordInfo = generatedRecordInfo[recordId];
                                recordId && recordInfo && record.attach({
                                    record: {
                                        type: "file",
                                        id: fileId
                                    },
                                    to: {
                                        type: recordInfo.type,
                                        id: recordId
                                    },
                                    attributes: {
                                        role: 3
                                    }
                                });
                            })
                        }

                        // Correcting exist historic processing record
                        ddt.correctExistHistoricalRecord(matchedFileRecId, fileInfoRecId, processedTime
                            , generatedRecordAsnInfoArr, configureInfo);
                    } catch (e) {
                        log.error("Reduce generatedRecordAsnInfoArr ", generatedRecordAsnInfoArr);
                        log.error("Reduce ddt.correctExistHistoricalRecor Exception", e);
                    }
                }

                // reduceContext.write({key: fileInfoRecId, value: processedHistoryRecIdArr});
                if (processedHistoryRecIdArr && processedHistoryRecIdArr.length > 0 && fileInfoRecId){
                    processedHistoryRecIdArr.forEach(recId => {
                        if (recId) {
                            // usage 2
                            record.submitFields({type: DD_CONSTANT.CUSTOM_RECORD_TYPE_ID.EDI_HISTORY_RECORD_TYPE_ID, id: recId, values: {
                                    custrecord_dd_edi_file_info_parent: fileInfoRecId
                            }});
                        }
                    });
                }
            } catch (e) {
                log.error("Reduce Exception", e.message || e.type);
            }
        }


        /**
         * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
         * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
         * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
         * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
         *     script
         * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
         * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
         * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
         * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
         *     script
         * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
         * @param {Object} summaryContext.inputSummary - Statistics about the input stage
         * @param {Object} summaryContext.mapSummary - Statistics about the map stage
         * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
         * @since 2015.2
         */
        const summarize = (summaryContext) => {
            // Usage limit 10000
            // Linked to corresponding FILE INFO RECORD for new failure history record
            // summaryContext.output.iterator().each(function (fileInfoRecId, processedHistoryRecIdArrStr){
            //     try {
            //         const processedHistoryRecIdArr = JSON.parse(processedHistoryRecIdArrStr);
            //         // Set edi file info for failure history record
            //         if (processedHistoryRecIdArr && processedHistoryRecIdArr.length > 0){
            //             processedHistoryRecIdArr.forEach(recId => {
            //                 // usage 2
            //                 record.submitFields({type: DD_CONSTANT.CUSTOM_RECORD_TYPE_ID.EDI_HISTORY_RECORD_TYPE_ID, id: recId, values: {
            //                         custrecord_dd_edi_file_info_parent: fileInfoRecId
            //                     }});
            //             });
            //         }
            //     } catch (e) {
            //         log.error("Exception on summarize", e.message || e.type);
            //     } finally {
            //         return true;
            //     }
            // });
        }

        return {
            getInputData,
            map,
            reduce,
            summarize
        }

    });