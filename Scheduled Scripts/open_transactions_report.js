/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/file', 'N/log', 'N/runtime', 'N/task', 'N/record', 'N/format'],
    function(search, file, log, runtime, task, record, format) {
    
        function execute(context) {
            try {
                const scriptObj = runtime.getCurrentScript();
        
                // Main processing parameters
                const fileId = scriptObj.getParameter({ name: 'custscript_dd_hrc_file_id' });
                const folderId = scriptObj.getParameter({ name: 'custscript_folder_id' });
                let currentTxnTypeIndex = parseInt(scriptObj.getParameter({ name: 'custscript_current_txn_type_index' })) || 0;
                let currentPageIndex = parseInt(scriptObj.getParameter({ name: 'custscript_current_page_index' })) || 0;
                let currentRecordIndex = parseInt(scriptObj.getParameter({ name: 'custscript_current_record_index_in_page' })) || 0;
        
                // Cleanup parameters
                let cleanupPageIndex = parseInt(scriptObj.getParameter({ name: 'custscript_cleanup_page_index' })) || 0;
                let cleanupRecordIndex = parseInt(scriptObj.getParameter({ name: 'custscript_cleanup_record_index' })) || 0;
                let inCleanupMode = scriptObj.getParameter({ name: 'custscript_in_cleanup_mode' }) || 'F';
        
                log.debug('Script Parameters', {
                    fileId,
                    folderId,
                    currentTxnTypeIndex,
                    currentPageIndex,
                    currentRecordIndex,
                    cleanupPageIndex,
                    cleanupRecordIndex,
                    inCleanupMode
                });
        
                if (!fileId || !folderId) {
                    log.error('Missing Parameters', 'Ensure file ID and folder ID are set.');
                    return;
                }
        
                // If in cleanup mode, run cleanup and exit
                if (inCleanupMode === 'T') {
                    let finishedCleanup = cleanupTemporaryData(cleanupPageIndex, cleanupRecordIndex);
                    if (!finishedCleanup) {
                        // Rescheduled mid-cleanup
                        return;
                    }
                    log.audit('Cleanup Complete', 'All temporary records have been deleted.');
                    return;
                }
        
                // Otherwise, perform main processing.
                let customerIds = getCustomerIdsFromFile(fileId);
                log.audit('Customer ID Count', `Total customers found: ${customerIds.length}`);
                if (!customerIds.length) {
                    log.error('No Customer IDs', 'File did not contain valid IDs.');
                    return;
                }
        
                // Define the transaction types to process
                const TRANSACTION_TYPES = [
                    { type: search.Type.INVOICE, label: 'Invoice' },
                    { type: search.Type.CREDIT_MEMO, label: 'Credit Memo' },
                    { type: search.Type.CUSTOMER_PAYMENT, label: 'Payment' }
                ];
        
                // Process all transaction types in sequence
                let finishedAllTypes = processAllTransactionTypes(
                    TRANSACTION_TYPES,
                    customerIds,
                    currentTxnTypeIndex,
                    currentPageIndex,
                    currentRecordIndex
                );
                if (!finishedAllTypes) {
                    // Rescheduled mid-processing
                    return;
                }
        
                logAllTransactionCounts();
                let fileUrl = saveResultsToCSV(folderId);
                log.audit('CSV File Created', `File saved at: ${fileUrl}`);
        
                // Start cleanup in a fresh run (to get a full usage allotment)
                startCleanup();
        
            } catch (error) {
                log.error('Error in Scheduled Script', error);
            }
        }
        
        // ----------------------
        // MAIN PROCESSING LOGIC
        // ----------------------
        
        function getCustomerIdsFromFile(fileId) {
            let ids = [];
            try {
                let fileObj = file.load({ id: fileId });
                let contents = fileObj.getContents();
                let lines = contents.split('\n');
                if (lines.length) {
                    lines.shift(); // Remove header row
                }
                ids = lines.map(line => line.split(',')[0].trim())
                           .filter(id => id && !isNaN(id));
            } catch (err) {
                log.error('Error Loading File', err);
            }
            return ids;
        }
        
        function processAllTransactionTypes(TRANSACTION_TYPES, customerIds, currentTxnTypeIndex, currentPageIndex, currentRecordIndex) {
            for (let i = currentTxnTypeIndex; i < TRANSACTION_TYPES.length; i++) {
                let txn = TRANSACTION_TYPES[i];
                log.audit('Processing Transaction Type', `${txn.label} (Index: ${i})`);
        
                let finishedThisType = processOneTransactionType(customerIds, txn, i, currentPageIndex, currentRecordIndex);
                if (!finishedThisType) {
                    // Rescheduled mid-type; state is passed via script parameters
                    return false;
                }
        
                // Reset page and record indexes for the next transaction type
                currentPageIndex = 0;
                currentRecordIndex = 0;
            }
            return true;
        }
        
        function processOneTransactionType(customerIds, txnInfo, txnTypeIndex, startPageIndex, startRecordIndex) {
            const PAGE_SIZE = 100;
            const USAGE_THRESHOLD = 100;
        
            let scriptObj = runtime.getCurrentScript();
            let searchObj = search.create({
                type: txnInfo.type,
                filters: [
                    ['mainline', 'is', 'T'],
                    'AND',
                    ['amountremaining', 'greaterthan', '0'],
                    'AND',
                    ['entity', 'anyof', customerIds]
                ],
                columns: [
                    'entity',
                    search.createColumn({ name: 'entity', label: 'Customer Name' }),
                    'internalid',
                    'amountremaining'
                ]
            });
        
            let pagedData = searchObj.runPaged({ pageSize: PAGE_SIZE });
            log.audit(`${txnInfo.label} Records`, `Total found: ${pagedData.count}, Pages: ${pagedData.pageRanges.length}`);
        
            for (let p = startPageIndex; p < pagedData.pageRanges.length; p++) {
                let page = pagedData.fetch({ index: p });
                log.debug(`${txnInfo.label} - Processing Page`, `${p + 1} (Records: ${page.data.length})`);
        
                for (let r = startRecordIndex; r < page.data.length; r++) {
                    let usage = scriptObj.getRemainingUsage();
                    if (usage < USAGE_THRESHOLD) {
                        log.audit('Rescheduling', `TxnTypeIndex=${txnTypeIndex}, page=${p}, record=${r}`);
                        rescheduleScript({
                            txnTypeIndex: txnTypeIndex,
                            pageIndex: p,
                            recordIndex: r
                        });
                        return false;
                    }
        
                    let result = page.data[r];
                    let customerId = result.getValue('entity');
                    let customerName = result.getText('entity');
                    let transactionId = result.getValue('internalid');
                    let amountRemaining = parseFloat(result.getValue('amountremaining')) || 0;
        
                    saveToTemporaryRecord(customerId, customerName, txnInfo.label, transactionId, amountRemaining);
                }
        
                // Finished the page, reset record index for the next page
                startRecordIndex = 0;
            }
        
            return true;
        }
        
        function rescheduleScript(params) {
            let scriptObj = runtime.getCurrentScript();
            let taskObj = task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: scriptObj.id,
                deploymentId: scriptObj.deploymentId,
                params: {
                    custscript_current_txn_type_index: params.txnTypeIndex,
                    custscript_current_page_index: params.pageIndex,
                    custscript_current_record_index_in_page: params.recordIndex
                }
            });
            taskObj.submit();
            log.audit('Script Rescheduled', `txnTypeIndex=${params.txnTypeIndex}, page=${params.pageIndex}, record=${params.recordIndex}`);
        }
        
        function saveToTemporaryRecord(customerId, customerName, transactionType, transactionId, amount) {
            let dupSearch = search.create({
                type: 'customrecord_open_txn_temp',
                filters: [
                    ['custrecord_transaction_id', 'is', transactionId],
                    'AND',
                    ['custrecord_transaction_type', 'is', transactionType]
                ],
                columns: ['internalid']
            });
        
            let hasDuplicate = false;
            dupSearch.run().each(result => {
                hasDuplicate = true;
                return false;
            });
        
            if (!hasDuplicate) {
                let rec = record.create({ type: 'customrecord_open_txn_temp' });
                rec.setValue({ fieldId: 'custrecord_customer_id', value: customerId });
                rec.setValue({ fieldId: 'custrecord_customer_name', value: customerName });
                rec.setValue({ fieldId: 'custrecord_transaction_type', value: transactionType });
                rec.setValue({ fieldId: 'custrecord_transaction_id', value: transactionId });
                rec.setValue({ fieldId: 'custrecord_amount_remaining', value: amount });
                rec.save();
            }
        }
        
        // --------------------
        // CSV GENERATION LOGIC
        // --------------------
        
        function saveResultsToCSV(folderId) {
            let searchObj = search.create({
                type: 'customrecord_open_txn_temp',
                columns: [
                    'custrecord_customer_id',
                    'custrecord_customer_name',
                    'custrecord_transaction_type',
                    'custrecord_transaction_id',
                    'custrecord_amount_remaining'
                ]
            });
        
            let pagedData = searchObj.runPaged({ pageSize: 1000 });
            let csvContent = 'Customer Internal ID,Customer Name,Transaction Type,Transaction ID,Amount Remaining\n';
            let recordCount = 0;
        
            pagedData.pageRanges.forEach(pageRange => {
                let page = pagedData.fetch({ index: pageRange.index });
                page.data.forEach(result => {
                    let custName = result.getValue('custrecord_customer_name') || '';
                    custName = `"${custName.replace(/"/g, '""')}"`;
                    csvContent += [
                        result.getValue('custrecord_customer_id'),
                        custName,
                        result.getValue('custrecord_transaction_type'),
                        result.getValue('custrecord_transaction_id'),
                        result.getValue('custrecord_amount_remaining')
                    ].join(',') + '\n';
                    recordCount++;
                });
            });
        
            log.audit('CSV Generation', `Total records in CSV: ${recordCount}`);
        
            let fileObj = file.create({
                name: `Open_Transactions_Report_${format.format({ value: new Date(), type: format.Type.DATETIME })}.csv`,
                fileType: file.Type.CSV,
                contents: csvContent,
                folder: folderId
            });
            let fileId = fileObj.save();
            log.audit('CSV File Saved', `File ID: ${fileId}`);
            return fileObj.url;
        }
        
        // -----------------
        // CLEANUP LOGIC
        // -----------------
        
        function startCleanup() {
            let scriptObj = runtime.getCurrentScript();
            let taskObj = task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: scriptObj.id,
                deploymentId: scriptObj.deploymentId,
                params: {
                    custscript_in_cleanup_mode: 'T',
                    custscript_cleanup_page_index: 0,
                    custscript_cleanup_record_index: 0
                }
            });
            taskObj.submit();
            log.audit('Starting Cleanup', 'Script rescheduled in cleanup mode.');
        }
        
        /**
         * Deletes temporary records in a paged manner.
         * Accepts startPageIndex and startRecordIndex to resume precisely.
         * Returns true if finished, false if rescheduled.
         */
        function cleanupTemporaryData(startPageIndex, startRecordIndex) {
            log.audit('Cleanup Process', `Deleting temporary records (start page: ${startPageIndex}, start record: ${startRecordIndex})`);
        
            const USAGE_THRESHOLD = 100;
            let scriptObj = runtime.getCurrentScript();
        
            let tempSearch = search.create({
                type: 'customrecord_open_txn_temp',
                columns: ['internalid']
            });
        
            let pagedData = tempSearch.runPaged({ pageSize: 1000 });
            log.debug('Cleanup - Total Records', `Found ${pagedData.count} records.`);
        
            // Loop over pages starting at startPageIndex
            for (let p = startPageIndex; p < pagedData.pageRanges.length; p++) {
                let page = pagedData.fetch({ index: p });
                log.debug('Cleanup - Page', `Page index: ${p}, Records: ${page.data.length}`);
        
                // Loop through records on the page starting at startRecordIndex
                for (let i = startRecordIndex; i < page.data.length; i++) {
                    let usage = scriptObj.getRemainingUsage();
                    if (usage < USAGE_THRESHOLD) {
                        log.audit('Rescheduling Cleanup', `Rescheduling at page ${p}, record ${i}`);
                        rescheduleCleanup(p, i);
                        return false;
                    }
        
                    let recId = page.data[i].getValue('internalid');
                    if (recId) {
                        log.debug('Deleting Record', `Record ID: ${recId}`);
                        try {
                            record.delete({
                                type: 'customrecord_open_txn_temp',
                                id: recId
                            });
                        } catch (err) {
                            log.error('Error Deleting Record', `ID: ${recId}, Error: ${err.message}`);
                        }
                    }
                }
                // After finishing a page, reset record index to 0 for next page
                startRecordIndex = 0;
            }
        
            log.audit('Cleanup Complete', `All temporary records deleted.`);
            return true;
        }
        
        function rescheduleCleanup(pageIndex, recordIndex) {
            let scriptObj = runtime.getCurrentScript();
            let taskObj = task.create({
                taskType: task.TaskType.SCHEDULED_SCRIPT,
                scriptId: scriptObj.id,
                deploymentId: scriptObj.deploymentId,
                params: {
                    custscript_in_cleanup_mode: 'T',
                    custscript_cleanup_page_index: pageIndex,
                    custscript_cleanup_record_index: recordIndex
                }
            });
            taskObj.submit();
            log.audit('Cleanup Rescheduled', `Will resume from pageIndex=${pageIndex}, recordIndex=${recordIndex}`);
        }
        
        // ---------------------
        // LOGGING & COUNTING
        // ---------------------
        
        function logAllTransactionCounts() {
            let types = ['Invoice', 'Credit Memo', 'Payment'];
            let total = 0;
            types.forEach(type => {
                let cnt = getTransactionTypeCount(type);
                log.audit(`Unique ${type} Record Count`, `Total: ${cnt}`);
                total += Number(cnt);
            });
            log.audit('Aggregate Unique Record Count', `Total across all types: ${total}`);
        }
        
        function getTransactionTypeCount(transactionType) {
            let count = 0;
            let countSearch = search.create({
                type: 'customrecord_open_txn_temp',
                filters: [
                    ['custrecord_transaction_type', 'is', transactionType]
                ],
                columns: [
                    search.createColumn({ name: 'internalid', summary: 'COUNT' })
                ]
            });
            let result = countSearch.run().getRange({ start: 0, end: 1 });
            if (result && result[0]) {
                count = result[0].getValue({ name: 'internalid', summary: 'COUNT' });
            }
            return count;
        }
        
        return {
            execute: execute
        };
    });
    