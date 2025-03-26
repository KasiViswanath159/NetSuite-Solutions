/**
 * @NApiVersion 2.0
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/format', 'N/record', 'N/search', 'N/runtime'],
function(format, record, search, runtime) {
    function beforeSubmit(scriptContext) {
		var recTransaction = scriptContext.newRecord;
		if (scriptContext.type == scriptContext.UserEventType.CREATE && runtime.executionContext !== runtime.ContextType.SCHEDULED) {
		    if (!recTransaction.getValue('custbody_dd_vendorbill_date')) {
                recTransaction.setValue('custbody_dd_vendorbill_date', recTransaction.getValue('trandate'));
            }
		}
    }

    return {
        beforeSubmit: beforeSubmit
    };
});
