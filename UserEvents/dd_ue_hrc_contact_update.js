/*
 * CONFIDENTIAL AND PROPRIETARY SOURCE CODE.
 *
 * Use and distribution of this code is subject to applicable licenses and the
 * permission of the code owner. This notice does not indicate the actual or
 * intended publication of this source code.
 *
 * Portions developed for DoorDash, Inc. and are the property of DoorDash, Inc.
 * =============================================================================
 * Version    Date           Author           Remarks
 * 1.0        23 01 2022     Bruce Do         Uncheck HRC Update flag in Contact record.
 */
/* global log */
/**
 * @NAPIVersion 2.1
 * @NScriptType UserEventScript
 * @ModuleScope SameAccount
 */
define([
    'N/email',
    'N/record',
    'N/runtime'
], function (email, record, runtime) {
    /**
     * Function definition to be triggered before record is loaded.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.newRecord - New record
     * @param {Record} scriptContext.oldRecord - Old record
     * @param {string} scriptContext.type - Trigger type
     * @Since 2015.2
     */
    const beforeSubmit = (scriptContext) => {
        let title = 'dd_ue_hrc_contact_update.scriptContext';
        log.debug('runtime.executionContext', runtime.executionContext);
        log.debug('scriptContext.type', scriptContext.type);
        try {
            let hrcUpdate = false;
            if (runtime.executionContext === runtime.ContextType.MAP_REDUCE)// && scriptContext.type === scriptContext.UserEventType.EDIT)
            {
                hrcUpdate = true;
            }
            let contRec = scriptContext.newRecord;
            log.debug(title,'Updating HRC Update field to ' + hrcUpdate);
            contRec.setValue({
                fieldId: 'custentity_hrc_update',
                value: hrcUpdate,
                ignoreFieldChange: true
            });
        } catch (e) {
            log.error(title, 'An error occurs during setting custentity_hrc_update: ' + e);
        }
    }
    return {
        // beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        // afterSubmit: afterSubmit
    };
});
