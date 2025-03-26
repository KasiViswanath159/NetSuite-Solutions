/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */
define(['N/search', 'N/record', 'N/runtime', 'N/log'],
    function(search, record, runtime, log) {    
        
        function getInputData() {
            var scriptObj = runtime.getCurrentScript();
            var recordType = scriptObj.getParameter({ name: 'custscript_delete_record_type' });
            var fieldValue = scriptObj.getParameter({ name: 'custscript_cleanup_file_id' });
            if (!recordType) {
                throw "Missing required script parameter: custscript_delete_record_type";
            }
          /*  if (!fieldValue) {
                throw "Missing required script parameter: custscript_delete_field_value";
            }*/
        
            // Create a search for the specified record type, filtering on the field "custrecord_csv_file_id"
            /*var deleteSearch = search.create({
                type: recordType,
                filters: [
                    ["custrecord_csv_file_id", "is", fieldValue]
                ],
                columns: ["internalid"]
            });*/
          var deleteSearch = search.create({
                type: recordType,
                columns: ["internalid"]
            });
        
            var pagedData = deleteSearch.runPaged({ pageSize: 1000 });
            var allIds = [];
            var totalCount = pagedData.count;
        
            log.audit("getInputData", "Record Type: " + recordType + "; Total records to delete: " + totalCount + " for field value: " + fieldValue);
        
            pagedData.pageRanges.forEach(function(pageRange) {
                var page = pagedData.fetch({ index: pageRange.index });
                page.data.forEach(function(result) {
                    allIds.push(result.id);
                });
            });
        
            log.audit("getInputData", "Accumulated " + allIds.length + " record IDs in total for " + recordType);
            return allIds;
        }
        
        /**
         * map:
         *  - Each context.value is a record ID from the getInputData array.
         *  - Loads the record type from the parameter and deletes the record by ID.
         */
        function map(context) {
            var scriptObj = runtime.getCurrentScript();
            var recordType = scriptObj.getParameter({ name: 'custscript_delete_record_type' });
            if (!recordType) {
                log.error("map", "Record type parameter missing in map stage");
                return;
            }
        
            var recId = context.value;
            if (!recId) return;
        
            try {
                record.delete({
                    type: recordType,
                    id: recId
                });
                log.debug("map", "Deleted record ID: " + recId + " from type: " + recordType);
            } catch (e) {
                log.error("Error deleting record ID: " + recId, e);
            }
        }
        
        /**
         * reduce:
         *  - Not used because each record is handled in map.
         */
        function reduce(context) {
            // Not needed
        }
        
        /**
         * summarize:
         *  - Logs any errors from the map stage and indicates completion.
         */
        function summarize(summary) {
            summary.mapSummary.errors.iterator().each(function(key, error) {
                log.error("Map Error for key: " + key, error);
                return true;
            });
            log.audit("summarize", "Deletion script complete. All possible records have been processed.");
        }
        
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
    });
    