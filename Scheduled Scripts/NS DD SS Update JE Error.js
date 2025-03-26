/**
 * Copyright (c) 1998-2010 NetSuite, Inc.
 * 2955 Campus Drive, Suite 100, San Mateo, CA, USA 94403-2511
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * NetSuite, Inc. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with NetSuite.
 */
/**
 * The purpose **********
 *
 * @author Shafiq Hossain
 * @version 1.0
 */

var USAGE_LIMIT_THRESHOLD = 200;

 function updateJEErrors(type)
 {
	var stLoggerTitle = 'updateJE';
	nlapiLogExecution('AUDIT', stLoggerTitle, '<<<<<<< START >>>>>>>');

	var context = nlapiGetContext();
	nlapiLogExecution('AUDIT', stLoggerTitle, 'Beginning Usage : ' + context.getRemainingUsage());

	var stSrchJEId = context.getSetting('SCRIPT', 'custscript_upd_je_id_svd_srch');
	var stSrchJEDtl = context.getSetting('SCRIPT', 'custscript_upd_je_dtl_svd_srch');
	var stDeptRef = context.getSetting('SCRIPT', 'custscript_dept_cross_ref_svd_srch');
	
//	nlapiLogExecution('DEBUG', stLoggerTitle, 'stSearchID : ' + stSearchID);

	var stRecordType = '';
	var arrSearchFilters = [];
	var arrSearchColumns = [];
	var arrResultSet = [];

	stRecordType = 'transaction';

	var objJEId = getJEId(stSrchJEId);

	if(objJEId)
	{
		var objDeptRef = getDeptRef(stDeptRef);
		
		nlapiLogExecution('AUDIT', stLoggerTitle, 'Number of Journal Entry Records: ' + objJEId.length);
		for (var j = 0; j < objJEId.length;  j ++)
		{
			checkUsageLimit(USAGE_LIMIT_THRESHOLD);
			
			var jeId = objJEId[j].getValue('internalid', null, 'GROUP');
			nlapiLogExecution('AUDIT', stLoggerTitle, 'JE ID: ' + jeId);
			
			var objJERec = nlapiLoadRecord('journalentry', jeId);
			var jeLineCnt = objJERec.getLineItemCount('line');
			
			nlapiLogExecution('AUDIT', stLoggerTitle, 'Number of Journal Entry Lines: ' + jeLineCnt);
			
			var objJEDtl = getJEDtl(stSrchJEDtl, jeId);
			
			if(objJEDtl)
			{
				var iResultCnt = objJEDtl.length;
				nlapiLogExecution('DEBUG', stLoggerTitle, 'Number of Journal Entry Lines From Saved Search: ' + iResultCnt);

				if (!NSUtils.isEmpty(objJEDtl))
				{
					var arrJEResultSet = toSimpleArray(objJEDtl);
					

					for (var x = 1; x <= jeLineCnt;  x ++)
//					for (var x = 1; x <= 1;  x ++)
					{					
						var jeLineId = objJERec.getLineItemValue('line', 'line', x);
						
						for (var k = 0; k < iResultCnt;  k ++)
						{
							var lineId = arrJEResultSet[k].lineId;
							var field = arrJEResultSet[k].field;
							var oldValue = arrJEResultSet[k].oldValue;
							var newValue = arrJEResultSet[k].newValue;
							
//							nlapiLogExecution('DEBUG', stLoggerTitle, 'lineId: ' + lineId);
//							nlapiLogExecution('DEBUG', stLoggerTitle, 'oldValue: ' + oldValue);
//							nlapiLogExecution('DEBUG', stLoggerTitle, 'newValue: ' + newValue);

							var deptId = '';
							
							if(!NSUtils.isEmpty(oldValue))
							{
								var deptId = getDeptId(objDeptRef, oldValue);
								nlapiLogExecution('DEBUG', stLoggerTitle, 'deptId: ' + deptId);
							
								if(!deptId)
								{
									nlapiLogExecution('DEBUG', stLoggerTitle, 'Department ID Not Found.  Line skipped.');
									break;
								}
							}
						
							if(lineId == jeLineId)
							{
//								var tempValue = 29;
//								nlapiLogExecution('DEBUG', stLoggerTitle, 'LineId Before Update: ' + lineId);
//								nlapiLogExecution('DEBUG', stLoggerTitle, 'Credit Before Update: ' + objJERec.getLineItemValue('line', 'credit', x));
//								nlapiLogExecution('DEBUG', stLoggerTitle, 'Debit Before Update: ' + objJERec.getLineItemValue('line', 'debit', x));
//								nlapiLogExecution('DEBUG', stLoggerTitle, 'Cost Center Before Update: ' + objJERec.getLineItemValue('line', 'custcol_cseg_costcenter', x));
//								nlapiLogExecution('DEBUG', stLoggerTitle, 'Department Before Update: ' + objJERec.getLineItemValue('line', 'custcol_department_custom_field', x));
//								nlapiLogExecution('DEBUG', stLoggerTitle, 'Line Before Update: ' + objJERec.getLineItemValue('line', 'line', x));
//								nlapiLogExecution('DEBUG', stLoggerTitle, 'Line Unique Key Before Update: ' + objJERec.getLineItemValue('line', 'lineuniquekey', x));
								
								objJERec.setLineItemValue('line', 'custcol_cseg_costcenter', x, deptId);
//								nlapiLogExecution('DEBUG', stLoggerTitle, 'After Update: ' + objJERec.getLineItemValue('line', 'custcol_cseg_costcenter', x));
//								nlapiLogExecution('DEBUG', stLoggerTitle, 'After Update: ' + objJERec.getLineItemValue('line', 'custcol_department_custom_field', x));
								objJERec.commitLineItem('line');
//								nlapiLogExecution('DEBUG', stLoggerTitle, 'After Commit: ' + objJERec.getLineItemValue('line', 'custcol_cseg_costcenter', x));
//								nlapiLogExecution('DEBUG', stLoggerTitle, 'After Commit: ' + objJERec.getLineItemValue('line', 'custcol_department_custom_field', x));
								break;
							}
						}
					}
					
					objJERec.setFieldValue('custbody_je_err_corr', 'T');
					
					var updJEId = nlapiSubmitRecord(objJERec);
					nlapiLogExecution('DEBUG', stLoggerTitle, 'Saved Journal Entry: ' + updJEId);
				}
			}
			nlapiLogExecution('DEBUG', stLoggerTitle, 'Usage Per JE : ' + context.getRemainingUsage());
		}
		nlapiLogExecution('DEBUG', stLoggerTitle, 'Usage At Script Termination : ' + context.getRemainingUsage());
	}
	else
	{
		NSUtils.logMessage('Journal Saved Search', 'No results found');
	}
	nlapiLogExecution('AUDIT', stLoggerTitle, '<<<<<<< END >>>>>>>');
 }

 function getJEId(stSrchJEId)
 {
 	var stMethod = 'getJEId';
 	var arrResultSet = [];

  	var search = nlapiSearchRecord(null, stSrchJEId, null, null);

  	return search;
 }
 
 function getDeptRef(stDeptRef)
 {
 	var stMethod = 'getJEId';
 	var arrResultSet = [];

  	var search = nlapiSearchRecord(null, stDeptRef, null, null);

  	return search;
 } 

