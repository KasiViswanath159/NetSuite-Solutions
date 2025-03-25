/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime', 'N/search', 'N/error', './DoorDashTool'],
    /**
     * @param{record} record
     * @param{runtime} runtime
     * @param{search} search
     */
    (record, runtime, search, error, ddt) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            if (runtime.executionContext == runtime.ContextType.CSV_IMPORT || runtime.executionContext == runtime.ContextType.WEBSERVICES || runtime.executionContext == runtime.ContextType.REST_WEBSERVICES) {
                const currentPoTotal = scriptContext.newRecord.getValue({
                    fieldId: "total"
                });
                //Document the Purcahse Contract Maximum Amount since we can't get this amount by savedsearch

                const currentPoDate = scriptContext.newRecord.getValue({
                    fieldId: "trandate"
                });

                // log.debug('maxContractAmountInfo.startdate',maxContractAmountInfo.startdate);
                const contractId = scriptContext.newRecord.getValue({
                    fieldId: "purchasecontract"
                });
                // log.debug('maxContractAmountInfo.startdate',maxContractAmountInfo.startdate);
                if (contractId) {


                    const maxContractAmountInfo = search.lookupFields({
                        type: search.Type.TRANSACTION,
                        id: contractId,
                        columns: ["maximumamount", "startdate"]
                    });
                    log.debug('maxContractAmountInfo.startdate', maxContractAmountInfo.maximumamount);

                    log.debug('maxContractAmountInfo.startdate', maxContractAmountInfo.startdate);

                    if (new Date(currentPoDate) < new Date(maxContractAmountInfo.startdate)) {

                        log.debug('Inside First If', maxContractAmountInfo.startdate);


                        throw "PO date is earlier than Contract start date";

                    } else {

                        log.debug('Inside First Else', 'Inside First Else');


                        // const contractNum = scriptContext.newRecord.getText({fieldId: "purchasecontract"});
                        const maxContractAmountInfos = search.lookupFields({
                            type: search.Type.TRANSACTION,
                            id: contractId,
                            columns: "maximumamount"
                        });
                        const sumPoAmt = ddt.getTotalPOAmount(contractId, scriptContext.newRecord.id);
                        log.debug('sumPoAmt', sumPoAmt);

                        const totalLinkedAmount = Number(sumPoAmt) + Number(currentPoTotal);

                        log.debug('totalLinkedAmount', totalLinkedAmount);

                        // Current po has over contract maximum amount.
                        if (totalLinkedAmount > Number(maxContractAmountInfos.maximumamount)) {
                            log.debug('Inside Second If', maxContractAmountInfos.maximumamount);


                            // throw error.create({name: "OVER_PUECHASE_CONTRACT_MAX_AMOUNT", message: "Over Maximum amount of Purchase Contract ", notifyOff: true});
                            throw "Over maximum amount of Purchase Contract";

                        }
                    }

                } else {
                    log.debug('Inside Second Else', 'Inside Second Else');


                    throw "No purchase contract available";
                }


                var lineItems = scriptContext.newRecord.getLineCount({
                    sublistId: 'item'
                });
                  
              
                if (lineItems) {
                    var itemIds = [];
                    var lineStart = 0;
                    if (scriptContext.type == 'edit') {
                        var oldItems = scriptContext.oldRecord.getLineCount({
                            sublistId: 'item'
                        });
                        lineStart = (lineItems) - (oldItems);
                    }
                    log.debug('lineItems' + lineStart, 'lineItems' + lineItems + '///' + oldItems);
                    for (var i = lineStart; i < lineItems; i++) {
                        var itemId = scriptContext.newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: i
                        });
                      var rateText = scriptContext.newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            line: i
                        }).toString();

                        var measures = scriptContext.newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'units',
                            line: i
                        });
                        var vendorUOMVal = scriptContext.newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_dd_vendor_uom',
                            line: i
                        });

                        if (scriptContext.type == 'create') {
                            if(measures == '513' || measures == '514') {
                                throw 'Error: Units CS/1 is not allowed';
                            }
                            if(vendorUOMVal == '') {
                                throw 'Error: vendor UOM is empty';
                            }
                            if(vendorUOMVal == 'CS/1') {
                                throw 'Error: Units CS/1 is not allowed';
                            }
                            if(vendorUOMVal == 'EA/1') {
                                throw 'Error: Units EA/1 is not allowed';
                            }
                        }

                      if(rateText.indexOf('.')!=-1 && scriptContext.type == 'create'){
                     var  number_to_text = rateText.split(".");
                      var decimalPlaces = number_to_text[1];
                      log.debug('decimalPlaces',decimalPlaces);
                      if(decimalPlaces.length>2){
                       throw 'Error:  The rate is more than 2 decimals';
                      }
                      }
                    if (itemIds.indexOf(itemId) !== -1 && scriptContext.type == 'create') {
                            log.debug('Inside Condition', itemIds);

                            var lookupItemName = search.lookupFields({
                                type: search.Type.ITEM,
                                id: itemId,
                                columns: ['itemid']
                            });
                            log.debug('lookupItemName', lookupItemName);


                            var itemName = lookupItemName.itemid;
                            log.debug('itemName', itemName);


                            throw 'Error: Duplicate line item with item ID ' + itemName;
                        }
                        itemIds.push(itemId)
                    }
                }


          /*      if (lineItems) {

                    for (var i = 0; i < lineItems; i++) {
                        var getRate = scriptContext.newRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            line: i
                        });
                        log.debug('getRate', getRate);
                        if (scriptContext.type == 'edit') {
                         var oldrate = scriptContext.oldRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'rate',
                            line: i
                        });
                        
                          
                          
                       if(getRate!=oldrate){
                         throw 'Error: Item Rate cannot be updated! ';
                       }
                      
                          
                    }
                        if (getRate <= '0' || getRate == '') {
                            log.debug('Inside Condition', getRate);

                            throw 'Error: Rate value is $0 ';
                        }

                    }
                } */

           }
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

        }

        return {
           beforeSubmit
        }

    });