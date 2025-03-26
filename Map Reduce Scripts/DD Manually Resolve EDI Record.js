/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define([
    "N/search",
    "N/record",
    "N/email",
    "N/render", "N/file", "N/runtime"
], function(search, record, email, render, file, runtime) {
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
		try{
            return search.load({
                 id: 'customsearch_dd_manually_resolve_bills'
             });
		}
		catch (e){
			log.error('Error Occured Get Input Stage ',e);
		}
    }

    /**
     * Executes when the map entry point is triggered and applies to each key/value pair.
     *
     * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
     * @since 2015.1
     */

    function map(context) {

        //var result = JSON.parse(context.value);
        var result = JSON.parse(context.value);
        log.debug({
            title: "result",
            details: result
        });
		
        try {
           var processRecords = resolveManually(result);
        } catch (e) {
            log.debug({
                title: "Error: ",
                details: e.message
            });
        }


    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    function reduce(context) {

        try {

        } catch (e) {
            log.debug({
                title: "jsonObj Error",
                details: e.message
            });
        }
    }

    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    function summarize(summary) {

    }

    function resolveManually(res) {
        var recType;
        var results = res.values;
      var fileId;
        log.debug("Rec results: ", results);
        var histRecid= res.id;
        var recordType = res.recordType;
        var tranTypeCode = results["custrecord_dd_transaction_type_code"];
        var poNum = results["custrecord_dd_matched_netsuite_po"].value;
        var tranId = results["custrecord_dd_invoice_number"];
        var vendId = results["custrecord_dd_vendor"].value;
        var ediType = results["custrecord_dd_his_edi_type"].value;
      var fileInfoId = results["custrecord_dd_edi_file_info_parent"].value;
        log.debug("Rec ediType: ", ediType);
        if(ediType == '2'){
            recType = 'transaction';checkifAsnExists
          var poExists = checkifAsnExists(recType,tranId,vendId,poNum);
        }
        else{
            recType = tranTypeCode =='CR' ? 'vendorcredit' : 'vendorbill';
             var poExists = checkifPoExists(recType,tranId,vendId,poNum);
        }
      

     
        if(poExists){
            var hisRecordObj = record.load({
                type: "customrecord_dd_edi_process_history",
                   id: histRecid,
                   isDynamic: true
               });
               hisRecordObj.setValue({fieldId:'custrecord_dd_process_resolved',value:true});
              var hisRecId = hisRecordObj.save();
          if(hisRecId&&fileInfoId)
          {
            var fileInforRec = record.load({
                type: "customrecord_dd_edi_file_info",
                   id: fileInfoId,
                   isDynamic: true
               });
             fileId = fileInforRec.getValue({fieldId:'custrecord_dd_file'});
               fileInforRec.setValue({fieldId:'custrecord_dd_file_process_status',value:4});
              var fileInfoId = fileInforRec.save();
          }
          if(fileId)
          {
            try {
            // Load the file
            var fileObj = file.load({
                id: fileId
            });

            // Set the new folder ID
            fileObj.folder = 1204204;

            // Save the file
            fileObj.save();

        } catch (e) {
            log.error({
                title: 'Error Moving File',
                details: e.message
            });
        }
          }
        }

    }

    function checkifPoExists(recType,tranId,vendId,poNum) {
        var txnExists = false;
        var id;
        var filters =[
            
            ["mainline","is","T"], 
            "AND", 
            ["name","anyof",vendId], 
            ];
         if(recType == 'vendorbill')
         {
           if(poNum){
             filters.push('AND');
            filters.push(["createdfrom","anyof",poNum]);
           }
          /* if(tranDt)
           {
             filters.push("AND");
             filters.push(["custbody_dd_vendorbill_date","on",tranDt])
           }*/
            filters.push("AND");
            filters.push(["type","anyof","VendBill"]);    
            filters.push("AND"), 
            filters.push(["number","equalto",tranId]) 
            //filters.push("AND"), 
            //filters.push(["custbody_dd_created_by_edi_script","is","F"]) 
           
         }
         else if(recType == 'vendorcredit'){
          /* if(poNum){
             filters.push('AND');
            filters.push(["createdfrom","anyof",poNum]);
           }
           */
            filters.push("AND");
            filters.push(["type","anyof","VendCred"]);
            filters.push("AND"), 
            filters.push(["number","equalto",tranId]),
            filters.push("AND"), 
            filters.push(["custbody_dd_created_by_edi_script","is","F"]) 
         }
         else{
            filters.push('AND');
            filters.push(["custbody_ddepono","anyof",poNum]);
            filters.push("AND") 
            filters.push(["type","anyof","CuTrPrch109"]);
            filters.push("AND"), 
            filters.push(["numbertext","equalto",tranId]) ,
            filters.push("AND"), 
            filters.push(["custbody_dd_created_by_edi_script","is","F"]) 
           
         }
         log.debug("recType",recType);
         log.debug("filters",filters);
         try{
            var vendorbillSearchObj = search.create({
                type: recType,
                filters:filters,
                columns:
                [
               search.createColumn({name: "internalid", label: "Internal ID"}),
              
                ]
             });
         }
         catch(e){
            log.debug("error",e.message);
         }
       
         var searchResultCount = vendorbillSearchObj.runPaged().count;
         log.debug("vendorbillSearchObj result count",searchResultCount);
         if (searchResultCount = 1) {
         vendorbillSearchObj.run().each(function(result){
            id = result.getValue({
                name: 'internalid'
            });
            return true;
         });
         txnExists =id;
        }
        return txnExists;

    }

  function checkifAsnExists(recType,tranId,vendId,poNum)
    {
        var txnExists = false;
        var id;
      var transactionSearchObj = search.create({
   type: "transaction",
   filters:
   [
      ["type","anyof","CuTrPrch109"], 
      "AND", 
      ["custbody_ddepono","anyof",poNum], 
      "AND", 
      ["mainline","is","T"], 
      "AND", 
      ["name","anyof",vendId], 
      "AND", 
      ["numbertext","is",tranId]
   ],
   columns:
   [
      search.createColumn({name: "internalid", label: "Internal ID"}),
   ]
});
var searchResultCount = transactionSearchObj.runPaged().count;
        log.debug("vendorbillSearchObj result count",searchResultCount);
         if (searchResultCount = 1) {
         vendorbillSearchObj.run().each(function(result){
            id = result.getValue({
                name: 'internalid'
            });
            return true;
         });
         txnExists =id;
        }
        return txnExists;

    }


    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize,
    };
});