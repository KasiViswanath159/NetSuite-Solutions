/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url', "N/redirect", "N/log", "N/task", 'N/record'],

    (runtime, search, url, redirect, log, task, record) => {
        'use strict';

        const getSearchData = (searchInstance, pageSize, columnInfoArr, startIndex) => {
            const resultSet = searchInstance.run();
            //10 unit
            const data = resultSet.getRange({start: startIndex || 0, end: pageSize || 5});
            let dataResultArr = [];
            data && data.forEach(result => {
                if (columnInfoArr){
                    let outputResult = "";
                    columnInfoArr && columnInfoArr.length > 0 && columnInfoArr.forEach(columnInfo => {
                        if (columnInfo && columnInfo.outKey){
                            if (!outputResult){
                                outputResult = {};
                            }
                            outputResult[columnInfo.outKey] = columnInfo.method ? result[method](columnInfo.colInfo) : result.getValue(columnInfo.colInfo);
                        }
                    });

                    outputResult && dataResultArr.push(outputResult);
                } else {
                    dataResultArr.push(result);
                }
            });

            return dataResultArr;
        }

        const getAllData = (searchInstance, columnInfoArr) => {
            const resultSet = searchInstance.run();
            let dataResultArr = [];
            let processStatus = true;
            let startIndex = 0;
            let pageSize = 999;
            while(processStatus){
                //10 unit
                const data = resultSet.getRange({start: startIndex || 0, end: startIndex + pageSize});
                if (data && data.length > 0){
                    data.forEach(result => {
                        if (columnInfoArr){
                            let outputResult = "";
                            columnInfoArr && columnInfoArr.length > 0 && columnInfoArr.forEach(columnInfo => {
                                if (columnInfo && columnInfo.outKey){
                                    if (!outputResult){
                                        outputResult = {};
                                    }
                                    outputResult[columnInfo.outKey] = columnInfo.method ? result[method](columnInfo.colInfo) : result.getValue(columnInfo.colInfo);
                                }
                            });

                            outputResult && dataResultArr.push(outputResult);
                        } else {
                            dataResultArr.push(result);
                        }
                    });
                } else {
                    processStatus = false;
                }
                startIndex += pageSize;
            }
            return dataResultArr;
        }

        const getFilterOrColArr = (mappingArr, type) => {
            let resultInfoArr = [];
            mappingArr && mappingArr.forEach(mappingInfo => {
                if (type == "filter"){
                    resultInfoArr.push(search.createFilter(mappingInfo));
                } else {
                    resultInfoArr.push({
                        outKey: mappingInfo.outKey || mappingInfo.name,
                        method: mappingInfo.method || "",
                        colInfo: search.createColumn(mappingInfo)
                    });
                }
            })
            return resultInfoArr;
        }

        const getMatchedPurchaseOrders = () => {
            const searchId = runtime.getCurrentScript().getParameter({name: "custscript_dd_pending_update_pos"});
            const poSearch = searchId ? search.load({id: searchId}) : "";
            const columnArr = [
                {name: "internalid", join: "CUSTBODY_DD_PURCHASECONTRACT", sort: search.Sort.ASC, outKey: "pcId"},
                {name: "internalid", sort: search.Sort.ASC, outKey: "poId"}
            ]
            let columnInfoArr = getFilterOrColArr(columnArr);
            let configSearch = search.create({
                type: search.Type.TRANSACTION,
                columns: columnInfoArr ? columnInfoArr.map(columnInfo => columnInfo.colInfo) : [],
                filters: poSearch.filters
            });

            let idArr = [];
            const data = getAllData(configSearch, columnInfoArr);
            data && data.length > 0 && data.forEach(pcInfo => {
                idArr.push({
                    pcId: pcInfo.pcId,
                    poId: pcInfo.poId
                });
            });

            return idArr;
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
            const idInfoArr = getMatchedPurchaseOrders();
            log.debug("idInfoArr.length", idInfoArr.length);
            // Get search result and pass it to map entry point.
            return idInfoArr;//idInfoArr;//;["4290470"];//
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
            try{
                // 4248835:vistar   4248836:McLane Company, Inc.   4248850:Supervalu Inc.
                const pcMap = {
                    // PC#2 TO PC#421 Vistar
                    4248835: "6565056",
                    // PC#3 TO PC#422 McLane Company, Inc.
                    4248836: "6565057",
                    // PC#17 TO PC#423 Supervalu Inc.
                    4248850: "6608579"
                };
                // Usage limit 1000
                const poIdInfo = mapContext.value && JSON.parse(mapContext.value);
                const poId = poIdInfo.poId;
                const oldPcId = poIdInfo.pcId;
                const newPcId = pcMap[oldPcId];
                log.debug("poIdInfo", poIdInfo);
                // recovery dd purchase contract field value for PO
                if (poId && newPcId){
                    const poRecord = record.load({type: record.Type.PURCHASE_ORDER, id: poId, isDynamic: true});
                    // Change PC from old TO new
                    poRecord.setValue({fieldId: "purchasecontract", value: newPcId, ignoreFieldChange: true});
                    poRecord.setValue({fieldId: "custbody_dd_purchasecontract", value: newPcId, ignoreFieldChange: true});
                    const group = "item";
                    const itemCount = poRecord.getLineCount({sublistId: group});
                    for (let lineNo = 0; lineNo < itemCount; lineNo++){
                        poRecord.selectLine({sublistId: group, line: lineNo});
                        // const rate = poRecord.getCurrentSublistValue({sublistId: group, fieldId: "rate"});
                        // item rate will be covered with default value after remove PC value
                        poRecord.setCurrentSublistValue({sublistId: group, fieldId: "purchasecontract", value: "", ignoreFieldChange: true});
                        //poRecord.setCurrentSublistValue({sublistId: group, fieldId: "expectedreceiptdate", value: new Date("2021/11/08"), ignoreFieldChange: true});
                        // reset item rate
                        // poRecord.setCurrentSublistValue({sublistId: group, fieldId: "rate", value: rate});
                        poRecord.commitLine({sublistId: group});
                    }
                    poRecord.save({ignoreMandatoryFields: true});
                }
            } catch (e) {
                log.debug("Exception on Map", e);
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
            summaryContext.mapSummary.errors.iterator().each(
                function (key, error, executionNo) {
                    log.error({
                        title:  'Map error for key: ' + key + ', execution no. ' + executionNo,
                        details: JSON.stringify(error)
                    });
                    return true;
                }
            );
        }

        return {getInputData, map, reduce, summarize}

    });
