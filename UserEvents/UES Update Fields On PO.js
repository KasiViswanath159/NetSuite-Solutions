/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/runtime', 'N/search'], function (record, runtime, search) {
  function updatePoFields(context) {
    if (context.type === context.UserEventType.CREATE || context.type === context.UserEventType.EDIT) {
		var newRecord = context.newRecord;
		var shortPayBillCredit = newRecord.getValue({ fieldId: 'custbody_created_from_shortpay' }); 
		
		log.debug('shortPayBillCredit ',shortPayBillCredit);
		if(shortPayBillCredit==true)
		{
			var createdFrom = newRecord.getValue({ fieldId: 'createdfrom'}); 
			var poRec = newRecord.getValue({ fieldId: 'custbody_dd_purchase_order_reference'}); 
			log.debug('poRec ',poRec);
			var dataArray = new Array();
			var dataArrayInt = new Array();
			var itemLines = newRecord.getLineCount({
				sublistId: 'item'
			});
			log.debug('itemLines ',itemLines);
			for(var i = 0; i < itemLines; i++) {
				var a_data;
				var itemDesc = newRecord.getSublistValue({
					sublistId: 'item',
					fieldId: 'description',
					line: i
				});
				var itemAmount = newRecord.getSublistValue({
					sublistId: 'item',
					fieldId: 'amount',
					line: i
				});
				var itemQuantity = newRecord.getSublistValue({
					sublistId: 'item',
					fieldId: 'quantity',
					line: i
				});
				var itemRate = newRecord.getSublistValue({
					sublistId: 'item',
					fieldId: 'rate',
					line: i
				});
				log.debug('itemDesc ',itemDesc);
				log.debug('itemAmount ',itemAmount);
				log.debug('itemQuantity ',itemQuantity);
				var extractedIntegers = extractIntegersFromString(itemDesc);
				if(extractedIntegers)
				{
					var itemId = extractedIntegers[0];
				    a_data = 
							{
								'itemid':parseInt(itemId), 
								'amount':itemAmount,
								'quantity':itemQuantity,
								'rate':itemRate
							};
					dataArrayInt.push(itemId);
					dataArray.push(a_data);
				}
			}
			log.debug('dataArray ',dataArray);
			log.debug('dataArrayInt ',dataArrayInt);
			if(poRec)
			{
				var purchaseorderSearchObj = search.create({
			    type: "purchaseorder",
			    filters:
			    [
				   ["type","anyof","PurchOrd"], 
				   "AND", 
				   ["numbertext","is",poRec], 
				   "AND", 
				   ["mainline","is","T"]
			    ],
			    columns:
			    [
				   search.createColumn({name: "internalid", label: "Internal ID"})
			    ]
			});
			  
			
				var obj_Role_Search = getAllResults(purchaseorderSearchObj);
				if (obj_Role_Search) {
					var poId = obj_Role_Search[0].getValue({ name: 'internalid' });	
					log.debug('poId ',poId);
					var poObj = record.load({type: record.Type.PURCHASE_ORDER,id: poId,isDynamic: false});
					
					var itemCount = poObj.getLineCount({
                        sublistId: 'item'
                    });

                    log.debug('itemCount ',itemCount);
                    for (var line = 0; line < itemCount; line++) {
                        var pr_Item_Id = poObj.getSublistText({
                            sublistId: 'item',
                            fieldId: 'item',
                            line: line
                        });
						//log.debug('pr_Item_Id ',pr_Item_Id);
						var dataIndex = dataArrayInt.indexOf(parseInt(pr_Item_Id))
						//log.debug('dataIndex '+dataIndex,'dataArrayInt '+dataArrayInt);
						if(dataIndex != -1)
						{
							var i_amount = dataArray[dataIndex].amount;
							var i_rate = dataArray[dataIndex].rate;
							var i_quantity = dataArray[dataIndex].quantity;
							log.debug('i_amount '+i_amount,'i_rate '+i_rate);
							log.debug('i_quantity '+i_quantity,'i_amount '+i_amount);
							if(i_quantity){
								poObj.setSublistValue({
									sublistId: 'item',
									fieldId: 'custcol_dd_shortpay_item_quantity',
									line: line,
									value: i_quantity,
								});
							}
							if(i_amount)
							{
								poObj.setSublistValue({
									sublistId: 'item',
									fieldId: 'custcol_dd_shortpay_item_amount',
									line: line,
									value: i_amount,
								});
							}
							if(i_rate)
							{
								poObj.setSublistValue({
									sublistId: 'item',
									fieldId: 'custcol_dd_shorrtpay_item_price',
									line: line,
									value: i_rate,
								});
							}
						}
                    }
					poObj.save({
						enableSourcing: true,
						ignoreMandatoryFields: false
					});
				}	
			}
		} 	
      }
    }
	function getAllResults(s) {
		var result = s.run();
		var searchResults = [];
		var searchid = 0;
		do {
			var resultslice = result.getRange({ start: searchid, end: searchid + 1000 });
			resultslice.forEach(function (slice) {
				searchResults.push(slice);
				searchid++;
			}
			);
		} while (resultslice.length >= 1000);
		return searchResults;
	}
	function extractIntegersFromString(inputString) {
	  // Use a regular expression to match integers in the string
	  var regex = /\d+/g;
	  var integers = inputString.match(regex);

	  // If there are integers, convert them to actual numbers
	  if (integers) {
		integers = integers.map(function (str) {
		  return parseInt(str, 10); // Parse the matched string into an integer
		});
	  }

	  return integers || [];
	}
  return {
    afterSubmit: updatePoFields
  };
});