/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 *Version    Date             Author                        Details
 *1.0        April 10, 2022   Dheeraj Vaniyamparambath      Initial version
 *
 */
 define(['N/ui/serverWidget', 'N/search', 'N/runtime', 'N/format', 'N/redirect', 'N/url', 'N/record'],
 /**
* @param{serverWidget} serverWidget
* @param{search} search
* @param{runtime} runtime
* @param{format} format
* @param {transaction} transaction
* @param {url} url
* @param {record} record
*/
 (serverWidget, search, runtime, format, redirect, url, record) => {


     /**
      * Defines the Suitelet script trigger point.
      * @param {Object} scriptContext
      * @param {ServerRequest} scriptContext.request - Incoming request
      * @param {ServerResponse} scriptContext.response - Suitelet response
      * @since 2015.2
      */
     const onRequest = (scriptContext) => {
         log.debug({title:"scriptContext",details:scriptContext});

             if(scriptContext.request.method==='GET'){
                let billRecId;

            


             const poId = scriptContext.request.parameters.recid;
             const isnotBillable = scriptContext.request.parameters.billPO;
             log.debug({title:"poId",details:poId});
             log.debug({title:"isnotBillable",details:isnotBillable});
             if(isnotBillable=='false'){
                var objRecord = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: poId,
                    isDynamic: true,
                });
   
                objRecord.setValue({fieldId:'approvalstatus',value:2});
   
                const poSavedId = objRecord.save({ignoreMandatoryFields: true});
                log.debug({title:"poSavedId",details:poSavedId});
                if(poSavedId)
                {
                   redirect.toRecordTransform({
                       fromType: 'purchaseorder',
                       fromId: poId,
                       toType: 'vendorbill',
                       parameters: {
                           'record.memo': "PO with Internal ID "+poId+" is in rejected status",
                           'record.custbody_dd_force_billed_flag':'T' 
                           
                       }
                   });
   
                     
                }
             }
             else{
                var latestBillId = getlatestBill(poId);

                redirect.toRecord({
                    type: 'vendorbill',
                    id: latestBillId,
                    isEditMode:true
                    
                });
             }
            
             
         }
         
     }
     const getlatestBill = (poId) => {
        let bill;
     var purchaseorderSearchObj = search.create({
        type: "purchaseorder",
        filters:
        [
           ["type","anyof","PurchOrd"], 
           "AND", 
           ["applyingtransaction.type","anyof","VendBill"], 
           "AND", 
           ["internalid","anyof",poId]
        ],
        columns:
        [
           search.createColumn({name: "applyingtransaction", label: "Applying Transaction"})
        ]
     });
     var searchResultCount = purchaseorderSearchObj.runPaged().count;
     log.debug("purchaseorderSearchObj result count",searchResultCount);
     var searchResult = purchaseorderSearchObj.run().getRange({
        start: 0,
        end: 1
        });
        for (var i = 0; i < searchResult.length; i++) {
             bill = searchResult[i].getValue({
                name: 'applyingtransaction'
            });
        }
        return bill;
    }
     const getTodaysDate = () => {
         var todaysDate = new Date();
         todaysDate = todaysDate.setDate(todaysDate.getDate() - 1);
         //subtracting 'formatDateforSuiteletField' function seems to add 1

         var todaysDate_formatted = formatDateforSuiteletField(todaysDate);
         log.debug('todaysDate_formatted', todaysDate_formatted);

         return todaysDate_formatted;
     }

     const formatDateforSuiteletField = (dateCreated_selected) => {

         //suiteanswers id 18223

         log.debug('dateCreated_selected', dateCreated_selected);

         var dateCreated_formatted;
         if (dateCreated_selected != null && dateCreated_selected != '' && dateCreated_selected != undefined) {

             var newDate = new Date(dateCreated_selected);
             newDate = newDate.setDate(newDate.getDate() + 1);  //have to add 1 as date seems to start at 0

             var dateCreated_formatted = format.parse({
                 value:new Date(newDate),
                 type: format.Type.DATE
             });

         }else{
             dateCreated_formatted = null;
         }

         return dateCreated_formatted;
     }

     
     return {onRequest}

 });