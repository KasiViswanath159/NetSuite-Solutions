/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define([
    'N/file',
    'N/record',
    'N/runtime',
    'N/search',
    'N/log',
    'N/task',
    '../../lib/lodash.min'
], function(file, record, runtime, search, log, task, _) {

    var TEMP_RECORD_TYPE   = 'customrecord_open_txn_temp';
    var FIELD_CM_ID        = 'custrecord_temp_cm_id';
    var FIELD_CM_DOC       = 'custrecord_temp_cm_doc_number';
    var FIELD_CM_STATUS    = 'custrecord_temp_cm_status';
    var FIELD_CM_REMAINING = 'custrecord_temp_cm_remaining';
    var FIELD_CM_LASTMOD   = 'custrecord_temp_cm_lastmod'; // New field for last modified date
    var FIELD_CSV_FILE_ID  = 'custrecord_csv_file_id';    
    var FIELD_ACCOUNT = 'custrecord_temp_payment_account';
    var FIELD_CUSTOMER = 'custrecord_temp_payment_customer';

    function getInputData() {
        var scriptObj = runtime.getCurrentScript();
        var csvFileId = scriptObj.getParameter({ name: 'custscript_creditmemo_csv_file_id' });
        var folderid = scriptObj.getParameter({ name: 'custscript_creditmemo_csv_folder_id' });
        log.audit("getInputData", "csvFileId: " + csvFileId);
        log.audit("getInputData", "folderid: " + folderid);
        if (!csvFileId) {
            throw "Missing CSV File ID parameter";
        }
        var csvFile   = file.load({ id: csvFileId });
        var contents  = csvFile.getContents();
        var lines     = contents.split(/\r?\n/);
        if (lines.length > 0) {
            lines.shift(); // remove header row
        }
        log.audit("getInputData", "Total lines (excluding header): " + lines.length);
        return lines;
    }

    function map(context) {
        var docNumber = (context.value || '').trim();
        if (!docNumber) {
            log.debug("map", "Skipping empty line");
            return;
        }
        try {
            var cmSearch = search.create({
                type: record.Type.CREDIT_MEMO,
                filters: [
                    ["tranid", "is", docNumber]
                ],
                columns: [
                    search.createColumn({ name: 'internalid' }),
                    search.createColumn({ name: 'tranid' }),
                    search.createColumn({ name: 'status' }),
                    search.createColumn({ name: 'amountremaining' }),
                    search.createColumn({ name: 'account' }),
                    search.createColumn({ name: 'lastmodifieddate' }),
                    search.createColumn({ name: 'entity' })
                ]
            });
            var searchResult = cmSearch.run().getRange({ start: 0, end: 1 });
            if (!searchResult || searchResult.length === 0) {
                log.error("map", "No Credit Memo found for document number: " + docNumber);
                return;
            }

            var internalId = searchResult[0].getValue({ name: 'internalid' });
            var tranid     = searchResult[0].getValue({ name: 'tranid' });
            var status     = searchResult[0].getValue({ name: 'status' });
            var remaining  = searchResult[0].getValue({ name: 'amountremaining' });
            var account  = searchResult[0].getText({ name: 'account' });
            var lastModifiedDate = searchResult[0].getValue({ name: 'lastmodifieddate' });         
            var customer = searchResult[0].getText({ name: 'entity' });
                    
            log.audit("getInputData", "internalId: " + internalId);
            var systemNotesSearch = search.create({
                type: 'systemnote',
               filters: [
        ['recordid', 'is', internalId],
        'AND',
        ['recordtype', 'is', 'Credit Memo'],
                 'AND',
        ['field', 'anyof', 'Document Status']
    ],
                columns: [
                    search.createColumn({
                        name: 'date',
                        sort: search.Sort.DESC
                    })
                ]
            });

                
            var sysNoteResults = systemNotesSearch.run().getRange({ start: 0, end: 1 });
            var lastModifiedDate = sysNoteResults.length > 0 
                ? sysNoteResults[0].getValue({ name: 'date', summary: search.Summary.MAX }) 
                : "N/A";
            //var lastModifiedDate = searchResult[0].getValue({ name: 'lastmodifieddate' }); // Get last modified date
           // log.audit("map", "SystemNotesDate: " + lastModifiedDate);
            var resultObj = {
                cmId: internalId,
                docNumber: tranid,
                status: status,
                remaining: remaining,
                lastModifiedDate: lastModifiedDate,
                account: account,
                customer: customer
            };

            context.write({
                key: internalId,
                value: JSON.stringify(resultObj)
            });

        } catch (e) {
            log.error("Error loading Credit Memo for docNumber " + docNumber, e);
        }
    }

    function reduce(context) {
        var cmId = context.key;
        var combined = [];
        _.forEach(context.values, function(val) {
            combined.push(JSON.parse(val));
        });
        var result = combined[0];

        var csvFileId = runtime.getCurrentScript().getParameter({ name: 'custscript_creditmemo_csv_file_id' });

        if (tempRecordExists(cmId, csvFileId)) {
            log.audit("reduce", "Record already exists for CM " + cmId + " and CSV " + csvFileId + ", skipping.");
            return;
        }

        try {
            var tempRec = record.create({ type: TEMP_RECORD_TYPE });
            tempRec.setValue({ fieldId: FIELD_CM_ID,        value: result.cmId });
            tempRec.setValue({ fieldId: FIELD_CM_DOC,       value: result.docNumber });
            tempRec.setValue({ fieldId: FIELD_CM_STATUS,    value: result.status });
            tempRec.setValue({ fieldId: FIELD_CM_REMAINING, value: result.remaining });
            tempRec.setValue({ fieldId: FIELD_CSV_FILE_ID,  value: csvFileId });
            tempRec.setValue({ fieldId: FIELD_CM_LASTMOD,   value: result.lastModifiedDate });
            tempRec.setValue({ fieldId: FIELD_ACCOUNT,   value: result.account });
            tempRec.setValue({ fieldId: FIELD_CUSTOMER, value: result.customer });

            var recId = tempRec.save();
            log.debug("reduce", "Inserted record for CM " + cmId + " (CSV " + csvFileId + "), recId=" + recId);
        } catch (e) {
            log.error("Error storing record for CM " + cmId, e);
        }
    }

    function tempRecordExists(cmId, csvFileId) {
        var found = false;
        var s = search.create({
            type: TEMP_RECORD_TYPE,
            filters: [
                [FIELD_CM_ID, 'is', cmId],
                "AND",
                [FIELD_CSV_FILE_ID, 'is', csvFileId]
            ],
            columns: [FIELD_CM_ID]
        });
        s.run().each(function() {
            found = true;
            return false;
        });
        return found;
    }

    function summarize(summaryContext) {
        summaryContext.mapSummary.errors.iterator().each(function(key, msg) {
            log.error("Map Error", "Key: " + key + " - " + msg);
            return true;
        });
        summaryContext.reduceSummary.errors.iterator().each(function(key, msg) {
            log.error("Reduce Error", "Key: " + key + " - " + msg);
            return true;
        });
        log.audit("summarize", "Done!");

        var csvFileId = runtime.getCurrentScript().getParameter({ name: 'custscript_creditmemo_csv_file_id' });
		 var csvContent = "Credit Memo ID,Document Number,Status,Remaining Amount,Open/Closed,Last Modified Date,Account,Customer\n";

        var tempSearch = search.create({
            type: TEMP_RECORD_TYPE,
            filters: [[FIELD_CSV_FILE_ID, 'is', csvFileId]],
            columns: [
                FIELD_CM_ID,
                FIELD_CM_DOC,
                FIELD_CM_STATUS,
                FIELD_CM_REMAINING,
                FIELD_CM_LASTMOD,
                FIELD_ACCOUNT,
                FIELD_CUSTOMER
            ]
        });
      var pagedData = tempSearch.runPaged({ pageSize: 1000 });
       pagedData.pageRanges.forEach(function(pageRange) {
            var page = pagedData.fetch({ index: pageRange.index });
            page.data.forEach(function(result) {
                var cmId        = result.getValue({ name: FIELD_CM_ID });
                var docNum      = result.getValue({ name: FIELD_CM_DOC });
                var cmStatus    = result.getValue({ name: FIELD_CM_STATUS });
                var cmRemaining = result.getValue({ name: FIELD_CM_REMAINING });                
                var openClosed = parseFloat(cmRemaining) > 0 ? "Open" : "Closed";
				var cmlastModified = result.getValue({ name: FIELD_CM_LASTMOD });                
                var pAccount = result.getValue({ name: FIELD_ACCOUNT });
                var pCustomer = result.getValue({ name: FIELD_CUSTOMER });
                
                csvContent += cmId + "," + '"' + docNum + '"' + "," + cmStatus + "," + cmRemaining + "," + openClosed + ","+ cmlastModified + ","+ pAccount + ","+pCustomer + "\n";                
             
            });
        });


        var scriptObj = runtime.getCurrentScript();
        var folderId  = scriptObj.getParameter({ name: 'custscript_creditmemo_csv_folder_id' });
        if (!folderId) {
            throw "Missing Folder ID parameter";
        }

        var fileName   = "CreditMemoValidationResults_" + csvFileId + ".csv";
        var outputFile = file.create({
            name: fileName,
            fileType: file.Type.CSV,
            contents: csvContent,
            folder: folderId
        });
        var outputFileId = outputFile.save();
        log.audit("summarize", "Final CSV File saved with File ID: " + outputFileId);

        triggerCleanup(csvFileId);
    }

    function triggerCleanup(fileIdToDelete) {
        var scriptTask = task.create({
            taskType: task.TaskType.MAP_REDUCE, 
            scriptId: "customscript3410",
            deploymentId: "customdeploy1",
            params: {
                custscript_cleanup_file_id: fileIdToDelete
            }
        });
        var taskId = scriptTask.submit();
        log.audit("triggerCleanup", "Submitted cleanup script with Task ID: " + taskId + " for File ID: " + fileIdToDelete);
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
});
