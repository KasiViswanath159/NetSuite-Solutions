/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/log', 'N/record', 'N/redirect', 'N/search', 'N/ui/message', 'N/runtime', './DoorDashTool'],
    /**
 * @param{log} log
 * @param{record} record
 * @param{redirect} redirect
 * @param{search} search
 * @param{message} message
 */
    (log, record, redirect, search, message, runtime, ddt) => {
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
            if (runtime.executionContext == runtime.ContextType.USER_INTERFACE) {
                const newRec = scriptContext.newRecord;
                const transform = newRec.getValue({fieldId: "transform"});
                const request = scriptContext.request;
                if (transform == "purchord" && request) {
                    const poId = request.parameters.id;
                    let billInfo = poId ? getRelatedBillFromEDI(poId) : "";
                    if (billInfo && billInfo.billId) {
                        redirect.toRecord({
                            type: record.Type.VENDOR_BILL,
                            id: billInfo.billId,
                            parameters: {
                                tipMsgEDI: "EDI 810 bill already created for this PO, Don't create another Bill." +
                                    " Instead attach the PDF to the existing Bill transaction(Current Bill Transaction)."
                            }
                        });
                    }
                }

                if (request && request.parameters && request.parameters.tipMsgEDI) {
                    scriptContext.form.addPageInitMessage({
                        title: "Tip Message!",
                        message: request.parameters.tipMsgEDI,
                        type: message.Type.WARNING
                    });
                }
            }
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

        }

        const getRelatedBillFromEDI = (poId) => {
            const filterArr = [
                // PurchOrd
                {name: "type", operator: search.Operator.ANYOF, values: "PurchOrd"},
                {name: "internalid", operator: search.Operator.ANYOF, values: poId},
                // VendBill
                {name: "type", join: "applyingtransaction", operator: search.Operator.ANYOF, values: "VendBill"},
                {name: "custbody_dd_created_by_edi_script", join: "applyingtransaction", operator: search.Operator.IS, values: "T"},
                {name: "mainline", operator: search.Operator.IS, values: "F"}
            ];
            let filterInfoArr = ddt.getFilterOrColArr(filterArr, "filter");

            const columnArr = [
                {name: "internalid", summary: search.Summary.GROUP, sort: search.Sort.ASC, outKey: "poId"},
                {name: "transactionname", summary: search.Summary.GROUP, sort: search.Sort.ASC, outKey: "poName"},
                {name: "applyingtransaction", summary: search.Summary.GROUP, method: "getText", outKey: "billName"},
                {name: "internalid", join: "applyingtransaction", summary: search.Summary.GROUP, sort: search.Sort.ASC, outKey: "billId"},
                {name: "custbody_dd_created_by_edi_script", join: "applyingtransaction", summary: search.Summary.GROUP, sort: search.Sort.ASC, outKey: "FromEDI"}

            ]
            let columnInfoArr = ddt.getFilterOrColArr(columnArr);
            let newSearch = search.create({
                type: search.Type.TRANSACTION,
                columns: columnInfoArr ? columnInfoArr.map(columnInfo => columnInfo.colInfo) : [],
                filters: filterInfoArr
            });

            const dataArr = ddt.getAllData(newSearch, columnInfoArr);

            return dataArr && dataArr.length > 0 && dataArr[0];
        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
