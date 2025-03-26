/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url', "N/redirect", "N/log", "N/task", 'N/record', './DoorDashTool', "./DD_Constant", 'N/query'],

    (runtime, search, url, redirect, log, task, record, ddt, DD_CONSTANT, query) => {
        'use strict';

        const getMatchedBill = () => {
            const searchId = runtime.getCurrentScript().getParameter({name: "custscript_dd_bills_need_update_search"});
            const searchFromParam = searchId ? search.load({id: searchId}) : "";
            const billsInfo = {};
            if (searchFromParam){
                const columnArr = [
                    {name: "internalid", summary: search.Summary.GROUP, outKey: "id"},
                    {name: "createdfrom", summary: search.Summary.GROUP, outKey: "poId"},
                ]
                let columnInfoArr = ddt.getFilterOrColArr(columnArr);
                let configSearch = search.create({
                    type: search.Type.TRANSACTION,
                    columns: columnInfoArr ? columnInfoArr.map(columnInfo => columnInfo.colInfo) : [],
                    filters: searchFromParam.filters
                });

                const data = ddt.getAllData(configSearch, columnInfoArr);
                log.debug("data length", data.length);
                if (data && data.length > 0){
                    data.forEach(lineInfo => {
                        if (!billsInfo[lineInfo.id]) {
                            billsInfo[lineInfo.id] = {
                                billId: lineInfo.id,
                                poId: lineInfo.poId
                            };
                        }
                    });
                }
            }

            log.debug("billsInfoh", billsInfo);
            return Object.values(billsInfo);
        }

        const getMatchedData = (poId, billId) => {
            if (!poId || !billId){
                return "";
            }
            const matchedBillLineInfo = {};
            const sql= `	
                SELECT
                distinct 
                poHead.tranid as 'po num',
                poHead.type 'po type',
                poline.item 'po item',
                item.itemid 'DDID SKU',
                poline.uniquekey,
                poline.quantity,
                poline.quantitybilled 'bill qty',
                poline.quantityshiprecv 'receipt qty',
                poline.transaction as 'PO ID',
                irBillLine.transaction as 'ir vb id',
                irBillHead.transactionnumber as 'ir vb num',
                irBillHead.type  'ir vb type',
                irBillHead.custbody_dd_created_by_edi_script 'from edi',
                irBillLine.item 'ir vb item',
                irBillLine.uniquekey 'ir vb uniquekey',
                irBillLine.quantity 'ir vb qty',
                journalLne.transaction as 'vb id',
                JournalHead.transactionnumber as 'vb num',
                JournalHead.type  'vb type',
                journalLne.item 'vb item',
                journalLne.uniquekey 'vb uniquekey',
                journalLne.quantity 'vb qty'
                FROM
                transactionLine poline
                inner join transaction poHead on poHead.id = poline.transaction
                inner join item item on item.id = poline.item
                left join NextTransactionLineLink nextVbIr on nextVbIr.previousdoc = poline.transaction and nextVbIr.previousline = poline.id
                left join transactionline irBillLine on nextVbIr.nextdoc = irBillLine.transaction and nextVbIr.nextline = irBillLine.id
                right join transaction irBillHead on irBillHead.id = irBillLine.transaction
                left join NextTransactionLineLink nextJournal on nextJournal.previousdoc = irBillLine.transaction and nextJournal.previousline = irBillLine.id and nextJournal.linktype = 'RcptBill'
                left join transactionline journalLne on nextJournal.nextdoc = journalLne.transaction and nextJournal.nextline = journalLne.id
                left join transaction JournalHead on JournalHead.id = journalLne.transaction
                WHERE
                poHead.id = ${poId}
                AND (irBillHead.id = ${billId} or irBillHead.type = 'ItemRcpt')
                AND poline.mainline = 'F'
                AND irBillLine.mainline = 'F'
                ORDER BY 'po num', poline.item, irBillHead.type, irBillLine.transaction
	        `;

            const result = query.runSuiteQL( { query: sql, params: [] } ).asMappedResults();
            const poLineLinkedIrInfo = {};
            const correspondingPoLineInfo = {};
            const currentBillLineInfoArr = [];
            result && result.length > 0 && result.forEach(lineInfo => {
                const poItemUniqueKey = lineInfo["uniquekey"];
                const irVbId = lineInfo["ir vb id"];
                const vbId = lineInfo["vb id"];
                // const fromEDI = lineInfo["from edi"];
                if (lineInfo["ir vb type"] == "VendBill") {
                    // current Bill
                    currentBillLineInfoArr.push(lineInfo);
                    correspondingPoLineInfo[poItemUniqueKey] = true;
                }
                if (lineInfo["ir vb type"] == "ItemRcpt") {
                    // PO corresponding receipts that had be linked to bill
                    if (!poLineLinkedIrInfo[poItemUniqueKey]) {
                        poLineLinkedIrInfo[poItemUniqueKey] = {}
                    }
                    const poItemLinkedInfo = poLineLinkedIrInfo[poItemUniqueKey];
                    const linkedStatus = vbId ? "beUsed" : "unused";
                    if (!poItemLinkedInfo[linkedStatus]) {
                        poItemLinkedInfo[linkedStatus] = {
                            irIdArr: [],
                            irLinInfo: []
                        }
                    }
                    poItemLinkedInfo[linkedStatus].irIdArr.push(irVbId);
                    poItemLinkedInfo[linkedStatus].irLinInfo.push(lineInfo);
                }
            });

            if (poLineLinkedIrInfo && Object.values(poLineLinkedIrInfo).length > 0) {
                currentBillLineInfoArr && currentBillLineInfoArr.length > 0 && currentBillLineInfoArr.forEach(lineInfo => {
                    const poItemUniqueKey = lineInfo["uniquekey"];
                    if (correspondingPoLineInfo[poItemUniqueKey]) {
                        // current item receipt corresponding bills
                        const billId = lineInfo["ir vb id"];
                        const billItemUniqueKey = lineInfo["ir vb uniquekey"];
                        let usedLinkedIrArr = [];
                        if (poLineLinkedIrInfo[poItemUniqueKey]) {
                            usedLinkedIrArr = poLineLinkedIrInfo[poItemUniqueKey].unused && poLineLinkedIrInfo[poItemUniqueKey].unused.irIdArr;
                        }
                        if (billId && !matchedBillLineInfo[billId]) {
                            matchedBillLineInfo[billId] = {
                                id: billId,
                                processed: false,
                                lineInfo: {}
                            };
                        }
                        const billLineInfo = matchedBillLineInfo[billId].lineInfo;
                        billLineInfo[billItemUniqueKey] = {
                            uniqueKey: billItemUniqueKey,
                            irIdArr: usedLinkedIrArr
                        }
                    }
                });
            }

            return matchedBillLineInfo;
        }

        const correctReceipt = (vendorBill, matchedBillInfo) => {
            let haveAnyChange = false;
            if (vendorBill && matchedBillInfo && !matchedBillInfo.processed) {
                const group = "item";
                const numLines = vendorBill.getLineCount({
                    sublistId: group
                });
                if (numLines && numLines > 0){
                    for (let index = 0; index < numLines; index++){
                        const lineUniqueKey = vendorBill.getSublistValue({sublistId: group, fieldId: "lineuniquekey", line: index});
                        // Find corresponding bill lines
                        if (matchedBillInfo && matchedBillInfo.lineInfo && matchedBillInfo.lineInfo[lineUniqueKey]) {
                            const receiptsArr = vendorBill.getSublistValue({sublistId: group, fieldId: "billreceipts", line: index}) || [];
                            if (!receiptsArr || receiptsArr.length < 1) {
                                vendorBill.setSublistValue({sublistId: group, fieldId: "billreceipts", value: matchedBillInfo.lineInfo[lineUniqueKey].irIdArr, line: index});
                                haveAnyChange = true;
                            }
                        }
                    }
                    matchedBillInfo.processed = true;
                }
            }

            return haveAnyChange;
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
                let billInfoArr = getMatchedBill();
                // log.debug("billInfoArr", billInfoArr);
                // log.debug("Bill Counts", billInfoArr.length);
                // Get search result and pass it to map entry point.
                return billInfoArr;
            }catch (e) {
                log.debug("Exception on getInputData event", e);
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
            const billInfo = mapContext.value && JSON.parse(mapContext.value);
            const billId = billInfo.billId;
            const poId = billInfo.poId;

            // Usage limit 1000
            try {
                // update po
                if (billId && poId){
                    const matchedBillLineInfo = getMatchedData(poId, billId);
                    // log.debug("matchedBillLineInfo billId:" + billId , matchedBillLineInfo);
                    if (matchedBillLineInfo) {
                        for (const billId in matchedBillLineInfo) {
                            const billInfo = matchedBillLineInfo[billId];
                            if (!billInfo.processed) {
                                const billRec = record.load({type: record.Type.VENDOR_BILL, id: billId});
                                const haveAnyChange = correctReceipt(billRec, billInfo);
                                haveAnyChange && billRec.save({ignoreMandatoryFields: true});
                                log.audit(`billId: ${billId}`,`poid: ${poId}`);
                            }
                        }
                    }
                }
            } catch (e) {
                log.error(`Exception on map event billId: ${billId}, poid: ${poId}`, e);
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
        }

        return {getInputData, map, reduce, summarize}

    });
