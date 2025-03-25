/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log'],
    function(record, log) {
        function afterSubmit(context) {
                try
                {
                        log.debug('afterSubmit: context.type', context.type);
                        if (context.type != 'create' && context.type != 'edit') return;
                        var newRecord = context.newRecord;
                        var vendorInternalId = context.newRecord.id;
                        log.debug('afterSubmit: vendorInternalId', vendorInternalId);
                        var vendorRecordObj = record.load({ type: 'vendor', id: vendorInternalId });
                        var enableShortpay = vendorRecordObj.getValue({ fieldId: 'custentity_dd_edi_shortpay_enabled' });
                        var shortpayEnabledDate = vendorRecordObj.getValue({ fieldId: 'custentity_shortpay_date' });
                        log.debug('afterSubmit: enableShortpay', enableShortpay);
                        log.debug('afterSubmit: shortpayEnabledDate', shortpayEnabledDate);
                        if (enableShortpay) {
                                if (!shortpayEnabledDate) {
                                        vendorRecordObj.setValue({ fieldId: 'custentity_shortpay_date', value: new Date() });
                                }
                        } else if (!enableShortpay) {
                                vendorRecordObj.setValue({ fieldId: 'custentity_shortpay_date', value: null });
                        }
                        var vendorIdVal = vendorRecordObj.save({ ignoreMandatoryFields: true, enableSourcing: true });
                        log.debug('afterSubmit: vendorIdVal', vendorIdVal);
                } catch (error) {
                        log.debug('error details: =====', JSON.stringify(error));
                }
        } return {
                afterSubmit: afterSubmit
        };
});