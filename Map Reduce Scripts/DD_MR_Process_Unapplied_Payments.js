/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope public
 */

/*
Purpose             : 
Script Type         : Map Reduce
 */

define(['N/runtime','N/search', 'N/record', 'N/format', 'N/file'],
		function (runtime, search, record, format, file) {

	function GetInputData() {
        log.audit('Map / Reduce START', new Date());

        var currentScript = runtime.getCurrentScript();
		var savedSearchId = currentScript.getParameter({
			name: "custscript_unapplied_payments_saved_sear"
		});
        try {
            return search.load({
                id: savedSearchId
            });
        } catch (err) {
            log.error("GetInputData", err);
            return [];
        }
    }

	/*
        Function Name : Map
        Purpose       :   
	 */
	function Map(context) {
		try
		{
			log.debug('MAP context   : ', context);
			var recordId = context.key;
			var parObj = JSON.parse(context.value);
			
			
			var custId = parObj.values['entity'].value;
			var paymentId = parObj.values['internalid'].value;
			var amount = Math.abs(parObj.values.amount);
			var department = parObj.values['department'].value;
			var classId =  parObj.values['class'].value;
			var accountId =  parObj.values['account'].value;
			

			context.write({
				key: custId,
				value: {'paymentid': paymentId, 'amount':amount, 'department': department, 'classId':classId, 'accountId':accountId}
			});

		}
		catch (e)
		{
			log.error('ERROR Occurred' , e.toString());
		}
	}

	function reduce(context) {
		try
		{
			log.debug('Reduce context   : ', context);
			var QUALIFIED_TRANSACTION_TYPE = ["Invoice"];
			var customerId = context.key;
			var tempValArray = context.values;
			var paymentArray = [];
			var accountId = '';
			log.debug('Reduce VALUES   : ', 'customerId   : '+customerId+'   tempValArray :  '+tempValArray);

			var payArrObj = []; tempObj = '';
			tempValArray.forEach(function(obj){
				tempObj = JSON.parse(obj);

				if(!accountId && tempObj.accountId)
					accountId = tempObj.accountId;

				payArrObj.push(tempObj);
				paymentArray.push(tempObj.paymentid);
			});
			log.debug('Reduce VALUES   : ',  'accountId : '+accountId+ '    payArrObj   : '+JSON.stringify(payArrObj));
			
			//CREATE CUSTOMER PAYMENT
			var custPaymentRec = record.create({
				type : 'customerpayment',
				isDynamic : true,
				defaultValues : {
					entity:customerId
				}
			});			
			

			//SET ACCOUNT
			custPaymentRec.setValue('aracct', accountId);

			//GET PAYMENTS LINE COUNT
			var creditLineCount =  custPaymentRec.getLineCount({
				sublistId: 'credit'
			});			
			log.debug('Reduce VALUES Pay   : ', 'creditLineCount   : '+creditLineCount);
			
			var payID = ''; var payCnt = 0;
			for(var i = 0; i < creditLineCount; i++)
			{
				payID = custPaymentRec.getSublistValue('credit', 'doc', i);
				log.debug('Reduce VALUES Pay   : ', 'payID   : '+payID+'      paymentArray  :   '+paymentArray);
				
				if(paymentArray.indexOf(payID) > -1)
				{

					custPaymentRec.selectLine({ 
						sublistId: 'credit', 
						line: i 
					});

					custPaymentRec.setCurrentSublistValue({ 
						sublistId: 'credit', 
						fieldId: 'apply', 
						value: true 
					});
					custPaymentRec.commitLine({ 
						sublistId: 'credit' 
					});



					// custPaymentRec.selectNewLine({
					// 	sublistId: 'credit'
					// });
					// custPaymentRec.setCurrentSublistValue({
					// 	sublistId: 'credit',
					// 	fieldId: 'apply',
					// 	value: true
					// });
					// custPaymentRec.commitLine({
					// 	sublistId: 'item'
					// });

					payCnt++;
				}
			}
			log.debug('Reduce VALUES   : ', '   payCnt :  '+payCnt);
			
			
			//GET INVOICE  LINE COUNT
			var applyLineCount =  custPaymentRec.getLineCount({
				sublistId: 'apply'
			});
			log.debug('Reduce VALUES Inv  : ', '   applyLineCount :  '+applyLineCount);
			
			var invID = ''; var invAmt = 0;  var amtIndex = -1; var invCnt = 0; var tranType = '';
			for(var k = 0; k < applyLineCount; k++)
			{
				invID = custPaymentRec.getSublistValue('apply', 'doc', k);
				invAmt = custPaymentRec.getSublistValue('apply', 'amount', k);
				tranType = custPaymentRec.getSublistValue('apply', 'type', k);

				//consider only qualified transacitons
				if(QUALIFIED_TRANSACTION_TYPE.indexOf(tranType) > -1)
				{
					//get index
					amtIndex = getAmountMatchIndex(invAmt,payArrObj, tranType);
					log.debug('Reduce VALUES Pay   : ', 'invID   : '+invID+'      invAmt  :   '+invAmt+ '      amtIndex : '+amtIndex+'    tranType : '+tranType);
					if(amtIndex > -1)
					{
	
						custPaymentRec.selectLine({ 
							sublistId: 'apply', 
							line: k 
						});
	
						custPaymentRec.setCurrentSublistValue({ 
							sublistId: 'apply', 
							fieldId: 'apply', 
							value: true 
						});
						custPaymentRec.commitLine({ 
							sublistId: 'ap	ply' 
						});
	
	
						// custPaymentRec.selectNewLine({
						// 	sublistId: 'apply'
						// });
						// custPaymentRec.setCurrentSublistValue({
						// 	sublistId: 'apply',
						// 	fieldId: 'apply',
						// 	value: true
						// });
						// custPaymentRec.commitLine({
						// 	sublistId: 'item'
						// });
						invCnt++;
					}

				}
				
			}
			log.debug('Reduce VALUES   : ', '   invCnt :  '+invCnt);
			
			//Set Department
			if(payArrObj[0].department)
				custPaymentRec.setValue('department', payArrObj[0].department);
			
			//Set Class
			if(payArrObj[0].classId)
				custPaymentRec.setValue('class',  payArrObj[0].classId);
			
			custPaymentRec.setValue('autoapply', true);

			
			var newCustPayId = custPaymentRec.save();
			
			log.debug('Reduce newCustPayId   : ', newCustPayId);
		}
		catch (e)
		{
			log.error('ERROR Occurred' , e.toString());
		}
		return '';
	}
	function  getAmountMatchIndex(invAmt,payArrObj, tranType)
	{
		var tempIndex = -1;
		for(var p = 0; p < payArrObj.length; p++){
			
			if(Number(invAmt)  == Number(payArrObj.amount))
			{
				tempIndex = p;
			}
			
		}
		return tempIndex;
		
	}


	
	function Summarize() {


	}

	return {
		getInputData: GetInputData,
		map: Map,
		reduce:reduce,
		summarize: Summarize
	};
});