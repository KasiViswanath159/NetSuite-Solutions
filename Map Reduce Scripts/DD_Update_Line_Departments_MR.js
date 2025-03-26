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

        const getAccountPeriodFirstDate = () => {
            let data = "";

            let filterArr = [
                {name: "closed", operator: search.Operator.IS, values: "F"},
                {name: "isquarter", operator: search.Operator.IS, values: "F"},
                {name: "isyear", operator: search.Operator.IS, values: "F"},
                {name: "formulanumeric", operator: search.Operator.GREATERTHANOREQUALTO, values: 0, formula: "TO_NUMBER(TO_CHAR({startdate}, 'yyyy')) - TO_NUMBER(TO_CHAR({today}, 'yyyy'))"},
                {name: "formulanumeric", operator: search.Operator.GREATERTHANOREQUALTO, values: -2, formula: "CASE WHEN TO_NUMBER(TO_CHAR({today}, 'yyyy')) = TO_NUMBER(TO_CHAR({startdate}, 'yyyy')) THEN TO_NUMBER(TO_CHAR({startdate}, 'mm')) - TO_NUMBER(TO_CHAR({today}, 'mm')) ELSE 1 END"}
            ];
            let filterInfoArr = getFilterOrColArr(filterArr, "filter");
            const columnArr = [
                {name: "periodname", outKey: "name"},
                {name: "startdate", sort: search.Sort.ASC, outKey: "startdate"}
            ]
            let columnInfoArr = getFilterOrColArr(columnArr);
            let configSearch = search.create({
                type: search.Type.ACCOUNTING_PERIOD,
                columns: columnInfoArr ? columnInfoArr.map(columnInfo => columnInfo.colInfo) : [],
                filters: filterInfoArr
            });

            let dataArr = getAllData(configSearch, columnInfoArr);
            if (dataArr && dataArr.length > 0){
                data = dataArr[0].startdate;
            }

            return data;
        }

        const getBlankDepartmentLine = () => {
            const accountPeriodStartDate = getAccountPeriodFirstDate();
            if (!accountPeriodStartDate){
               return [];
            }
            let data = [];
            let filterArr = [
                //{name: "internalid", operator: search.Operator.ANYOF, values: ["3890810", "3890808"]},
                {name: "type", operator: search.Operator.ANYOF, values: ["PurchOrd", "ItemRcpt", "VendBill"]},
                {name: "trandate", operator: search.Operator.ONORAFTER, values: accountPeriodStartDate},
                //SB3 ["25", "24", "5"], Production ["27", "24", "5"]
                {name: "subsidiary", operator: search.Operator.ANYOF, values: ["27", "24", "5"]},
                {name: "mainline", operator: search.Operator.IS, values: "F"},
                {name: "cogs", operator: search.Operator.IS, values: "F"},
                {name: "shipping", operator: search.Operator.IS, values: "F"},
                {name: "taxline", operator: search.Operator.IS, values: "F"},
                {name: "custcol_cseg_costcenter", operator: search.Operator.ANYOF, values: "@NONE@"}
            ];
            let filterInfoArr = getFilterOrColArr(filterArr, "filter");
            const columnArr = [
                {name: "internalid", sort: search.Sort.ASC, outKey: "id"},
                {name: "recordtype", outKey: "recordType"},
                {name: "linesequencenumber", sort: search.Sort.ASC, outKey: "line"}
            ]
            let columnInfoArr = getFilterOrColArr(columnArr);
            let configSearch = search.create({
                type: search.Type.TRANSACTION,
                columns: columnInfoArr ? columnInfoArr.map(columnInfo => columnInfo.colInfo) : [],
                filters: filterInfoArr
            });

            data = getAllData(configSearch, columnInfoArr);
            if (data && data.length > 0){
                let dataInfo = {};
                data.forEach(lineInfo => {
                    if (!dataInfo.hasOwnProperty(lineInfo.id)){
                        dataInfo[lineInfo.id] = [];
                    }
                    dataInfo[lineInfo.id].push({
                        recordtype: lineInfo.recordType,
                        line: lineInfo.line
                    });
                });
                data = dataInfo;
            }

            return data;
        }

        let departmentsDefault = "";

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
            departmentsDefault = runtime.getCurrentScript().getParameter({name: "custscript_update_line_department"});
            let lineInfo = getBlankDepartmentLine();
            let lineInfoArr = [];
            if (lineInfo && departmentsDefault){
                for (const tranId in lineInfo){
                    lineInfoArr.push({tranId: tranId, lineArr: lineInfo[tranId], department: departmentsDefault});
                }
            }
            // Get search result and pass it to map entry point.
            return lineInfoArr;
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
            const lineInfo = mapContext.value && JSON.parse(mapContext.value);
            const tranId = lineInfo && lineInfo.tranId;
            const lineArr = lineInfo && lineInfo.lineArr;
            departmentsDefault = lineInfo && lineInfo.department;
            // update po
            if (tranId && lineArr && lineArr.length > 0){
                const tranRecord = record.load({type: lineArr[0].recordtype, id: tranId});
                lineArr.forEach(lineInfo => {
                    //Departments  600 Ops & Support : 630 New Business S&O : 632 New Business Verticals
                    tranRecord.setSublistValue({sublistId: "item", fieldId: "custcol_cseg_costcenter", value: departmentsDefault, line: lineInfo.line - 1});
                });
                tranRecord.save({ignoreMandatoryFields: true});
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
            //progress pause at map step.
            summaryContext.mapSummary.errors.iterator().each(
                function (key, error, executionNo) {
                    log.error({
                        title:  'Map error for key: ' + key + ', execution no. ' + executionNo,
                        details: error
                    });
                    return true;
                }
            );
        }

        return {getInputData, map, reduce, summarize}

    });