function getJEDtl(stSrchJEDtl, jeId)
{
	var stLoggerTitle = 'getJEDtl';
	var stRecordType = 'transaction';
	var arrSearchFilters = [];
//	var arrSearchColumns = [];
	var arrResultSet = [];
	
	arrSearchFilters.push(new nlobjSearchFilter('internalid', null, 'anyof', jeId));
	
	var objJEResultSet = NSUtils.search(stRecordType, stSrchJEDtl, arrSearchFilters, null);

	return objJEResultSet;
}


function getDeptId(objDeptRef, oldValue)
{
	for (var x = 0; x < objDeptRef.length;  x ++)
	{
		if(oldValue == objDeptRef[x].getValue('name'))
		{
			var deptId = objDeptRef[x].getValue('custrecord_internalid_integer');
			break;
		}
	}
	return deptId
}

function checkUsageLimit(intUsageLimitThreshold)
{
    var stLoggerTitle = 'checkUsageLimit';

    var intRemainingUsage = nlapiGetContext().getRemainingUsage();
    nlapiLogExecution('AUDIT', stLoggerTitle, 'Remaining Usage = ' + intRemainingUsage);

    if (intRemainingUsage < intUsageLimitThreshold)
    {
        var state = nlapiYieldScript();
        var reason = 'Reason: ' + state.reason + ' Info: ' + state.information + ' Size: ' + state.size;

        if (state.status == 'FAILURE')
        {
            nlapiLogExecution('ERROR', stLoggerTitle, 'Exit. Failed to yield script. ' + reason);
            throw nlapiCreateError('SCRIPT_ERROR', 'Exit. Failed to yield script. ' + reason);

        }
        else if (state.status == 'RESUME')
        {
            nlapiLogExecution('AUDIT', stLoggerTitle, 'Yield. Resuming script. ' + reason);
        }
    }
}
		


 /**
 * Simplify search results into an array of mapped values. The resulting array can be used for auto-populating a sublist.
 * @param {nlobjSearchResult[]} arrResultSet
 * @returns {Object[]} An array of objects with key-value pairs
 */
