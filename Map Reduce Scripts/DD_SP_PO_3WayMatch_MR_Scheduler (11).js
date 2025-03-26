/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define([
        'N/record',
        'N/search',
        'N/runtime',
        'N/format'
    ],
    (record, search, runtime, format) => {

        let variancerray2 = [];

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

            // try
            try {

                // read the saved search from the parameters
                let shortPayPurchaseOrderSavedSearchId= runtime.getCurrentScript().getParameter({ name: 'custscript_dd_sp_po_search' });

                // log
                log.debug('getInputData: shortPayPurchaseOrderSavedSearchId: ', shortPayPurchaseOrderSavedSearchId);

                // if there is no search result found then return
                if (!shortPayPurchaseOrderSavedSearchId) return true;

                // load the search and process top 200 records
                var shortPaySearchObj = search.load({ id: shortPayPurchaseOrderSavedSearchId });

                // get records
                var shortPaySearchObjArray = shortPaySearchObj.run().getRange(0, 999);
                var shortPayBillPurchaseOrdersArray = [];

                for (var i = 0; i < shortPaySearchObjArray.length; i++) {
                    // for (var i = 0; i < 3; i++) {

                    // get po internal id
                    var poInternalIdNumber = shortPaySearchObjArray[i].getValue({ name: 'createdfrom', summary: 'GROUP', label: 'Created From' });

                    // read and push purchase order internal id's
                    if (poInternalIdNumber) shortPayBillPurchaseOrdersArray.push(poInternalIdNumber);
                }

                // log
                log.debug('getInputData: shortPayBillPurchaseOrdersArray', shortPayBillPurchaseOrdersArray);

                // load the search and return the data to next stage
                return shortPayBillPurchaseOrdersArray;

            } catch (error) {

                // TODO: log error lines if there are any in between errors found
                // log
                log.error('getInputData: error: ', error);
                log.error('getInputData: error stack trace: ', JSON.stringify(error));
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

            // try
            try {

                // log
                log.debug('map: mapContext: ', mapContext);

                // read the internal id of each purchase order and run shortpay process
                var purchaseOrderIdVal = mapContext.value;

                // log
                log.debug('map: purchaseOrderIdVal: ', purchaseOrderIdVal);

                // if there is no purchase order id found then return
                if (!purchaseOrderIdVal) return true;

                // check short pay enabled date with all bills
                var validShortPayEnabledDate = checkShortPayEnabledDate(purchaseOrderIdVal);

                // log
                log.debug('validShortPayEnabledDate: ', validShortPayEnabledDate);

                // if no bill date falls under po vendor short pay go live date
                if (!validShortPayEnabledDate) return true;

                // get all purchase order related bills and approve it
                var billsArray = getBills(purchaseOrderIdVal);
                var relatedBillsArray = getAllRelatedBills(purchaseOrderIdVal);

                // log
                log.debug('map: relatedBillsArray', relatedBillsArray);
                log.debug('map: billsArray', billsArray);

                if (!billsArray[0]) return true;
                var vendorBillInternalId = billsArray[0];

                // log
                log.debug('map: vendorBillInternalId: ', vendorBillInternalId);

                // approve all bills
                approveAllBills(relatedBillsArray);
                approveAllBills(relatedBillsArray);

                // process shortpay on the purchase order
                // processShortPay(purchaseOrderIdVal, vendorBillInternalId);
                mapContext.write({ key: vendorBillInternalId, value: purchaseOrderIdVal });
            } catch (error) {

                // TODO: log error lines if there are any in between errors found
                // log
                log.error('map: error: ', error);
                log.error('map: error stack trace: ', JSON.stringify(error));
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

                // process tagging lines
                // TODO: Bill Tagging will comes here to control the high load

                // log
                log.audit('reduce: reduceContext', reduceContext);

                var vendorBillInternalId = reduceContext.key;
                var purchaseOrderInternalId = reduceContext.values[0];

                // load the configuration record
                var shortPayConfigurationsPageRec = record.load({type: 'customrecord_shortpay_configuration_page', id: 1 });
                var vendorArray = shortPayConfigurationsPageRec.getValue('custrecord_vendors_ir_72_hours');
                var vendorArray96 = shortPayConfigurationsPageRec.getValue('custrecord_vendors_ir_96_hours');
                var vendorArray120 = shortPayConfigurationsPageRec.getValue('custrecord_vendors_ir_120_hours');
                var vendorArrayWeekends = shortPayConfigurationsPageRec.getValue('custrecord_exclude_sat_sun__for_vendords');
                log.debug('reduce: vendorArray', vendorArray);
                log.debug('reduce: vendorArray96', vendorArray96);
                log.debug('reduce: vendorArray120', vendorArray120);

                // log
                log.audit('reduce: vendorBillInternalId', vendorBillInternalId);
                log.audit('reduce: purchaseOrderInternalId', purchaseOrderInternalId);

                // item receipt condition
                var IRDateFlag = false;

                // to check is within item receipt condition or not
                var fieldLookUp = search.lookupFields({ type: 'vendorbill', id: vendorBillInternalId,
                    columns: [ 'vendor.custentity_dd_edi_shortpay_enabled', 'createdfrom.custbody_dd_3way_match_comp_flag', 'createdfrom.custbody_receiptfailure', 'createdfrom', 'vendor.custentity_paymentblocker', 'entity' ]
                });
                var VendorBypassRej = fieldLookUp['vendor.custentity_paymentblocker'];
                var vendorVal = fieldLookUp['entity'][0].value;
                log.debug('vendorVal=====', vendorVal);

                var POfieldLookUp = search.lookupFields({
                    type: 'purchaseorder',
                    id: purchaseOrderInternalId,
                    columns: ['approvalstatus','status']
                });

                var POApprovalStatus = POfieldLookUp['approvalstatus'];
                // log.debug('POApprovalStatus '+POApprovalStatus[0].value,'VendorBypassRej '+VendorBypassRej);
                // if(POApprovalStatus[0].value == 3 && VendorBypassRej == false)
                if(POApprovalStatus[0].value == 3)
                {
                    log.debug('from line 61');
                    IRDateFlag = true;
                }
                var itemreceiptSearchObj = search.create({
                    type: 'itemreceipt',
                    filters: [
                        [ 'type', 'anyof', 'ItemRcpt' ], 'AND',
                        [ 'createdfrom', 'anyof', purchaseOrderInternalId ], 'AND',
                        [ 'mainline', 'is', 'T' ]
                    ],
                    columns: [
                        // search.createColumn({ name: 'datecreated', sort: search.Sort.ASC, label: 'Date Created' }),
                        search.createColumn({ name: 'trandate', sort: search.Sort.ASC, label: 'Date' }),
                    ]
                })
                var date_arr = [];
                var searchResultCount = itemreceiptSearchObj.runPaged().count;
                log.debug('searchResultCount ',searchResultCount);
                if (searchResultCount > 0) {
                    itemreceiptSearchObj.run().each(function (result) {
                        date_arr.push({ 'date': result.getValue({ name: 'trandate', sort: search.Sort.ASC, label: 'Date' }) });
                        return true;
                    });
                    var oldIRDate = date_arr[0].date;
                    log.debug('oldIRDate',oldIRDate);
                    log.debug('date_arr',date_arr);
                    oldIRDate = format.parse({value:oldIRDate, type: format.Type.DATE})
                    var dateDiff = new Date() - oldIRDate;
                    var dateDifferenceInDays = Math.floor(dateDiff / (1000 * 60 * 60 * 24));
                    log.debug('actual dateDifferenceInDays ',dateDifferenceInDays);
                    log.debug('vendorArray.indexOf(vendorVal)',vendorArray.indexOf(vendorVal));
                    log.debug('vendorArray120.indexOf(vendorVal)',vendorArray120.indexOf(vendorVal));

                    // read the vendors from sat and sun check, if exists then compare the below
                    if (vendorArrayWeekends.indexOf(vendorVal) != -1) {

                        var creationDate = oldIRDate;
                        var today = new Date();
                        var creationDateUTC = new Date(creationDate.getFullYear(), creationDate.getMonth(), creationDate.getDate());
                        var todayUTC = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                        var saturdayCount = 0;
                        var sundayCount = 0;
                        var currentDate = new Date(creationDateUTC);

                        while (currentDate <= todayUTC) {
                            if (currentDate.getDay() === 6) { saturdayCount++; }
                            else if (currentDate.getDay() === 0) { sundayCount++; }
                            currentDate.setDate(currentDate.getDate() + 1);
                        }

                        // date difference in days, minus saturdays and sundays
                        dateDifferenceInDays = dateDifferenceInDays - (saturdayCount + sundayCount);
                        log.debug('exclude weekend dateDifferenceInDays ',dateDifferenceInDays);
                    }

                    if(dateDifferenceInDays >= 2 && vendorArray.indexOf(vendorVal) == -1 && vendorArray120.indexOf(vendorVal) == -1 && vendorArray96.indexOf(vendorVal) == -1) IRDateFlag = true;
                    if(dateDifferenceInDays >= 3 && vendorArray.indexOf(vendorVal) != -1 && vendorArray120.indexOf(vendorVal) == -1 && vendorArray96.indexOf(vendorVal) == -1) IRDateFlag = true;
                    if(dateDifferenceInDays >= 4 && vendorArray96.indexOf(vendorVal) != -1 && vendorArray.indexOf(vendorVal) == -1 && vendorArray120.indexOf(vendorVal) == -1) IRDateFlag = true;
                    if(dateDifferenceInDays >= 5 && vendorArray120.indexOf(vendorVal) != -1 && vendorArray.indexOf(vendorVal) == -1 && vendorArray96.indexOf(vendorVal) == -1) IRDateFlag = true;
                }
                log.debug('IRDateFlag ',IRDateFlag);

                // load the purchase order and read the status
                var isPORejected = getPOStatus(purchaseOrderInternalId);
                log.debug('reduce: isRejctedPO', isPORejected);

                // read accurate pay reason code
                var vendorBillObjArr = search.create({
                    type: "vendorbill",
                    filters:
                        [
                            ["type","anyof","VendBill"],
                            "AND",
                            ["internalidnumber","equalto",vendorBillInternalId],
                            "AND",
                            ["mainline","is","T"]
                        ],
                    columns:
                        [
                            search.createColumn({
                                name: "custentity_accurate_pay_reason_code",
                                join: "vendor"
                            })
                        ]
                }).run().getRange(0,1);
                var reasonCodeObj = { accuratePayReasonCodeId: vendorBillObjArr[0].getValue({
                        name: "custentity_accurate_pay_reason_code",
                        join: "vendor"
                    }), accuratePayReasonCodeText: vendorBillObjArr[0].getText({
                        name: "custentity_accurate_pay_reason_code",
                        join: "vendor"
                    }) }

                // if po is rejected then
                if (isPORejected) {

                    log.debug('reduce:  from isRejctedPO', isPORejected);
                    // log.debug('reduce:  from VendorBypassRej', VendorBypassRej);
                    // if (!VendorBypassRej) {
                    createVendorCreditRecord(purchaseOrderInternalId, vendorBillInternalId, reasonCodeObj);
                    // } else {
                    // log.debug('By passing rejected po: ');
                    // }
                } else if (IRDateFlag) {

                    log.debug('reduce:  from processShortpay');
                    // process shortpay
                    processShortPay(purchaseOrderInternalId, vendorBillInternalId, reasonCodeObj);
                } else {

                    // log
                    log.debug('reduce: purchase order not processed', purchaseOrderInternalId);
                }
                var scriptObj = runtime.getCurrentScript();
                // log.debug('Remaining governance units: ', scriptObj.getRemainingUsage());
            } catch(error) {
                log.error('reduce: error detail: ', error);
            }
        }

        function getMuleItem(mule_item_array, item_id) {
            log.debug("getMuleItem: mule_item_array===", mule_item_array);
            log.debug("getMuleItem: item_id", item_id);
            var poQuantityVal = 0;
            var poReceivedQtyVal = 0;
            var poBilledQtyVal = 0;

            // loop through mule item array and add the item quantities
            for (var i = 0; i < mule_item_array.length; i++) {
                var itemId = mule_item_array[i].itemId;
                if (itemId == item_id) {
                    // add
                    poQuantityVal = poQuantityVal + parseFloat(mule_item_array[i].itemQuantity);
                    poReceivedQtyVal = poReceivedQtyVal + parseFloat(mule_item_array[i].quantityReceived);
                    poBilledQtyVal = poBilledQtyVal + parseFloat(mule_item_array[i].quantityBilled);
                }
            }

            return { itemId: item_id, poQuantity: poQuantityVal, poReceivedQty: poReceivedQtyVal, poBilledQty: poBilledQtyVal }
        }

        function createVendorCreditRecord(purchase_order_internal_id, vendor_bill_internal_id) {

            // get the total bill value
            var vendorbillSearchObj = search.create({
                type: "vendorbill",
                filters:
                    [
                        ["type","anyof","VendBill"],
                        "AND",
                        ["createdfrom","anyof",purchase_order_internal_id],
                        "AND",
                        ["mainline","is","T"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "amount",
                            summary: "SUM"
                        }),
                        search.createColumn({
                            name: "total",
                            summary: "SUM"
                        })
                    ]
            }).run().getRange(0,1);

            if (!vendorbillSearchObj[0]) return true;
            var vendorBillTotalVal = vendorbillSearchObj[0].getValue({
                name: "total",
                summary: "SUM"
            });
            log.debug('createVendorCreditRecord: vendorBillTotalVal', vendorBillTotalVal);
            // load the configuration record
            var shortPayConfigurationsPage = record.load({type: 'customrecord_shortpay_configuration_page', id: 1 });
            var rejectedPOItem = shortPayConfigurationsPage.getValue('custrecord_rejected_po_item');

            // load the purchase order and read the memo field value
            var poRecObj = record.load({ type: 'purchaseorder', id: purchase_order_internal_id });
            var memoVal = poRecObj.getValue('memo');

            var vendorCreditObjRecord2 = record.transform({ fromType: 'vendorbill', fromId: vendor_bill_internal_id, toType: 'vendorcredit', isDynamic: true });
            removeVendorCreditLines(vendorCreditObjRecord2);
            vendorCreditObjRecord2.selectNewLine({ sublistId: 'item' });
            vendorCreditObjRecord2.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: rejectedPOItem });
            vendorCreditObjRecord2.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
            // vendorCreditObjRecord2.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: variance_array[lineNumber].rateDifference });
            vendorCreditObjRecord2.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: memoVal });
            vendorCreditObjRecord2.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: vendorBillTotalVal });
            vendorCreditObjRecord2.commitLine({ sublistId: 'item' });

            var billToApply = getVendorBillToAppy(purchase_order_internal_id, vendorBillTotalVal);

            // log
            log.audit('createVendorCreditRecord: vendorCreditAmountVal: ', vendorBillTotalVal);
            log.audit('createVendorCreditRecord: billToApply: ', billToApply);

            // loop through apply and apply the vendor credit value
            for (var lineNumber2 = 0; lineNumber2 < vendorCreditObjRecord2.getLineCount({ sublistId: 'apply' }); lineNumber2++) {

                // select line
                vendorCreditObjRecord2.selectLine({ sublistId: 'apply', line: lineNumber2 });

                // get vendor bill internal id
                var i_vendorId = vendorCreditObjRecord2.getCurrentSublistValue({ sublistId: 'apply', fieldId: 'internalid' });

                if (i_vendorId == billToApply) {
                    log.audit('i_vendorId', i_vendorId);
                    log.audit('billToApply', billToApply);
                    vendorCreditObjRecord2.setCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        value: true
                    });
                    vendorCreditObjRecord2.setCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'amount',
                        value: vendorBillTotalVal
                    });
                    vendorCreditObjRecord2.commitLine({
                        sublistId: 'apply'
                    });
                    break;
                }
            }

            // set created from shortpay as true
            vendorCreditObjRecord2.setValue('custbody_created_from_shortpay', true);
            vendorCreditObjRecord2.setValue('custbody_dd_created_by_edi_script', false);

            // load the purchase order and read po reference number
            var poObj = record.load({ type: 'purchaseorder', id: purchase_order_internal_id });
            vendorCreditObjRecord2.setValue('custbody_dd_purchase_order_reference', poObj.getValue('tranid'));
            vendorCreditObjRecord2.setValue('custbody_credit_applies_to_bill', billToApply);

            log.debug('check the line items length', vendorCreditObjRecord2.getLineCount({ sublistId: 'item' }));

            // save the record
            var vendorCreditInternalIdVal = vendorCreditObjRecord2.save({ ignoreMandatoryFields: true, enableSourcing: true});
            log.debug('createVendorCreditRecord: vendor credit created for rejected PO', vendorCreditInternalIdVal);

            if (vendorCreditInternalIdVal) {
                record.submitFields({
                    type: record.Type.PURCHASE_ORDER,
                    id: purchase_order_internal_id,
                    values: {
                        'custbody_dd_3way_match_comp_flag': true
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
                record.submitFields({
                    type: record.Type.VENDOR_BILL,
                    id: vendor_bill_internal_id,
                    values: {
                        'custbody_created_from_shortpay': true
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            }
        }

        function getPOStatus(purchase_order_internal_id) {
            var poSearchArray = search.create({
                type: "purchaseorder",
                filters:
                    [
                        ["type","anyof","PurchOrd"],
                        "AND",
                        ["approvalstatus","anyof","3"],
                        "AND",
                        ["internalidnumber","equalto",purchase_order_internal_id],
                        "AND",
                        ["mainline","is","T"]
                    ],
                columns: []
            }).run().getRange(0,1);
            if (!poSearchArray[0]) return false;
            return true;
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

            return true;
        }

        /**
         * process shortpay on purchase orders
         * @param purchase_order_internal_id
         */
        const processShortPay = (purchase_order_internal_id, vendor_bill_internal_id, reason_code_obj) => {

            // load the configuration record
            var shortPayConfigurationsPage = record.load({type: 'customrecord_shortpay_configuration_page', id: 1 });

            // read all the values from shortpay configuration page
            var itemShortShipId = shortPayConfigurationsPage.getValue('custrecord_item_qty_shortship');
            var itemPriceHigherId = shortPayConfigurationsPage.getValue('custrecord_item_amt_overage');
            var itemPriceLowerId = shortPayConfigurationsPage.getValue('custrecord_item_amount_low');
            var itemOverShipId = shortPayConfigurationsPage.getValue('custrecord_item_qty_overship');
            var itemDiscountId = shortPayConfigurationsPage.getValue('custrecord_item_discount');
            var itemNotOnPOUS = shortPayConfigurationsPage.getValue('custrecord_item_not_on_po_us');
            var itemCategoriesArray = shortPayConfigurationsPage.getValue('custrecord_exclude_items_with_categories');
            log.debug('reduce: itemCategoriesArray', itemCategoriesArray);
            var isAllowAllItems = false;
            var poTranIdVal = '';

            // allow all items or not
            if (reason_code_obj.accuratePayReasonCodeId == '') {
                isAllowAllItems = true;
            }
            log.debug('isAllowAllItems', isAllowAllItems);
            log.debug('reason_code_obj', reason_code_obj);

            // initiate variances array
            let varianceArray = [];
            let discountArray = [];
            let discountArray2 = [];
            let muleLinesArray = [];
            let muleLinesItemIdsArray = [];
            let muleMainItemsArray = [];

            // get all bills
            var relatedBillsArray2 = getAllRelatedBills2(purchase_order_internal_id);
            log.debug('relatedBillsArray2', relatedBillsArray2);
            var vendorbillSearchObj = search.create({
                type: "vendorbill",
                filters:
                    [
                        ["type","anyof","VendBill"],
                        "AND",
                        ["item","anyof","119904","90525"],
                        "AND",
                        ["internalid","anyof",relatedBillsArray2]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "ordertype",
                            sort: search.Sort.ASC,
                            label: "Order Type"
                        }),
                        search.createColumn({name: "mainline", label: "*"}),
                        search.createColumn({name: "trandate", label: "Date"}),
                        search.createColumn({name: "asofdate", label: "As-Of Date"}),
                        search.createColumn({name: "postingperiod", label: "Period"}),
                        search.createColumn({name: "taxperiod", label: "Tax Period"}),
                        search.createColumn({name: "type", label: "Type"}),
                        search.createColumn({name: "tranid", label: "Document Number"}),
                        search.createColumn({name: "entity", label: "Name"}),
                        search.createColumn({name: "account", label: "Account"}),
                        search.createColumn({name: "memo", label: "Memo"}),
                        search.createColumn({name: "amount", label: "Amount"}),
                        'item',
                        "custcol_dd_vendor_name",
                        "custcol_sps_upc",
                        search.createColumn({
                            name: "purchasedescription",
                            join: "item"
                        })
                    ]
            });
            var searchResultCount2 = vendorbillSearchObj.runPaged().count;
            log.debug("vendorbillSearchObj result count",searchResultCount2);
            var itemNotOnPOBillsArray = [];
            vendorbillSearchObj.run().each(function(result){

                var itemId = result.getValue('item');
                var itemTypeVal = '';
                var itemDescriptionVal = '';
                if (itemId == '119904' || itemId == '90525') {
                    itemTypeVal = itemNotOnPOUS;
                    itemDescriptionVal = result.getValue('item') + ' not on the Purchase Order';
                }
                /*if (itemId == '90525') {
                    itemTypeVal = itemNotOnPOUS;
                    itemDescriptionVal = 'Item not on the Purchase Order';
                }*/

                // .run().each has a limit of 4,000 results
                itemNotOnPOBillsArray.push({
                    rateDifference: result.getValue({name: "amount", label: "Amount"}),
                    itemDescription: itemDescriptionVal,
                    itemType: itemTypeVal,
                    itemTypeText: 'ITEM_DISCOUNT',
                    poDDVendorName: result.getValue("custcol_dd_vendor_name"),
                    poUPCCode: result.getValue('custcol_sps_upc'),
                    poItemDescription: result.getValue({
                        name: "purchasedescription",
                        join: "item"
                    }),
                });
                return true;
            });
            log.debug('itemNotOnPOBillsArray', itemNotOnPOBillsArray);

            var purchaseorderSearchObj2 = search.create({
                type: "purchaseorder",
                filters:
                    [
                        ["type","anyof","PurchOrd"],
                        "AND",
                        ["internalidnumber","equalto",purchase_order_internal_id],
                        "AND",
                        ["cogs","is","F"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["shipping","is","F"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        [["billingtransaction.custcol_pwc_addedbymuleboolean","is","T"],"OR",["billingtransaction.custcol_dd_appended_by_810","is","T"]],
                        "AND",
                        ["billingtransaction.amount","notequalto","0.00"]
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "internalid",
                            join: "billingTransaction",
                            sort: search.Sort.ASC,
                            label: "Bill Internal Id"
                        }),
                        search.createColumn({name: "mainline", label: "*"}),
                        search.createColumn({name: "trandate", label: "Date"}),
                        search.createColumn({name: "postingperiod", label: "Period"}),
                        search.createColumn({name: "type", label: "Type"}),
                        search.createColumn({name: "tranid", label: "Document Number"}),
                        search.createColumn({name: "account", label: "Account"}),
                        search.createColumn({name: "memo", label: "Memo"}),
                        search.createColumn({name: "line", label: "PO LineID"}),
                        search.createColumn({
                            name: "line",
                            join: "billingTransaction",
                            label: "Bill LineID"
                        }),
                        search.createColumn({name: "amount", label: "PO Amount"}),
                        search.createColumn({
                            name: "amount",
                            join: "billingTransaction",
                            label: "Bill Amount"
                        }),
                        search.createColumn({name: "quantity", label: "PO Quantity"}),
                        search.createColumn({name: "quantitybilled", label: "Bill Quantity"}),
                        search.createColumn({name: "quantityshiprecv", label: "Received Quantity"}),
                        search.createColumn({name: "quantityuom", label: "PO Quantity In Transaction Units"}),
                        search.createColumn({
                            name: "quantityuom",
                            join: "billingTransaction",
                            label: "Bill Quantity In Transaction Units"
                        }),
                        search.createColumn({name: "docunit", label: "Transaction Units"}),
                        search.createColumn({name: "unit", label: "PO Units"}),
                        search.createColumn({
                            name: "unit",
                            join: "billingTransaction",
                            label: "Bill Units"
                        }),
                        search.createColumn({name: "item", label: "PO Item Value"}),
                        search.createColumn({
                            name: "item",
                            join: "billingTransaction",
                            label: "Bill Item Value"
                        }),
                        search.createColumn({name: "rate", label: "PO Item Rate Value"}),
                        search.createColumn({
                            name: "rate",
                            join: "billingTransaction",
                            label: "Bill Item Rate Value"
                        }),
                        search.createColumn({name: "unitabbreviation", label: "Units"}),
                        search.createColumn({name: "custcol_pwc_lineid", label: "Line ID"}),
                        search.createColumn({name: "linesequencenumber", label: "Line Sequence Number"}),
                        search.createColumn({name: "lineuniquekey", label: "Line Unique Key"}),
                        search.createColumn({name: "billvariancestatus", label: "Bill Variance Status"}),
                        search.createColumn({name: "billingtransaction", label: "Billing Transaction"}),
                        search.createColumn({
                            name: "custcol_pwc_addedbymuleboolean"
                        }),
                        search.createColumn({
                            name: "custcol_dd_appended_by_810"
                        }),
                        search.createColumn({
                            name: "item",
                            join: "billingTransaction",
                            label: "Item"
                        }),search.createColumn({ name: 'item', label: 'PO Item' }),
                        "custcol_dd_vendor_name",
                        "custcol_sps_upc",
                        search.createColumn({
                            name: "purchasedescription",
                            join: "item"
                        })
                    ]
            });
            var searchResultCount2 = purchaseorderSearchObj2.runPaged().count;
            log.debug("purchaseorderSearchObj result count",searchResultCount2);
            purchaseorderSearchObj2.run().each(function(result){

                var amountToBeTaken = 0;
                var poAmountValToCompare = result.getValue('amount');
                if (!poAmountValToCompare) poAmountValToCompare = 0;
                var billAmountValToCompare = result.getValue({
                    name: "amount",
                    join: "billingTransaction",
                    label: "Bill Amount"
                }) * -1;
                if (!billAmountValToCompare) billAmountValToCompare = 0;
                amountToBeTaken = (billAmountValToCompare > poAmountValToCompare) ? billAmountValToCompare : poAmountValToCompare;
                // .run().each has a limit of 4,000 results
                discountArray.push({
                    rateDifference: amountToBeTaken,
                    itemDescription: result.getText('item') + ' not on the Purchase Order',
                    itemType: itemDiscountId,
                    itemTypeText: 'ITEM_DISCOUNT',
                    isMuleAdded: result.getValue({
                        name: "custcol_pwc_addedbymuleboolean"
                    }),
                    appendBy810: result.getValue({
                        name: "custcol_dd_appended_by_810"
                    }),
                    itemId: result.getValue('item'),
                    poDDVendorName1: result.getValue("custcol_dd_vendor_name"),
                    poUPCCode1: result.getValue('custcol_sps_upc'),
                    poItemDescription1: result.getValue({
                        name: "purchasedescription",
                        join: "item"
                    }),
                    itemTypeForAppendBy810: itemNotOnPOUS
                });
                return true;
            });
            log.debug('discountArray: from line 674:', discountArray);

            // creating mule lines array
            var purchaseorderSearchObj3 = search.create({
                type: "purchaseorder",
                filters:
                    [
                        ["type","anyof","PurchOrd"],
                        "AND",
                        ["internalidnumber","equalto",purchase_order_internal_id],
                        "AND",
                        ["cogs","is","F"],
                        "AND",
                        ["mainline","is","F"],
                        "AND",
                        ["shipping","is","F"],
                        "AND",
                        ["taxline","is","F"],
                        "AND",
                        ["custcol_pwc_addedbymuleboolean","is","T"],
                    ],
                columns:
                    [
                        search.createColumn({
                            name: "internalid",
                            join: "billingTransaction",
                            sort: search.Sort.ASC,
                            label: "Bill Internal Id"
                        }),
                        search.createColumn({name: "mainline", label: "*"}),
                        search.createColumn({name: "trandate", label: "Date"}),
                        search.createColumn({name: "postingperiod", label: "Period"}),
                        search.createColumn({name: "type", label: "Type"}),
                        search.createColumn({name: "tranid", label: "Document Number"}),
                        search.createColumn({name: "account", label: "Account"}),
                        search.createColumn({name: "memo", label: "Memo"}),
                        search.createColumn({name: "line", label: "PO LineID"}),
                        search.createColumn({
                            name: "line",
                            join: "billingTransaction",
                            label: "Bill LineID"
                        }),
                        search.createColumn({name: "amount", label: "PO Amount"}),
                        search.createColumn({
                            name: "amount",
                            join: "billingTransaction",
                            label: "Bill Amount"
                        }),
                        search.createColumn({name: "quantity", label: "PO Quantity"}),
                        search.createColumn({name: "quantitybilled", label: "Bill Quantity"}),
                        search.createColumn({name: "quantityshiprecv", label: "Received Quantity"}),
                        search.createColumn({name: "quantityuom", label: "PO Quantity In Transaction Units"}),
                        search.createColumn({
                            name: "quantityuom",
                            join: "billingTransaction",
                            label: "Bill Quantity In Transaction Units"
                        }),
                        search.createColumn({name: "docunit", label: "Transaction Units"}),
                        search.createColumn({name: "unit", label: "PO Units"}),
                        search.createColumn({
                            name: "unit",
                            join: "billingTransaction",
                            label: "Bill Units"
                        }),
                        search.createColumn({name: "item", label: "PO Item Value"}),
                        search.createColumn({
                            name: "item",
                            join: "billingTransaction",
                            label: "Bill Item Value"
                        }),
                        search.createColumn({name: "rate", label: "PO Item Rate Value"}),
                        search.createColumn({
                            name: "rate",
                            join: "billingTransaction",
                            label: "Bill Item Rate Value"
                        }),
                        search.createColumn({name: "unitabbreviation", label: "Units"}),
                        search.createColumn({name: "custcol_pwc_lineid", label: "Line ID"}),
                        search.createColumn({name: "linesequencenumber", label: "Line Sequence Number"}),
                        search.createColumn({name: "lineuniquekey", label: "Line Unique Key"}),
                        search.createColumn({name: "billvariancestatus", label: "Bill Variance Status"}),
                        search.createColumn({name: "billingtransaction", label: "Billing Transaction"}),
                        search.createColumn({
                            name: "custcol_pwc_addedbymuleboolean",
                            join: "billingTransaction",
                            label: "Added by Mule Boolean"
                        }),
                        search.createColumn({
                            name: "custcol_dd_appended_by_810",
                            join: "billingTransaction",
                            label: "DD Appended by 810"
                        }),
                        search.createColumn({
                            name: "item",
                            join: "billingTransaction",
                            label: "Item"
                        }),search.createColumn({ name: 'item', label: 'PO Item' }),
                        "custcol_dd_vendor_name",
                        "custcol_sps_upc",
                        search.createColumn({
                            name: "purchasedescription",
                            join: "item"
                        })
                    ]
            });
            var searchResultCount3 = purchaseorderSearchObj3.runPaged().count;
            log.debug("purchaseorderSearchObj result count",searchResultCount3);
            purchaseorderSearchObj3.run().each(function(result){
                // .run().each has a limit of 4,000 results
                muleLinesArray.push({
                    rateDifference: result.getValue({
                        name: "amount"
                    }) * -1,
                    itemId: result.getValue('item'),
                    itemQuantity: result.getValue('quantity'),
                    quantityBilled: result.getValue('quantitybilled'),
                    quantityReceived: result.getValue('quantityshiprecv'),
                    itemTypeText: 'MULE_ITEM',
                    poUnits: result.getValue('unit'),
                    poDDVendorName2: result.getValue("custcol_dd_vendor_name"),
                    poUPCCode2: result.getValue('custcol_sps_upc'),
                    poItemDescription2: result.getValue({
                        name: "purchasedescription",
                        join: "item"
                    }),
                });
                muleLinesItemIdsArray.push(result.getValue('item'));
                return true;
            });
            log.debug('muleLinesItemIdsArray ==== from line 783: ', muleLinesItemIdsArray);
            log.debug('muleLinesArray ==== from line 784: ', muleLinesArray);

            // log
            // var executionLogRecordObj = record.create({ type: 'customrecord_shortpay_process_logs' });
            // executionLogRecordObj.setValue('custrecord_purchase_order', purchase_order_internal_id);
            // executionLogRecordObj.setValue('custrecord_bill_three_way_match_executed', vbId);
            // create a scripting search to get all po lines and vendor bill lines
            let purchaseOrderSearchObj = search.create({
                type: "transaction",
                filters: [
                    [ "type", "anyof", "PurchOrd" ], "AND",
                    [ "internalidnumber", "equalto", purchase_order_internal_id ], "AND",
                    [ "cogs", "is", "F" ], "AND",
                    [ "mainline", "is", "F" ], "AND",
                    [ "shipping", "is", "F" ], "AND",
                    [ "taxline", "is", "F" ]
                ],
                columns: [
                    search.createColumn({ name: 'mainline', label: '*' }),
                    search.createColumn({ name: 'trandate', label: 'Date' }),
                    search.createColumn({ name: 'postingperiod', label: 'Period' }),
                    search.createColumn({ name: 'type', label: 'Type' }),
                    search.createColumn({ name: 'tranid', label: 'Document Number' }),
                    search.createColumn({ name: 'account', label: 'Account' }),
                    search.createColumn({ name: 'memo', label: 'Memo' }),
                    search.createColumn({ name: 'amount', label: 'Amount' }),
                    search.createColumn({ name: 'quantity', label: 'Quantity' }),
                    search.createColumn({ name: 'quantitybilled', label: 'Quantity Billed' }),
                    search.createColumn({ name: 'quantityshiprecv', label: 'Quantity Fulfilled/Received' }),
                    search.createColumn({ name: 'quantityuom', label: 'Quantity in Transaction Units' }),
                    search.createColumn({ name: 'docunit', label: 'Transaction Units' }),
                    search.createColumn({ name: 'unit', label: 'Units' }),
                    search.createColumn({ name: 'unitabbreviation', label: 'Units' }),
                    search.createColumn({ name: 'line', label: 'Line ID' }),
                    search.createColumn({ name: 'custcol_pwc_lineid', label: 'Line ID' }),
                    search.createColumn({ name: 'linesequencenumber', label: 'Line Sequence Number' }),
                    search.createColumn({ name: 'lineuniquekey', label: 'Line Unique Key' }),
                    search.createColumn({ name: 'linelastmodifieddate', label: 'Line Last Modified' }),
                    search.createColumn({ name: 'matchbilltoreceipt', label: 'Match Bill To Receipt' }),
                    search.createColumn({ name: 'billvariancestatus', label: 'Bill Variance Status' }),
                    search.createColumn({ name: 'billingtransaction', label: 'Billing Transaction' }),
                    search.createColumn({ name: 'internalid', join: 'billingTransaction', sort: search.Sort.ASC, label: 'Internal ID' }),
                    search.createColumn({ name: 'unit', join: 'billingTransaction', label: 'Units' }),
                    search.createColumn({ name: 'quantityuom', join: 'billingTransaction', label: 'Quantity in Transaction Units' }),
                    // search.createColumn({ name: 'formulacurrency', formula: '{amount}/{quantityuom}', label: 'PO Item Rate Value' }),
                    // search.createColumn({ name: 'formulacurrency', formula: '{billingtransaction.amount}/{billingtransaction.quantityuom}', label: 'Bill Item Rate Value' }),
                    search.createColumn({ name: 'line', join: 'billingTransaction', label: 'Bill Line ID' }),
                    search.createColumn({ name: 'custcol_pwc_addedbymuleboolean', label: 'Added by Mule Boolean' }),
                    search.createColumn({ name: 'custcol_dd_appended_by_810', label: 'DD Appended by 810' }),
                    search.createColumn({ name: 'item', label: 'PO Item' }),
                    search.createColumn({ name: 'amount', join: 'billingTransaction', label: 'Bill Amount' }),
                    search.createColumn({ name: 'location', join: 'billingTransaction' }),
                    search.createColumn({
                        name: "custcol_pwc_addedbymuleboolean",
                        join: "billingTransaction",
                        label: "Added by Mule Boolean"
                    }),
                    search.createColumn({
                        name: "custcol_dd_appended_by_810",
                        join: "billingTransaction",
                        label: "DD Appended by 810"
                    }),
                    search.createColumn({
                        name: "item",
                        join: "billingTransaction",
                        label: "Item"
                    }),
                    search.createColumn({ name: "custcol_dd_vendor_name", join: "billingTransaction" }),
                    search.createColumn({ name: "custcol_sps_upc", join: "billingTransaction" }),
                    search.createColumn({
                        name: "purchasedescription",
                        join: "item"
                    }),
                    "custcol_dd_vendor_uom",
                    search.createColumn({
                        name: "custitem_dd_itemcategory",
                        join: "item",
                        label: "Item Category"
                    })
                ]
            });

            // run the search
            let searchResultCount = purchaseOrderSearchObj.runPaged().count;

            // log
            log.debug('processShortPay: purchaseOrderSearchObj result count',searchResultCount);

            // TODO: here we have results are limited to 4000, later we need to update the code to handle more than that, but this case wont occur
            // loop through search results and process each po and bill lines
            purchaseOrderSearchObj.run().each(function(result){

                // read each result value
                let poQunatity = result.getValue({ name: 'quantity', label: 'Quantity' });
                let vbQuantity = result.getValue({ name: 'quantitybilled', label: 'Quantity Billed' });
                let receivedQuantity = result.getValue({ name: 'quantityshiprecv', label: 'Quantity Fulfilled/Received' });
                let poUnits = result.getValue({ name: 'unit', label: 'Units' });
                let vbUnits = result.getValue({ name: 'unit', join: 'billingTransaction', label: 'Units' });
                let poLineID = result.getValue({ name: 'line', label: 'Line ID' });
                let billLineID = result.getValue({ name: 'line', join: 'billingTransaction', label: 'Bill Line ID' });
                let billInternalId = result.getValue({ name: 'internalid', join: 'billingTransaction', sort: search.Sort.ASC, label: 'Internal ID' });
                let isAddedByMule = result.getValue({ name: 'custcol_pwc_addedbymuleboolean', label: 'Added by Mule Boolean' });
                let isAppendedBy810 = result.getValue({ name: 'custcol_dd_appended_by_810', label: 'DD Appended by 810' });
                let itemId = result.getValue({ name: 'item', label: 'PO Item' });
                let itemNameText = result.getText({ name: 'item', label: 'PO Item' });
                let poAmount = result.getValue({ name: 'amount', label: 'Amount' });
                let vbAmount = result.getValue({ name: 'amount', join: 'billingTransaction', label: 'Bill Amount' });
                let poUOM = result.getValue({ name: 'quantityuom', label: 'Quantity in Transaction Units' });
                let vbUOM = result.getValue({ name: 'quantityuom', join: 'billingTransaction', label: 'Quantity in Transaction Units' });
                let vbUomItemRate = vbAmount / vbUOM;
                let poUOMItemRate = poAmount / poUOM;
                let vbAddedByMule = result.getValue({ name: "custcol_pwc_addedbymuleboolean", join: "billingTransaction", label: "Added by Mule Boolean" });
                let vbAppendedBy810 = result.getValue({ name: "custcol_dd_appended_by_810", join: "billingTransaction", label: "DD Appended by 810" });
                let vbItemId = result.getValue({ name: "item", join: "billingTransaction", label: "Item" });
                let vbItemRate = (vbAmount) / ((vbUOM != 0) ? vbUOM : -1);
                let poItemRate = (poAmount) / ((poUOM != 0) ? poUOM : 1);
                poTranIdVal = result.getValue('tranid');
                let poDDVendorName = result.getValue({ name: "custcol_dd_vendor_name", join: "billingTransaction" });
                let poUPCCode = result.getValue({ name: "custcol_sps_upc", join: "billingTransaction" });
                let poItemDescription = result.getValue({
                    name: "purchasedescription",
                    join: "item"
                });
                let vendorUOMVal = result.getValue('custcol_dd_vendor_uom');
                var itemCategoryValFromItem = result.getValue({
                    name: "custitem_dd_itemcategory",
                    join: "item",
                    label: "Item Category"
                });

                var billItemLocation = result.getText({ name: 'location', join: 'billingTransaction' });
                var billItemLocationId = result.getValue({ name: 'location', join: 'billingTransaction' });

                // log
                log.debug('itemCategoriesArray', itemCategoriesArray);
                log.debug('itemCategoryValFromItem', itemCategoryValFromItem);
                log.debug('billItemLocation from line 1029', billItemLocation);
                log.debug('billItemLocation from line 1029', billItemLocationId);

                // if the item is falling under item category from custom record then continue to next item
                if (itemCategoriesArray.indexOf(itemCategoryValFromItem) != -1) return true;

                // if its by mule or 810 lines
                if (isAddedByMule || isAppendedBy810) return true;

                // log
                /*log.debug('processShortPay: poQunatity', poQunatity);
                log.debug('processShortPay: vbQuantity', vbQuantity);
                log.debug('processShortPay: receivedQuantity', receivedQuantity);
                log.debug('processShortPay: poUnits', poUnits);
                log.debug('processShortPay: vbUnits', vbUnits);
                log.debug('processShortPay: poAmount', poAmount);
                log.debug('processShortPay: poUOM', poUOM);
                log.debug('processShortPay: vbAmount', vbAmount);
                log.debug('processShortPay: vbUOM', vbUOM);
                log.debug('processShortPay: poItemRate', poItemRate);
                log.debug('processShortPay: vbItemRate', vbItemRate);
                log.debug('processShortPay: vbUomItemRate', vbUomItemRate);
                log.debug('processShortPay: poUOMItemRate', poUOMItemRate);
                log.debug('processShortPay: poLineID', poLineID);
                log.debug('processShortPay: billLineID', billLineID);
                log.debug('processShortPay: purchase_order_internal_id', purchase_order_internal_id);
                log.debug('processShortPay: billInternalId', billInternalId);
                log.debug('processShortPay: isAddedByMule', isAddedByMule);
                log.debug('processShortPay: isAppendedBy810', isAppendedBy810);
                log.debug('processShortPay: itemId', itemId);
                log.debug('processShortPay: itemNameText', itemNameText);*/

                // creating an item Obj
                log.debug('processShortPay: itemId', itemId);
                let itemObj = {
                    purchase_order_internal_id: purchase_order_internal_id,
                    billInternalId: billInternalId,
                    poLineID: poLineID,
                    billLineID: billLineID,
                    poUnits: poUnits,
                    vbUnits: vbUnits,
                    poQunatity: poQunatity,
                    vbQuantity: vbQuantity,
                    receivedQuantity: receivedQuantity,
                    poItemRate: poUOMItemRate,
                    vbItemRate: vbUomItemRate,
                    itemId: itemId,
                    itemNameText: itemNameText,
                    poUOM: poUOM,
                    vbUOM: vbUOM,
                    vbItemId: vbItemId,
                    vbAddedByMule: vbAddedByMule,
                    vbAppendedBy810: vbAppendedBy810,
                    poTranId: poTranIdVal,
                    poDDVendorName: poDDVendorName,
                    poUPCCode: poUPCCode,
                    poItemDescription: poItemDescription,
                    poAmount: poAmount,
                    vbAmount: vbAmount,
                    billItemLocation: billItemLocation,
                    billItemLocationId: billItemLocationId
                };
                log.debug('processShortPay: itemObj', itemObj);
                if (!billLineID) return true;

                // check the item id exists in mule added items or not
                if (muleLinesItemIdsArray.indexOf(itemId) != -1 && !isAddedByMule) {

                    var muleItemObj = getMuleItem(muleLinesArray, itemId);
                    if (muleItemObj.poQuantity) poQunatity = parseFloat(poQunatity) + parseFloat(muleItemObj.poQuantity);
                    if (muleItemObj.poBilledQty) vbQuantity = parseFloat(vbQuantity) + parseFloat(muleItemObj.poBilledQty);
                    if (muleItemObj.poReceivedQty) receivedQuantity = parseFloat(receivedQuantity) + parseFloat(muleItemObj.poReceivedQty);

                    // log
                    log.debug('muleItemObj: ', muleItemObj);
                    log.debug('poQunatity: ', poQunatity);
                    log.debug('vbQuantity: ', vbQuantity);
                    log.debug('receivedQuantity: ', receivedQuantity);

                    // push this item to mule main array
                    muleMainItemsArray.push(itemId);
                }

                // check is both units are same or not if units are same then it comes under normal validations
                if (poUnits && vbUnits && vbUnits == poUnits) {

                    // check for quantity differences
                    vbQuantity = parseFloat(vbQuantity);
                    receivedQuantity = parseFloat(receivedQuantity);

                    // rate and quantity validations
                    if (vbUomItemRate > poUOMItemRate && vbQuantity > receivedQuantity) {

                        // item rate difference
                        let itemRateDifference = vbUomItemRate - poUOMItemRate;
                        let quantityRateVal = getRateOfUnit(poUnits);
                        let poEachRate = poUOMItemRate/quantityRateVal;
                        let vbEachRate = vbUomItemRate/quantityRateVal;
                        // let itemRateDifference2 = parseFloat(vbAmount * -1) - (poUOMItemRate * (parseFloat((vbUOM * -1) - parseFloat(receivedQuantity/quantityRateVal))));
                        // let itemRateDifference2 = parseFloat(vbAmount * -1) - (poEachRate * parseFloat(receivedQuantity));
                        if (vbEachRate > poEachRate) {
                            var eachRateDiffVal = vbEachRate - poEachRate;
                        } else {
                            var eachRateDiffVal = 0
                        }
                        let itemQuantityDifference = vbQuantity - receivedQuantity;
                        if (itemQuantityDifference > 0) {
                            var itemRateDifference2 = eachRateDiffVal * (vbQuantity - itemQuantityDifference);
                        } else {
                            var itemRateDifference2 = eachRateDiffVal * vbQuantity;
                        }
                        if (vbQuantity < receivedQuantity) {
                            var quatityRateDifferenceAmount = 0;
                        } else {
                            var quatityRateDifferenceAmount = itemQuantityDifference * vbEachRate;
                        }
                        itemObj.rateDifference = itemRateDifference2;
                        // itemObj.itemDescription = "The rate for " + itemNameText + " in Vendor Bill " + billInternalId + " is " + Math.abs(itemRateDifference) + " higher than the rate in Purchase Order.";
                        itemObj.itemDescription = "The price for item " + itemNameText + " that DashMart was invoiced for is " + parseFloat(Math.abs(quatityRateDifferenceAmount)).toFixed(2) + " higher than the rate on Purchase Order.";
                        itemObj.itemType = itemPriceHigherId;
                        itemObj.itemTypeText = 'PRICE_HIGHER';
                        itemObj.isEaches = false;
                        itemObj.isQtyRateDifference = true;
                        itemObj.itemQuantityDifference = 1;
                        itemObj.poEachQuantityRate = poEachRate;
                        itemObj.vbEachQuantityRate = vbEachRate;
                        itemObj.extraLineDescription = "The quantity of item " + itemNameText + " that DashMart invoiced for is " + Math.abs(itemQuantityDifference) + " more than the quantity received.";
                        itemObj.extraLineItemId = itemShortShipId;
                        itemObj.extraLineItemTypeText = 'ITEM_SHORTSHIP';
                        itemObj.extraLineItemQuantityDifference = itemQuantityDifference;
                        itemObj.extraLineItemQuantityDifferenceAmount = quatityRateDifferenceAmount;
                        itemObj.eachRateDiffVal = eachRateDiffVal;
                        if (isAllowAllItems || reason_code_obj.accuratePayReasonCodeId == itemPriceHigherId || reason_code_obj.accuratePayReasonCodeId == itemShortShipId) varianceArray.push(itemObj);
                    } else if (vbUomItemRate > poUOMItemRate) {

                        let itemRateDifference = vbUomItemRate - poUOMItemRate;
                        itemObj.rateDifference = itemRateDifference;
                        // itemObj.itemDescription = "The rate for " + itemNameText + " in Vendor Bill " + billInternalId + " is " + Math.abs(itemRateDifference) + " higher than the rate in Purchase Order.";
                        itemObj.itemDescription = "The rate for item " + itemNameText + " in Vendor Bill is " + parseFloat(Math.abs(vbUOM * -1 * itemRateDifference)).toFixed(2) + " higher than the rate in Purchase Order.";
                        itemObj.itemType = itemPriceHigherId;
                        itemObj.itemTypeText = 'PRICE_HIGHER';
                        itemObj.isEaches = false;
                        itemObj.isQtyRateDifference = false;
                        if (isAllowAllItems || reason_code_obj.accuratePayReasonCodeId == itemPriceHigherId) varianceArray.push(itemObj);
                    } else if (vbQuantity > receivedQuantity && vbUomItemRate < poUOMItemRate) {

                        let quantityRateVal = getRateOfUnit(vbUnits);
                        let poEachRate = poUOMItemRate/quantityRateVal;
                        let vbEachRate = vbUomItemRate/quantityRateVal;
                        let itemRateDifference3 = (parseFloat(vbUomItemRate) * (parseFloat((vbUOM * -1) - parseFloat(receivedQuantity/quantityRateVal))));
                        // let itemRateDifference3 = parseFloat(vbAmount * -1) - (poUOMItemRate * (parseFloat((vbUOM * -1) - parseFloat(receivedQuantity/quantityRateVal))));
                        // let itemQuantityDifference = vbQuantity - receivedQuantity;
                        if (vbEachRate > poEachRate) {
                            var eachRateDiffVal = vbEachRate - poEachRate;
                        } else {
                            var eachRateDiffVal = 0
                        }
                        let itemQuantityDifference = vbQuantity - receivedQuantity;
                        if (itemQuantityDifference > 0) {
                            var itemRateDifference2 = eachRateDiffVal * (vbQuantity - itemQuantityDifference);
                        } else {
                            var itemRateDifference2 = eachRateDiffVal * vbQuantity;
                        }
                        if (vbQuantity < receivedQuantity) {
                            var quatityRateDifferenceAmount = 0;
                        } else {
                            var quatityRateDifferenceAmount = itemQuantityDifference * vbEachRate;
                        }
                        itemObj.quantityDifference = itemQuantityDifference;
                        itemObj.itemDescription = "The quantity of item " + itemNameText + " that DashMart invoiced for is " + Math.abs(itemQuantityDifference) + " more than the quantity received.";
                        itemObj.itemType = itemShortShipId;
                        itemObj.itemTypeText = 'ITEM_SHORTSHIP';
                        itemObj.isEaches = false;
                        itemObj.isQtyRateDifference = true;
                        itemObj.rateDifference = 0;
                        itemObj.extraLineDescription = "The price for item " + itemNameText + " that DashMart was invoiced for is " + parseFloat(Math.abs(quatityRateDifferenceAmount)).toFixed(2) + " higher than the rate on Purchase Order.";
                        itemObj.extraLineItemId = itemPriceHigherId;
                        itemObj.extraLineItemTypeText = 'PRICE_HIGHER';
                        itemObj.extraLineItemRateDifference = itemRateDifference2;
                        itemObj.extraLineItemQuantityDifferenceAmount = quatityRateDifferenceAmount;
                        itemObj.eachRateDiffVal = eachRateDiffVal;
                        if (isAllowAllItems || reason_code_obj.accuratePayReasonCodeId == itemShortShipId || reason_code_obj.accuratePayReasonCodeId == itemPriceHigherId) varianceArray.push(itemObj);
                    } else if (vbQuantity > receivedQuantity) {

                        let itemQuantityDifference = vbQuantity - receivedQuantity;
                        itemObj.quantityDifference = itemQuantityDifference;
                        itemObj.itemDescription = "The quantity of item " + itemNameText + " that DashMart invoiced for is " + Math.abs(itemQuantityDifference) + " more than the quantity received.";
                        itemObj.itemType = itemShortShipId;
                        itemObj.itemTypeText = 'ITEM_SHORTSHIP';
                        itemObj.isEaches = false;
                        itemObj.isQtyRateDifference = false;
                        if (isAllowAllItems || reason_code_obj.accuratePayReasonCodeId == itemShortShipId) varianceArray.push(itemObj);
                    } else if (vbUomItemRate < poUOMItemRate) {

                        // let itemRateDifference = vbItemRate - poItemRate;
                        let itemRateDifference = 0;
                        itemObj.rateDifference = itemRateDifference;
                        itemObj.itemDescription = "The rate for item " + itemNameText + " in Vendor Bill " + billInternalId + "  is " + Math.abs(itemRateDifference) + " lower than the rate in Purchase Order.";
                        itemObj.itemType = itemPriceLowerId;
                        itemObj.itemTypeText = 'PRICE_LOWER';
                        itemObj.isEaches = false;
                        itemObj.isQtyRateDifference = false;
                        varianceArray.push(itemObj);
                    } else if (vbQuantity && (vbQuantity > poQunatity) && (receivedQuantity >= poQunatity)) {

                        let itemQuantityDifference = vbQuantity - poQunatity;
                        if (itemQuantityDifference <= 0) return true;
                        var poLineAmtVal = parseFloat(poAmount).toFixed(2);
                        var vbLineAmtVal = parseFloat(vbAmount * -1).toFixed(2);
                        itemObj.quantityDifference = itemQuantityDifference;
                        itemObj.itemDescription = "The quantity of item " + itemNameText + " that DashMart received is " + Math.abs(itemQuantityDifference) + " more than the quantity ordered on the purchase order.";
                        itemObj.itemType = itemOverShipId;
                        itemObj.itemTypeText = 'ITEM_OVERSHIP';
                        itemObj.itemRateVal = vbItemRate;
                        itemObj.itemRateDifference = vbLineAmtVal - poLineAmtVal;
                        itemObj.isEaches = false;
                        itemObj.isQtyRateDifference = false;
                        varianceArray.push(itemObj);
                    }
                }

                // initiating po line amount and vb line amount to not trigger the code for eaches
                var poLineAmountVal = poAmount;
                var vbLineAmountVal = vbAmount * -1;

                log.debug('processShortPay: before Eaches: poLineAmountVal', poLineAmountVal);
                log.debug('processShortPay: before Eaches: vbLineAmountVal', vbLineAmountVal);
                log.debug('processShortPay: before Eaches: receivedQuantity', receivedQuantity);
                log.debug('processShortPay: before Eaches: vbQuantity', vbQuantity);

                // if po units are not equal to vendor bill units
                if ((poUnits && vbUnits && poUnits != vbUnits && poLineAmountVal != vbLineAmountVal) ||
                    (poUnits && vbUnits && poUnits != vbUnits && vbQuantity && receivedQuantity == 0)) {
                    log.debug('processShortPay: after Eaches: poLineAmountVal', poLineAmountVal);
                    log.debug('processShortPay: after Eaches: vbLineAmountVal', vbLineAmountVal);
                    // read the unit rates: UNITS RATE
                    let poUnitsValue = getRateOfUnit(poUnits);
                    let vbUnitsValue = getRateOfUnit(vbUnits);
                    let poVendorUnitsValue = getRateOfUnit(vendorUOMVal);

                    // log
                    log.debug('processShortPay: Eaches: poUOMItemRate', poUOMItemRate);
                    log.debug('processShortPay: Eaches: vbUomItemRate', vbUomItemRate);
                    log.debug('processShortPay: Eaches: poUOM', poUOM);
                    log.debug('processShortPay: Eaches: vbUOM', vbUOM);

                    log.debug('processShortPay: Eaches: poUnitsValue', poUnitsValue);
                    log.debug('processShortPay: Eaches: vbUnitsValue', vbUnitsValue);
                    log.debug('processShortPay: Eaches: poVendorUnitsValue', poVendorUnitsValue);


                    // read total quantities: UNITS RATE * QUANTITY, NOTHING BUT TOTAL EACHES
                    let poTotalQuantity = poUnitsValue * poUOM;
                    let vbTotalQuantity = vbUnitsValue * vbUOM;
                    let poVendorTotalQuantity = poVendorUnitsValue * poUOM;

                    // log
                    log.debug('processShortPay: Eaches: poTotalQuantity', poTotalQuantity);
                    log.debug('processShortPay: Eaches: vbTotalQuantity', vbTotalQuantity);
                    log.debug('processShortPay: Eaches: poVendorTotalQuantity', poVendorTotalQuantity);

                    // read EACHES * ITEM RATE
                    let poEachesTotalRateVal=  poTotalQuantity * poUOMItemRate;
                    let vbEachesTotalRateVal= vbTotalQuantity * vbUomItemRate;
                    let poVendorTotalRateVal= poVendorTotalQuantity * poUOMItemRate;

                    // log
                    log.debug('processShortPay: Eaches: poEachesTotalRateVal', poEachesTotalRateVal);
                    log.debug('processShortPay: Eaches: vbEachesTotalRateVal', vbEachesTotalRateVal);
                    log.debug('processShortPay: Eaches: poVendorTotalRateVal', poVendorTotalRateVal);

                    // read ITEM RATE / UNITS RATE
                    let poSingleQuantityRate=  poUOMItemRate / poUnitsValue;
                    let vbSingleQuantityRate= vbUomItemRate / vbUnitsValue;
                    let poVendorSingleQuantityRate= poUOMItemRate / poVendorUnitsValue;

                    // log
                    log.debug('processShortPay: Eaches: poSingleQuantityRate', poSingleQuantityRate);
                    log.debug('processShortPay: Eaches: vbSingleQuantityRate', vbSingleQuantityRate);
                    log.debug('processShortPay: Eaches: poVendorSingleQuantityRate', poVendorSingleQuantityRate);

                    poSingleQuantityRate = parseFloat(poSingleQuantityRate);
                    vbSingleQuantityRate = parseFloat(vbSingleQuantityRate);
                    poVendorSingleQuantityRate = parseFloat(poVendorSingleQuantityRate);

                    // vendor UOM check for price higher
                    log.debug('from line 1250: vendorUOMVal', vendorUOMVal);
                    log.debug('from line 1250: poUnits', poUnits);
                    log.debug('from line 1250: (parseFloat(poQunatity)', parseFloat(poQunatity));
                    log.debug('from line 1250: parseFloat(receivedQuantity)', parseFloat(receivedQuantity));
                    log.debug('from line 1250: vendorUOMVal != poUnits', vendorUOMVal != poUnits);
                    log.debug('from line 1250: parseFloat(poQunatity) > parseFloat(receivedQuantity)', parseFloat(poQunatity) > parseFloat(receivedQuantity));

                    if (vendorUOMVal != poUnits) {

                        // check for the po rate with reference to vendor uom and bill rate, if bill rate is less then return true
                        if (vbSingleQuantityRate < poVendorSingleQuantityRate) return true;
                    }

                    // EACHES: if vendor bill item rate greater than po item rate
                    if (parseFloat(vbSingleQuantityRate) > parseFloat(poSingleQuantityRate)) {

                        log.debug('from line eaches price higher check');
                        // item rate difference
                        let itemRateDifference = parseFloat(poSingleQuantityRate);

                        // log
                        log.debug('processShortPay: Eaches: itemRateDifference', itemRateDifference);

                        // get total item rate difference
                        let totalItemRateDifference = parseFloat(vbTotalQuantity * -1) * itemRateDifference;
                        log.debug('processShortPay: Eaches: totalItemRateDifference from line 470', totalItemRateDifference);

                        // amount to be taken
                        var poAmtVal = poAmount;
                        var vbAmtVal = vbAmount * -1;
                        // var amtToBeTaken = (poAmtVal > vbAmtVal) ? poAmtVal : vbAmtVal;
                        var amtToBeTaken = vbAmtVal;

                        // check if the received quantity greater than vb quantity or not
                        if (parseFloat(vbTotalQuantity * -1) <= receivedQuantity) {
                            totalItemRateDifference = amtToBeTaken - totalItemRateDifference;
                            log.debug('processShortPay: Eaches: totalItemRateDifference from line 475', totalItemRateDifference);
                        }
                        if (parseFloat(vbTotalQuantity * -1) > receivedQuantity) {
                            totalItemRateDifference = (vbEachesTotalRateVal * -1) - poEachesTotalRateVal;
                            log.debug('processShortPay: Eaches: totalItemRateDifference from line 479', totalItemRateDifference);
                        }
                        log.debug('processShortPay: Eaches: totalItemRateDifference from line481', totalItemRateDifference);
                        //
                        itemObj.rateDifference = totalItemRateDifference;
                        if (parseFloat(Math.abs(totalItemRateDifference)).toFixed(2) < 0.02) return true;
                        // itemObj.itemDescription = "The rate for " + itemNameText + " in Vendor Bill " + billInternalId + " is " + Math.abs(itemRateDifference) + " higher than the rate in Purchase Order.";
                        itemObj.itemDescription = "The rate for item " + itemNameText + " in Vendor Bill is " + parseFloat(Math.abs(totalItemRateDifference)).toFixed(2) + " higher than the rate in Purchase Order.";
                        itemObj.itemType = itemPriceHigherId;
                        itemObj.itemTypeText = 'PRICE_HIGHER';
                        itemObj.isEaches = true;
                        itemObj.isQtyRateDifference = false;
                        if (isAllowAllItems || reason_code_obj.accuratePayReasonCodeId == itemPriceHigherId) varianceArray.push(itemObj);
                    } /*else if (vbSingleQuantityRate < poSingleQuantityRate) {
                    log.debug('from line eaches price lower check');
                    // let itemRateDifference = vbItemRate - poItemRate;
                    let itemRateDifference = 0;
                    itemObj.rateDifference = itemRateDifference;
                    itemObj.itemDescription = "The rate for " + itemNameText + " in Vendor Bill " + billInternalId + "  is " + Math.abs(itemRateDifference) + " lower than the rate in Purchase Order.";
                    itemObj.itemType = itemPriceLowerId;
                    itemObj.itemTypeText = 'PRICE_LOWER';
                    itemObj.isEaches = true;
                    varianceArray.push(itemObj);
                }*/

                    // EACHES: check the quantity validations
                    if (parseFloat(vbQuantity) > parseFloat(receivedQuantity)) {

                        log.debug('from line eaches quantity lower check');
                        log.debug('from line 1254: vendorUOMVal', vendorUOMVal);
                        log.debug('from line 1254: poUnits', poUnits);
                        log.debug('from line 1254: (parseFloat(poQunatity)', parseFloat(poQunatity));
                        log.debug('from line 1254: parseFloat(receivedQuantity)', parseFloat(receivedQuantity));
                        log.debug('from line 1258: vendorUOMVal != poUnits', vendorUOMVal != poUnits);
                        log.debug('from line 1259: parseFloat(poQunatity) > parseFloat(receivedQuantity)', parseFloat(poQunatity) > parseFloat(receivedQuantity));

                        if ((vendorUOMVal != poUnits) && (parseFloat(poQunatity) > parseFloat(receivedQuantity))) {
                            var itemQuantityDifference = parseFloat(vbUOM * -1) - parseFloat(receivedQuantity);
                            if (itemQuantityDifference == 0) return true;
                        } else {
                            var itemQuantityDifference = vbQuantity - receivedQuantity;
                        }
                        itemObj.quantityDifference = itemQuantityDifference;
                        itemObj.itemDescription = "The quantity of item " + itemNameText + " that DashMart invoiced for is " + Math.abs(itemQuantityDifference) + " more than the quantity received.";
                        itemObj.itemType = itemShortShipId;
                        itemObj.itemTypeText = 'ITEM_SHORTSHIP';
                        itemObj.isEaches = true;
                        itemObj.isQtyRateDifference = false;
                        var poAmtVal = poAmount;
                        var vbAmtVal = vbAmount * -1;
                        // var amtToBeTaken = (poAmtVal > vbAmtVal) ? poAmtVal : vbAmtVal;
                        var amtToBeTaken = vbAmtVal;

                        log.debug('Eaches: poSingleQuantityRate: 1410: ', poSingleQuantityRate);
                        log.debug('Eaches: vbSingleQuantityRate: 1410: ', vbSingleQuantityRate);
                        log.debug('Eaches: amtToBeTaken: 1410: ', amtToBeTaken);
                        log.debug('Eaches: receivedQuantity: 1410: ', receivedQuantity);

                        // get the item rates
                        if (poSingleQuantityRate > vbSingleQuantityRate) {

                            // itemObj.rateDifference = vbSingleQuantityRate;
                            itemObj.rateDifference = parseFloat(amtToBeTaken) - (vbSingleQuantityRate * parseFloat(receivedQuantity));
                        }

                        if (poSingleQuantityRate <= vbSingleQuantityRate) {

                            // here we should not take rate we go for amount difference on line
                            itemObj.rateDifference = parseFloat(amtToBeTaken) - (poSingleQuantityRate * parseFloat(receivedQuantity));
                        }
                        log.debug('itemObj.rateDifference', itemObj.rateDifference);
                        if (isAllowAllItems || reason_code_obj.accuratePayReasonCodeId == itemShortShipId) varianceArray.push(itemObj);
                    } /*else if (vbQuantity < receivedQuantity) {
                    log.debug('from line eaches quantity higher check');
                    let itemQuantityDifference = receivedQuantity - vbQuantity;
                    itemObj.quantityDifference = itemQuantityDifference;
                    itemObj.itemDescription = "The quantity for item " + itemNameText + " in Vendor Bill is " + Math.abs(itemQuantityDifference) + " higher than the quantity in Item Receipt.";
                    itemObj.itemType = itemOverShipId;
                    itemObj.itemTypeText = 'ITEM_OVERSHIP';
                    itemObj.isEaches = true;
                    varianceArray.push(itemObj);
                }*/
                }
                return true;
            });

            // log
            log.debug('processShortPay: varianceArray', varianceArray);
            variancerray2 = varianceArray;

            // updateRateAndQuantityFlagsOnBill(varianceArray);
            var vendorCreditId = createVendorCredit(varianceArray, itemNotOnPOBillsArray, discountArray, reason_code_obj, isAllowAllItems, muleMainItemsArray, purchase_order_internal_id, vendor_bill_internal_id, poTranIdVal);
            log.debug('Created Bill Credit: Bill Credit Internal Id: ', vendorCreditId);
            if (!vendorCreditId) {
                record.submitFields({
                    type: record.Type.PURCHASE_ORDER,
                    id: purchase_order_internal_id,
                    values: {
                        'custbody_short_pay_no_descrepancy': true
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            }
            if (vendorCreditId) {
                record.submitFields({
                    type: record.Type.PURCHASE_ORDER,
                    id: purchase_order_internal_id,
                    values: {
                        'custbody_dd_3way_match_comp_flag': true
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
                record.submitFields({
                    type: record.Type.VENDOR_BILL,
                    id: vendor_bill_internal_id,
                    values: {
                        'custbody_created_from_shortpay': true
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            }
        }

        /**
         * create vendor credit
         * @param variance_array
         * @returns {boolean}
         */
        function createVendorCredit(variance_array, item_not_on_po_bills_array, discount_array, reasoncode_obj, is_allow_all_items, mule_items_main_array, po_internal_id, vendor_bill_internal_id, po_tran_id) {

            // if variance array has no results then return
            log.debug('po_internal_id', po_internal_id);
            log.debug('vendor_bill_internal_id', vendor_bill_internal_id);
            if (!variance_array.length && !discount_array.length && !item_not_on_po_bills_array.length) return false;

            // initiate vendor credit obj
            var vendorCreditObjRecord = '';
            var purchaseOrderId = '';
            var purchaseOrderTranId = po_tran_id;
            var transformedBillInternalId = '';
            var referenceBillInternalId = '';

            // to handle shortship scenario
            var itemsArray = []
            var qtyRateItemsArray = []

            // loop through each variance line and create vedor credit
            for (var lineNumber = 0; lineNumber < variance_array.length; lineNumber++) {

                // log
                log.debug('createVendorCredit: variance_array ' + lineNumber, variance_array[lineNumber]);
                var isExtraRateLine = false;
                var isExtraQuantityLine = false;

                // load the vendor bill record from first vendor bill id
                if (lineNumber == 0) {

                    // read purchase order id and transformed bill internal id from first index
                    purchaseOrderId = variance_array[lineNumber].purchase_order_internal_id;
                    purchaseOrderTranId = variance_array[lineNumber].poTranId;
                    transformedBillInternalId = variance_array[lineNumber].billInternalId;

                    // log
                    log.debug('createVendorCredit lineNumber zero purchaseOrderId', purchaseOrderId);
                    log.debug('createVendorCredit lineNumber zero transformedBillInternalId', transformedBillInternalId);

                    // transform to vendor credit using very first vendor bill
                    vendorCreditObjRecord = record.transform({ fromType: 'vendorbill', fromId: transformedBillInternalId, toType: 'vendorcredit', isDynamic: true });

                    // remove all lines from the vendor credit obj
                    vendorCreditObjRecord = removeVendorCreditLines(vendorCreditObjRecord);
                }

                // if the array line contains ITEM_OVERSHIP OR PRICE_LOWER then continue
                // if (variance_array[lineNumber].itemTypeText == 'ITEM_OVERSHIP' || variance_array[lineNumber].itemTypeText == 'PRICE_LOWER') continue;
                if (variance_array[lineNumber].itemTypeText == 'PRICE_LOWER') continue;

                // select new line on vendor credit, and set the item value
                vendorCreditObjRecord.selectNewLine({ sublistId: 'item' });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: variance_array[lineNumber].itemType });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: variance_array[lineNumber].billItemLocationId });
                referenceBillInternalId = variance_array[lineNumber].billInternalId;
                log.debug('referenceBillInternalId==== from line 1431', referenceBillInternalId);
                if (referenceBillInternalId) vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_ref_billno', value: referenceBillInternalId });

                // check each condition and set the values
                if (variance_array[lineNumber].itemTypeText == 'ITEM_DISCOUNT') {

                    // here rate is going to be the po rate
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: variance_array[lineNumber].rateDifference });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: variance_array[lineNumber].itemDescription });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', value: variance_array[lineNumber].poDDVendorName });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', value: variance_array[lineNumber].poUPCCode });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', value: variance_array[lineNumber].poItemDescription });
                    // vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: variance_array[lineNumber].rateDifference });
                } else if (variance_array[lineNumber].itemTypeText == 'ITEM_OVERSHIP') {

                    // here rate is going to be the po rate
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: parseInt(variance_array[lineNumber].quantityDifference) });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: '' });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: variance_array[lineNumber].itemDescription });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', value: variance_array[lineNumber].poDDVendorName });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', value: variance_array[lineNumber].poUPCCode });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', value: variance_array[lineNumber].poItemDescription });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: variance_array[lineNumber].itemRateDifference });
                } else if (variance_array[lineNumber].itemTypeText == 'PRICE_HIGHER') {

                    // if rate difference is less than 0.05 then continue
                    if (!variance_array[lineNumber].isEaches && variance_array[lineNumber].isQtyRateDifference && !variance_array[lineNumber].rateDifference) {
                        // select new line on vendor credit, and set the item value
                        vendorCreditObjRecord.selectNewLine({ sublistId: 'item' });
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: variance_array[lineNumber].extraLineItemId });
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: variance_array[lineNumber].billItemLocationId });
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: parseInt(variance_array[lineNumber].extraLineItemQuantityDifference) });
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: '' });
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: variance_array[lineNumber].extraLineDescription });
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', value: variance_array[lineNumber].poDDVendorName });
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', value: variance_array[lineNumber].poUPCCode });
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', value: variance_array[lineNumber].poItemDescription });
                        if (variance_array[lineNumber].extraLineItemQuantityDifferenceAmount) vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: variance_array[lineNumber].extraLineItemQuantityDifferenceAmount });
                        else vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: 0 });
                        if (is_allow_all_items || reasoncode_obj.accuratePayReasonCodeId == variance_array[lineNumber].extraLineItemId && parseFloat(variance_array[lineNumber].rateDifference) >= 0.02) {
                            if (parseFloat(vendorCreditObjRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'amount' })) >= 0.02) vendorCreditObjRecord.commitLine({ sublistId: 'item' });
                            qtyRateItemsArray.push(variance_array[lineNumber].itemId);
                        }
                    }
                    // if (variance_array[lineNumber].rateDifference < 0.02) continue;
                    if (qtyRateItemsArray.indexOf(variance_array[lineNumber].itemId) != -1) continue;

                    // if the price is higher on bill and is compared with PO, adding line on vendor credit
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: parseInt(variance_array[lineNumber].vbUOM * -1) });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: '' });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: variance_array[lineNumber].itemDescription });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', value: variance_array[lineNumber].poDDVendorName });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', value: variance_array[lineNumber].poUPCCode });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', value: variance_array[lineNumber].poItemDescription });
                    if (!variance_array[lineNumber].isEaches && !variance_array[lineNumber].isQtyRateDifference)
                    {
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: variance_array[lineNumber].vbUOM * -1 * variance_array[lineNumber].rateDifference });
                    }
                    if (!variance_array[lineNumber].isEaches && variance_array[lineNumber].isQtyRateDifference) {
                        isExtraQuantityLine = true;
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: parseInt(variance_array[lineNumber].itemQuantityDifference) });
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: variance_array[lineNumber].rateDifference });
                    }
                    if (variance_array[lineNumber].isEaches)
                    {
                        vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: variance_array[lineNumber].rateDifference });
                    }
                } else if (variance_array[lineNumber].itemTypeText == 'ITEM_SHORTSHIP' && variance_array[lineNumber].isQtyRateDifference) {

                    // set is extra line
                    isExtraRateLine = true;

                    // if the item already exists then continue
                    if (itemsArray.indexOf(variance_array[lineNumber].itemId) != -1) continue;
                    if (qtyRateItemsArray.indexOf(variance_array[lineNumber].itemId) != -1) continue;

                    // if rate difference is less than 0.05 then continue
                    // if (variance_array[lineNumber].rateDifference < 0.02) continue;

                    // if the quantity is higher on bill and is compared with Item receipt, adding line on vendor credit
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: parseInt(variance_array[lineNumber].quantityDifference) });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: '' });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: variance_array[lineNumber].itemDescription });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', value: variance_array[lineNumber].poDDVendorName });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', value: variance_array[lineNumber].poUPCCode });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', value: variance_array[lineNumber].poItemDescription });
                    if (variance_array[lineNumber].extraLineItemQuantityDifferenceAmount) vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: variance_array[lineNumber].extraLineItemQuantityDifferenceAmount });
                    else vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: variance_array[lineNumber].rateDifference });

                    // add this item to items array
                    itemsArray.push(variance_array[lineNumber].itemId);
                    qtyRateItemsArray.push(variance_array[lineNumber].itemId);
                } else if (variance_array[lineNumber].itemTypeText == 'ITEM_SHORTSHIP' && !variance_array[lineNumber].isQtyRateDifference) {

                    // if the item already exists then continue
                    if (itemsArray.indexOf(variance_array[lineNumber].itemId) != -1) continue;
                    if (qtyRateItemsArray.indexOf(variance_array[lineNumber].itemId) != -1) continue;

                    // if the quantity is higher on bill and is compared with Item receipt, adding line on vendor credit
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: parseInt(variance_array[lineNumber].quantityDifference) });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: '' });

                    // get eaches from units
                    var eachQuantityVal = getRateOfUnit(variance_array[lineNumber].poUnits);
                    log.debug('createVendorCredit: eachQuantityVal', eachQuantityVal);
                    var amountToBeAdded = (parseFloat(variance_array[lineNumber].quantityDifference) / parseFloat(eachQuantityVal)) * parseFloat(variance_array[lineNumber].poItemRate);
                    log.debug('createVendorCredit: amountToBeAdded', amountToBeAdded);
                    // if rate difference is less than 0.05 then continue
                    if (parseFloat(amountToBeAdded) < 0.02) continue;
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: variance_array[lineNumber].itemDescription });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', value: variance_array[lineNumber].poDDVendorName });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', value: variance_array[lineNumber].poUPCCode });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', value: variance_array[lineNumber].poItemDescription });
                    if (!variance_array[lineNumber].isEaches) vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: amountToBeAdded });
                    if (variance_array[lineNumber].isEaches) vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: variance_array[lineNumber].rateDifference });

                    // add this item to items array
                    itemsArray.push(variance_array[lineNumber].itemId);
                }

                // commit line
                if (is_allow_all_items || reasoncode_obj.accuratePayReasonCodeId == vendorCreditObjRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'item' }) && parseFloat(vendorCreditObjRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'amount' })) >= 0.02) {
                    vendorCreditObjRecord.commitLine({ sublistId: 'item' });
                }

                if (isExtraQuantityLine) {

                    // select new line on vendor credit, and set the item value
                    if (itemsArray.indexOf(variance_array[lineNumber].itemId) != -1) continue;
                    vendorCreditObjRecord.selectNewLine({ sublistId: 'item' });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: variance_array[lineNumber].extraLineItemId });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: variance_array[lineNumber].billItemLocationId });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: parseInt(variance_array[lineNumber].extraLineItemQuantityDifference) });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: '' });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: variance_array[lineNumber].extraLineDescription });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', value: variance_array[lineNumber].poDDVendorName });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', value: variance_array[lineNumber].poUPCCode });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', value: variance_array[lineNumber].poItemDescription });
                    if (variance_array[lineNumber].extraLineItemQuantityDifferenceAmount) vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: variance_array[lineNumber].extraLineItemQuantityDifferenceAmount });
                    else vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: 0 });
                    if (is_allow_all_items || reasoncode_obj.accuratePayReasonCodeId == variance_array[lineNumber].extraLineItemId) {
                        if (parseFloat(vendorCreditObjRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'amount' })) >= 0.02) vendorCreditObjRecord.commitLine({ sublistId: 'item' });
                        qtyRateItemsArray.push(variance_array[lineNumber].itemId);
                    }
                } else if (parseFloat(isExtraRateLine && variance_array[lineNumber].extraLineItemRateDifference) >= 0.02) {

                    // select new line on vendor credit, and set the item value
                    vendorCreditObjRecord.selectNewLine({ sublistId: 'item' });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: variance_array[lineNumber].extraLineItemId });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: variance_array[lineNumber].billItemLocationId });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: '' });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: '' });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: variance_array[lineNumber].extraLineDescription });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', value: variance_array[lineNumber].poDDVendorName });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', value: variance_array[lineNumber].poUPCCode });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', value: variance_array[lineNumber].poItemDescription });
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: variance_array[lineNumber].extraLineItemRateDifference });
                    if (is_allow_all_items || reasoncode_obj.accuratePayReasonCodeId == variance_array[lineNumber].extraLineItemId) {
                        if (parseFloat(vendorCreditObjRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'amount' })) >= 0.02) vendorCreditObjRecord.commitLine({ sublistId: 'item' });
                        qtyRateItemsArray.push(variance_array[lineNumber].itemId);
                    }
                }
                log.debug('qtyratearray', qtyRateItemsArray);
            }

            // if vendor credit record is empty, then create vendor credit record object
            if (vendorCreditObjRecord == '') {

                // transform to vendor credit using very first vendor bill
                vendorCreditObjRecord = record.transform({ fromType: 'vendorbill', fromId: vendor_bill_internal_id, toType: 'vendorcredit', isDynamic: true });

                // remove all lines from the vendor credit obj
                vendorCreditObjRecord = removeVendorCreditLines(vendorCreditObjRecord);

                // po id
                purchaseOrderId = po_internal_id;
            }

            for (var lineNumber2 = 0; lineNumber2 < item_not_on_po_bills_array.length; lineNumber2++) {
                // log.debug("item_not_on_po_bills_array[lineNumber2]", item_not_on_po_bills_array[lineNumber2]);
                // select new line on vendor credit, and set the item value
                vendorCreditObjRecord.selectNewLine({ sublistId: 'item' });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: item_not_on_po_bills_array[lineNumber2].itemType });
                // vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: variance_array[lineNumber].billItemLocationId });

                // check each condition and set the values
                // if (item_not_on_po_bills_array[lineNumber2].itemTypeText == 'ITEM_DISCOUNT') {

                // here rate is going to be the po rate
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: 1 });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: item_not_on_po_bills_array[lineNumber2].rateDifference });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: item_not_on_po_bills_array[lineNumber2].itemDescription });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', value: item_not_on_po_bills_array[lineNumber2].poDDVendorName });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', value: item_not_on_po_bills_array[lineNumber2].poUPCCode });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', value: item_not_on_po_bills_array[lineNumber2].poItemDescription });
                // vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: item_not_on_po_bills_array[lineNumber2].rateDifference });
                // }
                if (parseFloat(vendorCreditObjRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'amount' })) >= 0.02) vendorCreditObjRecord.commitLine({ sublistId: 'item' });
            }

            for (var lineNumber3 = 0; lineNumber3 < discount_array.length; lineNumber3++) {

                // log
                log.debug('from line 1541: discount_array[lineNumber3]', discount_array[lineNumber3]);
                log.debug('from line 1542: mule_items_main_array[lineNumber3]', mule_items_main_array);
                log.debug('from line 1543: mule_items_main_array.indexOf(discount_array[lineNumber3].itemId)', mule_items_main_array.indexOf(discount_array[lineNumber3].itemId));

                // check is the mule item is repeated or not
                if (discount_array[lineNumber3].isMuleAdded && mule_items_main_array.indexOf(discount_array[lineNumber3].itemId) != -1) continue;
                log.debug('adding mule line: from line 1540: ', discount_array[lineNumber3]);

                // select new line on vendor credit, and set the item value
                vendorCreditObjRecord.selectNewLine({ sublistId: 'item' });
                if (discount_array[lineNumber3].isMuleAdded) {
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: discount_array[lineNumber3].itemType });
                }
                if (discount_array[lineNumber3].appendBy810) {
                    vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: discount_array[lineNumber3].itemTypeForAppendBy810 });
                }

                // check each condition and set the values
                // if (item_not_on_po_bills_array[lineNumber2].itemTypeText == 'ITEM_DISCOUNT') {

                // here rate is going to be the po rate
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: discount_array[lineNumber3].rateDifference });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: discount_array[lineNumber3].itemDescription });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', value: discount_array[lineNumber3].poDDVendorName1 || '' });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', value: discount_array[lineNumber3].poUPCCode1 || '' });
                vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', value: discount_array[lineNumber3].poItemDescription1 || '' });

                // vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: item_not_on_po_bills_array[lineNumber2].rateDifference });
                // }
                if (parseFloat(vendorCreditObjRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'amount' })) >= 0.02) vendorCreditObjRecord.commitLine({ sublistId: 'item' });
            }

            log.debug('discount_array', discount_array);
            // get user total value and vendor bill to apply lines
            var vendorCreditAmountVal = vendorCreditObjRecord.getValue('usertotal');
            if (vendorCreditAmountVal < 0.02) {
                log.audit('createVendorCredit: skipping to create vendor credit, vendor credit total amount:  ', vendorCreditAmountVal);

                // as there is no discrepency found, updating purchase order flag
                record.submitFields({
                    type: record.Type.PURCHASE_ORDER,
                    id: purchaseOrderId,
                    values: {
                        'custbody_short_pay_no_descrepancy': true
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

                // return
                return false;
            }

            // check for each bill one credit field values contains the vendor then split the credits
            var shortPayConfigurationsPageRec3 = record.load({type: 'customrecord_shortpay_configuration_page', id: 1 });
            var vendorArray3 = shortPayConfigurationsPageRec3.getValue('custrecord_each_bill_one_credit_for_vend');
            if (vendorArray3.indexOf(vendorCreditObjRecord.getValue('entity')) != -1) {

                // read vendor credit lines
                var multipleCreditsObj = {};
                var vendorCreditsArray = [];

                // read vendor credit lines
                for (var i = 0; i < vendorCreditObjRecord.getLineCount({ sublistId: 'item' }); i++) {

                    var vendorBillInternalId = vendorCreditObjRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_ref_billno', line: i });
                    var itemId = vendorCreditObjRecord.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    var quantityVal = vendorCreditObjRecord.getSublistValue({ sublistId: 'item', fieldId: 'quantity', line: i });
                    var descriptionVal = vendorCreditObjRecord.getSublistValue({ sublistId: 'item', fieldId: 'description', line: i });
                    var amountVal = vendorCreditObjRecord.getSublistValue({ sublistId: 'item', fieldId: 'amount', line: i });
                    var upcCodeVal = vendorCreditObjRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', line: i });
                    var vendorSkuVal = vendorCreditObjRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', line: i });
                    var itemColDescription = vendorCreditObjRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', line: i });

                    var creditLineItem = {
                        vendorBillInternalId: vendorBillInternalId,
                        itemId: itemId,
                        quantityVal: quantityVal,
                        descriptionVal: descriptionVal,
                        amountVal: amountVal,
                        upcCodeVal: upcCodeVal,
                        vendorSkuVal: vendorSkuVal,
                        itemColDescription: itemColDescription
                    };

                    if (multipleCreditsObj.hasOwnProperty(vendorBillInternalId)) {
                        multipleCreditsObj[vendorBillInternalId].push(creditLineItem);
                    } else {
                        multipleCreditsObj[vendorBillInternalId] = [creditLineItem];
                    }
                }

                // log
                log.debug('Each Bill One Credit: MultipleObjArray', multipleCreditsObj);

                // loop through each object and create a seperate credit
                for (var billId in multipleCreditsObj) {
                    log.debug('billId', billId);
                    var billItems = multipleCreditsObj[billId];
                    log.debug('multipleCreditsObj[billId]', billItems);

                    // creating vendor credit for each bill
                    var vendorCreditObjRecord3 = record.transform({ fromType: 'vendorbill', fromId: billId, toType: 'vendorcredit', isDynamic: true });
                    removeVendorCreditLines(vendorCreditObjRecord3);
                    for (var lineNumber = 0; lineNumber < billItems.length; lineNumber++) {
                        vendorCreditObjRecord3.selectNewLine({ sublistId: 'item' });
                        vendorCreditObjRecord3.setCurrentSublistValue({ sublistId: 'item', fieldId: 'item', value: billItems[lineNumber].itemId });
                        // vendorCreditObjRecord.setCurrentSublistValue({ sublistId: 'item', fieldId: 'location', value: variance_array[lineNumber].billItemLocationId });
                        vendorCreditObjRecord3.setCurrentSublistValue({ sublistId: 'item', fieldId: 'quantity', value: billItems[lineNumber].quantityVal });
                        vendorCreditObjRecord3.setCurrentSublistValue({ sublistId: 'item', fieldId: 'rate', value: '' });
                        vendorCreditObjRecord3.setCurrentSublistValue({ sublistId: 'item', fieldId: 'description', value: billItems[lineNumber].descriptionVal });
                        vendorCreditObjRecord3.setCurrentSublistValue({ sublistId: 'item', fieldId: 'amount', value: billItems[lineNumber].amountVal });
                        vendorCreditObjRecord3.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_upc_code', value: billItems[lineNumber].upcCodeVal});
                        vendorCreditObjRecord3.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_vendorsku_imported', value: billItems[lineNumber].vendorSkuVal });
                        vendorCreditObjRecord3.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_item_description', value: billItems[lineNumber].itemColDescription });
                        vendorCreditObjRecord3.setCurrentSublistValue({ sublistId: 'item', fieldId: 'custcol_ref_billno', value: billItems[lineNumber].vendorBillInternalId });
                        vendorCreditObjRecord3.commitLine({ sublistId: 'item' });
                    }
                    log.debug('after each loop');

                    for (var lineNumber2 = 0; lineNumber2 < vendorCreditObjRecord3.getLineCount({ sublistId: 'apply' }); lineNumber2++) {

                        // select line
                        vendorCreditObjRecord3.selectLine({ sublistId: 'apply', line: lineNumber2 });

                        // get vendor bill internal id
                        var i_vendorId = vendorCreditObjRecord3.getCurrentSublistValue({ sublistId: 'apply', fieldId: 'internalid' });

                        if (i_vendorId == billId) {
                            log.audit('i_vendorId', i_vendorId);
                            log.audit('billToApply', billId);
                            vendorCreditObjRecord3.setCurrentSublistValue({
                                sublistId: 'apply',
                                fieldId: 'apply',
                                value: true
                            });
                            vendorCreditObjRecord3.setCurrentSublistValue({
                                sublistId: 'apply',
                                fieldId: 'amount',
                                value: vendorCreditAmountVal
                            });
                            vendorCreditObjRecord3.commitLine({
                                sublistId: 'apply'
                            });
                            break;
                        }
                    }

                    // set created from shortpay as true
                    vendorCreditObjRecord3.setValue('custbody_created_from_shortpay', true);
                    vendorCreditObjRecord3.setValue('custbody_dd_created_by_edi_script', false);
                    vendorCreditObjRecord3.setValue('custbody_dd_purchase_order_reference', purchaseOrderTranId);
                    vendorCreditObjRecord3.setValue('custbody_credit_applies_to_bill', billId);

                    // save the vendor credit record
                    var vendorCreditId = vendorCreditObjRecord3.save({ ignoreMandatoryFields: true, enableSourcing: true });
                    log.debug('after creating each vendor credits: ', vendorCreditId);
                    vendorCreditsArray.push(vendorCreditId);
                }
                log.debug('multiple credits: vendorCreditsArray', vendorCreditsArray);
                return true;
            }

            var billToApply = getVendorBillToAppy(purchaseOrderId, vendorCreditAmountVal);

            // log
            log.audit('createVendorCredit: vendorCreditAmountVal: ', vendorCreditAmountVal);
            log.audit('createVendorCredit: billToApply: ', billToApply);

            // loop through apply and apply the vendor credit value
            for (var lineNumber2 = 0; lineNumber2 < vendorCreditObjRecord.getLineCount({ sublistId: 'apply' }); lineNumber2++) {

                // select line
                vendorCreditObjRecord.selectLine({ sublistId: 'apply', line: lineNumber2 });

                // get vendor bill internal id
                var i_vendorId = vendorCreditObjRecord.getCurrentSublistValue({ sublistId: 'apply', fieldId: 'internalid' });

                if (i_vendorId == billToApply) {
                    log.audit('i_vendorId', i_vendorId);
                    log.audit('billToApply', billToApply);
                    vendorCreditObjRecord.setCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'apply',
                        value: true
                    });
                    vendorCreditObjRecord.setCurrentSublistValue({
                        sublistId: 'apply',
                        fieldId: 'amount',
                        value: vendorCreditAmountVal
                    });
                    vendorCreditObjRecord.commitLine({
                        sublistId: 'apply'
                    });
                    break;
                }
            }

            // set created from shortpay as true
            vendorCreditObjRecord.setValue('custbody_created_from_shortpay', true);
            vendorCreditObjRecord.setValue('custbody_dd_created_by_edi_script', false);
            vendorCreditObjRecord.setValue('custbody_dd_purchase_order_reference', purchaseOrderTranId);
            vendorCreditObjRecord.setValue('custbody_credit_applies_to_bill', billToApply);

            // log
            log.debug('check the line items length', vendorCreditObjRecord.getLineCount({ sublistId: 'item' }));

            // if there are no items then return false
            if (vendorCreditObjRecord.getLineCount({ sublistId: 'item' }) == 0) return false;

            // save the vendor credit record
            return vendorCreditObjRecord.save({ ignoreMandatoryFields: true, enableSourcing: true });
        }

        /**
         * remove vendor credit line
         * @param vendor_credit_obj
         * @returns {*}
         */
        function removeVendorCreditLines(vendor_credit_obj) {

            // remove all lines from vendor credit
            for(var i = vendor_credit_obj.getLineCount('item') - 1; i >= 0; i--) {

                // log
                // log.debug('removeVendorCreditLines: line number', i);

                // remove line
                vendor_credit_obj.removeLine({ sublistId: 'item', line: i, ignoreRecalc: true });
            }

            // loop through apply lines and remove very first bill used to transform the vendor credit
            var appliedLineNumber = vendor_credit_obj.findSublistLineWithValue({ sublistId: 'apply', fieldId: 'apply', value: true });

            // log
            log.debug('removeVendorCreditLines: appliedLineNumber', appliedLineNumber);

            // if applied line number has value
            if (appliedLineNumber >= 0) {

                // remove already applied lines, which is used in transform record
                vendor_credit_obj.selectLine({ sublistId: 'apply', line: appliedLineNumber });
                vendor_credit_obj.setCurrentSublistValue({ sublistId: 'apply', fieldId: 'apply', value: false });
            }

            // remove all expense lines
            for(var j = vendor_credit_obj.getLineCount('expense') - 1; j >= 0; j--) {

                // log
                log.debug('removing expense line: removeVendorCreditLines: line number', j);

                // remove line
                vendor_credit_obj.removeLine({ sublistId: 'expense', line: j, ignoreRecalc: true });
            }

            // return the updated vendor credit obj
            return vendor_credit_obj;
        }

        /**
         * get vendor bills to apply
         * @param po_internal_id
         * @param vendor_credit_amount
         * @returns {number|boolean}
         */
        function getVendorBillToAppy(po_internal_id, vendor_credit_amount) {

            // find the bill amount which is greater than or equal to vendor credit amount
            var vendorbillSearchObj = search.create({
                type: 'vendorbill',
                filters: [
                    [ 'type', 'anyof', 'VendBill' ], 'AND',
                    [ 'createdfrom', 'anyof', po_internal_id ], 'AND',
                    [ 'mainline', 'is', 'T' ], 'AND',
                    [ 'totalamount', 'greaterthanorequalto', vendor_credit_amount ]
                ],
                columns: [
                    'internalid',
                    search.createColumn({ name: 'amount', sort: search.Sort.ASC })
                ]
            });

            // if there are no results found then return false
            if (vendorbillSearchObj.runPaged().count == 0) return false;

            // if results found then take the first bill
            var vendorBillsArray = vendorbillSearchObj.run().getRange(0,1);

            // return
            return vendorBillsArray[0].id;
        }

        /**
         * approve all bills
         * @param related_bills_array
         */
        function approveAllBills(related_bills_array) {

            // loop through bills and appove it
            for (var i = 0; i < related_bills_array.length; i++) {

                // approve all bills
                record.submitFields({
                    type: 'vendorbill',
                    id: related_bills_array[i],
                    values: {
                        'custbody_approved_from_shortpay': true,
                        'approvalstatus': 2
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            }

        }

        /**
         * get all related bills
         * @param po_internal_id
         * @returns {*[]}
         */
        function getAllRelatedBills(po_internal_id) {

            // bills array
            var billsArray = [];

            // get all related bills
            var vendorbillSearchObj = search.create({
                type: 'vendorbill',
                filters: [
                    [ 'type', 'anyof', 'VendBill' ], 'AND',
                    [ 'createdfrom', 'anyof', po_internal_id ], 'AND',
                    [ 'mainline', 'is', 'T' ], 'AND',
                    ['approvalstatus','noneof','2'],
                ],
                columns: [
                    search.createColumn({ name: 'internalid', sort: search.Sort.DESC })
                ]
            });

            // vendor search obj
            vendorbillSearchObj.run().each(function(result){

                // push all results in bills array
                billsArray.push(result.id);
                return true;
            });

            // return all bills
            return billsArray;
        }

        function getBills(po_internal_id) {

            // bills array
            var billsArray = [];

            // get all related bills
            var vendorbillSearchObj = search.create({
                type: 'vendorbill',
                filters: [
                    [ 'type', 'anyof', 'VendBill' ], 'AND',
                    [ 'createdfrom', 'anyof', po_internal_id ], 'AND',
                    [ 'mainline', 'is', 'T' ], 'AND',
                    [ 'status', 'noneof', 'VendBill:B', 'VendPymt:D' ]
                ],
                columns: [
                    search.createColumn({ name: 'internalid', sort: search.Sort.DESC })
                ]
            });

            // vendor search obj
            vendorbillSearchObj.run().each(function(result){

                // push all results in bills array
                billsArray.push(result.id);
                return true;
            });

            // return all bills
            return billsArray;
        }

        function getAllRelatedBills2(po_internal_id) {

            // bills array
            var billsArray = [];

            // get all related bills
            var vendorbillSearchObj = search.create({
                type: 'vendorbill',
                filters: [
                    [ 'type', 'anyof', 'VendBill' ], 'AND',
                    [ 'createdfrom', 'anyof', po_internal_id ], 'AND',
                    [ 'mainline', 'is', 'T' ], 'AND',
                    ['approvalstatus','noneof','1'],
                ],
                columns: [
                    search.createColumn({ name: 'internalid', sort: search.Sort.DESC })
                ]
            });

            // vendor search obj
            vendorbillSearchObj.run().each(function(result){

                // push all results in bills array
                billsArray.push(result.id);
                return true;
            });

            // return all bills
            return billsArray;
        }

        function getRateOfUnit(unit) {

            var ratePerUnit;
            var unitstypeSearchObj = search.create({
                type: "unitstype",
                filters:
                    [
                        ["abbreviation","is",unit]
                    ],
                columns:
                    [
                        search.createColumn({name: "conversionrate", label: "Rate"})
                    ]
            });
            var searchResultCount = unitstypeSearchObj.runPaged().count;
            log.debug("unitstypeSearchObj result count from 1245",searchResultCount);
            // var scriptObj = runtime.getCurrentScript();
            // log.debug('Remaining governance units: ', scriptObj.getRemainingUsage());
            unitstypeSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                log.debug("unitstypeSearchObj result count result from line 1248",result);
                ratePerUnit = result.getValue({
                    name: "conversionrate",
                    label: "Rate"
                });
                return true;
            });
            log.debug('ratePerUnit: ', ratePerUnit);
            return ratePerUnit;
        }

        /**
         * Update rate and quantity flags on bills
         * @param variance_array
         * @param rate_variance_json
         * @param quantity_variance_json
         */
        function updateRateAndQuantityFlagsOnBill(variance_array, rate_variance_json, quantity_variance_json) {

            // log
            log.debug('updateRateAndQuantityFlagsOnBill: rate_variance_json', rate_variance_json);
            log.debug('updateRateAndQuantityFlagsOnBill: quantity_variance_json', quantity_variance_json);
            log.debug('updateRateAndQuantityFlagsOnBill: variance_array', variance_array);

            // loop through rate variance array and update the line values
            for (var lineNumber = 0; lineNumber < variance_array.length; lineNumber++) {

                // read vendor bill id
                var vendorBillInternalId = variance_array[lineNumber].billInternalId;

                // log
                log.debug('updateRateAndQuantityFlagsOnBill: vendorBillInternalId', vendorBillInternalId);

                // if there is no vendor bill internal id found then continue
                if (!vendorBillInternalId) continue;

                // load vendor bill record
                var vendorBillRecordObj = record.load({ type: 'vendorbill', id: vendorBillInternalId, isDynamic: true });

                // read the item values
                var itemInternalId = variance_array[lineNumber].itemId;
                var quantityVal = variance_array[lineNumber].vbQuantity;
                var differedQuantity = variance_array[lineNumber].quantityDifference;
                var differedRate = variance_array[lineNumber].rateDifference;
                var typeVal = variance_array[lineNumber].itemTypeText;
                var typeValBoth = variance_array[lineNumber].itemQuantityDifference;

                // log
                log.debug('updateRateAndQuantityFlagsOnBill: itemInternalId', itemInternalId);
                log.debug('updateRateAndQuantityFlagsOnBill: quantityVal', quantityVal);
                log.debug('updateRateAndQuantityFlagsOnBill: differedQuantity', differedQuantity);
                log.debug('updateRateAndQuantityFlagsOnBill: differedRate', differedRate);
                log.debug('updateRateAndQuantityFlagsOnBill: typeVal', typeVal);

                // find item index from vendor bill record
                // TODO: include vendor bill line id
                var vendorBillItemIndexVal = vendorBillRecordObj.findSublistLineWithValue({ sublistId: 'item', fieldId: 'item', value: itemInternalId });

                // log
                log.debug('updateRateAndQuantityFlagsOnBill: vendorBillItemIndexVal', vendorBillItemIndexVal);

                // if index not found then continue
                if (vendorBillItemIndexVal == -1) continue;

                // select line using vendor bill item line index
                vendorBillRecordObj.selectLine({sublistId: 'item', line: vendorBillItemIndexVal });

                if ((typeVal == 'PRICE_HIGHER' || typeVal == 'PRICE_LOWER') && !typeValBoth) {
                    vendorBillRecordObj.setCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_shortpay_item_rate_flag', text: typeVal });
                } else if (typeVal == 'ITEM_DISCOUNT') {
                    vendorBillRecordObj.setCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_shortpay_item_rate_flag', text: typeVal });
                    vendorBillRecordObj.setCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_shortpay_item_qty_flag', text: 'ITEM_NOT_ON_PO_MULESOFT_810' });
                } else if ((typeVal == 'ITEM_SHORTSHIP' || typeVal == 'ITEM_OVERSHIP') && !typeValBoth) {
                    vendorBillRecordObj.setCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_shortpay_item_qty_flag', text: typeVal });
                } else if (typeValBoth && typeVal == 'PRICE_HIGHER') {
                    vendorBillRecordObj.setCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_shortpay_item_rate_flag', text: 'PRICE_HIGHER' });
                    vendorBillRecordObj.setCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_shortpay_item_qty_flag', text: 'ITEM_SHORTSHIP' });
                } else if (typeValBoth && typeVal == 'ITEM_SHORTSHIP') {
                    vendorBillRecordObj.setCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_shortpay_item_rate_flag', text: 'PRICE_LOWER' });
                    vendorBillRecordObj.setCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_shortpay_item_qty_flag', text: 'ITEM_SHORTSHIP' });
                }
                vendorBillRecordObj.commitLine({ sublistId: 'item' });

                // save the vendor bill record
                var vendorBillId = vendorBillRecordObj.save({ignoreMandatoryFields: true, enableSourcing: true});

                // log
                log.debug('updateRateAndQuantityFlagsOnBill: vendorBillId', vendorBillId);
            }
        }

        function checkShortPayEnabledDate(po_internal_id) {

            var shortPayEnabledDateCheck = false;
            var vendorbillSearchObj = search.create({

                type: "vendorbill",
                settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
                filters:
                    [
                        ["type","anyof","VendBill"],
                        "AND",
                        ["createdfrom.internalidnumber","equalto",po_internal_id],
                        "AND",
                        ["mainline","is","T"]
                    ],
                columns:
                    [
                        search.createColumn({name: "trandate", label: "Date"}),
                        search.createColumn({name: "entity", label: "Name"}),
                        search.createColumn({
                            name: "custentity_shortpay_date",
                            join: "vendor",
                            label: "Short Pay Go-Live Date"
                        })
                    ]
            });
            var searchResultCount = vendorbillSearchObj.runPaged().count;
            log.debug("vendorbillSearchObj result count",searchResultCount);
            vendorbillSearchObj.run().each(function(result){
                // .run().each has a limit of 4,000 results
                var billDate = result.getValue({name: "trandate", label: "Date"});
                var vendorShortPayDate = result.getValue({ name: "custentity_shortpay_date", join: "vendor", label: "Short Pay Go-Live Date" });
                log.debug("billDate", billDate);
                log.debug("vendorShortPayDate", vendorShortPayDate);
                if (new Date(billDate) >= new Date(vendorShortPayDate)) shortPayEnabledDateCheck = true;
                return true;
            });

            return shortPayEnabledDateCheck;
        }

        // return entry points
        return { getInputData, map, reduce, summarize }
    });