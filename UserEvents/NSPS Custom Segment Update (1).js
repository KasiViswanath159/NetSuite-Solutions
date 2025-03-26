/**
 * @NScriptType UserEventScript
 * @NApiVersion 2.x
 */

define(['N/record','N/runtime','N/log'], 
    function(record,runtime,log) 
    {
        function beforeSubmitFunction(scriptContext) 
        {
        	try{
        	var FUNC_NAME = 'beforeSubmitFunction';
        	log.debug(FUNC_NAME, '----Script starts----');
        	
        	var exeContext = runtime.executionContext;
        	log.debug(FUNC_NAME, 'exeContext :'+exeContext);
        	
        	//if((runtime.ContextType == runtime.ContextType.USERINTERFACE) || (runtime.ContextType == runtime.ContextType.CSV_IMPORT))
        	/*if(runtime.executionContext != runtime.ContextType.WEBSERVICES)
        	{*/
        		var eventType = scriptContext.type;
            	log.debug(FUNC_NAME, 'Event Type :'+eventType);

            	if((eventType == scriptContext.UserEventType.CREATE) || (eventType == scriptContext.UserEventType.EDIT))
        		{
            		var billRec  = scriptContext.newRecord;
            		var numLines = billRec.getLineCount({
            		    		   sublistId: 'expense'
            					   });
            		log.debug(FUNC_NAME, 'No. of lines :'+numLines);
            		
            		if(numLines >0)
            		{
	            		for(var i=0;i<numLines;i++)
	            		{
	            			var budgetDepartment = billRec.getSublistValue({
	            			    				   sublistId: 'expense',
	            			    				   fieldId: 'custcol_department_custom_field',
	            			    				   line: i
	            								   });
	            			var expenseCostCenterValue = billRec.getSublistValue({
	            			    				   sublistId: 'expense',
	            			    				   fieldId: 'custcol_cseg_costcenter',
	            			    				   line: i
	            								   });
	            			log.debug(FUNC_NAME, 'budgetDepartment :'+budgetDepartment);
	            			if (!expenseCostCenterValue && budgetDepartment) {
								billRec.setSublistValue({
									sublistId: 'expense',
									fieldId: 'custcol_cseg_costcenter',//''
									line: i,
									value :budgetDepartment
								});
							}
	            		}
            		}
        var numLines_items = billRec.getLineCount({
 		    		         sublistId: 'item'
 					         });
 		log.debug(FUNC_NAME, 'No. of lines_item :'+numLines_items);
 		if(numLines_items >0)
 		{
	 		for(var j=0;j<numLines_items;j++)
	 		{
	 			var budgetDepartment = billRec.getSublistValue({
	 			    				   sublistId: 'item',
	 			    				   fieldId: 'custcol_department_custom_field',
	 			    				   line: j
	 								   });
	 			var itemCostCenterValue = billRec.getSublistValue({
	 			    				   sublistId: 'item',
	 			    				   fieldId: 'custcol_cseg_costcenter',
	 			    				   line: j
	 								   });
	 			log.debug(FUNC_NAME, 'budgetDepartment :'+budgetDepartment);
				if (!itemCostCenterValue && budgetDepartment) {
					billRec.setSublistValue({
						sublistId: 'item',
						fieldId: 'custcol_cseg_costcenter',//''
						line: j,
						value :budgetDepartment
					});
				}
	 		}
 		}
	}                
	else
	{
		log.debug(FUNC_NAME, 'Returning because the Event Type does Not Match' );
		return;
	}
        	/*}
        	else
        	{
        		log.debug(FUNC_NAME, 'exeContext :'+exeContext+'; Returning because the ContextType does Not Match' );
        		return;
        	}*/
        	
                    
            log.debug(FUNC_NAME, '----Script Ends----');
            
       
    } catch (ex) {
		var errorStr = (ex.getCode != null) ? ex.getCode() + '\n'
				+ ex.getDetails() + '\n' : ex.toString();
		log.debug('Error in the beforeSubmit function', errorStr);
	}
        }
        return {
            beforeSubmit: beforeSubmitFunction
        };
});