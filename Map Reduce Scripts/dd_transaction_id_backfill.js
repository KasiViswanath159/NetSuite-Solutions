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
    	return search.load({
            id: 'customsearch_transaction_id_backfill'
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
    	log.debug({title: "result", details: result});
		var recId = result.id;
		log.debug({title: "recId", details: recId});		
		var recType = result.recordType;
     	
		try{
         
			var rec = record.load({
				type: recType,
			    id: recId,
			});
          var tranId = rec.getValue({fieldId: 'custrecord_dd_generated_vendor_bills'});
          rec.setValue({fieldId:'custrecord_dd_txn_internal_id',value:tranId.toString()});

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
        log.debug('SUMMARIZE STAGE', 'SUMMARIZING VALUES');
        
        var message = '';
        var userid = runtime.getCurrentUser().id;
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
                subject: 'Purchase Order Update encountered an error.',
                body: message
            });
        } else {
            message = 'Purchase Order updated successfully.';
            email.send({
                author: userid,
                recipients: userid,
                subject: 'Purchase Order Update Successful.',
                body: message
            });
        }
        
    }

    function getPoId(poNum)
    {
        var poID ;
        var purchaseorderSearchObj = search.create({
            type: "purchaseorder",
            filters:
            [
               ["type","anyof","PurchOrd"], 
               "AND", 
               ["mainline","is","T"], 
               "AND", 
               ["numbertext","is",poNum]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"})
            ]
         });
         var searchResultCount = purchaseorderSearchObj.runPaged().count;
         log.debug("purchaseorderSearchObj result count",searchResultCount);
         purchaseorderSearchObj.run().each(function(result){
            poID =result.getValue({name:'internalid'});
            return true;
         });
         if(poID){return poID}else{return false;}
    }

    function getitemId(item)
    {
        var itemId ;
        var itemSearchObj = search.create({
            type: "item",
            filters:
            [
               ["nameinternal","is",item]
            ],
            columns:
            [
               search.createColumn({name: "internalid", label: "Internal ID"}),
               search.createColumn({
                  name: "itemid",
                  sort: search.Sort.ASC,
                  label: "Name"
               })
            ]
         });
         var searchResultCount = itemSearchObj.runPaged().count;
         log.debug("itemSearchObj result count",searchResultCount);
         itemSearchObj.run().each(function(result){
            itemId =result.getValue({name:'internalid'});
            return true;
         });
       
         if(itemId){return itemId}else{return false;}
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
    
});