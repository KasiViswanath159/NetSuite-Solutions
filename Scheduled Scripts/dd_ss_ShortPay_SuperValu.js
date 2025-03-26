/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/runtime', 'N/search','./DD Lib/dd_common_lib'],//'./DD Lib/dd_common_lib'
    /**
     * @param{runtime} runtime
     * @param{search} search
     */
    (runtime, search, ddlib) => {

        /**
         * Defines the Scheduled script trigger point.
         * @param {Object} scriptContext
         * @param {string} scriptContext.type - Script execution context. Use values from the scriptContext.InvocationType enum.
         * @since 2015.2
         */
        const execute = (scriptContext) => {
            try {

                const scriptObj = runtime.getCurrentScript();
                const param = scriptObj.getParameter.bind();
                let searchId = param('custscript_dd_shotpay_search');
                log.debug('searchId', searchId);
                if (searchId) {
                    let searchLoad = search.load({
                        id: searchId
                    });
                    let date=formatDate();
                    const filename=`accurate_pay_${date}.csv`;
                    //log.debug('searchLoad', searchLoad);
                    let fileObj = ddlib.createCSVfile(searchLoad,filename);
                    let senderlist = param('custscript_recipients').split(',');//[8248538,8248537,5535722,8248539,4359318,8248540,9012495,9087759,120099,8928013,391689,391690,8928012]
                    let emailsubject = param('custscript_email_subject');//`DoorDash - Daily itemized adjustments`;
                    let emailbody =  param('custscript_email_body');/*`Hi Supervalu/UNFI team, 
                Please find our Daily list of invoices processed with the corresponding itemized adjustments in CSV format.
                Invoices are processed to match what our records indicate as the quantity we have received,at the cost we listed on our Purchase Order.
                Items delivered that were not listed on our original Purchase Orders will be deducted from the invoice. A separate payment remittance report will continue to be emailed at the time of payment.
                If you have any items you would like to dispute, please follow our attached (attached PDF) dispute process. We appreciate your valuable business partnership!
                
                Thanks,
                DashMart Team`;*/
                  log.debug('senderlist',senderlist);
                  let sender=param('custscript_sender');
                  const size = 10;
                   if(sender){
                    for (var i = 0; i < senderlist.length; i += size) {
                        let recipients = senderlist.slice(i, size + i);
                        log.debug('recipients',recipients);
                        let emailObj = {
                            senderId:sender,
                            recipients: [recipients],
                            subject: emailsubject,
                            body: emailbody,
                            attachment: fileObj
                        }
                        ddlib.sendEmail(emailObj);
                    }
                   }
                }
            } catch (e) {

log.error('ERROR',e)
            }


        }
        const formatDate=()=> {
            var d = new Date(),
                month = '' + (d.getMonth() + 1),
                day = '' + d.getDate(),
                year = d.getFullYear();
        
            if (month.length < 2) 
                month = '0' + month;
            if (day.length < 2) 
                day = '0' + day;
        
            return [year, month, day].join('.');
        }

        return {
            execute
        }

    });