/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 * 
 * Samiha Chowdhury Case:4068052  2/11/21
 * 
 */
define(['N/record', 'N/search', 'N/runtime', 'N/task', 'N/format'],
function(record, search, runtime, task, format) {
	
    var scriptObj = runtime.getCurrentScript();
   
    /**
     * Definition of the Scheduled script trigger point.
     *
     * @param {Object} scriptContext
     * @param {string} scriptContext.type - The context in which the script is executed. It is one of the values from the scriptContext.InvocationType enum.
     * @Since 2015.2
     */
    function execute(context) {
    	//LOAD SEARCH AND RESULTS
    	var jeRecordSearch = search.load('customsearch_acs_allocation_je_for_updat'); 
    	var jeResults = jeRecordSearch.run().getRange(0,999);
		log.debug('Search Results', jeResults);
		
    	//SS:  JEs need processing & load them
		if( jeResults != null && jeResults.length > 0)
		{			
			
			for (var i = 0; i < jeResults.length; i++)
			{
				var intId = jeResults[i].id; 
				log.debug('je record ids', intId);
              
                var type = jeResults[i].recordType;
                    log.debug('record type', type);

                    if (type == 'journalentry') {

				var jeRecord = record.load({ 
					type: record.Type.JOURNAL_ENTRY,
					id: intId,
					isDynamic: true
				});
				
				log.debug('je record', jeRecord );
				
				var SublistCount = jeRecord.getLineCount({
					sublistId: 'line'
				});
	            log.debug('line count', SublistCount);
				//SET SUBLIST NAME FIELD TO EMPTY
				for(var exp = 0; exp < SublistCount; exp ++){
				/*	jeRecord.setSublistValue({
					    sublistId: 'line',
					    fieldId: 'entity',
					    line: exp,
					    value: null
					});
                    */
                  
                  
                  var lineNum = jeRecord.selectLine({
                      sublistId: 'line',
                      line: exp
                  });
                  jeRecord.setCurrentSublistValue({
                      sublistId: 'line',
                      fieldId: 'entity',
                      value: null,
                      ignoreFieldChange: true
                  });
                  
                  jeRecord.commitLine({
                      sublistId: 'line'
                  });

                  
				}
				jeRecord.save();	
                    }
              
               if (type == 'advintercompanyjournalentry') {

				var jeRecord = record.load({ 
					type: record.Type.ADV_INTER_COMPANY_JOURNAL_ENTRY,
					id: intId,
					isDynamic: true
				});
				
				log.debug('je record', jeRecord );
				
				var SublistCount = jeRecord.getLineCount({
					sublistId: 'line'
				});
	            log.debug('line count', SublistCount);
				//SET SUBLIST NAME FIELD TO EMPTY
				for(var exp = 0; exp < SublistCount; exp ++){
				/*	jeRecord.setSublistValue({
					    sublistId: 'line',
					    fieldId: 'entity',
					    line: exp,
					    value: null
					});
                    */
                  
                  
                  var lineNum = jeRecord.selectLine({
                      sublistId: 'line',
                      line: exp
                  });
                  jeRecord.setCurrentSublistValue({
                      sublistId: 'line',
                      fieldId: 'entity',
                      value: null,
                      ignoreFieldChange: true
                  });
                  
                  jeRecord.commitLine({
                      sublistId: 'line'
                  });

                  
				}
				jeRecord.save();	
                    }
              
              
    }
		}
    }
    return {
        execute: execute
    };
    
});
