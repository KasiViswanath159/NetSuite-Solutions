/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url', "N/redirect", "N/log", "N/task", 'N/record', 'N/query', './DD_Constant'],

    (runtime, search, url, redirect, log, task, record, query, DD_CONSTANT) => {
        'use strict';
        const deleteDupHistoricProcessRecord = (fileInfoId) => {
            const fileInfoRec = record.load({id: fileInfoId, type: DD_CONSTANT.CUSTOM_RECORD_TYPE_ID.EDI_FILE_INFO_RECORD_TYPE_ID});
            const sublistId = "recmachcustrecord_dd_edi_file_info_parent";
            const sublistCount = fileInfoRec.getLineCount({sublistId: sublistId});
            const hisRecInfo = {
                success: [],
                failure: []
            };
            for (let lineIndex = 0; lineIndex < sublistCount; lineIndex++) {
                const historicalRecId = fileInfoRec.getSublistValue({sublistId: sublistId, fieldId: "id", line: lineIndex});
                const modifiedDate = fileInfoRec.getSublistValue({sublistId: sublistId, fieldId: "lastmodified", line: lineIndex});
                const historicalRecStatus = fileInfoRec.getSublistValue({sublistId: sublistId, fieldId: "custrecord_dd_process_status", line: lineIndex});
                if (historicalRecStatus == DD_CONSTANT.HISTORY_PROCESS_STATUS.SUCCESS
                    || historicalRecStatus == DD_CONSTANT.HISTORY_PROCESS_STATUS.SUCCESS_WARNING
                    || historicalRecStatus == DD_CONSTANT.HISTORY_PROCESS_STATUS.SUCCESS_WITH_WARNING) {
                    hisRecInfo.success.push({
                        modifiedDate: modifiedDate,
                        historicalRecId: historicalRecId
                    });
                } else {
                    hisRecInfo.failure.push({
                        modifiedDate: modifiedDate,
                        historicalRecId: historicalRecId
                    });
                }
            }

            log.debug("hisRecInfo for fileInfoId: " + fileInfoId, hisRecInfo);

            const unmatchItemSublistId = "recmachcustrecord_dd_edi_process_history";
            hisRecInfo.failure.sort((hisRecInfo1, hisRecInfo2) => {
                return hisRecInfo2.modifiedDate.getTime() - hisRecInfo1.modifiedDate.getTime();
            }).forEach((hisRecInfo, failureIndex) => {
                if (failureIndex > 0 && hisRecInfo.historicalRecId) {
                    const hisRec = record.load({type: DD_CONSTANT.CUSTOM_RECORD_TYPE_ID.EDI_HISTORY_RECORD_TYPE_ID, id: hisRecInfo.historicalRecId});
                    const hisRecItemCounts = hisRec.getLineCount({sublistId: unmatchItemSublistId});
                    for (let unmatchedItemIndex = hisRecItemCounts - 1; unmatchedItemIndex > -1; unmatchedItemIndex--) {
                        hisRec.removeLine({sublistId: unmatchItemSublistId, line: unmatchedItemIndex});
                    }
                    hisRec.save({ignoreMandatoryFields: true});
                    record.delete({type: DD_CONSTANT.CUSTOM_RECORD_TYPE_ID.EDI_HISTORY_RECORD_TYPE_ID, id: hisRecInfo.historicalRecId});
                }
            });

            hisRecInfo.success.sort((hisRecInfo1, hisRecInfo2) => {
                return hisRecInfo1.modifiedDate.getTime() - hisRecInfo2.modifiedDate.getTime();
            }).forEach((hisRecInfo, successIndex) => {
                if (successIndex > 0 && hisRecInfo.historicalRecId) {
                    const hisRec = record.load({type: DD_CONSTANT.CUSTOM_RECORD_TYPE_ID.EDI_HISTORY_RECORD_TYPE_ID, id: hisRecInfo.historicalRecId});
                    const hisRecItemCounts = hisRec.getLineCount({sublistId: unmatchItemSublistId});
                    for (let unmatchedItemIndex = hisRecItemCounts - 1; unmatchedItemIndex > -1; unmatchedItemIndex--) {
                        hisRec.removeLine({sublistId: unmatchItemSublistId, line: unmatchedItemIndex});
                    }
                    hisRec.save({ignoreMandatoryFields: true});
                    record.delete({type: DD_CONSTANT.CUSTOM_RECORD_TYPE_ID.EDI_HISTORY_RECORD_TYPE_ID, id: hisRecInfo.historicalRecId});
                }
            });
        }
        /**
         * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
         * @param {Object} inputContext
         * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
         *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
         * @param {Object} inputContext.ObjectRef - Object that references the input data
         * @typedef {Object} ObjectRef
         * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
         * @property {string} ObjectRef.type - Type of the record instance that contains the input data
         * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
         * @since 2015.2
         */

        const getInputData = (inputContext) => {
            try{
                let fileInfoIdArr = [3915505, 3716906];
                // let fileInfoIdArr = [5045902];
                // Get search result and pass it to map entry point.
                return fileInfoIdArr;
            }catch (e) {
                log.error("Exception on getInputData entry point", e);
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
            // Usage limit 1000
            const fileInfoId = mapContext.value;
            if (fileInfoId) {
                mapContext.write({
                    key: fileInfoId,
                    value: fileInfoId
                });
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
            // Usage limit 5000
            const startTime = new Date().getTime();
            const fileInfoId = reduceContext.key;
            try {
                // update po
                deleteDupHistoricProcessRecord(fileInfoId);
            } catch (e) {
                log.error("Exception on reduce entry point for fileInfoId:" + fileInfoId, e);
                if (e.name == "UNEXPECTED_ERROR") {
                    deleteDupHistoricProcessRecord(fileInfoId);
                }
            } finally {
                const endTime = new Date().getTime();
                const secondsOfProcessing = Math.floor((endTime - startTime)/1000);
                log.debug("secondsOfProcessing for fileInfoId:" + fileInfoId, secondsOfProcessing);
                // reduceContext.write({
                //     key: fileInfoId,
                //     value: fileInfoId
                // });
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

            // let countOld = 0;
            // summaryContext.output.iterator().each((key, poIdArr) => {
            //     ++countOld;
            //     return true;
            // });
            // log.debug("Old Count", countOld);
            // let poIdArr = getPendingUpdatePO();
            // log.debug("Remaining Count", poIdArr ? poIdArr.length : 0);
            // if (poIdArr && poIdArr.length > 0 && countOld > 0 && poIdArr.length < countOld) {
            //     log.debug("Retrigger MR again", `Old count: ${countOld}   Remaining count: ${poIdArr.length}`);
            //     const currentScript = runtime.getCurrentScript();
            //     const mrTask = task.create({
            //         taskType: task.TaskType.MAP_REDUCE,
            //         scriptId: currentScript.id,
            //         deploymentId: currentScript.deploymentId,
            //         params: {
            //             custscript_duedate_from: currentScript.getParameter({name: "custscript_duedate_from"}),
            //             custscript_duedate_to: currentScript.getParameter({name: "custscript_duedate_to"})
            //         }
            //     });
            //     mrTask && mrTask.submit();
            // }
        }

        return {getInputData, map, reduce, summarize}

    });
