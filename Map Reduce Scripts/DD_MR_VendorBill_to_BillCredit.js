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
		var billMemo = objBillRec.getValue({fieldId:'memo'});
        var billTranNum = objBillRec.getValue({fieldId:'transactionnumber'});
		log.debug("bill reduce values", "billRef: " + billRef +" billMemo: "+billMemo +" billTranNum: "+billTranNum);
				
		// Transform each vendor bill to bill credit
		var billCreditRecord = record.transform({
			fromType: record.Type.VENDOR_BILL,
			fromId: vendorBillId,
			toType: record.Type.VENDOR_CREDIT
		});

        var billcreditRef;
		billcreditRef = 'VOID '+billRef+' '+billTranNum;
       
        if (billcreditRef.length <= 45) 
		{
		  billCreditRecord.setValue('tranid', billcreditRef);
	    } 
		else 
		{
		  billCreditRecord.setValue('tranid', billcreditRef.substring(0, 45));
	    }
		
		var billcreditMemo = 'VOID '+billMemo;
		log.debug("billcredit reduce value", "billcreditRef: " + billcreditRef +" billcreditMemo: "+billcreditMemo);
		
		billCreditRecord.setValue('memo',billcreditMemo );
		
		var billCreditId = billCreditRecord.save();
		
		record.submitFields({
			type: 'customrecord_dd_vb_to_bc',
			id: RecId,
			values: {
				custrecord_dd_bill_credit_trans_ref: billCreditId,
				custrecord_dd_rc_process_status:true,
				custrecord_dd_er_description:''	
			},
			options: {
				enableSourcing: true,
				ignoreMandatoryFields: true
			}
		});
		log.audit("Vendor Bill Processed", "Vendor Bill ID: " + vendorBillId + " transformed to Bill Credit ID: " + billCreditId);

        } 
		catch (e) {
           
            log.error("Error in reduce for Vendor Bill ID: " + vendorBillId, e.message);
			 record.submitFields({
                type: 'customrecord_dd_vb_to_bc',
                id: RecId,
                values: {
                    custrecord_dd_er_description: e.message  // Log the error message
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
