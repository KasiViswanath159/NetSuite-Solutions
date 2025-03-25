/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 */
define(['N/log', 'N/record', 'N/runtime', 'N/search', 'N/ui/dialog'],
/**
 * @param{log} log
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 * @param{dialog} dialog
 */
function(log, record, runtime, search, dialog) {
    function getSearchData (searchInstance, pageSize, columnInfoArr){
        var resultSet = searchInstance.run();
        //10 unit
        var data = resultSet.getRange({start: 0, end: pageSize || 5});
        var dataResultArr = [];
        data && data.forEach(function (result) {
            if (columnInfoArr){
                var outputResult = "";
                columnInfoArr && columnInfoArr.length > 0 && columnInfoArr.forEach(function (columnInfo) {
                    if (columnInfo && columnInfo.outKey){
                        if (!outputResult){
                            outputResult = {};
                        }
                        outputResult[columnInfo.outKey] = columnInfo.method ? result[columnInfo.method](columnInfo.colInfo) : result.getValue(columnInfo.colInfo);
                    }
                });

                outputResult && dataResultArr.push(outputResult);
            } else {
                dataResultArr.push(result);
            }
        });

        return dataResultArr;
    }

    function getFilterOrColArr(mappingArr, type) {
        var resultInfoArr = [];
        mappingArr && mappingArr.forEach(function (mappingInfo) {
            if (type == "filter"){
                resultInfoArr.push(search.createFilter(mappingInfo));
            } else {
                resultInfoArr.push({
                    outKey: mappingInfo.outKey || mappingInfo.name,
                    method: mappingInfo.method || "",
                    colInfo: search.createColumn(mappingInfo)
                });
            }
        })
        return resultInfoArr;
    }
    function externalidCheck(externalId, type, id){
        var filterArr = [
            {name: "externalid", operator: search.Operator.IS, values: externalId}
        ];
        if (id){
            filterArr.push({name: "internalid", operator: search.Operator.NONEOF, values: id});
        }
        var filterInfoArr = getFilterOrColArr(filterArr, "filter");

        var columnArr = [
            {name: "internalid", outKey: "id"},
            {name: "transactionnumber", outKey: "tranNum"},
            {name: "transactionname", outKey: "tranName"},
            {name: "tranid", outKey: "tranId"}
        ]
        var columnInfoArr = getFilterOrColArr(columnArr);
        var newSearch = search.create({
            type: search.Type.PURCHASE_ORDER,
            columns: columnInfoArr ? columnInfoArr.map(function (columnInfo){return columnInfo.colInfo}) : [],
            filters: filterInfoArr
        });

        var dataArr = getSearchData(newSearch, 5, columnInfoArr);
        if (dataArr && dataArr.length > 0){
            return dataArr[0].tranName;
        } else {
            return false;
        }
    }
    
    /**
     * Function to be executed after page is initialized.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
     *
     * @since 2015.2
     */
    function pageInit(scriptContext) {

    }

    /**
     * Function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @since 2015.2
     */
    function fieldChanged(scriptContext) {

    }

    /**
     * Function to be executed when field is slaved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     *
     * @since 2015.2
     */
    function postSourcing(scriptContext) {

    }

    /**
     * Function to be executed after sublist is inserted, removed, or edited.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @since 2015.2
     */
    function sublistChanged(scriptContext) {

    }

    /**
     * Function to be executed after line is selected.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @since 2015.2
     */
    function lineInit(scriptContext) {

    }

    /**
     * Validation function to be executed when field is changed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     * @param {string} scriptContext.fieldId - Field name
     * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
     * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
     *
     * @returns {boolean} Return true if field is valid
     *
     * @since 2015.2
     */
    function validateField(scriptContext) {

    }

    /**
     * Validation function to be executed when sublist line is committed.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function validateLine(scriptContext) {

    }

    /**
     * Validation function to be executed when sublist line is inserted.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function validateInsert(scriptContext) {

    }

    /**
     * Validation function to be executed when record is deleted.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @param {string} scriptContext.sublistId - Sublist name
     *
     * @returns {boolean} Return true if sublist line is valid
     *
     * @since 2015.2
     */
    function validateDelete(scriptContext) {

    }

    /**
     * Validation function to be executed when record is saved.
     *
     * @param {Object} scriptContext
     * @param {Record} scriptContext.currentRecord - Current form record
     * @returns {boolean} Return true if record is valid
     *
     * @since 2015.2
     */
    function saveRecord(scriptContext) {
        try {
            var oldId = scriptContext.currentRecord.getValue("externalid");
            var customExternalid = scriptContext.currentRecord.getValue("custbody_external_id");
            if (oldId != customExternalid){
                var poNum = customExternalid ? externalidCheck(customExternalid, scriptContext.currentRecord.type, scriptContext.currentRecord.id) : "";
                if (poNum){
                    dialog.alert({title: "Externalid Check", message: "The externalid " + customExternalid + " has been used for "+ poNum});
                    return false;
                }
            }
        } catch (e) {
            log.error("Exception on saveRecord", e);
        }

        return true;
    }

    return {
        pageInit: pageInit,
        // fieldChanged: fieldChanged,
        // postSourcing: postSourcing,
        // sublistChanged: sublistChanged,
        // lineInit: lineInit,
        // validateField: validateField,
        // validateLine: validateLine,
        // validateInsert: validateInsert,
        // validateDelete: validateDelete,
        saveRecord: saveRecord
    };
    
});
