    /**
     * Copyright (c) 1998-2018 NetSuite, Inc.
     * 2955 Campus Drive, Suite 100, San Mateo, CA, USA 94403-2511
     * All Rights Reserved.
     *
     * This software is the confidential and proprietary information of
     * NetSuite, Inc. ("Confidential Information"). You shall not
     * disclose such Confidential Information and shall use it only in
     * accordance with the terms of the license agreement you entered into
     * with NetSuite.
     */

    /**
     * @NApiVersion 2.x
     * @NScriptType Suitelet
     * @NModuleScope Public
     *
     * Version    Date          Author        Remarks
     * 1.00       12/29/2020    Urkesh Shah    Initial Commit
     * case#4023738
     *
     */
    define(['N/http', 'N/ui/serverWidget', 'N/runtime', 'N/email', 'N/render', 'N/record', './NSUtilvSS2', 'N/file', 'N/search'],
        function(http, serverWidget, runtime, email, render, record, nsutil, file, search) {
            /**
             *
             * Suitelets are extensions of the SuiteScript API that allow you to build custom NetSuite pages and backend logic.
             * Suitelets are server-side scripts that operate in a request-response model, and are invoked by HTTP GET or POST
             * requests to system generated URLs.
             *
             * @param context = { request: http.ServerRequest, response: http.ServerResponse }
             */
            function onRequest(context) {
                var stLogTitle = 'onRequest';
                try {
                    var request = context.request;
                    var response = context.response;
                    var parameters = request.parameters;
                    var form, outputHTMLField;

                    //Get script parameters
                    var clientScript_id = runtime.getCurrentScript().getParameter('custscript_sl_clientscript');
                    //var ssEmployeesId = runtime.getCurrentScript().getParameter('custscript_employees_ss');
                    var ssCustomersId = runtime.getCurrentScript().getParameter('custscript_contact_ss');
                    var entitySearchId = runtime.getCurrentScript().getParameter('custscript_entity_search')
                    var param_recordid = parameters.recid;
                    var param_recType = parameters.rectype;
                    //var param_receiverid = parameters.custparam_receiverid;
                    var emailaddress = parameters.custpage_from_email;
                    if(isEmpty(emailaddress)){
                        emailaddress = runtime.getCurrentScript().getParameter('custscript_from_email');
                    }
                    var emailTemplateId = parameters.custpage_email_template;
                    //var param_attachment5 = parameters.custparam_attachment5;
                    //log.debug(stLogTitle, 'param_receiverid: ' + param_receiverid);

                    //Get parameters when suitelet reloads                
                    if (context.request.method === http.Method.GET) {
                        stLogTitle = 'Get Method';

                        //var arrInvFiles = nsutil.search(null, ssInvoiceFiles, arrFilters);
                        if(!isEmpty(param_recordid)){

                            var recFields = search.lookupFields({
                            type: param_recType,
                            id: param_recordid,
                            columns: ['entity', 'email']
                        });
                        log.debug(stLogTitle, 'Customer Record Id is:' + ' ' + recFields.entity[0].value);
                        }
                        
                        var params = {
                            clientScript_id: clientScript_id,
                            recordid: param_recordid,
                            recordType : param_recType,
                            ssCustomers : ssCustomersId,
                            ssEntity: entitySearchId,
                            customerInternalId: recFields.entity[0].value,
                            emailaddress: emailaddress,
                            emailTemplateId : emailTemplateId
                            //arrInvFiles: arrInvFiles
                        };

                        form = displayForm(params);
                        response.writePage(form);
                    }

                    if (context.request.method === http.Method.POST) {
                        stLogTitle = 'Post Method';
                        var response = context.response;
                        var form, outputHTMLField;
                        var script = runtime.getCurrentScript();
                        var arrAttachments = [];
                        //Gets all the data from the suitelet
                        var sender = parameters.custpage_from_email;
                        var toEmail = parameters.custpage_to_email;
                        var additionalEmail = parameters.custpage_additional_email;
                        var stRecordId = parameters.custpage_recordid;

                        log.debug('POST', 'Invoice Id is:' + ' ' + stRecordId + ' '+ 'Sender Email id is:'+ ' '+ sender +' '+ 'Additonal Emails are:'+' '+additionalEmail);
                        //Creates the attachment array

                        if (!isEmpty(stRecordId)) {
                            var invoicePdf = render.transaction({
                                entityId: parseInt(stRecordId),
                                printMode: render.PrintMode.PDF
                            });
                            arrAttachments.push(invoicePdf);
                        }
                        var subject = parameters.custpage_subject;
                        var message = parameters.custpage_message;
                        log.debug(stLogTitle, message);


                        var arrTO = [];
                        var arrCC = [];
                        var arrBCC = [];
                        arrTO.push(toEmail);
                        arrTO.push(additionalEmail);
                        var sublistInputs = parameters.custpage_sublistinputs;
                        if (!isEmpty(sublistInputs)) {
                            sublistInputs = JSON.parse(sublistInputs);
                            for (var i = 0; i < sublistInputs.length && ((arrTO.length + arrCC.length + arrBCC.length) < 10); i++) {
                                if (sublistInputs[i].to == true) {
                                    if (!isEmpty(sublistInputs[i].employeeid)) {
                                        arrTO.push(sublistInputs[i].employeeid);
                                    }
                                    if (!isEmpty(sublistInputs[i].contactid)) {
                                        arrTO.push(sublistInputs[i].contactid);
                                    }
                                } else if (sublistInputs[i].cc == true) {
                                    if (!isEmpty(sublistInputs[i].employeeid)) {
                                        arrCC.push(sublistInputs[i].employeeid);
                                    }
                                    if (!isEmpty(sublistInputs[i].contactid)) {
                                        arrCC.push(sublistInputs[i].contactid);
                                    }
                                } else if (sublistInputs[i].bcc == true) {
                                    if (!isEmpty(sublistInputs[i].employeeid)) {
                                        arrBCC.push(sublistInputs[i].employeeid);
                                    }
                                    if (!isEmpty(sublistInputs[i].contactid)) {
                                        arrBCC.push(sublistInputs[i].contactid);
                                    }
                                }
                            }

                        }

                        log.debug(stLogTitle, 'arrTO: ' + arrTO);
                        log.debug(stLogTitle, 'arrCC: ' + arrCC);
                        log.debug(stLogTitle, 'arrBCC: ' + arrBCC);
                        if (!isEmpty(arrTO) && !isEmpty(subject) && !isEmpty(message) && !isEmpty(stRecordId)) {
                            log.debug(stLogTitle, 'stRecordId: ' + stRecordId);
                            try {
                                email.send({
                                    author: sender,
                                    recipients: arrTO,
                                    cc: arrCC,
                                    bcc: arrBCC,
                                    subject: subject,
                                    body: message,
                                    attachments: arrAttachments,
                                    relatedRecords: {
                                        transactionId: parseInt(stRecordId)
                                    }
                                });


                                log.audit(stLogTitle, 'Email Sent');
                                //Suitelet is closed
                                response.write('<html><body><script type="text/javascript">window.close();</script></body></html>');
                            } catch (email_error) {
                                log.error(stLogTitle, email_error);
                                displayMessage(outputHTMLField, response, form, 'ERROR: There was an error when sending the email, please contact your Netsuite Admin', true);
                            }
                        } else {
                            // No From and To set         
                            log.error(stLogTitle, 'No receiver or message');
                            displayMessage(outputHTMLField, response, form, 'ERROR: Receiver, Email subject and Email message are mandatory', true);
                        }

                    }
                } catch (error) {
                    log.error(stLogTitle, error);
                    displayMessage(outputHTMLField, response, form, 'Unexpected error. Please contact your Netsuite Admin', true);
                }
            }
            //Displays a message on the suitelet
            function displayMessage(outputHTMLField, response, form, message, error) {
                var stLogTitle = 'displayMessage';
                try {
                    if (isEmpty(form)) {
                        var txtSuiteletTitle = 'Send PDF Email'; //runtime.getCurrentScript().getParameter('custscript_acs_suitelettitle');
                        var clientScript_id = runtime.getCurrentScript().getParameter('custscript_sl_clientscript');
                        form = serverWidget.createForm({
                            title: txtSuiteletTitle
                        });
                        form.clientScriptFileId = clientScript_id;
                    }
                    if (error) {
                        form.addButton({
                            id: 'custpage_btn_close',
                            label: 'Close',
                            functionName: 'closeButton()'
                        });
                    }
                    outputHTMLField = form.addField({
                        id: 'custpage_output_html',
                        label: 'Output',
                        type: serverWidget.FieldType.INLINEHTML
                    });
                    outputHTMLField.defaultValue = message;
                    outputHTMLField.updateLayoutType({
                        layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
                    });
                    response.writePage(form);
                } catch (error) {
                    log.error(stLogTitle, error);
                }
            }
            //Validates if it is empty
            function isEmpty(value) {
                var stLogTitle = 'isEmpty';
                try {
                    if (value == null || value == '' || (!value) || value == 'undefined') {
                        return true;
                    }
                    return false;
                } catch (error) {
                    log.error(stLogTitle, error);
                }
            }
            //Displays the suitelet with all the fields needed
            function displayForm(params) {
                var stLogTitle = 'displayForm';
                try {
                    var form = serverWidget.createForm({
                        title: 'Email Invoice'
                    });
                    log.debug('params', params);
                    //Set the Client script id
                    form.clientScriptFileId = params.clientScript_id;

                    var fromEmail = form.addField({
                        id: 'custpage_from_email',
                        type: serverWidget.FieldType.SELECT,
                        label: 'From Email ',
                        source : '-9'
                    }).updateDisplayType({
                        displayType : 'disabled'
                    });

                    if(!isEmpty(params.emailaddress)){
                       fromEmail.defaultValue = params.emailaddress; 
                    }

                    var toEmail = form.addField({
                        id: 'custpage_to_email',
                        type : serverWidget.FieldType.TEXT,
                        label : 'Recipient'
                    });


                    var additionalEmail = form.addField({
                        id : 'custpage_additional_email',
                        type : serverWidget.FieldType.TEXT,
                        label : 'Additional Recipients'
                    });

                     var customerFields = search.lookupFields({
                            type: 'customer',
                            id: params.customerInternalId,
                            columns: ['email','custentitydd_additional_trx_email']
                        });
                     if(!isEmpty(customerFields.email)){
                        toEmail.defaultValue = customerFields.email;
                     }
                     if(!isEmpty(customerFields.custentitydd_additional_trx_email)){
                        additionalEmail.defaultValue = customerFields.custentitydd_additional_trx_email;
                     }
                    var recordid = form.addField({
                        id: 'custpage_recordid',
                        type: serverWidget.FieldType.TEXT,
                        label: 'Record id: '
                    });

                    if (!isEmpty(params.recordid)) {
                        recordid.defaultValue = params.recordid;
                    }
                    recordid.updateDisplayType({
                        displayType: 'hidden'
                    });
                   var tranType = form.addField({
                        id: 'custpage_recordtype',
                        type: serverWidget.FieldType.TEXT,
                        label: 'Record Type: '
                    });
                   if(!isEmpty(params.recordType)){
                        tranType.defaultValue = params.recordType
                   }
                    tranType.updateDisplayType({
                        displayType: 'hidden'
                    });
                    var tab_message = form.addSubtab({
                        id: 'custpage_subtab_message',
                        label: 'Message'
                    });

                    var template = form.addField({
                        id: 'custpage_email_template',
                        type: serverWidget.FieldType.SELECT,
                        label : 'Email Template',
                        source: '-120',
                        container :'custpage_subtab_message'
                    });

                   if (!isEmpty(params.emailTemplateId)) {
                    template.defaultValue = params.emailTemplateId;
                    var mergeResult = render.mergeEmail({
                        templateId : parseInt(params.emailTemplateId),
                        transactionId : parseInt(params.recordid)
                    });
                }
                var subject_field = form.addField({
                    id: 'custpage_subject',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Subject: ',
                    container: 'custpage_subtab_message'
                });
                subject_field.updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                });
                if (!isEmpty(params.emailTemplateId)) {
                    subject_field.defaultValue = mergeResult.subject;
                }
                var message = form.addField({
                    id: 'custpage_message',
                    type: serverWidget.FieldType.RICHTEXT,
                    label: 'Message: ',
                    container: 'custpage_subtab_message'
                });

                if (!isEmpty(params.emailTemplateId)) {
                    message.defaultValue = mergeResult.body;
                }

                /*message.updateBreakType({
                        breakType: serverWidget.FieldBreakType.STARTCOL
                    });*/
                    var sublistInputs = form.addField({
                        id: 'custpage_sublistinputs',
                        type: serverWidget.FieldType.LONGTEXT,
                        label: 'Sublist Inputs:'
                    });
                    sublistInputs.updateDisplayType({
                        displayType: serverWidget.FieldDisplayType.HIDDEN
                    });

                    //Sublist Fields                
                    var sublist_message = form.addSublist({
                        id: 'sublist',
                        type: serverWidget.SublistType.INLINEEDITOR,
                        label: 'Recipients'
                    });
                    var sublist_recipient = sublist_message.addField({
                        id: 'sublist1',
                        type: serverWidget.FieldType.SELECT,
                        label: ' Additional  RECIPIENT',
                    });
                    sublist_recipient = addValuesToDropDown(params.ssEntity, params.ssCustomers, params.customerInternalId, sublist_recipient);
                    sublist_message.addField({
                        id: 'sublist3',
                        type: serverWidget.FieldType.EMAIL,
                        label: 'EMAIL'
                    });
                    sublist_message.addField({
                        id: 'sublist4',
                        type: serverWidget.FieldType.CHECKBOX,
                        label: 'TO'
                    });
                    sublist_message.addField({
                        id: 'sublist5',
                        type: serverWidget.FieldType.CHECKBOX,
                        label: 'CC'
                    });
                    sublist_message.addField({
                        id: 'sublist6',
                        type: serverWidget.FieldType.CHECKBOX,
                        label: 'BCC'
                    });
                    //End sublist fields

                    form.addSubmitButton({
                        label: 'Send'
                    });

                    return form;
                } catch (error) {
                    log.error(stLogTitle, error);
                }
            }

            function addValuesToDropDown(ssEntity, ssCustomers ,customerInternalId ,sublist_recipient) {
                var arrFilters = [];
                //var arrEntity = nsutil.search(null, ssEntity, null);
                arrFilters.push(search.createFilter({
                    name : 'company',
                    operator : 'anyof',
                    values : customerInternalId
                }))
               var arrContacts = nsutil.search(null, ssCustomers, arrFilters);
                //Add Employees

                sublist_recipient.addSelectOption({
                    value: '',
                    text: ''
                });
                if (!isEmpty(arrContacts)) {
                    for (var i = 0; i < arrContacts.length; i++) {
                        sublist_recipient.addSelectOption({
                            value: arrContacts[i].getValue('internalid'),
                            text: arrContacts[i].getValue('entityid')
                        });


                    }
                }

                return sublist_recipient;
            }

            return {
                onRequest: onRequest
            }
        });