/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/log', 'N/record', 'N/search', 'N/task', 'N/runtime'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{search} search
 * @param{task} task
 */
    (log, record, search, task, runtime) => {

        const getSearchData = (searchInstance, pageSize, columnInfoArr) => {
            const resultSet = searchInstance.run();
            //10 unit
            const data = resultSet.getRange({start: 0, end: pageSize || 5});

            // const itemPageResult = searchInstance && searchInstance.runPaged({
            //     pageSize: pageSize || 5
            // });
            // const pageData = itemPageResult && itemPageResult.fetch({
            //     index: 0
            // });
            // const data = pageData && pageData.data;
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

        const getDoorDashConfigDays = () => {
            const filterArr = [
                {name: "isinactive", operator: search.Operator.IS, values: "F"}
            ];
            let filterInfoArr = getFilterOrColArr(filterArr, "filter");

            const columnArr = [
                {name: "internalid", sort: search.Sort.DESC, outKey: "id"},
                //Days Before Close PO
                {name: "custrecord_days_before_close_po", outKey: "days"}
            ]
            let columnInfoArr = getFilterOrColArr(columnArr);
            let configSearch = search.create({
                type: "customrecord_doordash_configure",
                columns: columnInfoArr ? columnInfoArr.map(columnInfo => columnInfo.colInfo) : [],
                filters: filterInfoArr
            });

            const configData = getSearchData(configSearch, 5, columnInfoArr);
            //Days Before Close PO
            const days = configData && configData.length > 0 && configData[0].days;
            return days;
        }

        const getMatchedData = (daysBeforeClose, pageSize) => {
            if (!daysBeforeClose){
                return "";
            }
            const filterArr = [
                {name: "type", operator: search.Operator.ANYOF, values: "PurchOrd"},
                {name: "type", join: "applyingtransaction", operator: search.Operator.ANYOF, values: ["@NONE@", "ItemRcpt"]},
                //Partially Received
                {name: "status", operator: search.Operator.ANYOF, values: ["PurchOrd:D", "PurchOrd:E"]},
                {name: "mainline", operator: search.Operator.IS, values: "F"},
                {name: "cogs", operator: search.Operator.IS, values: "F"},
                {name: "shipping", operator: search.Operator.IS, values: "F"},
                {name: "closed", operator: search.Operator.IS, values: "F"},
                {name: "formulanumeric", operator: search.Operator.LESSTHANOREQUALTO, values: 0, formula: "{quantityshiprecv} - {quantitybilled}"},
                {name: "formulanumeric", operator: search.Operator.NOTEQUALTO, values: 1, formula: "case when ABS({quantity}) - {quantityshiprecv} = 0 then case when ABS({quantity}) - {quantitybilled} = 0 then 1 else 0 end else 0 end"},
                {name: "formulanumeric", operator: search.Operator.GREATERTHAN, values: daysBeforeClose, formula: "CASE WHEN {applyingtransaction.trandate} is null THEN TO_DATE(TO_CHAR({today} , 'yyyy/mm/dd'), 'yyyy/mm/dd') - TO_DATE(TO_CHAR({expectedreceiptdate} , 'yyyy/mm/dd'), 'yyyy/mm/dd') ELSE TO_DATE(TO_CHAR({today} , 'yyyy/mm/dd'), 'yyyy/mm/dd') - TO_DATE(TO_CHAR({applyingtransaction.trandate} , 'yyyy/mm/dd'), 'yyyy/mm/dd') END"}
            ];
            let filterInfoArr = getFilterOrColArr(filterArr, "filter");

            const columnArr = [
                {name: "internalid", sort: search.Sort.ASC, outKey: "id", summary: search.Summary.GROUP},
                {name: "item", sort: search.Sort.ASC, outKey: "itemId", summary: search.Summary.GROUP},
                {name: "linesequencenumber", sort: search.Sort.ASC, outKey: "lineNo", summary: search.Summary.GROUP},
                // {name: "expectedreceiptdate", outKey: "expDate", summary: search.Summary.GROUP},
                // {name: "formulanumeric", outKey: "diffExpDays", summary: search.Summary.GROUP, formula: "TO_DATE(TO_CHAR({today} , 'yyyy/mm/dd'), 'yyyy/mm/dd') - TO_DATE(TO_CHAR({expectedreceiptdate} , 'yyyy/mm/dd'), 'yyyy/mm/dd')"},
                // {name: "trandate", join: "applyingTransaction", outKey: "recDate", summary: search.Summary.MAX},
                // {name: "formulanumeric", join: "applyingTransaction", outKey: "diffRecDays", summary: search.Summary.MIN, formula: "TO_DATE(TO_CHAR({today} , 'yyyy/mm/dd'), 'yyyy/mm/dd') - TO_DATE(TO_CHAR({applyingtransaction.trandate} , 'yyyy/mm/dd'), 'yyyy/mm/dd')"},
                {name: "formulanumeric", outKey: "diffDays", summary: search.Summary.MIN, formula:"CASE WHEN {applyingtransaction.trandate} is null THEN TO_DATE(TO_CHAR({today} , 'yyyy/mm/dd'), 'yyyy/mm/dd') - TO_DATE(TO_CHAR({expectedreceiptdate} , 'yyyy/mm/dd'), 'yyyy/mm/dd') ELSE TO_DATE(TO_CHAR({today} , 'yyyy/mm/dd'), 'yyyy/mm/dd') - TO_DATE(TO_CHAR({applyingtransaction.trandate} , 'yyyy/mm/dd'), 'yyyy/mm/dd') END"}
            ]
            let columnInfoArr = getFilterOrColArr(columnArr);
            let poLineSearch = search.create({
                type: search.Type.TRANSACTION,
                columns: columnInfoArr ? columnInfoArr.map(columnInfo => columnInfo.colInfo) : [],
                filters: filterInfoArr
            });

            const poData = getSearchData(poLineSearch, pageSize || 5, columnInfoArr);
            return poData;
        }

        const closeItemLine = (poRecord, group, lineNo) => {
            poRecord.setSublistValue({
                sublistId: group,
                fieldId: "isclosed",
                value: true, //"T",
                line: lineNo
            });
        }

        const closePOProcess = (daysBeforeClose, size) => {
            if (!daysBeforeClose){
                return false;
            }
            const matchedPOLineDataArr = getMatchedData(daysBeforeClose, size);
            const dataLength = matchedPOLineDataArr ? matchedPOLineDataArr.length : 0;
            let poRecord = "";
            let lastPoId = "";
            const group = "item";
            if (matchedPOLineDataArr && matchedPOLineDataArr.length > 0){
                for (let index = 0; index < matchedPOLineDataArr.length; index++){
                    if (runtime.getCurrentScript().getRemainingUsage() < 100){
                        return true;
                    }
                    const itemInfo = matchedPOLineDataArr[index];
                    const poId = itemInfo.id;
                    const lineNo = itemInfo.lineNo;
                    // const diffExpDays = itemInfo.diffExpDays;
                    // const diffRecDays = itemInfo.diffRecDays;
                    // const diffDays = diffRecDays || diffExpDays;
                    const diffDays = itemInfo.diffDays;
                    if (diffDays > daysBeforeClose - 1){
                        if (poId != lastPoId){
                            //Submit change. 20 Units
                            poRecord && poRecord.save({
                                ignoreMandatoryFields: true
                            });

                            //10 Units
                            poRecord = record.load({
                                type: record.Type.PURCHASE_ORDER,
                                id: poId
                            });
                            lastPoId = poId;
                        }

                        //Close item line of PO
                        closeItemLine(poRecord, group, lineNo - 1);
                    }
                }
            }

            //20 units
            poRecord && poRecord.save({
                ignoreMandatoryFields: true
            });

            return size > 0 && dataLength >= size ? true : false;
        }
        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            let processContinue = false;
            try{
                const days = getDoorDashConfigDays();
                log.debug("days", days);
                if (days){
                    processContinue = closePOProcess(days, 400);
                }
            } catch (e) {
                log.error({
                    title: "Exception on Close PO!",
                    details: e
                });
            }

            if (processContinue){
                let scriptTask = task.create({taskType: task.TaskType.SCHEDULED_SCRIPT});
                scriptTask.scriptId = runtime.getCurrentScript().id;
                scriptTask.deploymentId = runtime.getCurrentScript().deploymentId;
                scriptTask.submit();
            }
        }

        return {execute}

    });
