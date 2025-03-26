/**
 * @NScriptType UserEventScript
 * @NApiVersion 2.x
 */

define(['N/record', 'N/runtime', 'N/log'],
	function (record, runtime, log) {

		function isEmpty(stValue) {
			if ((stValue == '') || (stValue == null)
				|| (stValue == undefined)) {
				return true;
			}
			return false;
		}
		function beforeSubmitFunction(scriptContext) {

			var FUNC_NAME = 'beforeSubmitFunction';
			log.debug(FUNC_NAME, '----Script starts----');

			var exeContext = runtime.ContextType; //runtime.executionContext; 
			log.debug(FUNC_NAME, 'exeContext :' + exeContext);

			//if((runtime.ContextType == runtime.ContextType.USERINTERFACE) || (runtime.ContextType == runtime.ContextType.CSV_IMPORT))
			/*if(runtime.executionContext != runtime.ContextType.WEBSERVICES)
			{*/
			var eventType = scriptContext.type;
			log.debug(FUNC_NAME, 'Event Type :' + eventType);


			var billRec = scriptContext.newRecord;
			var record_type = billRec.type;
			if (record_type == 'journalentry' || record_type == 'intercompanyjournalentry' ||   record_type == 'statisticaljournalentry') {
				var numLines = billRec.getLineCount({
					sublistId: 'line'
				});

				log.debug(FUNC_NAME, 'No. of lines :' + numLines);

				if (numLines > 0) {
					for (var i = 0; i < numLines; i++) {
						var budgetDepartment = billRec.getSublistValue({
							sublistId: 'line',
							fieldId: 'custcol_department_custom_field',
							line: i
						});
						var department_custom = billRec.getSublistValue({
							sublistId: 'line',
							fieldId: 'custcol_cseg_costcenter',
							line: i
						});
						var marketclass = billRec.getSublistValue({
							sublistId: 'line',
							fieldId: 'class',
							line: i
						});
						var business_unit = billRec.getSublistValue({
							sublistId: 'line',
							fieldId: 'department',
							line: i
						});
						if (isEmpty(business_unit) == true) {


							billRec.setSublistValue({
								sublistId: 'line',
								fieldId: 'department',//''
								line: i,
								value: 1
							});

						}
						if (isEmpty(marketclass) == true) {


							billRec.setSublistValue({
								sublistId: 'line',
								fieldId: 'class',//''
								line: i,
								value: 21
							});

						}
						if (isEmpty(budgetDepartment) == true && isEmpty(department_custom) == true) {
							budgetDepartment = 29;

							billRec.setSublistValue({
								sublistId: 'line',
								fieldId: 'custcol_department_custom_field',//''
								line: i,
								value: budgetDepartment
							});
							billRec.setSublistValue({
								sublistId: 'line',
								fieldId: 'custcol_cseg_costcenter',//''
								line: i,
								value: budgetDepartment
							});
						}
						if (isEmpty(budgetDepartment) == true && isEmpty(department_custom) == false) {


							billRec.setSublistValue({
								sublistId: 'line',
								fieldId: 'custcol_department_custom_field',//''
								line: i,
								value: department_custom
							});

						}
						if (isEmpty(budgetDepartment) == false && isEmpty(department_custom) == true) {

							billRec.setSublistValue({
								sublistId: 'line',
								fieldId: 'custcol_cseg_costcenter',//''
								line: i,
								value: budgetDepartment
							});
						}
						if (isEmpty(budgetDepartment) == false && isEmpty(department_custom) == false) {


							billRec.setSublistValue({
								sublistId: 'line',
								fieldId: 'custcol_department_custom_field',//''
								line: i,
								value: department_custom
							});
						}

					}
				}


			}


			/*}
			else
			{
				log.debug(FUNC_NAME, 'exeContext :'+exeContext+'; Returning because the ContextType does Not Match' );
				return;
			}*/


			log.debug(FUNC_NAME, '----Script Ends----');



		}
		return {
			beforeSubmit: beforeSubmitFunction
		};
	});