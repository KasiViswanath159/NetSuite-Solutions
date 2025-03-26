/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/search'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search) => {
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

            try {

                var customrecord_dd_edi_process_historySearchObj = search.create({
                    type: "customrecord_dd_edi_process_history",
                    filters:
                        [
                            ["custrecord_dd_source_file_name", "contains", ""],
                            "AND",
                            ["formulatext: coalesce({custrecord_dd_generated_vendor_bills},{custrecord_dd_invoice_number})", "contains", ""],
                            "AND",
                            ["custrecord_dd_his_edi_type", "noneof", "2"],
                            "AND",
                            ["custrecord_dd_reason_for_failure", "startswith", "Fail to transform"],
                            "AND",
                            ["custrecord_dd_force_post", "is", "F"],
                            "AND",
                            ["custrecord_dd_process_status", "anyof", "3", "6"],
                            "AND",
                            ["created", "within", "thismonth"]
                        ],
                    columns:
                        [
                            "internalid"
                        ]
                });

                let results = executeSearch(customrecord_dd_edi_process_historySearchObj);
                 log.debug("results", results.length);
             
                return results;

            } catch (e) {
                log.error('error in getinputdata', typeof e);
                var msg = '';
                if (e.hasOwnProperty('message')) {
                    msg = e.name + ': ' + e.message;
                    log.error({
                        title: 'System Error',
                        details: e.name + '' + e.message + '' + JSON.stringify(e.stack)
                    });
                } else {
                    msg = e.toString();
                    log.error({
                        title: 'Unexpected Error',
                        details: e.toString(msg)
                    });
                }
            }
            //return ddHistoryRecordsObj;

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
                // log.debug("reduceContext.key", reduceContext.key)

                let DD_EDIHistoryRecordObj = JSON.parse(reduceContext.values[0]);
                log.debug("DD_EDIHistoryRecordObj", DD_EDIHistoryRecordObj);

                // Get the dd history record id 
                let DD_History_Id = DD_EDIHistoryRecordObj.id;
                if (DD_History_Id) {
                    record.submitFields({
                        type: "customrecord_dd_edi_process_history",
                        id: DD_History_Id,
                        values: { "custrecord_dd_force_post": true },
                    });
                }

            } catch (e) {
                log.error('error in reduce', typeof e);
                var msg = '';
                if (e.hasOwnProperty('message')) {
                    msg = e.name + ': ' + e.message;
                    log.error({
                        title: 'System Error',
                        details: e.name + '' + e.message + '' + JSON.stringify(e.stack)
                    });
                } else {
                    msg = e.toString();
                    log.error({
                        title: 'Unexpected Error',
                        details: e.toString(msg)
                    });
                }
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

        }

        /*
    * helper function to get the search results
    */
        function executeSearch(srch) {
            var results = [];

            var pagedData = srch.runPaged({
                pageSize: 1000
            });
            pagedData.pageRanges.forEach(function (pageRange) {
                var page = pagedData.fetch({
                    index: pageRange.index
                });
                page.data.forEach(function (result) {
                    results.push(result);
                });
            });
            return results;
        };



        return { getInputData, reduce, summarize }



    });
