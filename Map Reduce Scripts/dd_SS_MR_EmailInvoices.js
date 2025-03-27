/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 *
 * 01/11/2021 Kalyani Chintala, NS Case# 4005460
 * 02/22/2021 Kalyani Chintala, NS Case# 4101298
 * 05/05/2021 Kalyani Chintala, NS Case# 4172079
 * 05/13/2021 Kalyani Chintala, NS Case# 4170409
 */

define(['N/runtime', 'N/search', 'N/record', 'N/error', 'N/email', 'N/render', 'SuiteScripts/NetSuite/dd_UtilityFunctions_SSV2.js'],
    function(runtime, search, record, errorMod, emailMod, renderMod, utilityObj) {

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
            var srchId = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_email_srch'}));
            var emailFrom = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_email_frm'}));
            var emailTmpl = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_email_tmpl'}));
            if(srchId == '' || emailTmpl == '' || emailFrom == '')
            {
                throw 'Missing required parameters: Search Id or Email From or Email Template';
                return ;
            }

            var searchObj = search.load({type: record.Type.TRANSACTION, id: srchId});
            var newCols = [search.createColumn({name: 'internalid', summary: search.Summary.GROUP}),
                search.createColumn({name: 'internalid', summary: search.Summary.GROUP, join: 'customer', label: 'custid'}),
                search.createColumn({name: 'email', summary: search.Summary.GROUP}),
                search.createColumn({name: 'custentitydd_additional_trx_email', summary: search.Summary.GROUP, join: 'customer'}),
                search.createColumn({name: 'email', summary: search.Summary.GROUP, join: 'customer'}),
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

                //{"recordType":null,"id":"1","values":{"GROUP(internalid)":{"value":"3508022","text":"3508022"},"GROUP(internalid.customer)":{"value":"216475","text":"216475"},"GROUP(email)":"Tyng.Pan@hbo.com"}}

                var srchRowInternalIdValues = searchResult.values['GROUP(internalid)'];
                var internalId = srchRowInternalIdValues.value;

                var srchRowTxnTypeValues = searchResult.values['GROUP(type)'];
                var type = srchRowTxnTypeValues.value;

                var invCustomerSrchRowVals = searchResult.values['GROUP(internalid.customer)'];
                var invCustId = invCustomerSrchRowVals.value;
                var invEmail = searchResult.values['GROUP(email)'];
                var custEmail = searchResult.values['GROUP(email.customer)'];
                var toEmails = searchResult.values['GROUP(custentitydd_additional_trx_email.customer)'];
                var tranId = searchResult.values['GROUP(tranid)'];

                log.debug({title: 'Checking', details: 'Processing Id: ' + internalId + ', Email: ' + invEmail + ', CustId: ' + invCustId + ', Email: ' + invEmail + ', CustEmail: ' + custEmail + ', toEmails: ' + toEmails + ', type: ' + type + ', tranid: ' + tranId});

                var value = {'inv_email': invEmail, 'cust_id': invCustId, 'cust_email': custEmail, 'cust_additional_email': toEmails, 'type': type, 'tranid': tranId};
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
            var emailFrom = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_email_frm'}));
            var emailTmpl = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_email_tmpl'}));
            var emailSubj = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_email_subject'}));
            var emailBody = utilityObj.convNull(scriptObj.getParameter({name: 'custscript_ns_inv_email_body'}));

            if(emailTmpl == '' || emailFrom == '')
                throw 'Missing required parameters: Search Id or Email From or Email Template';

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

            //Now start sending email
            var returnVal = utilityObj.convNull(sendEmail(emailFrom, emailTmpl, emailSubj, emailBody, txnId, detailsObj));
            log.debug({title: 'Checking', details: 'ReturnVal: ' + returnVal});

            if(returnVal != '')
                throw returnVal;

            try{
                record.submitFields({type: txnType, id: txnId, values: {'custbody_ns_inv_email_err': returnVal, 'custbody_ns_inv_email_sent': (returnVal == '' ? true : false)}, options: {ignoreMandatoryFields: true, enableSourcing: false}});
            }catch (er) {
                log.debug({title: 'Checking', details: 'Error occurred while updating Invoice/CreditMemo. Details: ' + er.message});
                throw 'Error occurred while updating Invoice/CreditMemo with internalId: ' + txnId + '. Details: ' + er.message;
            }
        }

        String.prototype.trim = function() {
            return this.replace(/^\s+|\s+$/g,"");
        };

        function sendEmail(emailFrom, emailTmpl, emailSubj, emailBody, txnId, invDetails)
        {
            log.debug({title: 'Checking', details: 'emailFrom: ' + emailFrom + ', Email Templ: ' + emailTmpl});
            log.debug({title: 'Checking', details: 'Email Subj: ' + emailSubj});
            log.debug({title: 'Checking', details: 'Email Body: ' + emailBody});

            var returnVal = '';
            try{
                var toEmails = new Array();
                var invEmail = utilityObj.convNull(invDetails.inv_email).trim();
                if(invEmail != '' && invEmail != '- None -')
                    toEmails.push(invEmail);

                var custEmail = utilityObj.convNull(invDetails.cust_email).trim();
                if(custEmail != '' && custEmail != '- None -' && custEmail != invEmail)
                    toEmails.push(custEmail);
                var additionalEmails = utilityObj.convNull(invDetails.cust_additional_email);
                if(additionalEmails != '' && additionalEmails != '- None -')
                {
                    var emails = additionalEmails.split(/[ ,;]+/);
                    for(var idx=0; idx < emails.length; idx++)
                    {
                        var emailTo = utilityObj.convNull(emails[idx]).trim();
                        if(emailTo != '' && toEmails.indexOf(emailTo) == -1)
                            toEmails.push(emailTo);
                    }
                }

                log.debug('Checking', 'Emails: ' + toEmails.join(','));
                if(toEmails.length == 0)
                    returnVal = 'Unable to find To Email address in order to send email for Invoice with InternalId: ' + txnId;
                else
                {
                    var invFile = renderMod.transaction({entityId: parseInt(txnId, 10), printMode: renderMod.PrintMode.PDF, inCustLocale: true});

                    var mergeResult = renderMod.mergeEmail({templateId: emailTmpl, transactionId: parseInt(txnId, 10)});
                    var subject = mergeResult.subject;
                    log.debug({title: 'Checking', details: 'Subject: ' + subject});
                    var body = mergeResult.body;
                    log.debug({title: 'Checking', details: 'body: ' + body});

                    log.debug({title: 'Checking', details: 'Sending email'});
                    emailMod.sendBulk({author: emailFrom, recipients: toEmails, body: body, subject: subject, cc: null, relatedRecords: {transactionId: txnId}, attachments: [invFile]});
                    log.debug({title: 'Checking', details: 'Email sent'});
                    returnVal = '';
                }
            }catch(er){
                log.error({title: 'Checking', details: 'Error occurred while sending email. Error: ' + er.message});
                returnVal = 'Error occurred while sending email for Invoice with InternalId: ' + txnId + '. Error: ' + er.message;
            }
            return returnVal;
        }

        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        function summarize(summary)
        {
            var emailTmpl = utilityObj.convNull(runtime.getCurrentScript().getParameter({name: 'custscript_ns_inv_email_tmpl'}));
            record.delete({type: record.Type.EMAIL_TEMPLATE, id: emailTmpl});

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
            var mailSubject = 'Invoice Email Process Summary';

            var mailBody = 'Sending Emails for Invoices is completed! Search(InternalId) Used is: ' + scriptObj.getParameter('custscript_ns_inv_email_srch') + ' <br />';
            mailBody += 'Total Number of Invoices Processed is <b>' + totalKeysProcessed + '</b>.<br />';
            mailBody += 'Number of Invoices Emailed is <b>' + totalSuccess + '</b><br />';
            mailBody += 'Number of Invoices failed either to Email or to get updated is <b>' + totalErrors + '</b>';
            if(totalErrors > 0)
            {
                mailBody += '<br /><br/> Please find list of errors below: <br />';
                mailBody += errorDetails;
            }

            var toEmails = utilityObj.convNull(scriptObj.getParameter('custscript_ns_inv_email_proc_notif'));
            var emailArray = toEmails.split(",");
            var newEmailArray = new Array();
            for(var idx=0; idx < emailArray.length; idx++)
            {
                var tmpEmail = utilityObj.convNull(emailArray[idx]).trim();
                if(tmpEmail != '')
                    newEmailArray.push(tmpEmail);
            }

            log.debug({title: 'Checking', details: 'newEmailArray: ' + newEmailArray.length});
            if(newEmailArray.length > 0)
            {
                emailMod.sendBulk({
                    author: scriptObj.getParameter('custscript_ns_inv_email_frm'),
                    recipients: emailArray,
                    subject: mailSubject,
                    body: mailBody,
                    relatedRecords: {
                        entityid: scriptObj.getParameter('custscript_ns_inv_email_frm')
                    }
                });
            }
            else
                throw 'Invalid email recipeients!';

            log.debug({ title: 'END', details: '<---------------------------------END--------------------------------->' });
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };

    });