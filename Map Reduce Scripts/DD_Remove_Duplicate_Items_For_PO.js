/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search', 'N/runtime', 'N/file', './DoorDashTool', './DD_Constant'],
    (record, search, runtime, file, ddt,
     DD_CONSTANT) => {

        const suiteQL = "SELECT" +
            " poh.id," +
            " poh.tranid," +
            " potl.item iteminternalid," +
            " count(potl.item)," +
            " item.fullname DDID," +
            " listagg(potl.linesequencenumber,',') POLINES," +
            " potl.quantityshiprecv," +
            " potl.quantitybilled," +
            " listagg(irh.id||'|'||irl.linesequencenumber,',') IRPipeLine," +
            " listagg(vbh.id||'|'||vbl.linesequencenumber,',') VBPipeLine" +
            " FROM transactionline potl" +
            " join transaction poh on potl.transaction = poh.id" +
            " left join item on potl.item = item.id" +
            " left join NextTransactionLineLink irlink on irlink.previousdoc = potl.transaction and irlink.previousline = potl.id and irlink.linktype = 'ShipRcpt'" +
            " left join transactionline irl on irlink.nextdoc = irl.transaction and irlink.nextline = irl.id" +
            " left join transaction irh on irl.transaction = irh.id" +
            " left join NextTransactionLineLink vblink on vblink.previousdoc = potl.transaction and vblink.previousline = potl.id and vblink.linktype = 'OrdBill'" +
            " left join transactionline vbl on vblink.nextdoc = vbl.transaction and vblink.nextline = vbl.id" +
            " left join transaction vbh on vbl.transaction = vbh.id" +
            " where poh.type='PurchOrd'" +
            " and poh.id in (6429065)" +
            // 6086668, 6493215, 6429065
            " and potl.custcol_pwc_addedbymuleboolean = 'T'" +
            " and irh.trandate between to_date('11-01-2021', 'MM-DD-YYYY') and to_date('02-28-2022', 'MM-DD-YYYY')" +
            " group by poh.id, poh.tranid, potl.item,item.fullname, potl.quantityshiprecv, potl.quantitybilled" +
            " having count(*) > 1" +
            " order by potl.item";
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
            // try {
                const replacedItem = runtime.getCurrentScript().getParameter({name: "custscript_dd_replaced_item"});
                const searchPO = runtime.getCurrentScript().getParameter({name: "custscript_dd_find_po_by_ir"});
                const searchDuplicateItems = runtime.getCurrentScript().getParameter({name: "custscript_dd_find_out_dup_items_for_po"});
                if (!replacedItem || !searchPO || !searchDuplicateItems){
                    log.debug("Missing required paramter on scirpt deployment", "Please enter/select value for script deployment parameter!");
                    return [];
                }
                const searchPOInstance = searchPO ? search.load({id: searchPO}) : "";
                const poIrInfo = ddt.getInfoForPOIR(searchPOInstance);
                const poIdArr = poIrInfo.poIdArr;
                const irInfo = poIrInfo.irInfo;
                const dateFilter = poIrInfo.dateFilter;
                const uniqueFileName = (dateFilter ? dateFilter + "_" : "") + new Date();
                log.debug("getInputData:poIdArr", poIdArr);
                log.debug("getInputData:irInfo", irInfo);
                log.debug("getInputData:dateFilter", dateFilter);

                const openPeriodInfo = ddt.getOpenAccountPeriodInfo();
                log.debug("getInputData:openPeriodInfo", openPeriodInfo);
                let poInfoArr = [];
                const duplicateItemsSearchInstance = searchDuplicateItems ? search.load({id: searchDuplicateItems}) : "";
                poIdArr && poIdArr.length > 0 && poIdArr.forEach(poIdPerPage => {
                    // po id arr has been separated with size 1000.
                    if (poIdPerPage && poIdPerPage.length > 0){
                        const duplicateItemPO = ddt.getDuplicateItemsForPO(duplicateItemsSearchInstance, poIdPerPage, irInfo, openPeriodInfo, uniqueFileName);
                        const poInfoArrPerPage = Object.values(duplicateItemPO);
                        if (poInfoArrPerPage && poInfoArrPerPage.length > 0){
                            poInfoArr = poInfoArr.concat(poInfoArrPerPage);
                        }
                    }
                });
log.debug("getInputData:poInfoArr.length", poInfoArr.length);
// log.debug("getInputData:poInfoArr", poInfoArr);
                return poInfoArr;
            // }  catch (error) {
            //     log.error("Exception on getInputData", error);
            // }
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
            const poInfo = reduceContext.values && JSON.parse(reduceContext.values);
            const poId = poInfo && poInfo.id;
            // try{
            const updatedInfo = {
                poLineInfo: [],
                irLineInfo: [],
                vbLineInfo: []
            };
            const replacedItem = runtime.getCurrentScript().getParameter({name: "custscript_dd_replaced_item"});
                // const searchPO = runtime.getCurrentScript().getParameter({name: "custscript_dd_find_po_by_ir"});
                // const searchPOInstance = searchPO ? search.load({id: searchPO}) : "";
                if (poId && replacedItem){
                    const duplicateItemIdArr = poInfo.duplicateItemInfo ? Object.keys(poInfo.duplicateItemInfo) : "";
                    log.debug("reduceContext duplicateItemIdArr from poid:" + poId, duplicateItemIdArr);

                    // Porcessing for duplicate items
                    if (duplicateItemIdArr && duplicateItemIdArr.length > 0){
                        // const poIrInfo = ddt.getInfoForPOIR(searchPOInstance, poId);
                        // const irInfo = poIrInfo.irInfo;
                        const irInfo = poInfo.irInfo;
                        const openPeriodInfo = poInfo.openPeriodInfo;
                        const uniqueFileName = poInfo.uniqueFileName;
                        updatedInfo.uniqueFileName = uniqueFileName;
                        // Get matched PO,BILL,RECEIPT info
                        const matchedInfo = ddt.getBillReeciptLineInfo(poId, duplicateItemIdArr, openPeriodInfo, irInfo);
                        // log.debug("reduceContext poLineInfoWithOutScope from poid:" + poId, poLineInfoWithOutScope);
                        // log.debug("reduceContext poLineInfoWithClosedAP from poid:" + poId, poLineInfoWithClosedAP);
                        if (matchedInfo) {
                            // Replaced VB lines first
                            let previousSaveResult = ddt.replacedLinesForVendorBill(matchedInfo, updatedInfo, poId, replacedItem);
                            if (previousSaveResult){
                                // Unreceived IR lines second
                                previousSaveResult = ddt.unreceivedLinesForItemReceipt(matchedInfo, updatedInfo, poId);
                                if (previousSaveResult){
                                    // Removed PO lines last
                                    ddt.removedLinesForPurchaseOrder(matchedInfo, updatedInfo, poId);
                                }
                            }
                        }
                    }
                }

            if (poId && updatedInfo && (updatedInfo.poLineInfo.length > 0 || updatedInfo.vbLineInfo.length > 0 || updatedInfo.irLineInfo.length > 0)) {
                log.debug("Updated poId", poId);
                reduceContext.write({key: poId, value: updatedInfo});
            }
            // } catch (error) {
            //     log.error("Exception on reduce poId:" + poId, error);
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
            try {
                // Usage limit 10000
                let poLineInfoTotalArr = [["", "Date", "PO Name", "PO ID", "Line ID",
                    "SKU Name", "SKU ID", "Quantity", "Rate", "Currency", "Amount", "Base Currency Amount","Removed\n"]];
                let irLineInfoTotalArr = [["", "Date", "IR Name", "IR ID", "IR Line ID",
                    "SKU Name", "SKU Id", "IR Qty", "IR Rate", "Currency", "IR Amount", "Base Currency Amount",
                    "PO Name", "PO Line Id", "PO Qty", "Unreceived\n"]];
                let vbLineInfoTotalArr = [["", "Date", "VB Name", "VB ID", "VB Line ID",
                    "SKU Name", "SKU ID", "VB Qty", "VB Rate", "Currency", "VB Amount", "Base Currency Amount",
                    "PO Name", "PO Line ID", "PO Qty", "Linked IR Num", "Linked IR ID", "Replaced\n"]];
                let uniqueFileName = "";
                summaryContext.output.iterator().each(function (poId, poUpdatedInfo){
                    const poUpdateInfo = poUpdatedInfo && JSON.parse(poUpdatedInfo);
                    if (poUpdateInfo){
                        const poLineInfo = poUpdateInfo.poLineInfo;
                        const irLineInfo = poUpdateInfo.irLineInfo;
                        const vbLineInfo = poUpdateInfo.vbLineInfo;
                        uniqueFileName = poUpdateInfo.uniqueFileName;
                        if (poLineInfo && poLineInfo.length > 0){
                            poLineInfoTotalArr = poLineInfoTotalArr.concat(poLineInfo);
                        }
                        if (irLineInfo && irLineInfo.length > 0){
                            irLineInfoTotalArr = irLineInfoTotalArr.concat(irLineInfo);
                        }
                        if (vbLineInfo && vbLineInfo.length > 0){
                            vbLineInfoTotalArr = vbLineInfoTotalArr.concat(vbLineInfo);
                        }
                    }
                    return true;
                });

                const logFolderId = DD_CONSTANT.DOCUMENT_ID.REMOVE_DUP_ITEMS_LOG_FOLDER;
                // Save removed PO lines info into file
                if (poLineInfoTotalArr.length > 0){
                    ddt.saveCsvFile(DD_CONSTANT.PREFIX.REMOVE_DUP_ITEMS_LOG_PO + "_" + uniqueFileName, poLineInfoTotalArr, logFolderId);
                }
                //  Save unreceived IR lines info into file
                if (irLineInfoTotalArr.length > 0){
                    ddt.saveCsvFile(DD_CONSTANT.PREFIX.REMOVE_DUP_ITEMS_LOG_IR + "_" + uniqueFileName, irLineInfoTotalArr, logFolderId);
                }
                //  Save replaced VB lines info into file
                if (vbLineInfoTotalArr.length > 0){
                    ddt.saveCsvFile(DD_CONSTANT.PREFIX.REMOVE_DUP_ITEMS_LOG_VB + "_" + uniqueFileName, vbLineInfoTotalArr, logFolderId);
                }

                if (summaryContext.inputSummary.error) {
                    log.error('summaryContext.inputSummary.error', summaryContext.inputSummary.error);
                }
            } catch (e) {
                log.error("Exception on summarize", e);
            }

        }

        return {getInputData,
            //map,
            reduce, summarize}

    });
