/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/log', 'N/record', 'N/runtime', 'N/search', 'N/task', 'N/file'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 * @param{task} task
 */
    (log, record, runtime, search, task, file) => {
        const getSearchData = (searchInstance, pageSize, columnInfoArr) => {
            const resultSet = searchInstance.run();
            //10 unit
            const data = resultSet.getRange({start: 0, end: pageSize || 5});
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

        const updatesItemSort = (scriptContext) => {
            //5 Units
            const filterArr = [
                {name: "type", operator: search.Operator.ANYOF, values: "InvtPart"},
                {name: "custitem_pwc_itemsort", operator: search.Operator.ISEMPTY, values: ""}
            ];
            let filterInfoArr = getFilterOrColArr(filterArr, "filter");

            const columnArr = [
                {name: "internalid", outKey: "id"},
                {name: "itemid", outKey: "itemid"}
            ]
            let columnInfoArr = getFilterOrColArr(columnArr);
            let dataSearch = search.create({
                type: search.Type.ITEM,
                columns: columnInfoArr ? columnInfoArr.map(columnInfo => columnInfo.colInfo) : [],
                filters: filterInfoArr
            });
            const data = getSearchData(dataSearch, 1000, columnInfoArr);
            let processContinue = false;
            let num = 0;
            data && data.length > 0 && data.forEach(dataInfo => {
                if (runtime.getCurrentScript().getRemainingUsage() < 50){
                    processContinue = true;
                }
                if (!processContinue){
                    let itemId = dataInfo.itemid;
                    if (dataInfo.id && itemId && !isNaN(Number(itemId)) && itemId.length < 20){
                        itemId = (itemId || "0").padStart(20, "0");
                    }
                    //5 Units
                    const id = dataInfo.id && record.submitFields({
                        type: record.Type.INVENTORY_ITEM,
                        id: dataInfo.id,
                        values: {
                            custitem_pwc_itemsort: itemId
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields : true
                        }
                    });

                    log.debug((++num).toString().padStart(6, "0"), id);
                }
            });


            if (processContinue || data.length > 999){
                let scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
                scriptTask.scriptId = runtime.getCurrentScript().id;
                scriptTask.deploymentId = runtime.getCurrentScript().deploymentId;
                scriptTask.submit();
            }
        }

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            try{
                updatesItemSort(scriptContext);
            }catch (e){
                log.error("Exception", e);
            }

        }

        return {execute}

    });
