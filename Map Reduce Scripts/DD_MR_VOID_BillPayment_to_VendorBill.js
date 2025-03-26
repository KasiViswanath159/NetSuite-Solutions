/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/record', 'N/search', 'N/log', 'N/runtime','N/transaction'], function (record, search, log, runtime,transaction) {

    /**
     * getInputData: Fetch all bill payment records from the custom record
     * @returns {Array|Object|Search}
     */
    function getInputData() 
	{
       try
	   {
		   var customrecord_dd_void_ven_bill_paymentsSearchObj = search.create({
			   type: "customrecord_dd_void_ven_bill_payments",
			   filters:
			   [
				  ["custrecord_dd_billpay_rec_process","is","F"]
			   ],
			   columns:
			   [
				  search.createColumn({name: "custrecord_dd_bill_paymt_id", label: "Bill Payment ID"}),
				  search.createColumn({name: "internalid", label: "Record Internal ID"})
			   ]
			});
			
			   return customrecord_dd_void_ven_bill_paymentsSearchObj;
	   }
		catch(e)
		{
			log.debug("Error in GetInput",e.message);
		}
		
    }

    /**
     * map: For each bill payment, find related bills and create a custom record
     * @param {Object} context
     */
    function map(context) {
        var searchResult = JSON.parse(context.value);
        var billPaymentId = searchResult.values.custrecord_dd_bill_paymt_id;
        var customRecordId = searchResult.id;
		
		log.debug("billPaymentId MAP", "billPaymentId: " + billPaymentId +" RecID: "+customRecordId);

        try {
            // Get all the related bills for the Bill Payment
            var billIds,billPaymentID,CreatedBillids=[];
           
			var vendorpaymentSearchObj = search.create({
			   type: "vendorpayment",
			   settings:[{"name":"consolidationtype","value":"ACCTTYPE"}],
			   filters:
			   [
				  ["type","anyof","VendPymt"], 
				  "AND", 
				  ["internalidnumber","equalto",billPaymentId] // 27752375
				
			   ],
			   columns:
			   [
				  search.createColumn({
					 name: "internalid",
					 join: "appliedToTransaction",
					 label: "Vendor Bill Internal ID"
				  }),
				  search.createColumn({name: "internalid", label: "Bill Payment Internal ID"})
			   ]
			});
			var searchResultCount = vendorpaymentSearchObj.runPaged().count;
			log.debug("vendorpaymentSearchObj result count",searchResultCount);
			
			vendorpaymentSearchObj.run().each(function(result){
			   // .run().each has a limit of 4,000 results
			   billIds = result.getValue({ name: "internalid",join: "appliedToTransaction"});
			   billPaymentID = result.getValue({ name: "internalid"});
			   log.debug('billIds',billIds);
			   
			   if(billIds)
			   {
				   // Creating bill Records associated with the bill payment
				   var objBillRecord = record.create({
						type: 'customrecord_dd_vb_to_bc',  
						isDynamic: true
						})
					objBillRecord.setValue({fieldId: 'custrecord_dd_bill_pmt_trans_ref',value: billPaymentId});
					objBillRecord.setValue({fieldId: 'custrecord_dd_bill_trans_ref',value: billIds});
					objBillRecord.setValue({fieldId: 'custrecord_dd_vendor_bill_id',value: billIds});
					var billrecID = objBillRecord.save();
					CreatedBillids.push(billrecID);
			   }
			   return true;
			});

            // Write billPaymentId,customRecordId and CreatedBillids to pass to the reduce stage
            context.write({
                key: billPaymentId,
                value: {customRecordId:customRecordId,CreatedBillids:CreatedBillids}
            });

        } catch (error) {
            log.error('Error in map', error);
            record.submitFields({
                type: 'customrecord_dd_void_ven_bill_payments',
                id: customRecordId,
                values: {
                    custrecord_dd_billpay_err_descp: error.message
                }
            });
        }
    }

    /**
     * reduce: Void the bill payment and update the custom record with success or error status
     * @param {Object} context
     */
    function reduce(context) {
		try 
		{
            var billPaymentId = context.key;
			var reduceValue = JSON.parse(context.values[0]);
			log.debug('reduceValue',reduceValue);
			var customRecordId = reduceValue.customRecordId;  // Custom record internal ID
			log.debug("billPaymentId reduce", "billPaymentId: " + billPaymentId +" RecID: "+customRecordId);
			var TotalbillCreated = reduceValue.CreatedBillids;
			log.debug('TotalbillCreated',TotalbillCreated);
			log.debug('TotalbillCreated length',TotalbillCreated.length);
        
			
            //void the Bill Payment Record
			if(TotalbillCreated.length>0)
			{		
			   var voidbillPaymentId = transaction.void({
				type:"vendorpayment",
				id: billPaymentId
				});
				log.debug("voidbillPaymentId reduce","voidbillPaymentId: "+voidbillPaymentId);

				// Update the custom record, mark as processed
				record.submitFields({
					type: 'customrecord_dd_void_ven_bill_payments',
					id: customRecordId,
					values: {
						custrecord_dd_billpay_rec_process: true,
						custrecord_dd_billpay_err_descp: ''  // Clear error message
					}
				});
			}
            log.debug('Success', 'Bill Payment ' + billPaymentId + ' voided and custom record updated.');

        } catch (error) {
            log.error('Error in reduce', error);
            record.submitFields({
                type: 'customrecord_dd_void_ven_bill_payments',
                id: customRecordId,
                values: {
                    custrecord_dd_billpay_err_descp: error.message  // Log the error message
                }
            });
        }
    }

    /**
     * summarize: Log how many records were processed successfully or failed
     * @param {Object} summary
     */
    function summarize(summaryContext) 
	{
        summaryContext.mapSummary.keys.iterator().each(function (key) {
            log.audit('Processed record ID:', key);
            return true;
        });
		summaryContext.reduceSummary.keys.iterator().each(function (key) {
            log.audit('Processed billpayment ID:', key);
            return true;
        });

        if (summaryContext.inputSummary.error) {
            log.error('Input Error', summaryContext.inputSummary.error);
        }

        if (summaryContext.mapSummary.error) {
            log.error('Map Error', summaryContext.mapSummary.error);
        }

        if (summaryContext.reduceSummary.error) {
            log.error('Reduce Error', summaryContext.reduceSummary.error);
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
