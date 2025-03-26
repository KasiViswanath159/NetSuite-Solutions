/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *  Task                     Date          Author              Remarks
 * Vendor Payment update     11-22-2022          
 */
define(['N/record', 'N/runtime', 'N/search', 'N/file', 'N/format', 'N/transaction'],
    /**
     * @param {file} file
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     */
    function (record, runtime, search, file, format, transaction) {

        /**
         * Marks the beginning of the Map/Reduce process and generates input data.
         *
         * @typedef {Object} ObjectRef
         * @property {number} id - Internal ID of the record instance
         * @property {string} type - Record type id
         *
         * @return {Array|Object|Search|RecordRef} inputSummary
         * @since 2015.1
         */

        function getInputData() {
            try {
                // Load the EFT Bank Payment  Status  L2 Search saved search and then return the to map stage.
                return search.load({
                    id: "customsearch_eft_bank_payment_status_l2" // EFT Bank Payment  Status  L2 Search
                });
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
                        details: e.toString()
                    });
                }
                throw msg;
            }
        }

        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1
         */
        function map(context) {
            try {
                // Getting the EFT Bank Payment Status Record transaction number. 
                var recId = JSON.parse(context.value);
                var transactionNumber = recId.values["GROUP(custrecord_eft_transaction_number)"];
                log.debug("transactionNumber", transactionNumber);

                var errorCodes = [];
                var errorDescription = [];
                var eftPaymentRecordIds = [];
                var errorCodeStr = "";
                var errorDescriptionStr = "";

                if (!isNullOrEmpty(transactionNumber)) {

                    // Making a search on EFT Bank Payment Status custom record to get the follwing details. 
                    // Error Code 
                    // Error Description
                    // EFT Bannk Payment internal ids. 

                    var eftSearchObj = search.create({
                        type: "customrecord_eft_bank_payment_status",
                        filters: [
                            ["custrecord_eft_transaction_number", "is", transactionNumber],
                            "AND",
                            ["custrecord_eft_bank_pymt_status", "is", "RJCT"],
                            "AND", 
                            ["custrecord_eft_record_process_status","is","F"], 
                            "AND", 
                            ["custrecord_eft_bank_pymt_status_level","is","L2"],
                            
                        ],
                        columns: [
                            "custrecord_eft_bank_pymt_status",
                            "custrecord_eft_transaction_number",
                            "custrecord_eft_error_code",
                            "custrecord_eft_error_description",
                            "internalid"
                        ]
                    });


                    // Execute the search and get results.
                    var searchResults = executeSearch(eftSearchObj);
                    log.debug("searchResults", searchResults);
                    log.debug("searchResults- Count", searchResults.length);


                    // Looping through the search results and prepare the error codes, error description and  EFT payment internal id's
                    for (var i = 0; i < searchResults.length; i++) {
                        eftPaymentRecordIds.push(searchResults[i].getValue("internalid"));
                        errorCodes.push(searchResults[i].getValue("custrecord_eft_error_code"));
                        errorDescription.push(searchResults[i].getValue("custrecord_eft_error_description"));
                    };
                    // If errorCodes array has valus then concatenating strings by using the _ operator
                    if (errorCodes.length > 0) {
                        errorCodeStr = errorCodes.join(",").split(',').join(' && ')
                    };

                    // If errorDescription array has valus then concatenating strings by using the _ operator
                    if (errorDescription.length > 0) {
                        errorDescriptionStr = errorDescription.join(",").split(',').join(' && ')
                    };

                    // Making a search on vendor payment transaction record to get the transaction internal id.
                    var vendorPaymentsearch = search.create({
                        type: "vendorpayment",
                        filters:
                            [
                                ["type", "anyof", "VendPymt"],
                                "AND",
                                ["formulatext: {number}", "is", transactionNumber],
                                 "AND",
                                ["custbody_9997_pfa_record", "noneof", "@NONE@"],
                                "AND",
                                ["custbody_9997_is_for_ep_eft", "is", "T"]
                            ],
                        columns:
                            [
                                search.createColumn({
                                    name: "internalid",
                                    summary: "GROUP",
                                }),

                            ]
                    });

                    // Execute the search and get the results.
                    var vendorPaymentResults = executeSearch(vendorPaymentsearch);
                    log.debug("vendorPaymentResults", vendorPaymentResults);

                    // Getting the vendor payment transaction internal id.
                    var transactionId = vendorPaymentResults[0].getValue({
                        name: "internalid",
                        summary: "GROUP",
                    });

                    log.debug("transactionId", transactionId);

                    // If vendor payment internal is not empty then load the vendor payment record and update the follwing field values.
                    // BANK PAYMENT STATUS
                    // BANK PAYMENT NOTES
                    // BANK PAYMENT REJECTION REASON CODE
                    // BANK PAYMENT STATUS UPDATE DATE. 

                    if (!isNullOrEmpty(transactionId)) {
                        var vendorPayMentRec = record.load({
                            type: "vendorpayment",
                            id: transactionId,
                            isDynamic: true,
                        })
                        vendorPayMentRec.setValue("custbody_dd_jpm_payment_status", "Level2 Failed");
                        vendorPayMentRec.setValue("custbody_dd_payment_rejection_rc", errorCodeStr);
                        vendorPayMentRec.setValue("custbody_dd_jpm_payment_notes", errorDescriptionStr);
                        vendorPayMentRec.setValue("custbody_dd_bank_payment_status_u_date", getNSDateFormat())
                        var vendorPayMentRecId = vendorPayMentRec.save(true, true);
                        log.debug("vendorPayMentRecId", vendorPayMentRecId);

                        // Looping the eftpayment record id's and update the follwing field values. 
                        // Record process status 
                        // EFT Process Date.

                        if (eftPaymentRecordIds.length > 0) {
                            for (var i = 0; i < eftPaymentRecordIds.length; i++) {
                                var eftRecId = record.submitFields({
                                    type: "customrecord_eft_bank_payment_status",
                                    id: eftPaymentRecordIds[i],
                                    values: { "custrecord_eft_record_process_status": true, "custrecord_eft_process_date": getNSDateFormat() }
                                });
                                log.debug("eftRecId", eftRecId);
                            }
                        }


                        // Voiding the vendor payment record.
                        var voidInvoiceID = transaction.void({
                            type: "vendorpayment",
                            id: transactionId
                        });
                        log.debug("voidInvoiceID", voidInvoiceID);
                    }
                }

            } catch (e) {
                log.error('error in map');
                var msg = '';

                if (e.hasOwnProperty('message')) {
                    msg = e.name + ': ' + e.message;
                    log.error({
                        title: 'Map System Error',
                        details: e.name + '' + e.message + '' + JSON.stringify(e.stack)
                    });
                } else {
                    msg = e.toString();
                    log.error({
                        title: 'Unexpected Error',
                        details: e.toString()
                    });
                }
                context.write("error", msg);
            }
        }

        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        function summarize(summary) {
            try {
                var errors = [];
                summary.output.iterator().each(function (key, value) {
                    log.debug("summary: " + key, value);
                    if (key == "error") {
                        errors.push(value);
                    }
                    return true;
                });

                log.debug("errors", errors);

            } catch (e) {
                log.error('error in summarize');
                var msg = '';

                if (e.hasOwnProperty('message')) {
                    msg = e.name + ': ' + e.message;
                    log.error({
                        title: 'summarize System Error',
                        details: e.name + '' + e.message + '' + JSON.stringify(e.stack)
                    });
                } else {
                    msg = e.toString();
                    log.error({
                        title: 'Unexpected Error',
                        details: e.toString()
                    });
                }
            }
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


        var getNSDateFormat = function () {
            var date = new Date();
            var day = date.getDate();
            var month = date.getMonth() + 1;
            var year = date.getFullYear();
            var formattedDate = month + "/" + day + "/" + year;
            return format.parse({
                value: formattedDate.toString(),
                type: format.Type.DATE
            });
        };

        /*
       * Validating if value is null or empty
       */
        function isNullOrEmpty(val) {
            if (val == null || val == '' || val == "" || val == 'undefined' || val == undefined || val == [] || val == {} || val == '{}' || val == NaN) {
                return true;
            } else {
                return false;
            }
        };

        return {
            getInputData: getInputData,
            map: map,
            summarize: summarize
        };

    });