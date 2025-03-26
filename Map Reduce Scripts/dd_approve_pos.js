/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/record'],

function(s, record) {
   
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
    	return s.load({
            id: 'customsearch5759'
            });
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */
    function map(context) {
    	var result = JSON.parse(context.value);
    	//log.debug({title: "result", details: result});
		var recId = result.id;
		log.debug({title: "recId", details: recId});		
		var recType = result.recordType;
     	//var lineId = result.values.line;
		//log.debug({title: "recType", details: recType});
		try{
			var rec = record.load({
				type: recType,
			    id: recId,
			    isDynamic: true,
			});
			//log.debug({title: "rec", details: rec});
			rec.setValue({fieldId:'approvalstatus',value:2});
            rec.save();
		}
		catch(err){
			log.debug({title: "Load Record", details: err});
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