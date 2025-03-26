/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/log', 'N/record', 'N/runtime', 'N/search', 'N/format'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */
    (log, record, runtime, search, format) => {

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
                            outputResult[columnInfo.outKey] = columnInfo.method ?
                                result[columnInfo.method](columnInfo.colInfo) : result.getValue(columnInfo.colInfo);
                        }
                    });

                    outputResult && dataResultArr.push(outputResult);
                } else {
                    dataResultArr.push(result);
                }
            });

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
                                    outputResult[columnInfo.outKey] = columnInfo.method ?
                                        result[columnInfo.method](columnInfo.colInfo) : result.getValue(columnInfo.colInfo);
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

        const getMatchedData = () => {
            // Using Netsuite SavedSearch
            const poSavedSearchId = runtime.getCurrentScript().getParameter({name: "custscript_dd_po_savedsearch"});
            const poSavedSearch = poSavedSearchId ? search.load({type: search.Type.PURCHASE_ORDER, id: poSavedSearchId}) : "";
            //2021/5/31
            const fullfillingTrandate = format.format({value: new Date(2021, 4, 31), type: format.Type.DATE});
            const filterArr = [
                {name: "type", operator: search.Operator.ANYOF, values: "PurchOrd"},
                //Purchase Order:Pending Billing/Partially Received, Purchase Order:Pending Bill
                {name: "status", operator: search.Operator.ANYOF, values: ["PurchOrd:E", "PurchOrd:F"]},
                {name: "mainline", operator: search.Operator.IS, values: "F"},
                {name: "cogs", operator: search.Operator.IS, values: "F"},
                {name: "shipping", operator: search.Operator.IS, values: "F"},
                {name: "taxline", operator: search.Operator.IS, values: "F"},
                {name: "trandate", summary: "max", join: "fulfillingtransaction", operator: search.Operator.ONORBEFORE, values: fullfillingTrandate}
            ];
            let filterInfoArr = getFilterOrColArr(filterArr, "filter");
            const columnArr = [
                {name: "internalid", sort: search.Sort.ASC, summary: search.Summary.GROUP, outKey: "id"},
                {name: "transactionname", summary: search.Summary.GROUP, outKey: "transactionName"},
                {name: "formuladate", summary: search.Summary.MAX, formula: "{fulfillingtransaction.trandate}", outKey: "maxDate"}
            ];
            let columnInfoArr = getFilterOrColArr(columnArr);
            let poSearch = search.create({
                type: search.Type.TRANSACTION,
                columns: columnInfoArr ? columnInfoArr.map(columnInfo => columnInfo.colInfo) : [],
                filters: poSavedSearch ? poSavedSearch.filters : filterInfoArr,
            });

            const poData = getAllData(poSearch, columnInfoArr);
            let poIdInfo = {};
            poData && poData.length > 0 && poData.forEach(poInfo => {
                poIdInfo[poInfo.id] = {
                    id: poInfo.id
                }
            });
            return Object.keys(poIdInfo);
        }

        /**
         *
         * @param pendingPadStr
         * @param padStr
         * @param length
         * @param paddingForRight
         * @returns {string}
         */
         const padString = (pendingPadStr, padStr, length, paddingForRight) => {
            pendingPadStr = pendingPadStr + "";
            if (pendingPadStr.length < length){
                let padString = "";
                for (let index = 0; index < length - pendingPadStr.length; index++){
                    padString += (padStr ? padStr : " ");
                }
                if (paddingForRight){
                    pendingPadStr += padString;
                } else {
                    pendingPadStr = padString + pendingPadStr;
                }
            }

            return pendingPadStr;
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
            const poIdArr = getMatchedData();
            return poIdArr;
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
            const poId = mapContext.value;
            log.debug("poId", poId);
            try{
                if (poId){
                    //Transform vendor bill and set quantity 0 for vendor bill
                    const vendorBillRec = record.transform({fromType: record.Type.PURCHASE_ORDER,
                        fromId: poId, toType: record.Type.VENDOR_BILL});
                    var tranIdInfo = search.lookupFields({
                        type: search.Type.TRANSACTION,
                        id: poId,
                        columns: "tranid"
                    });
                    const poTranId = tranIdInfo.tranid;
                    const vendorBillTranId = "CLEAR" + poTranId + "_" + padString(new Date().getMonth() + 1, "0", 2) + padString(new Date().getDate(), "0", 2);
                    vendorBillRec.setValue({fieldId: "tranid", value: vendorBillTranId});
                    const group = "item";
                    let lineCounts = vendorBillRec.getLineCount({sublistId: group});
                    for (let lineNo = 0; lineNo < lineCounts; lineNo++){
                        vendorBillRec.setSublistValue({sublistId: group, fieldId: "rate", value: 0, line: lineNo});
                    }
                    const vendorBillId = vendorBillRec.save({ignoreMandatoryFields: true});
                    //Approve vendor bill
                    record.submitFields({
                        type: record.Type.VENDOR_BILL,
                        id: vendorBillId,
                        values: {
                            approvalstatus: 2
                        },
                        options: {
                            ignoreMandatoryFields: true
                        }
                    });

                    const poRec = record.load({type: record.Type.PURCHASE_ORDER, id: poId});
                    let poLineCounts = poRec.getLineCount({sublistId: group});
                    //close PO
                    for (let lineNo = 0; lineNo < poLineCounts; lineNo++){
                        poRec.setSublistValue({sublistId: group, fieldId: "isclosed", value: true, line: lineNo});
                    }
                    poRec.save({ignoreMandatoryFields: true});
                }
            }catch (e) {
                log.debug("Exception on Map entry point for PO id:" + poId, e);
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

        }

        return {getInputData, map, reduce, summarize}

    });