function toSimpleArray(arrResultSet)
{
	try
	{
		var arrayOutput,
			arrayItemAggr,
			count,
			i;
		/** @type nlobjSearchResult */
		var result;

		if (arrResultSet) {
			arrayOutput = [];

			for (var i = 0; i < arrResultSet.length; i++)
			{
				result = arrResultSet[i];

				var lineId = NSUtils.getValueByLabel(result, 'Line ID');
				var internalId = NSUtils.getValueByLabel(result, 'Internal ID');
//				var lineUniqId = NSUtils.getValueByLabel(result, 'Line Unique Key');
//				var Field = NSUtils.getValueByLabel(result, 'Field');
				var oldValue = NSUtils.getValueByLabel(result, 'Old Value');
				var newValue = NSUtils.getValueByLabel(result, 'New Value');

				var map = {
					'lineId' : lineId,
					'internalId' : internalId,
//					'lineUniqId' : lineUniqId,
//					'Field' : Field,
					'oldValue' : oldValue,
					'newValue' : newValue
				};

				arrayOutput.push(map);
//				NSUtils.logMessage('Retrieve Journal Search Results', "Values:", map);
			};

//			NSUtils.logMessage('Retrieve Journal Search', 'arrayOutput.length - ' + arrayOutput.length);

			return arrayOutput;
		}
	}
	catch(ex)
	{
		var errorStr = (ex.getCode != null) ? ex.getCode() + '\n' + ex.getDetails() + '\n' : ex.toString();
		NSUtils.logMessage('Error in the main function', errorStr);

		if (!(ex instanceof nlobjError)){
			throw nlapiCreateError("An Unexpected Error has occurred: ", ex.toString());
		}
	}
}


 var NSUtils = {
    /**
     * Log message to the server script logs. Any mapped values are automatically entered as audit entries. Messages are purely entered as debug
     * entries.
     *
     * @param {String}
     *                title [optional] - A title used to organize log entries (max length: 99 characters). If you set title to null or empty string
     *                (''), you will see the word "Untitled" appear in your log entry.
     * @param {String}
     *                details [optional] - The details of the log entry (max length: 3000 characters)
     * @param {Object}
     *                map [optional] - Key-value pairs to be added to the message (the values add to the message length)
     * @returns {Void}
     */
    logMessage : function(title, details, map)
    {
	var i;
	if (!title)
	{
	    title = "";
	}
	if (!details)
	{
	    details = "";
	}
	if (map)
	{
	    for (i in map)
	    {
		if (map.hasOwnProperty(i))
		{
		    details += ('\n' + i + ': ' + map[i]);
		}
	    }
	    nlapiLogExecution('AUDIT', title, details);
	}
	else
	{
	    nlapiLogExecution('DEBUG', title, details);
	}
    },

    /**
     * Evaluate if the given string or object value is empty, null or undefined.
     *
     * @param {String}
     *                stValue - string or object to evaluate
     * @returns {Boolean} - true if empty/null/undefined, false if not
     * @author mmeremilla
     */
    isEmpty : function(stValue)
    {
	if ((stValue == '') || (stValue == null) || (stValue == undefined))
	{
	    return true;
	}
	else
	{
	    if (typeof stValue == 'string')
	    {
		if ((stValue == ''))
		{
		    return true;
		}
	    }
	    else if (typeof stValue == 'object')
	    {
		if (stValue.length == 0 || stValue.length == 'undefined')
		{
		    return true;
		}
	    }

	    return false;
	}
    },
    /**
     * Get all of the results from the search even if the results are more than 1000.
     *
     * @param {String}
     *                stRecordType - the record type where the search will be executed.
     * @param {String}
     *                stSearchId - the search id of the saved search that will be used.
     * @param {Array}
     *                arrSearchFilter - array of nlobjSearchFilter objects. The search filters to be used or will be added to the saved search if
     *                search id was passed.
     * @param {Array}
     *                arrSearchColumn - array of nlobjSearchColumn objects. The columns to be returned or will be added to the saved search if search
     *                id was passed.
     * @returns {Array} - an array of nlobjSearchResult objects
     * @author memeremilla - initial version
     * @author gmanarang - used concat when combining the search result
     */
    search : function(stRecordType, stSearchId, arrSearchFilter, arrSearchColumn)
    {
	var arrReturnSearchResults = new Array();
	var nlobjSavedSearch;

	var stLoggerTitle = 'search';

	if (stSearchId != null)
	{
	    nlobjSavedSearch = nlapiLoadSearch((stRecordType) ? stRecordType : null, stSearchId);

	    // add search filter if one is passed
	    if (arrSearchFilter != null)
	    {
		nlobjSavedSearch.addFilters(arrSearchFilter);
	    }

	    // add search column if one is passed
	    if (arrSearchColumn != null)
	    {
		nlobjSavedSearch.addColumns(arrSearchColumn);
	    }
	}
	else
	{
	    nlobjSavedSearch = nlapiCreateSearch((stRecordType) ? stRecordType : null, arrSearchFilter, arrSearchColumn);
	}

	var nlobjResultset = nlobjSavedSearch.runSearch();
	var intSearchIndex = 0;
	var nlobjResultSlice = null;
	do
	{

	    nlobjResultSlice = nlobjResultset.getResults(intSearchIndex, intSearchIndex + 1000);
	    if (!(nlobjResultSlice))
	    {
		break;
	    }

	    arrReturnSearchResults = arrReturnSearchResults.concat(nlobjResultSlice);
	    intSearchIndex = arrReturnSearchResults.length;
	}

	while (nlobjResultSlice.length >= 1000);

	return arrReturnSearchResults;
    },

    /**
     * Get value of a saved search column using a label(formula numeric fileds on the saved search result).
     *
     * @param {nlobjSearchResultSet}
     *                result [required] - A single record from the result set.
     * @param {String}
     *                label [required] - The custom label from the saved search column.
     * @returns {String} sValue - The value for the saved search column.
     */
    getValueByLabel : function(result, label)
    {
	var sValue = '';
	var columns = result.getAllColumns();
	// NSUtils.logMessage('intializeSearch', 'columns - ' + columns);
	var columnLen = columns.length;
	var column;
	for (i = 0; i < columnLen; i++)
	{
	    column = columns[i];
	    if (column.getLabel() == label)
	    {
		sValue = result.getValue(column);
		break;
	    }
	}
	return sValue;
    }

}



//Supressing the 'Leave this page' warning on window close
function confirmExit(){
    return null;
}



//Closing the window
function closeWindow() {
	window.close();
}