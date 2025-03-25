/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */
define(['N/record', 'N/search'],

    function (record, search) {


        function beforeSubmit(context) {
            try {

                var currRec = context.newRecord;
                var CheckNo = currRec.getValue('tranid');
                log.debug('Vendor payment Id:', currRec.id);
                log.debug('Check Number:', CheckNo);
                log.debug('UserEvent Type:', context.type);
                var pfaRecId = currRec.getValue('custbody_9997_pfa_record');
                log.debug('pfa Record Id:', pfaRecId);
                var memo = currRec.getValue('memo');
                log.debug('Memo old value:', memo);
                // if ((context.type == context.UserEventType.CREATE || context.type == context.UserEventType.EDIT) && fnIsNotNull(CheckNo)) {
                if ((context.type == context.UserEventType.CREATE) && fnIsNotNull(CheckNo)) {
                    var checkNo = currRec.getValue('tranid');
                    log.debug('Old check No:', checkNo);
                    // Replace '/' with null value in the check number field value 
                    var newCheckNo = checkNo.replace("/", "");
                    log.debug('New check No:', newCheckNo);
                    currRec.setValue('tranid', newCheckNo);
                    // Set the payment method field value and add prefix to the memo field
                    if (fnIsNotNull(pfaRecId)) {
                        var paymentMtdInfo = getBankPaymentMethod(pfaRecId);
                        currRec.setValue('custbody_dd_bank_payment_method', paymentMtdInfo.paymentMtd);
                        currRec.setValue('memo', paymentMtdInfo.memoPrefix + memo);
                        log.debug('memo new value:', paymentMtdInfo.memoPrefix + memo);
                    }

                }
            }
            catch (e) { log.error('Error in beforeSubmit function:', e.message); }

        }
        function getBankPaymentMethod(pfaRecId) {
            try {
                // This function is to get the payment method details based on the payemnt template
                var paymentMethod = "";
                var memoPrefix = "";
                var responseInfo = {};
                var lookupPFARec = search.lookupFields({
                    type: 'customrecord_2663_file_admin',
                    id: pfaRecId,
                    columns: ['custrecord_2663_bank_account']
                });
                var CompanyBankRecId = lookupPFARec.custrecord_2663_bank_account[0].value;
                log.debug('Company Bank Rec Id:', CompanyBankRecId);
                var lookupCompanyBankRec = search.lookupFields({
                    type: 'customrecord_2663_bank_details',
                    id: CompanyBankRecId,
                    columns: ['custrecord_2663_eft_template']
                });
                var templateEFT = lookupCompanyBankRec.custrecord_2663_eft_template[0].text;
                log.debug('EFT Template Name:', templateEFT);
                if (templateEFT.indexOf("US ACH") > -1) {
                    paymentMethod = '1';//1:US ACH
                    memoPrefix = "US ACH ";
                }
                else if (templateEFT.indexOf("US CHECK") > -1) {
                    paymentMethod = '2';//2:US CHECK
                    memoPrefix = "US CHECK ";
                }
                else if (templateEFT.indexOf("GACH") > -1) {
                    paymentMethod = '3';//3:Global ACH
                    memoPrefix = "GACH ";
                }
                else if (templateEFT.indexOf("CA CHECK") > -1) {
                    paymentMethod = '4';//4:CA CHECK
                    memoPrefix = "CA CHECK ";
                }
                responseInfo.paymentMtd = paymentMethod;
                responseInfo.memoPrefix = memoPrefix;
                log.debug('Bank Payment Method details:', responseInfo);
                return responseInfo;
            }
            catch (e) { log.error('Error in getBankPaymentMethod function:', e.message); }
        }
        function fnIsNotNull(str) {
            return (str != null && str !== '' && str != undefined);
        }

        function fnIsNull(str) {
            return (str == null || str === '' || str == undefined);

        }
        return {
            beforeSubmit: beforeSubmit
        };

    });
