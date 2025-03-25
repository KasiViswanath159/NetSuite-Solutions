/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/runtime', 'N/record'], function (log, runtime, record) {

    function beforeSubmit(context) {
        try {
            var currentUserId = runtime.getCurrentUser().id;
			log.debug('currentUserId ',currentUserId);
			log.debug('context.type  ',context.type);
            if (context.type == 'create' &&(currentUserId === 8634185)) {
                var newRecord = context.newRecord;
				var memoValue = newRecord.getValue({'fieldId':'memo'});
				log.debug('memoValue ',memoValue);
                newRecord.setValue({
                    fieldId: 'custbody_original_invoice_number', 
                    value: memoValue 
                });
				newRecord.setValue({
                    fieldId: 'memo', 
                    value: '' 
                });
            }
        } catch (ex) {
            log.error('User Event Script Error', ex);
        }
    }
    return {
        beforeSubmit: beforeSubmit
    };
});
