/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url', "N/redirect", "N/log", "N/task", 'N/record'],

    (runtime, search, url, redirect, log, task, record) => {
        'use strict';

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
            // Get search result and pass it to map entry point.
          var scriptObj = runtime.getCurrentScript();
            var searchId = scriptObj.getParameter({name:'custscript_search_to_fetch_data'});
             log.audit({
                title: "searchId: ",
                details: searchId
            });
            return search.load({
                id: searchId
            });
      //return search results to Map phase;
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
            const result = mapContext.value && JSON.parse(mapContext.value);
            const poId = result.id;
            const recType = result.recordType;
            log.audit({
                title: "PO Being Processed: ",
                details: poId
            });
            try {
                // remove items for PC
                if (poId) {
                    //pass the data to reduce context:
                    mapContext.write({
                        key: poId,
                        value: recType
                    });

                }
            } catch (e) {
                log.debug("Exception on Map entrypoint while remove items for pc:" + poId, e)
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
            const id = reduceContext.key;
            log.audit({title:"id: ",details:id});
          log.audit({title:"reduceContext.value: ",details:reduceContext});
            //const recordType = context.values[0];
            //const irArr = getReceipt(id);
            //log.audit({title:"irArr: ",details:irArr});
            //if(irArr.length>0)
           // {
            //        const jeData = getGlImpact(id);
           //         log.audit({title:"jeData: ",details:jeData});
            //}//
           // else{
           //     log.audit({title:"No Receipts : ",details:id+" has no Receipts."});
           // }
    
      var poRecord = record.load({
    type: 'purchaseorder',
    id: reduceContext.key,
    isDynamic: true,
});
           const poLineCount = poRecord.getLineCount({
        sublistId: 'item'
      });
          try{
            log.audit({title:"poLineCount : ",details:poLineCount});
      for(let i = 0; i < poLineCount; i++){
            poRecord.selectLine({
      sublistId: 'item',
      line: i
    });
    poRecord.setCurrentSublistValue({
      sublistId: 'item',
      fieldId: 'isclosed',
      value: true
    });
    poRecord.commitLine({
      sublistId: 'item'
    });
    
      }
          poRecord.save();
          }
          catch(e){
            log.audit({title:"Error : ",details:e.message});
          }
          
      
          
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
                        title: 'Map error for key: ' + key + ', execution no. ' + executionNo,
                        details: JSON.stringify(error)
                    });
                    return true;
                }
            );
        }

        const getReceipt = (poId) => {
            let recArr = [];
            const itemreceiptSearchObj = search.create({
                type: "itemreceipt",
                filters: [
                    ["type", "anyof", "ItemRcpt"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["createdfrom", "anyof", poId]
                ],
                columns: [
                    search.createColumn({
                        name: "internalid",
                        label: "Document Number"
                    })
                ]
            });
            var searchResultCount = itemreceiptSearchObj.runPaged().count;
            log.debug("itemreceiptSearchObj result count", searchResultCount);
            itemreceiptSearchObj.run().each(function (result) {
                const irId = result.getValue({
                    name: 'internalid'
                });
                if (irId) {
                    recArr.push(irId);
                }
                return true;
            });

            return recArr.length > 0 ? recArr : false;
        }


        //get JE Data

        const getGlImpact = (poId) => {
            let jeCreationArr = [];
            
            let transactionSearchObj = search.create({
                type: "transaction",
                filters: [
                    ["posting", "is", "T"],
                    "AND",
                    ["amount", "notequalto", "0.00"],
                    "AND",
                    ["accounttype", "noneof", "@NONE@"],
                    "AND",
                    ["type", "anyof", "ItemRcpt"],
                    "AND",
                    ["createdfrom", "anyof", poId]
                ],
                columns: [
                    search.createColumn({
                        name: "trandate",
                        summary: "GROUP",
                        label: "Date"
                    }),
                    search.createColumn({
                        name: "postingperiod",
                        summary: "GROUP",
                        label: "Period"
                    }),
                    search.createColumn({
                        name: "type",
                        summary: "GROUP",
                        label: "Type"
                    }),
                    search.createColumn({
                        name: "tranid",
                        summary: "GROUP",
                        label: "Document Number"
                    }),
                    search.createColumn({
                        name: "entity",
                        summary: "GROUP",
                        label: "Name"
                    }),
                    search.createColumn({
                        name: "account",
                        summary: "GROUP",
                        label: "Account"
                    }),
                    search.createColumn({
                        name: "debitamount",
                        summary: "SUM",
                        label: "Amount (Debit)"
                    }),
                    search.createColumn({
                        name: "creditamount",
                        summary: "SUM",
                        label: "Amount (Credit)"
                    })
                ]
            });
            const searchResultCount = transactionSearchObj.runPaged().count;
            transactionSearchObj.run().each(function (result) {
                // .run().each has a limit of 4,000 results
                let jeDataObj = {};
                const acc = result.getValue({name:"account",summary:"GROUP"});
                const creditAmt = result.getValue({name:"debitamount",summary:"SUM"});
                const debitAmt = result.getValue({name:"creditamount",summary:"SUM"});
                jeDataObj.account = acc;
                jeDataObj.credit = creditAmt;
                jeDataObj.debit = debitAmt;
                jeCreationArr.push(jeDataObj);
                return true;
            });

            return jeCreationArr;

        }



        return {
            getInputData,
            map,
            reduce,
            summarize
        }

    });