 /**
  *@NApiVersion 2.x
  *@NScriptType ClientScript
  */
 define(['N/record', 'N/runtime'], function(record, runtime) {

     function validateLine(context) {

         function isvalid(str) {
             if (str) {
                 if (str != "" && str != undefined && str != null) {
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
         if (sublistName === 'line') {

             var getAccountId = currentRecord.getCurrentSublistValue({
                 sublistId: sublistName,
                 fieldId: 'account'
             });

             var getAmortizationSchedule = currentRecord.getCurrentSublistValue({
                 sublistId: sublistName,
                 fieldId: 'schedule'
             });

             var getAmortizationStartDate = currentRecord.getCurrentSublistValue({
                 sublistId: sublistName,
                 fieldId: 'startdate'
             });

             var getAmortizationEndDate = currentRecord.getCurrentSublistValue({
                 sublistId: sublistName,
                 fieldId: 'enddate'
             });


             if (getAccountId == '247' || getAccountId == '1805' || getAccountId == '246') {

                 if (isvalid(getAmortizationSchedule) && isvalid(getAmortizationStartDate) && isvalid(getAmortizationEndDate)) {
                     return true;
                 } else {
                     if (confirm('You are recording to a prepaid line and it is missing an amortization schedule and/or start and end date, are you sure you want to proceed?')) {
                         return true;
                     } else {
                         return false;
                     }

                 }

             } else {
                 return true;
             }

         }
 else {
                 return true;
             }

     }


     return {
         validateLine: validateLine
     };
 });