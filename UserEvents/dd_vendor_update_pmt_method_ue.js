/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
define(['N/record'],
    function (record) {
        function afterSubmit(context) {
            if (context.type == 'edit' || context.type == 'create') {
                try {
                    var getContext = context.newRecord;
                    var type = getContext.getValue("custrecord_2663_entity_bank_type");
                    log.debug("type", type);
                    var parentVendor = getContext.getValue("custrecord_2663_parent_vendor");
                    log.debug("parentVendor", parentVendor);
                    var fileformat = getContext.getValue("custrecord_2663_entity_file_format");
                    if (type == "1" && !isNullOrEmpty(parentVendor)) {  // Primary 
                        record.submitFields({
                            type: "vendor",
                            id: parentVendor,
                            values: { "custentity_eft_payment_method": fileformat }
                        });
                    }
                } catch (e) {
                    log.debug('After Submit Error:', JSON.stringify(e));
                }
            }
        }

        /*
      * Validating if value is null or empty
      */
        function isNullOrEmpty(val) {
            if (val == null || val == '' || val == "" || val == 'undefined' || val == undefined || val == [] || val == {} || val == '{}' || val == NaN) {
                return true;
            } else {
                return false;
            }
        };
        return {
            afterSubmit: afterSubmit
        }
    });