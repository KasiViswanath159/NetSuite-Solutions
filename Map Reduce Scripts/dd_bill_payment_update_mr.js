/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
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
                // Load the saved search and then return the to map stage.
                return search.load({
                    id: "customsearch_eft_bank_payment_status_rec"
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

                // Getting the EFT Bank Payment Status Record internal id. 
                var recId = JSON.parse(context.value);
                log.debug("recId", recId.id);

                // Make a search on {EFT Bank Payment Status Record} and getting results.
                var eftSearchObj = search.lookupFields({
                    type: "customrecord_eft_bank_payment_status",
                    id: recId.id,
                    columns: ["custrecord_eft_transaction_id", "custrecord_eft_bank_pymt_status", "custrecord_eft_transaction_number", "custrecord_eft_error_description", "custrecord_eft_error_code"]
                });
               // log.debug("eftSearchObj", eftSearchObj);

                // When the status is ACSP {ACCEPTED} update Vendor payment record and EFT Bank Payment Status Record fields 
                var EFT_STATUS = eftSearchObj.custrecord_eft_bank_pymt_status;

                if (isNullOrEmpty(EFT_STATUS)) {
                    return;
                }; 

                if (EFT_STATUS == "ACSP") {
                    var vendorPayMentRec = record.load({
                        type: "vendorpayment",
                        id: eftSearchObj.custrecord_eft_transaction_id,
                        isDynamic: true,
                    })
                    vendorPayMentRec.setValue("custbody_dd_jpm_payment_status", "Level1 Completed" );
                    var vendorPayMentRecId = vendorPayMentRec.save(true, true);
                    log.debug("vendorPayMentRecId", vendorPayMentRecId);

                    var eftRecId = record.submitFields({
                        type: "customrecord_eft_bank_payment_status",
                        id: recId.id,
                        values: { "custrecord_eft_record_process_status": true, "custrecord_eft_process_date": getNSDateFormat() }
                    });
                   // log.debug("eftRecId", eftRecId);
                    // When the status is ACSP {REJECTED} update Vendor payment record and EFT Bank Payment Status Record fields 
                    // When the status is ACSP {REJECTED} then void the vendor payment transaction 
                } else if (EFT_STATUS == "RJCT") {
                    var vendorPayMentRec = record.load({
                        type: "vendorpayment",
                        id: eftSearchObj.custrecord_eft_transaction_id,
                        isDynamic: true,
                    })
                    vendorPayMentRec.setValue("custbody_dd_jpm_payment_status", "Level1 Failed" );
                    vendorPayMentRec.setValue("custbody_dd_payment_rejection_rc", eftSearchObj.custrecord_eft_error_code);
                    vendorPayMentRec.setValue("custbody_dd_jpm_payment_notes", eftSearchObj.custrecord_eft_error_description)
                    var vendorPayMentRecId = vendorPayMentRec.save(true, true);
                   // log.debug("vendorPayMentRecId", vendorPayMentRecId);

                    var eftRecId = record.submitFields({
                        type: "customrecord_eft_bank_payment_status",
                        id: recId.id,
                        values: { "custrecord_eft_record_process_status": true, "custrecord_eft_process_date": getNSDateFormat() }
                    });
                    //log.debug("eftRecId", eftRecId);
                    var voidInvoiceID = transaction.void({
                        type: "vendorpayment",
                        id: eftSearchObj.custrecord_eft_transaction_id
                    });
                   // log.debug("voidInvoiceID", voidInvoiceID);
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