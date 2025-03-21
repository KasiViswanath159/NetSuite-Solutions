/**
 * @NApiVersion 2.x
 * @NScriptType UserEventScript
 */
define(['N/record', 'N/log', 'N/search'], function(record, log, search) {

    function afterSubmit(context) {
        if (context.type === context.UserEventType.DELETE) {
            return;
        }
        log.debug('context', context);

        // Get the new record
        var newRecord = context.newRecord;
        var oldRecord = context.oldRecord;

        // Get the value of the custom field custrecord_deprhistjournal
        var journalEntryId = newRecord.getValue({
            fieldId: 'custrecord_summary_histjournal'
        });
        log.debug('jeid', journalEntryId);

       if(journalEntryId){                                          //HB 2/28
       var journalEntryRecord = record.load({
            type: record.Type.JOURNAL_ENTRY,
            id: journalEntryId,
              isDynamic: true
        });

        var postingPeriod = journalEntryRecord.getText({
            fieldId: 'postingperiod'
        });

        var memo = 'FAM ' + ' ' + '|' + ' Depreciation ' + '|' + ' ' + postingPeriod;
        log.debug('memo', memo);

        journalEntryRecord.setValue({
            fieldId: 'memo',
            value: memo
        });


        journalEntryRecord.save();

    
       
      if (context.type === context.UserEventType.CREATE) {
            // Fetch name from new record on create
          var  bgSummary = newRecord.getValue({
                fieldId: 'name'
            });  
    //    var  bgSummary = newRecord.fields.name;
        } else {
            // Fetch name from old record on edit
         var   bgSummary = oldRecord.getValue({
                fieldId: 'name'
            });  
      }

        log.debug('bg summary', bgSummary);

        if(journalEntryId){
        var deprHistorySrch =  search.create({
            type: "customrecord_ncfar_deprhistory",
            filters:
                [
                    ["name", "is", bgSummary]
                ],
            columns:
                [
                    search.createColumn({
                        name: "internalid"
                    })
                ]
        });

            // Run the search and get the results
            var deprHistorySrchResults = deprHistorySrch.run().getRange({
                start: 0,
                end: 1000  // Adjust the end index based on your needs
            });

        // Check if there are results and retrieve the internal ID
            if (deprHistorySrchResults.length > 0) {
              for(var i = 0; i < deprHistorySrchResults.length ; i++ ) {
                var deprHistory_id = deprHistorySrchResults[i].getValue({
                    name: "internalid"
                });
                log.debug('Depr History ID', deprHistory_id);

              record.submitFields({
                type: 'customrecord_ncfar_deprhistory',
                id: deprHistory_id,
                values: {
                    custrecord_acs_je_reference: journalEntryId
                }
            });
            }
            }
        }  
    }
}

        return {
            afterSubmit: afterSubmit
        };
    });