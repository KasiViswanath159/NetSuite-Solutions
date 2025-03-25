/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
define(['N/record', 'N/ui/serverWidget', 'N/runtime', 'N/email', 'N/file', 'N/render'], function (record, serverWidget, runtime, email, file, render) {

    function beforeSubmit(context) {
        if (context.type == 'create') {
            try {
               
            } catch (e) {
                log.debug('Before Submit Error:', JSON.stringify(e));
            }
        }
    }
    function afterSubmit(context) {
        if (context.type == 'edit' || context.type == 'create') {
            try {

                var getContext = context.newRecord;
                var getId = getContext.id;
                var getType = getContext.type;
                var rec = record.load({
                    type: getType,
                    id: getId,
                    isDynamic: true

                });

                var getCheckBox = rec.getValue({
                    fieldId: 'custbody_dd_payment_email_notification'
                });
               
                if (getCheckBox == false) {

                    var getVendor = rec.getValue({
                        fieldId: 'entity'
                    });

                    var loadVendor = record.load({
                        type: 'vendor',
                        id: getVendor
                    });
                   var final_email;
                    var getEmail = loadVendor.getValue({
                        fieldId: 'email'
                    });
                   var email_notification = loadVendor.getValue({
                        fieldId: 'custentity_dd_email_notification'
                    });
                   log.debug('email_notification',email_notification);
                    if(getEmail&&email_notification){
                      final_email=getEmail+','+email_notification;
                    }else if(getEmail){
                      final_email=getEmail;
                    }else if(email_notification){
                      final_email=email_notification;
                    }
                   var vendorEmails=[];
				   var emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
                   if(final_email)
				   {
					  var processedEmails = final_email.replace(/\s+/g, ',').split(','); // Replace spaces with commas and split
					  log.debug('processedEmails',processedEmails);
					  
					  for (var i = 0; i < processedEmails.length; i++) 
					  {
						var ValidEmails = processedEmails[i].trim(); // Trim whitespace
						if (ValidEmails && emailRegex.test(ValidEmails)) {
							vendorEmails.push(ValidEmails);
						}
					  } 
				   }
                  log.debug('vendorEmails',vendorEmails);
                    //var getEmail = 'naveen.narsapuram@doordash.com';
                    
                    var getStatus = rec.getValue({
                        fieldId: 'custbody_dd_jpm_payment_status'

                    });
                  

                    if (getStatus == 'Level1 Completed') {

                        var TransactionPdfObj = render.transaction({
                            entityId: getId,
                            printMode: render.PrintMode.PDF
                        });


                        var getBody = 'Hello! <br/><br/>\
  This email is to inform you that DoorDash has made a payment that is coming your way. Please see the attached <br/>\
  remittance advice for further information. You can expect the funds to arrive in your account within 4 business days if you are set up as ACH, or within 10 business if you are set up to receive check<br/>\ <br/>\
  Please remember to update your information through Coupa SIM supplier platform if you address or banking is changing.<br/>\
  <br/>\
   Have questions about the payment? Please contact us at AP@doordash.com. <br/>\
   <br/>\
   Thank You! <br/>\
    Your Friends at DoorDash.'

                       
                       var chunkSize = 10;
                      for (var i = 0; i < vendorEmails.length; i += chunkSize) {
                       var emailchunk = vendorEmails.slice(i, i + chunkSize);
					   log.debug('emailchunk',emailchunk);
					   
                        if(emailchunk)
                        email.send({
                            author: 487159,
                            recipients: emailchunk,
                            subject: 'Immediate Remittance Advice:',
                            body: getBody,
                            attachments: [TransactionPdfObj],
                            relatedRecords: {
                             transactionId: getId
                            }
                        });
                        }
                        rec.setValue({
                            fieldId: 'custbody_dd_payment_email_notification',
                            value: true
                        });
                        var updateBill = rec.save();

                        log.debug('Email Sent', 'The email has been sent');
                    } else if (getStatus == 'Level1 Failed') {
                        var TransactionPdfObj = render.transaction({
                            entityId: getId,
                            printMode: render.PrintMode.PDF
                        });


                        var getBody = 'Hello! <br/><br/><br/>\
We are reaching out to inform you that a recent payment made to you by DoorDash was unsuccessful. The corresponding remittance advice is attached for your reference. <br/>\
 <br/>\
Please send us an email at AP@doordash.com with your updated bank details so that we can update our records accordingly! <br/>\
 <br/>\
Once we confirm your bank details, we will swiftly reprocess the affected payments.<br/>\
 <br/>\
We’re looking forward to hearing from you <br/><br/><br/>\
 <br/>\
Thank you!<br/>\
Your Friends at DoorDash.'
                      var chunkSize = 10;
                      for (var i = 0; i < vendorEmails.length; i += chunkSize) {
                       var emailchunk = vendorEmails.slice(i, i + chunkSize);
                        if(emailchunk)
                        email.send({
                            author: 487159,
                            recipients: emailchunk,
                            subject: 'Notice of Failed Payments ',
                            body: getBody,
                            attachments: [TransactionPdfObj],
                            relatedRecords: {
                             transactionId: getId
                            }
                        });
                        }
                        rec.setValue({
                            fieldId: 'custbody_dd_payment_email_notification',
                            value: true
                        });
                        var updateBill = rec.save();

                        log.debug('Failed Email Sent', 'The Failed email has been sent');

                    }

                }

            } catch (e) {
                log.debug('After Submit Error:', JSON.stringify(e));
            }
        }

    }
    return {
        beforeSubmit: beforeSubmit,
        afterSubmit: afterSubmit
    }
});