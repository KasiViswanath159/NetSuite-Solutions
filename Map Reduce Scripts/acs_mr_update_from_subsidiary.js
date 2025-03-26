/**
 * Copyright (c) 1998-2020 NetSuite, Inc.
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
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope Public
 * @ScriptName ACS | MR | Update Due To/From Subsidiary
 *
 * Version    Date          Author              Remarks
 * 1.00       30/07/2021    Ignacio Navarro     Initial Commit, case #4274978
 * 1.10       24/08/2021    Ignacio Navarro     Made corrections to the approach used to get the results from the search
 */

 define(['N/search','N/record','N/runtime','N/task'], function(search, record, runtime, task) {

    function getInputData(inputContext) {
        var logTitle = 'getInputData';
        try {
            
            log.debug(logTitle, '* * start ' + logTitle + ' * *');

            var intSearchId = runtime.getCurrentScript().getParameter('custscript_acs_ss_journals_to_update');
            var objSearchResults = allSearchValues(intSearchId);

            log.debug(logTitle, '* * end ' + logTitle + ' * *');
            return objSearchResults;
        } catch (error) {
            log.error(logTitle, error.message);
        }
    }

    function reduce(reduceContext) {
        var logTitle = 'reduce';
        try {
            log.debug(logTitle, '* * start ' + logTitle + ' * *');

            var strRecordId = JSON.parse(reduceContext.values[0]).id;
            var strRecordType = JSON.parse(reduceContext.values[0]).recordType;

            log.debug(logTitle, 'strRecordId = ' + JSON.stringify(strRecordId));
            log.debug(logTitle, 'strRecordType = ' + JSON.stringify(strRecordType));


            var recCurrentRecord = record.load({
                type: strRecordType,
                id: strRecordId,
            });

            var itemSublist = 'line';
            var lineCount = recCurrentRecord.getLineCount({
                sublistId: itemSublist
            });
            for(var i = 0; i < lineCount; i++) {
                var intSubsidiaryId = recCurrentRecord.getSublistValue({
                    sublistId: itemSublist,
                    fieldId: 'duetofromsubsidiary',
                    line: i
                });
                if(!isEmpty(intSubsidiaryId)) {
                    log.debug(logTitle, 'intSubsidiaryId = ' + intSubsidiaryId);
                    recCurrentRecord.setSublistValue({
                        sublistId: itemSublist,
                        fieldId: 'custcol_acs_due_to_from_subsidiary',
                        line: i,
                        value: intSubsidiaryId
                    });

                
                    recCurrentRecord.setSublistValue({
                        sublistId: itemSublist,
                        fieldId: 'custcol_acs_is_processed_by_script',
                        line: i,
                        value: true
                    });
                }
            }

            recCurrentRecord.setValue({
                fieldId: 'custbody_acs_is_processed_by_script',
                value: true
            });

            recCurrentRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            log.debug(logTitle, '* * end ' + logTitle + ' * *');
        } catch (error) {
            log.error(logTitle, error.message);
        }
    }

    function summarize(summarizeContext) {
        var logTitle = 'summarize';
        try {
            log.debug(logTitle, '* * start ' + logTitle + ' * *');
            objSearchResults = returnParameterSearchResults('custscript_acs_ss_journals_to_update');
            if(objSearchResults > 0) {
                var objTask = task.create({taskType: task.TaskType.MAP_REDUCE});
                objTask.scriptId = 'customscript_acs_mr_update_from_subs';
                objTask.submit();
            }
            log.debug(logTitle, '* * end ' + logTitle + ' * *');
        } catch (error) {
            log.error(logTitle, error.message);
        }
    }

    function returnParameterSearchResults(strParameterId) {
        var strSearchId = runtime.getCurrentScript().getParameter(strParameterId);
        var objJournalRecordSearch = allSearchValues(strSearchId);

        return objJournalRecordSearch;
    }

    /**
     * Takes the internal id of a search and runs it, splitting it in batches of 1000
     * to avoid the 4000 search result return maximum
     * @param {int} intSearchId 
     * @returns JSON[]
     */
    function allSearchValues(intSearchId) {
        var logTitle = 'allSearchValues';
        try {
            var objSavedSearch = search.load({
                id: intSearchId
            });

            var arrAllSearchREsults = [];
            var intSearchResultCount = objSavedSearch.runPaged({pageSize: 1000}).count;
            log.debug(logTitle, 'searchResultCount : ' + intSearchResultCount);

            for (var rangeIndex = 0; rangeIndex <= (intSearchResultCount / 1000); rangeIndex++) {
                var arrSearchResultsSlice = objSavedSearch.run().getRange({
                    start: rangeIndex * 1000,
                    end: ((rangeIndex + 1) * 1000)
                });
                var intLastInternalId = 0;
                
                for (var i = 0; i < arrSearchResultsSlice.length; i++) {
                    var strTranId = arrSearchResultsSlice[i].getValue('tranid');
                    if(intLastInternalId != strTranId) {
                        intLastInternalId = strTranId;
                        arrAllSearchREsults.push(arrSearchResultsSlice[i]);
                    }
                }
                log.debug(logTitle, arrAllSearchREsults);
            }
            return arrAllSearchREsults;
        } catch (error) {
            log.error(logTitle, error);
        }
    }

    /**
     * Returns true if given string is empty
     * @param {string} strValue 
     * @returns boolean
     */
    function isEmpty(strValue) {
        var logTitle = 'isEmpty';
        try {
            if (strValue == null || strValue == '' || (!strValue) || strValue == 'NaN' || strValue == 'undefined') {
                return true;
            }
            return false;
        } catch (error) {
            log.error(logTitle, error);
        }
    }
    return {
        getInputData: getInputData,
        reduce: reduce,
        summarize: summarize
    }
});