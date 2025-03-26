/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/runtime', 'N/log'], function(search, record, runtime, log) {

    /**
     * getInputData - Fetches vendor bill records from the custom Record that need to be processed.
     * @returns {Array|Object|Search} The input data to use in the map/reduce process
     */
    function getInputData() 
	{
        try {
			
           var vendorBillSearch = search.create({
			   type: "customrecord_dd_vb_to_bc",
			   filters:
			   [
				  ["custrecord_dd_bill_credit_trans_ref","isempty",""],
				  "AND", 
				  ["custrecord_dd_rc_process_status","is","F"]
				  // "AND", 
                  // ["internalidnumber","equalto","5"]
			   ],
			   columns:
			   [
				  search.createColumn({name: "custrecord_dd_vendor_bill_id", label: "Vendor Bill ID"})
			   ]
			});
			
            return vendorBillSearch;
        } catch (error) {
            log.error("Error in getInputData", error);
        }
    }
	
    /**
     * reduce - This function is executed for each unique key.
     * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage.
     */
    function reduce(reduceContext) 
	{
	 try 
	 {
		log.debug('reduceContext',reduceContext);
		var RecId = reduceContext.key; 
		log.debug("Processing RecId", "RecId ID: " + RecId);
		
		var jsonString = reduceContext.values[0];
		var parsedObject = JSON.parse(jsonString);
		var vendorBillId = parsedObject.values.custrecord_dd_vendor_bill_id;
		log.debug("Processing Vendor Bill", "Vendor Bill ID: " + vendorBillId);
		
		//load the vendor bill record
		var objBillRec = record.load({type: record.Type.VENDOR_BILL,id: vendorBillId});
		var billRef = objBillRec.getValue({fieldId:'tranid'});
        var billTranNum = objBillRec.getValue({fieldId:'transactionnumber'});
		var billMemo = objBillRec.getValue({fieldId:'memo'});
		log.debug("bill reduce values", "billRef: " + billRef +" billMemo: "+billMemo+" billTranNum: "+billTranNum);
		
		// Transform each vendor bill to bill credit
		var billCreditRecord = record.transform({
			fromType: record.Type.VENDOR_BILL,
			fromId: vendorBillId,
			toType: record.Type.VENDOR_CREDIT,
			isDynamic: true
		});
		var billCreditRecordRef = 'VOID '+billRef+' '+billTranNum;
		var billCreditRecordMemo = 'VOID '+billMemo;
		log.debug("billCreditRecord reduce value", "billCreditRecordRef: " + billCreditRecordRef +" billCreditRecordMemo: "+billCreditRecordMemo);

       if (billCreditRecordRef.length <= 45) 
		{
		  billCreditRecord.setValue('tranid', billCreditRecordRef);
	    } 
		else 
		{
		  billCreditRecord.setValue('tranid', billCreditRecordRef.substring(0, 45));
	    }
       
		billCreditRecord.setValue('memo',billCreditRecordMemo );
		
		// Start: To set the new expense account
		var expenseLineCount = billCreditRecord.getLineCount({ sublistId: 'expense' });
		
		 for (var i = 0; i < expenseLineCount; i++) 
		 {
			billCreditRecord.selectLine({ sublistId: 'expense', line: i });
			
			// Update account to 2166 Unclaimed Property Payable	
			billCreditRecord.setCurrentSublistValue({
				sublistId: 'expense',
				fieldId: 'account',
				value:'4277'
			});
			
			billCreditRecord.commitLine({ sublistId: 'expense' });
         }
		 
		 // Process item sublist and add the details in expense lines
            var itemLineCount = billCreditRecord.getLineCount({ sublistId: 'item' });
			log.debug('itemLineCount',itemLineCount);
			
            for (var j = 0; j < itemLineCount; j++) 
			{
				billCreditRecord.selectLine({ sublistId: 'item', line: j });
				
				var itemAmount = billCreditRecord.getCurrentSublistValue({ sublistId: 'item', fieldId: 'amount' });
				var itemBusiness = billCreditRecord.getCurrentSublistText({ sublistId: 'item', fieldId: 'department' });
				var itemMarket = billCreditRecord.getCurrentSublistText({ sublistId: 'item', fieldId: 'class' });
				log.debug('itemMarket'+j,itemMarket);
				
				var itmebudgetDepartment = billCreditRecord.getCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_department_custom_field' });
				log.debug('itmebudgetDepartment'+j,itmebudgetDepartment);
				
				var itemDepartment = billCreditRecord.getCurrentSublistText({ sublistId: 'item', fieldId: 'custcol_cseg_costcenter' });
				log.debug('itemDepartment'+j,itemDepartment);
				
				// Adding a corresponding expense line
				var expenseLine = billCreditRecord.selectNewLine({ sublistId: 'expense' });
				billCreditRecord.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'account', value: '4277' });
				billCreditRecord.setCurrentSublistValue({ sublistId: 'expense', fieldId: 'amount', value: itemAmount });
				billCreditRecord.setCurrentSublistText({ sublistId: 'expense', fieldId: 'department', text:itemBusiness });
				billCreditRecord.setCurrentSublistText({ sublistId: 'expense', fieldId: 'class', text:itemMarket });
				billCreditRecord.setCurrentSublistText({ sublistId: 'expense', fieldId: 'custcol_department_custom_field', text:itmebudgetDepartment });
				billCreditRecord.setCurrentSublistText({ sublistId: 'expense', fieldId: 'custcol_cseg_costcenter', text:itemDepartment});
				billCreditRecord.commitLine({ sublistId: 'expense' });
            }

            // Remove all items from the item sublist
            for (var k = itemLineCount - 1; k >= 0; k--) 
			{
                billCreditRecord.removeLine({ sublistId: 'item', line: k });
            }
		//END
		
		var billCreditRecordId = billCreditRecord.save({enableSourcing: true,ignoreMandatoryFields: true});
		
		record.submitFields({
			type: 'customrecord_dd_vb_to_bc',
			id: RecId,
			values: {
				custrecord_dd_bill_credit_trans_ref: billCreditRecordId,
				custrecord_dd_rc_process_status:true,
				custrecord_dd_er_description:''	
			},
			options: {
				enableSourcing: true,
				ignoreMandatoryFields: true
			}
		});
		log.audit("Vendor Bill Processed", "Vendor Bill ID: " + vendorBillId + " transformed to Bill Credit ID: " + billCreditRecordId);

        } 
		catch (e) {
           
            log.error("Error in reduce for Vendor Bill ID: " + vendorBillId, e.message);
			 record.submitFields({
                type: 'customrecord_dd_vb_to_bc',
                id: RecId,
                values: {
                    custrecord_dd_er_description: e.message 
                }
            });
        }
    }

    /**
     * summarize - Logs the status of the vendor bills processed in the summarize stage.
     * @param {Object} summaryContext - Statistics about the execution of the map/reduce script.
     */
    function summarize(summaryContext) 
	{
        // summaryContext.mapSummary.errors.iterator().each(function(key, error) {
            // log.error("Map Error for Vendor Bill ID: " + key, error);
            // return true;
        // });

        summaryContext.reduceSummary.errors.iterator().each(function(key, error) {
            log.error("Reduce Error for Vendor Bill ID: " + key, error);
            return true;
        });

        // Log the number of successful bills transformed
        summaryContext.reduceSummary.keys.iterator().each(function (key) {
            log.audit('Processed vendorBill ID:', key);
            return true;
        });

        //map and reduce errors
        if (summaryContext.mapSummary.error) {
            log.error('Map Error', summaryContext.mapSummary.error);
        }

        if (summaryContext.reduceSummary.error) {
            log.error('Reduce Error', summaryContext.reduceSummary.error);
        }
    }

    return {
        getInputData: getInputData,
        reduce: reduce,
        summarize: summarize
    };
});
