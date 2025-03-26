/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * 08/13/2021 Kalyani Chintala, NS Case# 4151676
 */

define(['N/runtime', 'N/search', 'N/record', 'N/error', 'N/email', 'N/workflow', 'SuiteScripts/NetSuite/dd_UtilityFunctions_SSV2.js'],
    function(runtime, search, record, errorMod, emailMod, workflow, utilityObj) {

        /**
         * Marks the beginning of the Map/Reduce process and generates input data.
         *
         * @typedef {Object} ObjectRef
         * @property {number} id - Internal ID of the record instance
         * @property {string} type - Record type id
         * @return {Array|Object|Search|RecordRef} inputSummary
         * @since 2015.1
         */

        String.prototype.trim = function() {
            return this.replace(/^\s+|\s+$/g,"");
        };

        function getInputData()
        {
            var scriptObj = runtime.getCurrentScript();
            var srchId = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_appr_srch'}));
            var apprActionId = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_appr_action_id'}));
            var invApprWFId = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_appr_wf_id'}));
            if(srchId == '' || invApprWFId == '' || apprActionId == '')
            {
                throw 'Missing required parameters: Search Id or Approve action Id or Approval Workflow Id';
                return ;
            }

            var searchObj = search.load({type: record.Type.TRANSACTION, id: srchId});
            var newCols = [search.createColumn({name: 'internalid', summary: search.Summary.GROUP}),
                search.createColumn({name: 'type', summary: search.Summary.GROUP, join: null}),
                search.createColumn({name: 'tranid', summary: search.Summary.GROUP, join: null})
            ];
            searchObj.columns = newCols;
            return searchObj;
        }


        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1
         */
        function map(context) {
            try {
                var searchResult = JSON.parse(context.value);
                log.debug({title: 'Checking', details: 'searchResult: ' + JSON.stringify(searchResult)});

                var srchRowInternalIdValues = searchResult.values['GROUP(internalid)'];
                var internalId = srchRowInternalIdValues.value;

                var srchRowTxnTypeValues = searchResult.values['GROUP(type)'];
                var type = srchRowTxnTypeValues.value;

                var tranId = searchResult.values['GROUP(tranid)'];

                log.debug({title: 'Checking', details: 'Processing Id: ' + internalId + ', type: ' + type + ', tranid: ' + tranId});
                var value = {'type': type, 'tranid': tranId};
                context.write({key: internalId, value: value});
            } catch (errorObject) {
                log.error({ title: 'Map Error', details: 'Error occurred while reading search result. Details: ' + errorObject.message});
                throw 'Error occurred while reading search result. Details: ' + errorObject.message;
            }
        }

        /**
         * Executes when the reduce entry point is triggered and applies to each group.
         *
         * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
         * @since 2015.1
         */
        function reduce(context)
        {
            var scriptObj = runtime.getCurrentScript();
            var apprActionId = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_appr_action_id'}));
            var invApprWFId = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_appr_wf_id'}));
            if(apprActionId == '' || invApprWFId == '')
            {
                throw 'Missing required parameter: Approval Action Id or Approval Workflow Id';
            }

            log.debug({title: 'Checking', details: JSON.stringify(context)});
            var txnId = context.key;
            var details = context.values[0];
            log.debug({title: 'Checking', details: 'details: ' + details});

            var detailsObj = null;
            try{
                detailsObj = JSON.parse(details);
            }catch(er){
                throw 'Error occurred while reading Invoice Details with Invoice/CreditMemo InternalId: ' + txnId + '. Details: ' + er.message;
            }
            if(detailsObj == null)
                throw 'Error occurred while reading Invoice Details with Invoice/CreditMemo InternalId: ' + txnId + '. Details: ' + er.message;

            log.debug({title: 'MAP | custRecData', details: 'Processing: ' + txnId});

            var txnType = '';
            if(detailsObj.type == 'CustInvc')
                txnType = record.Type.INVOICE;
            else if(detailsObj.type == 'CustCred')
                txnType = record.Type.CREDIT_MEMO;

            if(txnType == '')
                throw 'Error occurred while processing Invoice/Credit Memo with internalId: ' + txnId + '. Type of transaction is not either Invoice or CreditMemo';

            //Now push this Invoice thru approval workflow
            try{
                workflow.trigger({recordId: txnId, recordType: txnType, workflowId: invApprWFId, actionId: apprActionId});
            }catch (er) {
                log.debug({title: 'Checking', details: 'Error occurred while triggering APPROVE action on Invoice/CreditMemo. Details: ' + er.message});
                throw 'Error occurred while triggering APPROVE action on Invoice/CreditMemo with internalId: ' + txnId + '. Details: ' + er.message;
            }
        }

        String.prototype.trim = function() {
            return this.replace(/^\s+|\s+$/g,"");
        };

        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        function summarize(summary)
        {
            var reduceKeys = [];

            summary.reduceSummary.keys.iterator().each(function (key){
                reduceKeys.push(key);
                return true;
            });

            log.debug({title: 'Reduce keys Length', details: reduceKeys.length});
            var totalKeysProcessed = reduceKeys.length;
            var totalErrors = 0;
            var errorDetails = '';
            summary.reduceSummary.errors.iterator().each(function (key, error)
            {
                totalErrors++;
                var errMsg = JSON.parse(error).message;
                errorDetails += '<p>' + errMsg + '</p>';
                return true;
            });

            var totalSuccess = parseFloat(totalKeysProcessed) - parseFloat(totalErrors);

            var scriptObj = runtime.getCurrentScript();
            var mailSubject = 'Invoice Approval Process Summary';

            var mailBody = 'Approving Invoices is completed! Search(InternalId) Used is: ' + scriptObj.getParameter('custscript_ns_inv_appr_srch') + ' <br />';
            mailBody += 'Total Number of Invoices Processed/Approved is <b>' + totalKeysProcessed + '</b>.<br />';
            mailBody += 'Number of Invoices Approved successfully is <b>' + totalSuccess + '</b><br />';
            mailBody += 'Number of Invoices failed is <b>' + totalErrors + '</b>';
            if(totalErrors > 0)
            {
                mailBody += '<br /><br/> Please find list of errors below: <br />';
                mailBody += errorDetails;
            }

            var toEmails = utilityObj.convNull(scriptObj.getParameter('custscript_ns_inv_appr_proc_notif'));
            var emailArray = toEmails.split(",");
            var newEmailArray = new Array();
            for(var idx=0; idx < emailArray.length; idx++)
            {
                var tmpEmail = utilityObj.convNull(emailArray[idx]).trim();
                if(tmpEmail != '')
                    newEmailArray.push(tmpEmail);
            }

            var emailFrom = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_email_frm'}));
            log.debug({title: 'Checking', details: 'newEmailArray: ' + newEmailArray.length});
            if(newEmailArray.length > 0 && emailFrom != '')
            {
                emailMod.send({author: emailFrom, recipients: emailArray, subject: mailSubject, body: mailBody, relatedRecords: {entityid: emailFrom} });
            }
            else
                throw 'Invalid email recipients!';

            log.debug({ title: 'END', details: '<---------------------------------END--------------------------------->' });
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };

    });