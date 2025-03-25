/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/record', 'N/runtime', 'N/search', 'N/workflow', './DoorDashTool', './DD_Constant'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 * @param{workflow} workflow
 */
    (log, record, runtime, search, workflow, ddt, DD_CONSTANT) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {
            try {
                const newRec = scriptContext.newRecord;
                if (newRec) {
                    newRec.setValue({fieldId: DD_CONSTANT.CUSTOM_FIELD_ID.AUTO_APPROVAL_DASH_MART, value: false});
                    const subsidiary = newRec.getValue({fieldId: "subsidiary"});
                    let poId = newRec.getValue({fieldId: "createdfrom"});
                    const sublistId = "item";
                    if (!poId) {
                        for (let lineIndex = 0; lineIndex < newRec.getLineCount({sublistId: sublistId}); lineIndex++) {
                            poId = newRec.getSublistValue({sublistId: sublistId, fieldId: "orderdoc", line: lineIndex});
                            if (poId) {
                                break;
                            }
                        }
                    }
                    /*
                    *  5: DoorDash Essentials, LLC
                    * 24: DoorDash Essentials Canada Inc.
                    * 27: DoorDash Essentials LLC, Australia
                    * 41: Rapid Retail Canada Inc.
                    */
                    if (/^(5|24|27|41)$/.test(subsidiary)) {
                        const newPendingApprovalStatus = newRec.getValue({fieldId: "approvalstatus"});
                        const account = newRec.getValue({fieldId: "account"});
                        // "2350": 2105 Accounts Payable - Inventory
                        if (runtime.executionContext == runtime.ContextType.USER_INTERFACE && poId && account == "2350") {
                            const hasMismatchTolerance = ddt.hasMismatchPrice(newRec, poId);
                            // 1: pending approval
                            if (!hasMismatchTolerance && newPendingApprovalStatus == "1"){
                                newRec.setValue({fieldId: DD_CONSTANT.CUSTOM_FIELD_ID.AUTO_APPROVAL_DASH_MART, value: true});
                            }
                        }
                    }
                }
            } catch (e) {
                log.error("Exception on beforesubmit", e);
            }
        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            try{
                const newRec = scriptContext.newRecord;
                //Ticket# : Vendor Hold and pending approval in case no reciept available for related PO
                if (newRec && scriptContext.type != scriptContext.UserEventType.DELETE && scriptContext.type != scriptContext.UserEventType.EDIT && runtime.executionContext != runtime.ContextType.MAP_REDUCE) { 
                    //Retrieve the linked Purchase Order ID
                    let rec = record.load({
                                id: scriptContext.newRecord.id,
                                type: scriptContext.newRecord.type
                              });
                    var purchaseOrderId = ddt.getPurchaseOrderId(rec);
                    if (purchaseOrderId) {
                        // Check for related Item Receipts using SuiteQL
                        let itemReceiptFound = ddt.checkForItemReceipts(purchaseOrderId);
                        // If no Item Receipt found, update Vendor Bill status and payment hold
                        if (!itemReceiptFound) {
                            ddt.updateVendorBill(rec);
                        } else {
                            log.audit({
                                title: 'Item Receipt Found',
                                details: 'Item Receipt exists for the related Purchase Order. No changes made to Vendor Bill.'
                            });
                        }
                    }
                }
                if (newRec && scriptContext.type != scriptContext.UserEventType.DELETE) {
                    const autoApprovalDashMart = newRec.getValue({fieldId: DD_CONSTANT.CUSTOM_FIELD_ID.AUTO_APPROVAL_DASH_MART});
                    if (autoApprovalDashMart){
                        workflow.trigger({
                            recordType: record.Type.VENDOR_BILL,
                            recordId: newRec.id,
                            // DD Journal Entry Approval Workflow
                            workflowId: "customworkflow1",
                            // Add Approve Button Action
                            // actionId: "workflowaction13",
                            actionId: "workflowaction377"
                        });
                    }
                }
               if (newRec && scriptContext.type != scriptContext.UserEventType.DELETE) {
                  let rec = record.load({
                    id: scriptContext.newRecord.id,
                    type: scriptContext.newRecord.type
                  });
                  const accountId = rec.getValue({fieldId: 'account'});
                  const vendId = rec.getValue({fieldId: 'entity'});
                  let fieldLookUp = search.lookupFields({
                    type: search.Type.VENDOR,
                    id: vendId,
                    columns: ['custentity_dd_directdebitvendor']
                });
                const isDirectDebit = fieldLookUp['custentity_dd_directdebitvendor'];
                   log.debug({title:"isDirectDebit",details:isDirectDebit});
                   log.debug({title:"accountId",details:accountId});
                  if(accountId == "2350" && isDirectDebit== true)
                  {
                    
                  log.debug({title:"isDirectDebit Inside",details:isDirectDebit});
                   log.debug({title:"accountId Inside",details:accountId});
                    rec.setValue({fieldId:"approvalstatus",value:2});
                  }
                  rec.save();
                }
            } catch (e) {
                log.error("Exception on aftersubmit", e);
            }
        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
