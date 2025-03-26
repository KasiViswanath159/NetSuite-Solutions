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
    'N/format',
    'N/task',
    '../../lib/lodash.min'
], function(file, record, runtime, search, log, format, task, _) {

    // Custom record type & field IDs for storing Payment data.
    var TEMP_RECORD_TYPE = 'customrecord_open_txn_temp';
    var FIELD_PAYMENT_ID = 'custrecord_temp_payment_id';
    var FIELD_PAYMENT_STATUS = 'custrecord_temp_payment_status';
    var FIELD_PAYMENT_REMAINING = 'custrecord_temp_payment_remaining';
    // New additional fields:
    var FIELD_LAST_MODIFIED = 'custrecord_temp_payment_lastmodified';
    var FIELD_ACCOUNT = 'custrecord_temp_payment_account';
    var FIELD_CUSTOMER = 'custrecord_temp_payment_customer';
    // Field to tag the custom record with the CSV file's internal ID.
    var FIELD_CSV_FILE_ID = 'custrecord_csv_file_id';

    /**
     * getInputData:
     * - Loads the CSV file (using custscript_payment_csv_file_id).
     * - Splits into lines (handles LF/CRLF), removes the header row.
     * - Returns an array of lines (each a Payment ID).
     */
    function getInputData() {
        var scriptObj = runtime.getCurrentScript();
        var csvFileId = scriptObj.getParameter({ name: 'custscript_payment_csv_file_id' });
        if (!csvFileId) {
            throw "Missing CSV File ID parameter";
        }
        var csvFile = file.load({ id: csvFileId });
        var contents = csvFile.getContents();
        var lines = contents.split(/\r?\n/);
        if (lines.length > 0) {
            lines.shift();
        }
        log.audit("getInputData", "Total lines (excluding header): " + lines.length);
        return lines;
    }

    /**
     * map:
     * - Each context.value is a Payment ID.
     * - Loads the Payment record, retrieves deposit status, amount remaining, last modified date,
     *   account info and customer name.
     * - Writes a JSON result keyed by Payment ID.
     */
    function map(context) {
        var line = (context.value || '').trim();
        if (!line) {
            log.debug("map", "Skipping empty line");
            return;
        }
        try {
            var paymentRec = record.load({
                type: record.Type.CUSTOMER_PAYMENT,
                id: line
            });
            var status = paymentRec.getValue({ fieldId: 'status' });
            var remaining = paymentRec.getValue({ fieldId: 'amountremaining' });
            var lastModified = paymentRec.getValue({ fieldId: 'lastmodifieddate' });
            var account = paymentRec.getText({ fieldId: 'aracct' });
            var customer = paymentRec.getText({ fieldId: 'customer' });
            
            var resultObj = {
                paymentId: line,
                status: status,
                remaining: remaining,
                lastModified: lastModified,
                account: account,
                customer: customer
            };
            context.write({
                key: line,
                value: JSON.stringify(resultObj)
            });
        } catch (e) {
            log.error("Error loading Payment " + line, e);
        }
    }

    /**
     * reduce:
     * - Called once per Payment ID.
     * - Aggregates map outputs (usually one record).
     * - Checks for duplicates (based on Payment ID and CSV File ID) and,
     *   if none exist, inserts a custom record with Payment data (including new fields) and the CSV file ID.
     */
    function reduce(context) {
        var paymentId = context.key;
        var combined = [];
        _.forEach(context.values, function(val) {
            combined.push(JSON.parse(val));
        });
        var result = combined[0]; // Typically one record per Payment ID.

        // Get current CSV file ID.
        var csvFileId = runtime.getCurrentScript().getParameter({ name: 'custscript_payment_csv_file_id' });

        // Check if a record already exists for this Payment and CSV file.
        if (tempRecordExists(paymentId, csvFileId)) {
            log.audit("reduce", "Record already exists for Payment " + paymentId + " and CSV " + csvFileId + ", skipping.");
            return;
        }

        try {
            var tempRec = record.create({ type: TEMP_RECORD_TYPE });
            tempRec.setValue({ fieldId: FIELD_PAYMENT_ID, value: result.paymentId });
            tempRec.setValue({ fieldId: FIELD_PAYMENT_STATUS, value: result.status });
            tempRec.setValue({ fieldId: FIELD_PAYMENT_REMAINING, value: result.remaining });
            tempRec.setValue({ fieldId: FIELD_LAST_MODIFIED, value: result.lastModified });
            tempRec.setValue({ fieldId: FIELD_ACCOUNT, value: result.account });
            tempRec.setValue({ fieldId: FIELD_CUSTOMER, value: result.customer });
            tempRec.setValue({ fieldId: FIELD_CSV_FILE_ID, value: csvFileId });
            var recId = tempRec.save();
            //log.debug("reduce", "Inserted record for Payment " + paymentId + " (CSV " + csvFileId + "), recId=" + recId);
        } catch (e) {
            log.error("Error storing record for Payment " + paymentId, e);
        }
    }

    /**
     * Helper: Checks if a temp record exists for a given Payment ID and CSV file ID.
     */
    function tempRecordExists(paymentId, csvFileId) {
        var found = false;
        var s = search.create({
            type: TEMP_RECORD_TYPE,
            filters: [
                [FIELD_PAYMENT_ID, 'is', paymentId],
                "AND",
                [FIELD_CSV_FILE_ID, 'is', csvFileId]
            ],
            columns: [FIELD_PAYMENT_ID]
        });
        s.run().each(function() {
            found = true;
            return false;
        });
        return found;
    }

    /**
     * summarize:
     * - Searches for custom records with the current CSV file ID.
     * - Builds a final CSV with columns: Payment ID, Deposit Status, Remaining Amount, Open/Closed,
     *   Last Modified, Account, Customer.
     *   (Open if remaining > 0; Closed otherwise.)
     * - Saves the CSV to the folder specified by custscript_payment_csv_folder_id.
     * - Then triggers a cleanup script to delete the custom records.
     */
    function summarize(summaryContext) {
        // Log map/reduce errors.
        _.forOwn(summaryContext.mapSummary.errors, function(error, mapKey) {
            if (mapKey === 'iterator') return;
            log.error("Map Error for key: " + mapKey, error);
        });
        _.forOwn(summaryContext.reduceSummary.errors, function(error, reduceKey) {
            if (reduceKey === 'iterator') return;
            log.error("Reduce Error for key: " + reduceKey, error);
        });

        var csvContent = "Payment ID,Deposit Status,Remaining Amount,Open/Closed,Last Modified,Account,Customer\n";
        var openCount = 0;
        var closedCount = 0;

        var csvFileId = runtime.getCurrentScript().getParameter({ name: 'custscript_payment_csv_file_id' });
        var tempSearch = search.create({
            type: TEMP_RECORD_TYPE,
            filters: [[FIELD_CSV_FILE_ID, 'is', csvFileId]],
            columns: [
                FIELD_PAYMENT_ID,
                FIELD_PAYMENT_STATUS,
                FIELD_PAYMENT_REMAINING,
                FIELD_LAST_MODIFIED,
                FIELD_ACCOUNT,
                FIELD_CUSTOMER
            ]
        });

        var pagedData = tempSearch.runPaged({ pageSize: 1000 });
        log.debug("summarize", "Found " + pagedData.count + " temp records for CSV " + csvFileId);

        pagedData.pageRanges.forEach(function(pageRange) {
            var page = pagedData.fetch({ index: pageRange.index });
            page.data.forEach(function(result) {
                var pId = result.getValue({ name: FIELD_PAYMENT_ID });
                var pStatus = result.getValue({ name: FIELD_PAYMENT_STATUS });
                var pRemaining = result.getValue({ name: FIELD_PAYMENT_REMAINING });
                var pLastModified = result.getValue({ name: FIELD_LAST_MODIFIED });
                var pAccount = result.getValue({ name: FIELD_ACCOUNT });
                var pCustomer = result.getValue({ name: FIELD_CUSTOMER });
                var openClosed = parseFloat(pRemaining) > 0 ? "Open" : "Closed";
                csvContent += pId + "," + pStatus + "," + pRemaining + "," + openClosed + "," + pLastModified + "," + pAccount + "," + pCustomer + "\n";
                
            });
        });
      

        var scriptObj = runtime.getCurrentScript();
        var folderId = scriptObj.getParameter({ name: 'custscript_payment_csv_folder_id' });
        if (!folderId) {
            throw "Missing Folder ID parameter";
        }
        var fileName   = "PaymentValidationResults_" + csvFileId + ".csv";
        var outputFile = file.create({
            name: fileName,
            fileType: file.Type.CSV,
            contents: csvContent,
            folder: folderId
        });
        var outputFileId = outputFile.save();
        log.audit("summarize", "Final CSV File saved with File ID: " + outputFileId);

        // Trigger cleanup: Delete all temp records for this CSV file.
        triggerCleanup(csvFileId);
    }

    /**
     * triggerCleanup:
     * - Submits a cleanup map/reduce script to delete the temporary custom records.
     */
    function triggerCleanup(fileIdToDelete) {
        var scriptTask = task.create({
            taskType: task.TaskType.MAP_REDUCE,
            scriptId: "customscript3410",    // The internal ID of your cleanup script
            deploymentId: "customdeploy1",   // The deployment ID of your cleanup script
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
