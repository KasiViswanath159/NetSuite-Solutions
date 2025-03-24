 /**
  *@NApiVersion 2.x
  *@NScriptType ClientScript
  */
 define(['N/record', 'N/search', 'N/runtime'], function(record, search, runtime) {
 
function fieldChanged(context) {
        try {
            var nsRecord = context.currentRecord;
            var nsChangedFldId = context.fieldId;
           var sub=nsRecord.getValue({fieldId:'subsidiary'});
            var subList=['5','24','27','41'];
            if (nsChangedFldId == 'custbody_dd_vendorbill_date'&&subList.indexOf(sub)!=-1){
              var billdate=nsRecord.getValue({fieldId:'custbody_dd_vendorbill_date'});
               var terms=nsRecord.getText({fieldId:'terms'});
              if(terms!=''&&terms!=null&&terms!='Due on receipt'){
              var days=parseInt(terms.split(" ")[1]);
               console.log('days', days);
                            log.debug('date',billdate);
              // log.debug('days'+terms,days+'/////////'+billdate);
              var termsDate=addDays(billdate,days);
               console.log('days', termsDate);
              log.debug('termsDate',termsDate);
              nsRecord.setValue({fieldId:'duedate',value:termsDate});
              }
            }

        } catch (err) {
            log.debug('Error: pageInit: ', err.toString());
            console.log('Error: pageInit: ', err);
            //showErrorMessage(err);
        }
    }


     function validateLine(context) {

         function isvalid(str) {
             if (str) {
                 if (str == "" || str == undefined || str == null) {
                     return true;
                 } else {
                     return false;
                 }
             } else {
                 return false;
             }

         }

         var currentRecord = context.currentRecord;
         var sublistName = context.sublistId;
         var sublistFieldName = context.fieldId;
         var account=currentRecord.getValue({fieldId:'account'});
       if(currentRecord.id){
         var podocnum=currentRecord.getValue({fieldId:'custbody_dd_purchase_order_reference'});
       }else{
         var podocnum=currentRecord.getValue({fieldId:'podocnum'});
         }
       log.debug('podocnum',podocnum+'///'+account);
       console.log(podocnum)
      
         if (sublistName === 'item' && (podocnum != "" && podocnum != undefined && podocnum != null)&&account==2350) {
             var getItemId = currentRecord.getCurrentSublistValue({
                 sublistId: sublistName,
                 fieldId: 'item'
             });
           var itemtype= currentRecord.getCurrentSublistValue({
                 sublistId: sublistName,
                 fieldId: 'itemtype'
             });
                     var getOrderDoc = currentRecord.getCurrentSublistValue({
                         sublistId: sublistName,
                         fieldId: 'orderdoc'
                     });
                     if (itemtype=='InvtPart' && (getOrderDoc=="" || getOrderDoc==null || getOrderDoc==undefined )) {
                         alert('You are not eligible for this item ! Please select another item !');
                         currentRecord.setCurrentSublistValue({
                         sublistId: sublistName,
                         fieldId: 'item',
                         value:""
                     });
                         return false;
                     } 
             }
  return true;

         }

     function addDays(date, number) {
  const newDate = new Date(date);
       log.debug('newDate',newDate);
  return new Date(newDate.setDate(date.getDate() + number));
}


     return {
        fieldChanged:fieldChanged,
         validateLine: validateLine
     };
 });