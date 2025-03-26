/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 *@NModuleScope Public
 */
define(['N/record', 'N/search', 'N/runtime', 'N/task', 'N/file'],

    function(record, search, runtime, task, file) {

        function execute(scriptContext) {
            try {
                

                var loadFile = file.load({id: "SuiteScripts/DuplicateDDIDs.csv"});

                loadFile.lines.iterator().each(function (line) {

                var getColumns = line.value.split(",");

                var getVendorId = getColumns[1];
                log.debug("getVendorId", getVendorId);

                var getItemName = getColumns[0];
                log.debug("getItemName", getItemName);
      

                //Find Item Internal ID

                var itemSearchObj = search.create({
                                type: "item",
                                filters: [
                                    ["formulatext: {itemid}", "is", getItemName]
                                ],
                                columns: [
                                    search.createColumn({
                                        name: "internalid",
                                        label: "Internal ID"
                                    })
                                ]
                            });


                            var find_Item_Id = itemSearchObj.run().getRange({
                                start: 0,
                                end: 1000
                            });

                            var getItemsId;

                            if (find_Item_Id.length > 0) {
                                getItemsId = find_Item_Id[0].id;
                            }
                           // log.debug("getItemsId", getItemsId);



                            //Find Item Type based on Item's Internal ID

                            var fieldLookUp = search.lookupFields({
                                type: search.Type.ITEM,
                                id: getItemsId,
                                columns: ['type']
                            });
                            var itype = fieldLookUp.type[0].value;

                            var recordtype = '';

                            switch (itype) { // Compare item type to its record type counterpart
                                case 'InvtPart':
                                    recordtype = 'inventoryitem';
                                    break;
                                case 'NonInvtPart':
                                    recordtype = 'noninventoryitem';
                                    break;
                                case 'Service':
                                    recordtype = 'serviceitem';
                                    break;
                                case 'Assembly':
                                    recordtype = 'assemblyitem';
                                    break;

                                case 'GiftCert':
                                    recordtype = 'giftcertificateitem';
                                    break;
                                default:
                            }
                           // log.debug("recordtype", recordtype);

                            //Load Item Record

                            var loadItemRecord = record.load({
                                type: recordtype,
                                id: getItemsId,
                                isDynamic: true
                            });

                           // log.debug("loadItemRecord", loadItemRecord);


                            var vendor_line_count = loadItemRecord.getLineCount('itemvendor');
                        //    log.debug("vendor_line_count", vendor_line_count);


                            // for (j = 1; j < vendor_line_count; j++) {
                                 for(var j = vendor_line_count -1; j >= 0; j-- ){

                                var getLoadedVendor = loadItemRecord.getSublistValue('itemvendor', 'vendor', j);
                               // log.debug('getLoadedVendor', getLoadedVendor);

                                if (getLoadedVendor == getVendorId) {

                                   // log.debug('Inside', 'Inside vendor match');

                                    loadItemRecord.removeLine({
                                        sublistId: 'itemvendor',
                                        line: j,
                                        ignoreRecalc: true
                                    });

                                }

                            }

                            var updatedItemRecord = loadItemRecord.save({
                                ignoreMandatoryFields: true,
                                enableSourcing: true
                            });
                            log.debug('updatedItemRecord', JSON.stringify(updatedItemRecord));

                  var remainingUsage = runtime.getCurrentScript().getRemainingUsage();
                    log.debug('remainingUsage outside', remainingUsage);
                    if (remainingUsage <= 200) {

                        // var RsTask = task.create({
                        //     taskType: task.TaskType.SCHEDULED_SCRIPT,
                        //     scriptId: script.id,
                        //     deploymentId: script.deploymentId
                        // });

                        // var taskObj = RsTask.submit();
                    }


                            return true;

                        });


            
                     
  
            } catch (e) {
                log.error("Error:", JSON.stringify(e));
            }

        }

        return {
            execute: execute
        };
    });