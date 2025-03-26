/**
 *@NApiVersion 2.1
 *@NScriptType ScheduledScript
 *@NModuleScope Public
 */
define(['N/record', 'N/search', 'N/runtime', 'N/task', 'N/file'],

    function(record, search, runtime, task, file) {

        function execute(scriptContext) {
            try {
                var script = runtime.getCurrentScript();
                var startIndex = 0;
                var endIndex = 1000;

                var values = 1000;
                mainLoop: while (values == 1000) {

                    var getSavedSearchId = script.getParameter("custscript_saved_search_id");
                      log.debug("getSavedSearchId", getSavedSearchId);

                    var loadSearch = search.load({
                        id: getSavedSearchId
                    });
                    var searchResults = loadSearch.run().getRange(startIndex, endIndex);

                    // var exportResults = [];

                    if (searchResults.length > 0) {

                        for (var i = 0; i < searchResults.length; i++) {

                            var getBillId = searchResults[i].id;

                            log.debug("getBillId", getBillId);


                             var updatedBillRec = record.submitFields({
                                    type: "vendorbill",
                                    id: getBillId,
                                    values: {
                                      "approvalstatus": "3",
                                        "paymenthold":true,
                                        "memo":"Po Rejected"
                                    }
                                });
                                log.debug("updatedBillRec", updatedBillRec);

                        }
                        return;
                    }

                    var remainingUsage = runtime.getCurrentScript().getRemainingUsage();
                    log.debug('remainingUsage outside', remainingUsage);
                    if (remainingUsage <= 200) {

                        // var RsTask = task.create({
                        //     taskType: task.TaskType.SCHEDULED_SCRIPT,
                        //     scriptId: script.id,
                        //     deploymentId: script.deploymentId
                        // });

                        // var taskObj = RsTask.submit();
                        break mainLoop;
                    }
                }

                startIndex = endIndex;
                endIndex = startIndex + 1000;
                values = searchResults.length;
                log.debug('values', values);

            } catch (e) {
                log.error("Error:", JSON.stringify(e));
            }

        }

        return {
            execute: execute
        };
    });