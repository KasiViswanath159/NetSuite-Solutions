/**
 * Copyright (c) 1998-2018 NetSuite, Inc.
 * 2955 Campus Drive, Suite 100, San Mateo, CA, USA 94403-2511
 * All Rights Reserved.
 *
 * This software is the confidential and proprietary information of
 * NetSuite, Inc. ("Confidential Information"). You shall not
 * disclose such Confidential Information and shall use it only in
 * accordance with the terms of the license agreement you entered into
 * with NetSuite.
 */

/**
 * @NApiVersion 2.x
 * @NScriptType userEventScript
 * 
 * Version    Date          Author              Remarks
 * 1.00       12/23/2020    Urkesh Shah    Initial Commit
 * case#4023738
 */

define(['N/runtime','N/url'],
  function(runtime,url) {

    //Displays the button on Invoice  that will route to the suitelet
    function beforeLoad(context) {
      var stLogTitle = 'beforeLoad';
      try {
        var newRec = context.newRecord;
        var stRecordType = newRec.type;
        var stRecordId = newRec.id;
        var receiveremail = newRec.email;
        log.debug(stLogTitle, '*** Start ***');
        log.debug(stLogTitle, context);
        log.debug(stLogTitle,stRecordType);
        if (context.type == context.UserEventType.VIEW) {
          var buttonLabel = runtime.getCurrentScript().getParameter('custscript_email_buttonlabel');
          var urlSuitelet = url.resolveScript({
              scriptId: 'customscript_ns_acs_sl_email_manual_inv',
              deploymentId: 'customdeploy_ns_acs_email_manual_inv',
              returnExternalUrl: false,
              params: {
                    'rectype': stRecordType,
                    'recid': stRecordId
                }
            });

            var buttonPrintPdf = context.form.addButton({
              id: 'custpage_btn_openCustomEmailForm',
              label: buttonLabel,
             functionName: "window.open('" + urlSuitelet + "', 'win', 'resizable=0,scrollbars=0,width=1000,height=500');"
            });
            log.debug(stLogTitle, '*** End ***');
        }
      } catch (error) {
        log.error(stLogTitle, error);
      }
    }

    function isEmpty(value) {
      var stLogTitle = 'isEmpty';
      try {
        if (value == null || value == '' || (!value) || value == 'undefined') {
          return true;
        }
        return false;
      } catch (error) {
        log.error(stLogTitle, error);
      }
    }

    return {
      beforeLoad: beforeLoad,
    }
  });