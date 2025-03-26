/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/log', 'N/record', 'N/runtime', 'N/search', 'N/format', './DoorDashTool', './DD_Constant'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */
    (log, record, runtime, search, format, ddt, DD_CONSTANT) => {
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
            const irInfo = getMatchedData();
            // log.debug("getInputData irInfo", irInfo);
            const irInfoArr = Object.values(irInfo);
            return irInfoArr;
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
                const irInfo = mapContext.value && JSON.parse(mapContext.value);
                // log.debug("map irInfo", irInfo);
                if (irInfo && irInfo.poId && irInfo.irId){
                    const poId = irInfo.poId;
                    const poLineIdArr = [];
                    log.debug("map poId", poId);
                    //Transform vendor bill and set quantity 0 for vendor bill
                    const vendorBillRec = record.transform({fromType: record.Type.PURCHASE_ORDER,
                        fromId: poId, toType: record.Type.VENDOR_BILL});
                    const irTranId = irInfo.irDoc;
                    const vendorBillTranId = "CLEAR" + irTranId + "_" + formatDate(new Date(), "md");
                    vendorBillRec.setValue({fieldId: "tranid", value: vendorBillTranId});
                    const group = "item";
                    let lineCounts = vendorBillRec.getLineCount({sublistId: group});
                    // clear item lines
                    for (let lineNo = lineCounts - 1; lineNo >= 0; lineNo--){
                        vendorBillRec.removeLine({sublistId: group, line: lineNo});
                    }
                    // billing item receipt lines
                    if (irInfo.lineInfo) {
                        let line = 0;
                        for (const poLineId in irInfo.lineInfo) {
                            poLineIdArr.push(poLineId);
                            const irLineInfo = irInfo.lineInfo[poLineId];
                            // const conversionRate = irLineInfo.conversionRate;
                            vendorBillRec.setSublistValue({sublistId: group, fieldId: "item", value: irLineInfo.itemId, line: line});
                            irLineInfo.unitId && vendorBillRec.setSublistValue({sublistId: group, fieldId: "units", value: irLineInfo.unitId, line: line});
                            vendorBillRec.setSublistValue({sublistId: group, fieldId: "quantity", value: irLineInfo.uomQty || "", line: line});
                            vendorBillRec.setSublistValue({sublistId: group, fieldId: "rate", value: 0, line: line});
                            irLineInfo.location && vendorBillRec.setSublistValue({sublistId: group, fieldId: "location", value: irLineInfo.location, line: line});
                            vendorBillRec.setSublistValue({sublistId: group, fieldId: DD_CONSTANT.CUSTOM_FIELD_ID.CSEG_COST_CENTER,
                                value: DD_CONSTANT.FIELD_VALUE.DEFAULT_CESG_COST_CENTER_ID, line: line});
                            // link to PO item
                            vendorBillRec.setSublistValue({sublistId: group, fieldId: "orderdoc", value: poId, line: line});
                            vendorBillRec.setSublistValue({sublistId: group, fieldId: "orderline", value: poLineId, line: line++});
                        }
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

                    // mapContext.write({key: poId, value: poLineIdArr});
                }
            }catch (e) {
                log.error("Exception on Map entry point", e);
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
            // close PO line
            // try{
            //     const poId = reduceContext.key;
            //     log.debug("reduce poId", poId);
            //     const poLineIdArr = reduceContext.values;
            //     log.debug("reduce poLineIdArr", poLineIdArr);
            //     if (poId && poLineIdArr && poLineIdArr.length > 0){
            //         const poLineIdInfo = {};
            //         poLineIdArr.forEach(poIdArrStr => {
            //             const lineIdArr = JSON.parse(poIdArrStr);
            //             lineIdArr && lineIdArr.length > 0 && lineIdArr.forEach(poLineId => {
            //                 poLineIdInfo[poLineId] = true;
            //             });
            //         });
            //
            //         //close PO corresponding line
            //         const group = "item";
            //         const poRec = record.load({type: record.Type.PURCHASE_ORDER, id: poId});
            //         let poLineCounts = poRec.getLineCount({sublistId: group});
            //         for (let lineNo = 0; lineNo < poLineCounts; lineNo++) {
            //             const lineId = poRec.getSublistValue({sublistId: group, fieldId: "line", line: lineNo});
            //             if (poLineIdInfo[lineId]) {
            //                 poRec.setSublistValue({sublistId: group, fieldId: "isclosed", value: true, line: lineNo});
            //             }
            //         }
            //         poRec.save({ignoreMandatoryFields: true});
            //     }
            // }catch (e) {
            //     log.error("Exception on Reduce entry point", e);
            // }
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

        const getMatchedData = () => {
            // Using Netsuite SavedSearch
            const irSavedSearchId = runtime.getCurrentScript().getParameter({name: "custscript_dd_ir_savedsearch"});
            if (!irSavedSearchId) {
                log.audit("Blank parameter", "Please set value for script deployment parameter 'IR SEARCH NEEDED'");
                return {};
            }
            const irSavedSearch = irSavedSearchId ? search.load({type: search.Type.ITEM_RECEIPT, id: irSavedSearchId}) : "";
            if (!irSavedSearch) {
                return {};
            }
            const columnArr = [
                {name: "internalid", sort: search.Sort.ASC, outKey: "irId"},
                {name: "tranid", outKey: "irDoc"},
                {name: "item", outKey: "itemId"},
                {name: "unitstype", join: "item", outKey: "primaryUT"},
                {name: "unit", outKey: "unitName"},
                {name: "quantityuom", outKey: "uomQty"},
                {name: "quantity", outKey: "qty"},
                {name: "location", outKey: "location"},
                {name: "appliedtotransaction", outKey: "poId"},
                {name: "line", join: "appliedtotransaction", outKey: "poLineId"},
                {name: "quantity", join: "appliedtotransaction", outKey: "poQty"},
                {name: "quantitybilled", join: "appliedtotransaction", outKey: "billedQty"}
            ];
            let columnInfoArr = ddt.getFilterOrColArr(columnArr);
            let irSearch = search.create({
                type: search.Type.TRANSACTION,
                columns: columnInfoArr ? columnInfoArr.map(columnInfo => columnInfo.colInfo) : [],
                filters: irSavedSearch.filters,
            });

            const irData = ddt.getAllData(irSearch, columnInfoArr);
            // log.debug("getMatchedData irData", irData);
            let irDataInfo = {};
            if (irData && irData.length > 0) {
                const unitTypeMappingInfo = ddt.getNetsuiteUnitTypeInfo();
                irData.forEach(irLineInfo => {
                    const irId = irLineInfo.irId;
                    const poId = irLineInfo.poId;
                    const poLineId = irLineInfo.poLineId;
                    const unitTypeId = irLineInfo.primaryUT;
                    const unitName = irLineInfo.unitName;
                    const unitInfo = unitTypeMappingInfo[unitTypeId] && unitTypeMappingInfo[unitTypeId][unitName];
                    const unitId = unitInfo ? unitInfo.id : "";
                    const conversionRate = unitInfo ? unitInfo.conversionrate : "";
                    const irQty = irLineInfo.qty;
                    const poQty = irLineInfo.poQty;
                    const billedQty = irLineInfo.billedQty;
                    let pendingBillQty = Number(poQty) - Number(billedQty);
                    // pendingBillQty = pendingBillQty > 0 ? Math.min([pendingBillQty, irQty]) : 0;
                    if (!irDataInfo[irId]){
                        irDataInfo[irId] = {
                            irId: irId,
                            irDoc: irLineInfo.irDoc,
                            poId: poId,
                            lineInfo: {}
                        }
                    }
                    const lineInfo = irDataInfo[irId].lineInfo;
                    lineInfo[poLineId] = {
                        irId: irId,
                        irDoc: irLineInfo.irDoc,
                        poId: poId,
                        poLineId: poLineId,
                        itemId: irLineInfo.itemId,
                        primaryUT: irLineInfo.primaryUT,
                        unitName: irLineInfo.unitName,
                        unitId: unitId,
                        conversionRate: conversionRate,
                        uomQty: irLineInfo.uomQty,
                        qty: irQty,
                        poQty: poQty,
                        billedQty: billedQty,
                        pendingBillQty: pendingBillQty,
                        pendingBillUomQty: conversionRate ? pendingBillQty / unitInfo.conversionrate : "",
                        location: irLineInfo.location
                    }
                });
            }

            return irDataInfo;
        }

        /**
         * Date object to string of date with specify format
         * @param {*} oDate                           Date Thu Mar 31 2022 16:14:07
         * @param {*} sDestinationFormatPattern       yyyy|mm|dd
         * @param {*} bNoPrefixZero
         * @returns                                   2022|03|31
         */
        const formatDate = (oDate, sDestinationFormatPattern, bNoPrefixZero) => {
            if (!oDate){
                return "";
            }
            const oDateMethodInfo = { y: "getFullYear", m: "getMonth", d: "getDate", h: "getHours", f: "getMinutes", s: "getSeconds", i: "getMilliseconds"};
            sDestinationFormatPattern = sDestinationFormatPattern.replace(/(?<!\\)(y+|m+|d+|h+|f+|s+|i+)/ig, function ($1){
                let dateComponentValue = oDate[oDateMethodInfo[$1.charAt().toLowerCase()]].apply(oDate);
                dateComponentValue = /m/i.test($1.charAt()) ? dateComponentValue + 1 : dateComponentValue;
                return /y/i.test($1.charAt().toLowerCase()) ? dateComponentValue : (bNoPrefixZero || /i/i.test($1.charAt()) ? Number(dateComponentValue) : ("00" + dateComponentValue).substr(-2));
            }).replace(/\\([ymdhfsi])/ig, ($1, $2) => $2);

            return sDestinationFormatPattern;
        }

        return {getInputData, map, reduce, summarize}

    });
