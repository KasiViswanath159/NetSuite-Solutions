/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/error', 'N/search'], function (log, record, error, search) {

    function beforeSubmit(context) {
        try {
            var newRecord = context.newRecord;
            var vendorId = newRecord.getValue({
                fieldId: 'entity'
            });
			log.debug('vendorId ',vendorId);
			if(vendorId){
				var isConsignedVendor = search.lookupFields({
					type: search.Type.VENDOR,
					id: vendorId,
					columns: ['custentity_dd_consigned']
				});
				log.debug('isConsignedVendor ',isConsignedVendor.custentity_dd_consigned);
				if (isConsignedVendor.custentity_dd_consigned == true) {
					var recObj = record.load({type: 'customrecord_consigned_vb_autonumber',id: 1,isDynamic: false});
					var latestNumber = recObj.getValue({fieldId: 'custrecord8'});
					log.debug('latestNumber ',latestNumber);
					latestNumber++;
					var prefix = 'CONS'; 
					var sequenceNumber = prefix + latestNumber;
					recObj.setValue({fieldId:'custrecord8', value:latestNumber});
                  var existingNumber = newRecord.getValue('tranid');
					if (!existingNumber) {
						recObj.save();
						newRecord.setValue({ fieldId: 'tranid', value: sequenceNumber });
						newRecord.setValue({ fieldId: 'account', value: 2350 });
					}
				}
			}
        } catch (ex) {
            log.error({
                title: 'User Event Script Error',
                details: ex.toString()
            });

            // Throw the exception again to prevent the record from being saved
            /*Throw error.create({
                name: 'USER_EVENT_SCRIPT_ERROR',
                message: 'An error occurred in the User Event Script.'
            });*/
        }
    }

    return {
        beforeSubmit: beforeSubmit
    };
});