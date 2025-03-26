/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @Author Dheeraj Vaniyamparambath
 */
define(['N/record', 'N/search', 'N/runtime', 'N/file','N/url','N/render','N/email'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, runtime, file,url,render,email) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */


        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
           
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
         try{
            const oldRecord = scriptContext.oldRecord;
            const newRecord = scriptContext.newRecord;
            const recId= newRecord.id;
            const contextType = scriptContext.type;
            log.debug({title:"scriptContext",details:scriptContext});
            log.debug({title:"oldRecord",details:oldRecord});
           if(contextType=='delete'){return;}
            else{
               var newRecObj = record.load({
                  type: newRecord.type,
                  id: recId,
                  isDynamic: true,
              });
               const statusCheck = newRecord.type == 'purchaseorder'?'Rejected by Supervisor':'Rejected';
               const oldStatus = !oldRecord?'':oldRecord.getValue({fieldId:'status'});
               const newStatus = newRecObj.getValue({fieldId:'status'});
               const vendor =newRecObj.getValue({fieldId:'entity'});
               if(newStatus == statusCheck)
               {
             if(oldStatus!=statusCheck)
                 {
                     const templId = (newRecord.type == 'purchaseorder')?663:662;
                     let emailRecepients = new Array();
                     const vendorFlagLookUp = search.lookupFields({type: search.Type.VENDOR,id: vendor,columns: ['custentity_dd_rej_po_bill_emails','email','custentity_coupa_po_email']});
                     log.debug({title:"vendorFlagLookUp",details:vendorFlagLookUp});
                     const triggerEmailObject = vendorFlagLookUp.custentity_dd_rej_po_bill_emails; 
                        
                       // const doNottriggerEmails = triggerEmailObject.value;
                        
                      // log.debug({title:"doNottriggerEmails",details:doNottriggerEmails});
                       
                        if(!triggerEmailObject)
                        {
                           const regEmail = vendorFlagLookUp.email; 
                           if(regEmail){emailRecepients.push(regEmail);}
                           const coupaEmail = vendorFlagLookUp.custentity_coupa_po_email;
                           if(coupaEmail){emailRecepients.push(coupaEmail);}
                           const contEmails = getContactEmails(vendor);
                           if(contEmails){
                           contEmails.run().each(function(result){
                              emailReturned = result.getValue({name:'email'});
                              if(emailReturned)
                              {
                                 emailRecepients.push(emailReturned);
                              }
                           });
                           
                        }
                        log.debug({title:"emailRecepients",details:recId});
                        const mergeResult = render.mergeEmail({
                           templateId:templId,
                           entity:null,
                           recipient:null,
                           transactionId:recId
                        });
                        const emailSubject = mergeResult.subject;
                        const emailBody = mergeResult.body;
                        let pdfArray=[]
                        const defaultFile = file.load({      //FINAPPS-6126
							id: 17158367
						});
						pdfArray.push(defaultFile);
                        if(emailRecepients.length>0)
                        {
                           email.send({
                              author:8274108,
                              recipients:emailRecepients,
                              subject:emailSubject,
                              body:emailBody,
                              attachments: pdfArray,
                              relatedRecords:{
                                 transactionId:recId
                              }
                           })
                        }
                           
                        }
                     }
                  }
               }

         }
         catch(err)
         {
            log.error({title:"Error on afterSubmit",details:err.message});
         }
            

            }

            const getContactEmails = (recId) => {
            {
               let emailList = new Array();
               let emailReturned;
               const contactSearchObj = search.create({
                  type: "contact",
                  filters:
                  [
                     ["company","anyof",recId], 
                     "AND", 
                     ["isinactive","is","F"]
                  ],
                  columns:
                  [
                     search.createColumn({
                        name: "entityid",
                        sort: search.Sort.ASC,
                        label: "Name"
                     }),
                     search.createColumn({name: "email", label: "Email"}),
                     search.createColumn({name: "phone", label: "Phone"})
                  ]
               });
               const searchResultCount = contactSearchObj.runPaged().count;
               log.debug("contactSearchObj result count",searchResultCount);
               if(searchResultCount>0){
                  return contactSearchObj;
               }
               else{
               return false;
               }
               
               
            }
            


        }

        return {afterSubmit}

    });