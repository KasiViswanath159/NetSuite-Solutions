/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @Author Dheeraj Vaniyamparambath
 */
define(['N/record', 'N/search', 'N/runtime', 'N/error','N/url','N/render','N/email','N/query'],
    /**
 * @param{record} record
 * @param{search} search
 */
    (record, search, runtime, error,url,render,email,query) => {
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
            let totalCreditsApplied= 0;
            const recId= newRecord.id;
            const contextType = scriptContext.type;
            log.debug({title:"scriptContext",details:scriptContext});
            log.debug({title:"oldRecord",details:oldRecord});
           if(contextType!='create'){return;}
            else{
              
               var newRecObj = record.load({
                  type: record.Type.VENDOR_PAYMENT,
                  id: recId,
                  isDynamic: false
              });
                const vendorId = newRecObj.getValue({fieldId:"entity"});
              if(vendorId){
                 const vendorLookupObj =  search.lookupFields({
    type: search.Type.VENDOR,
    id: vendorId,
    columns: ['custentity_dd_bill_pay_edi_flag']
});
const ediCheck = vendorLookupObj.custentity_dd_bill_pay_edi_flag;      
                log.debug({
                title: 'ediCheck',
                details: ediCheck
            });
                 if(ediCheck)
                 {
                     newRecObj.setValue({fieldId:"custbodyintegrationstatus",value:1});
                 }
            
              }
              //newRecObj.setValue({fieldId:"custbodyintegrationstatus",value:1});
      

              var sql = `
           SELECT SUM( pt1.foreignamount)  "CreditApplied"
FROM PreviousTransactionLineLink pt1, PreviousTransactionLineLink pt2
WHERE pt1.nexttype = 'VendCred'
AND pt1.previousdoc = pt2.previousdoc
AND  pt2.nextdoc = ? 
        `;

            var resultSet = query.runSuiteQL({
                query: sql,
                params: [recId]
            });

            var results = resultSet.asMappedResults();

            // Log the contacts for the vendor
            log.debug({
                title: 'Vendor Contacts',
                details: JSON.stringify(results)
            });

            totalCreditsApplied = results[0].creditapplied;
              log.debug({
                title: 'totalCreditsApplied',
                details: totalCreditsApplied
            });
              if(totalCreditsApplied>0)
              {
               newRecObj.setValue({fieldId:"custbody_dd_bill_pay_credits_total",value:totalCreditsApplied}); 
              }
          
                  newRecObj.save();
               }

         }
         catch(err)
         {
            log.error({title:"Error on afterSubmit",details:err.message});
         }
            

            }
       const getDataFromSuiteQL = (suiteQL) => {
            const results = getAllDataBySuiteQL(suiteQL);

            return results;
        }


        return {afterSubmit}

    });