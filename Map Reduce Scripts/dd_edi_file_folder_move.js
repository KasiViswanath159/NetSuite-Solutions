/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 * @Author Dheeraj Vaniyamparambath
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
        
        return search.load({id:'customsearch_dd_edi_file_move'});
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
       // var configInfo = ddhelper.getDoorDashConfigInfo();
       // var processFolder = configureInfo.cabinetId
       var processFolder = 558519;
        log.debug('MAP STAGE', 'MAPPING VALUES');
        log.debug('map: contextkey', context.key);
        var result = JSON.parse(context.value);
        var recType = result.recordType;
        var recId = result.id;
        var fileId = result.values["custrecord_dd_file.CUSTRECORD_DD_EDI_FILE_INFO_PARENT"].value;
        log.debug('map: fileId', fileId);
        try{
            var fileObj = file.load({
                id: fileId
                });
                fileObj.folder = processFolder;
                var savedFileId = fileObj.save();
        }
     catch(e)
     {
        log.debug({title:"error",details:e.message});
     }

        if(savedFileId)
        {
            var hisrecObj = record.load({type:recType,id:recId,isDynamic:true});
            hisrecObj.setValue({fieldId:'custrecord_dd_edi_reprocess',value:false});
            hisrecObj.save();

        }

    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {
        
    }


    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {
        
        
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
    
});