/**
 * Module Description
 * 
 * Version    Date            Author           Remarks
 * 1.00       				Anil C
 *
 */

var USAGE_LIMIT_THRESHOLD = 500;
var currentContext = nlapiGetContext();


function sched_itemClassUpdate(type) 
{

	var savedSearchId = 2242;
	//var searchObj = [6673035,6672834];
	var searchObj = getAllResults(savedSearchId); 
	nlapiLogExecution("DEBUG","searchObj", + searchObj); 

	try { //catches errors

		//for (var i=0; i < 1; i++)
		for (var i=0; i < searchObj.length; i++)
		{
			nlapiLogExecution("DEBUG","INSIDE FOR"); 
			//Get Remaining Usage
			var remainingUsage = currentContext.getRemainingUsage();
			if (remainingUsage < USAGE_LIMIT_THRESHOLD){   
				rescheduleScript();
			} 
			try 
			{ 
			    nlapiLogExecution("DEBUG","INSIDE TRY"); 
				//var Trantype = searchObj[i].getValue('type',null,'group');
			    var SaleOrdId = searchObj[i].getValue('internalid',null,'group');
				//var SaleOrdId = '6673035';
				nlapiLogExecution("DEBUG","SaleOrdId", + SaleOrdId); 
                var startDate = '1/1/2022';
				var rec = nlapiLoadRecord('purchasecontract', SaleOrdId); //load the record 20
				rec.setFieldValue('startdate', startDate);
				rec.setFieldValue('trandate', startDate);
				nlapiSubmitRecord(rec,{disabletriggers : true, enablesourcing : true}); //submit the record without triggering scripts and workflows
			} 
			catch(err)
			{
				nlapiLogExecution('ERROR','Process Error', err.getCode() + ': ' + err.getDetails());
			}


		}
	} 
	catch(err)
	{
		if (err instanceof nlobjError) 
		{
			nlapiLogExecution('ERROR','Process Error', err.getCode() + ': ' + err.getDetails());
			throw err;
		} 
		else 
		{	 
			nlapiLogExecution('ERROR','Unexpected Error', err.toString());     
			throw nlapiCreateError('99999', err.toString());
		}            			
	} 

}

//It Reschedule the script 
function rescheduleScript(){
	var state = nlapiYieldScript();
	var reason = 'Reason: ' + state.reason + ' Info: ' + state.information + ' Size: ' + state.size;

	if (state.status == 'FAILURE'){
		nlapiLogExecution('ERROR', 'Status', 'Exit. Failed to yield script. ' + reason);
		throw nlapiCreateError('SCRIPT_ERROR', 'Exit. Failed to yield script. ' + reason);
	}
	else if (state.status == 'RESUME')	{
		nlapiLogExecution('AUDIT', 'Status', 'Yield. Resuming script. ' + reason);
	}
}


function isEmpty(stValue)
{
	if ((stValue == '') || (stValue == null) ||(stValue == undefined) ||(stValue == 0))
	{
		return true;
	}
	return false;
}

function getAllResults(stSavedSearch)
{
	var arrResult = [];

	var count = 1000;
	var init  = true;
	var min   = 0;
	var max   = 1000;
	if(stSavedSearch)
	{
		var search = nlapiLoadSearch('purchasecontract', stSavedSearch);

	}

	var rs = search.runSearch();

	while (count == 1000 || init)
	{
		var resultSet = rs.getResults(min, max);
		arrResult = arrResult.concat(resultSet);
		min = max;
		max += 1000;

		init  = false;
		count = resultSet.length;
	}

	return arrResult;
}