/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/email', 'N/runtime', 'N/search', './common_lib'],
    /**
     * @param{email} email
     * @param{runtime} runtime
     * @param{search} search
     */
    (email, runtime, search, lib) => {
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
                const scriptObj = runtime.getCurrentScript();
                const param = scriptObj.getParameter.bind();
                //get NS Saved search Id
                let searchId = param('custscript_invoice_search_id');
                log.debug('searchId', searchId);
                // throw message if search is missing
                if (!searchId)
                    throw "Missing the Search Id"
                // Load the search
                  return search.load({id:searchId})
            } catch (e) {
                log.error('ERROR', e)
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
                const obj = JSON.parse(reduceContext.values).values;
                log.debug('obj', obj);
                let vendor = reduceContext.key;
                let vendorname =obj.entityid;
                let vendoremail =obj.email;
              //  let sender = param('custscript_sender');
                let searchObj = search.load({
                    id: 15793
                });
                searchObj.filters.push(search.createFilter({
                    name: 'name',
                    operator: search.Operator.ANYOF,
                    values: vendor
                }));
              let searchResultCount = searchObj.runPaged().count;
              log.debug("vendorSearchObj result count",searchResultCount);
              if(searchResultCount>0){
                let vendorName = search.lookupFields({
							type: search.Type.VENDOR,
							id: vendor,
							columns: ['companyname','custentity_dd_accuratepay_emails']
						});
						let toArray = new Array();
						toArray.push(vendoremail);
						if(vendorName.custentity_dd_accuratepay_emails)
							toArray.push(vendorName.custentity_dd_accuratepay_emails);
						log.debug('toArray ',toArray);
                let fileObj = lib.createCSVfile(searchObj);
                let emailObj = {
                    sender: 8266872,
                    recipient: toArray,
                    subject: "DoorDash - Consignment Payment Report",
                    body: `Hi ${vendorname},
Please find an attached list of invoices processed for payment with the corresponding details by DoorDash (DashMart) location and item quantity. Invoices are processed to match what our records indicate as the quantity we have sold to customers. You will receive a separate PDF remittance for these payments and they will be sent automatically to the bank account you used when onboarding onto our platform.
If you have any questions please reach out to your partnership contacts here at DoorDash. We appreciate your valuable business partnership!
Thanks,
DoorDash Team`
                }
                lib.sendEmail(emailObj, fileObj);
              }

            } catch (e) {
                log.error('ERROR', e)
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

        return {
            getInputData,
            reduce,
            summarize
        }

    });