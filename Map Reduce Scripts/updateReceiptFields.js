/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/runtime', 'N/file', 'N/record', 'N/search', 'N/task', 'N/format', 'N/email'],

function(runtime, file, record, search, task, format, email) {
   
    /**
     * Marks the beginning of the Map/Reduce process and generates input data.
     *
     * @typedef {Object} ObjectRef
     * @property {number} id - Internal ID of the record instance
     * @property {string} type - Record type id
     *
     * @return {Array|Object|Search|RecordRef} inputSummary
     * @since 2015.1
     */
    function getInputData() {
        log.debug('GET INPUT STAGE', 'GET INPUT VALUES');
        
        var fileObj = file.load({
            id: 14331524
        });
        
        var csvContent = fileObj.getContents();
        log.debug('csvContent', csvContent);
        
        var arrCSVLines = csvContent.split('\r\n');

        log.debug('arrCSVLines', arrCSVLines);
        
        var arrLines = [];

        for(var i = 1; i < arrCSVLines.length; i++){
            
            var arrRow = [];
            
            if (arrCSVLines[i] != "") {
                
                arrRow = arrCSVLines[i].split(',');
                
                var rowData = {
                    "externalId": arrRow[0],
                    "memp": arrRow[1],
                }
                
                arrLines.push(rowData);
            }

        }

        log.debug('arrLines', arrLines);
        return arrLines;
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
        log.debug('MAP STAGE', 'MAPPING VALUES');
        log.debug('map: contextkey', context.key);
        log.debug('map: contextvalues', context.value);
        var lineVal = JSON.parse(context.value);
       log.debug('map: lineVal', lineVal);

        if (lineVal.externalId != '') {
            var recType = 'itemreceipt';
          var memo = lineVal.memp;
           var internalId = getInternalID(lineVal.externalId,recType);
           var currentRecord = record.load({
                type: recType, // Replace with your actual transaction record type
                id: internalId,
                isDynamic: true
            });
            currentRecord.setValue({
                fieldId: 'memo', // Replace with the actual field ID for the memo field
                value: memo
            });
            currentRecord.save();
        }
    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {
        log.debug('REDUCE STAGE', 'REDUCING VALUES');

        
       
    }


    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {
        log.debug('SUMMARIZE STAGE', 'SUMMARIZING VALUES');
        
        var message = '';
        var userid = 8137349;
        var contents = '';
        var errorCount = 0;
        
        summary.mapSummary.errors.iterator().each(function(key, error, executionNo) {
            log.error({
                title: 'Map Error for key: ' + key + ' and execution number: ' + executionNo,
                details: error
            }) 
            contents += 'An error occured for ' + key + ': '+ error + '\n\n';
            errorCount++;
            return true;
        })
        
        summary.reduceSummary.errors.iterator().each(function (key, error, executionNo){
            log.error({
                   title: 'Reduce error for key: ' + key + ', execution no. ' + executionNo,
                   details: error
            }); 
            contents += 'An error occured for ' + key + ': '+ error + '\n\n';
            errorCount++;
            return true;
        });
        
        
        if (errorCount > 0) {
            message += contents;
            email.send({
                author: userid,
                recipients: userid,
                subject: 'Planned Revenue Update encountered an error.',
                body: message
            });
        } else {
            message = 'Planned revenues updated successfully.';
            email.send({
                author: userid,
                recipients: userid,
                subject: 'Planned Revenue Update Successful.',
                body: message
            });
        }
        
    }

    function getInternalID(externalId,recordType){
        var searchObj = search.create({
            type: recordType,
            filters: ['externalid', 'anyof', externalId],
            columns: ['internalid']
        });
    
        // Execute the search and retrieve the results
        var searchResults = searchObj.run().getRange({
            start: 0,
            end: 1
        });
    
        // Check if any results were found
        if (searchResults.length > 0) {
            var internalId = searchResults[0].getValue({
                name: 'internalid'
            });
    
            log.debug({
                title: 'Internal ID Found',
                details: 'Internal ID for external ID ' + externalId + ': ' + internalId
            });
           return internalId;
            // Do something with the internal ID
        } else {
            log.error({
                title: 'Internal ID Not Found',
                details: 'No record found with external ID: ' + externalId
            });
    
            // Handle the case when the external ID is not found
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        //reduce: reduce,
        summarize: summarize
    };
    
});
