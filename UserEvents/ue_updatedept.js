/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 */

/**
* Module Description
* Copies the Budget department to department
* 
* Version    Date            Author           Remarks
* 1.00       30 Nov 2020     Naveen           init
*
*/

define([],

    function () {

        /**
         * Function definition to be triggered before record is loaded.
         *
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type
         * @Since 2015.2
         */
        function beforeSubmit(scriptContext) {

            //restrict to create 
            try {
                if (scriptContext.type == 'create') {

                    var rec = scriptContext.newRecord;
                    //get expense lines
                    var expLines = rec.getLineCount({
                        sublistId: 'expense'
                    });
                    var itemLines = rec.getLineCount({
                        sublistId: 'item'
                    });
                    log.debug('linecount', expLines + ' : ' + itemLines);

                    //update expense liens
                    for (var i = 0; i < expLines; i++) {

                        var budgetDept = '';
                        var dept = '';
                        budgetDept = rec.getSublistValue({
                            sublistId: 'expense',
                            fieldId: 'custcol_department_custom_field',
                            line: i
                        });
                        dept = rec.getSublistValue({
                            sublistId: 'expense',
                            fieldId: 'custcol_cseg_costcenter',
                            line: i
                        });

                        log.debug('budgetDept', budgetDept + ' : ' + dept)

                        if (!dept) {
                            log.debug('setting dept');
                            rec.setSublistValue({
                                sublistId: 'expense',
                                fieldId: 'custcol_cseg_costcenter',
                                line: i,
                                value: budgetDept
                            });

                        }
                    }

                    //update item lines
                    for (var i = 0; i < itemLines; i++) {

                        var budgetDept = '';
                        var dept = '';
                        budgetDept = rec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_department_custom_field',
                            line: i
                        });
                        dept = rec.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_cseg_costcenter',
                            line: i
                        });

                        if (!dept) {
                            rec.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_cseg_costcenter',
                                line: i,
                                value: budgetDept
                            });

                        }
                    }


                }
            }
            catch (e) {
                log.error('Exception', e);
            }
        }

        return {
            beforeSubmit: beforeSubmit
        };

    });
