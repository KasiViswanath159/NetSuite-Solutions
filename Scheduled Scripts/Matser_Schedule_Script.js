/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define(['N/search', 'N/file', 'N/task', 'N/log', 'N/runtime'],
    function(search, file, task, log, runtime) {
    
        /**
         * Attempts to submit a Map/Reduce task using one of the provided deployments.
         * If a deployment is already running, it catches "MAP_REDUCE_ALREADY_RUNNING" and tries the next.
         * @param {string} scriptId - The MR script ID
         * @param {string[]} deployments - Array of deployment IDs to try
         * @param {object} params - The task parameters to pass
         * @returns {string|null} - The submitted task ID, or null if no deployment was free
         */
        function submitAvailableDeployment(scriptId, deployments, params) {
            for (var i = 0; i < deployments.length; i++) {
                var deployId = deployments[i];
                try {
                    var mrTask = task.create({
                        taskType: task.TaskType.MAP_REDUCE,
                        scriptId: scriptId,
                        deploymentId: deployId,
                        params: params
                    });
                    var mrTaskId = mrTask.submit();
                    log.audit("submitAvailableDeployment", 
                              "Successfully submitted MR with deployment " + deployId + 
                              ", Task ID: " + mrTaskId);
                    return mrTaskId; // success
                } catch (e) {
                    if (e.name === "MAP_REDUCE_ALREADY_RUNNING") {
                        log.audit("submitAvailableDeployment", 
                                  "Deployment " + deployId + " is busy, trying next...");
                    } else {
                        // Some other error, rethrow
                        throw e;
                    }
                }
            }
            // If we exhaust all deployments, return null
            return null;
        }
    
        function execute(context) {
            try {
                var scriptObj = runtime.getCurrentScript();
    
                // Retrieve folder parameters
                var inputFolderId = scriptObj.getParameter({ name: 'custscript_input_folder_id' });
                var processedFolderId = scriptObj.getParameter({ name: 'custscript_processed_folder_id' });
                var resultFolderId = scriptObj.getParameter({ name: 'custscript_master_csv_folder_id' });
    
                if (!inputFolderId || !processedFolderId || !resultFolderId) {
                    throw "Missing required folder parameters. " +
                          "Please set 'custscript_input_folder_id', 'custscript_processed_folder_id', " +
                          "and 'custscript_master_csv_folder_id'.";
                }
    
                // Search for CSV files in the input folder; process only one file per run
                // Use 'anyof' for folder, 'contains' for .csv
                var fileSearch = search.create({
                    type: "file",
                    filters: [
                        ["folder", "anyof", inputFolderId],
                        "AND",
                        ["name", "contains", ".csv"]
                    ],
                    columns: ["internalid", "name"]
                });
    
                var fileId = null, fileName = null;
                fileSearch.run().each(function(result) {
                    fileId = result.getValue("internalid");
                    fileName = result.getValue("name");
                    return false; // only process one file
                });
    
                if (!fileId) {
                    log.audit("Master Script", "No CSV files found to process.");
                    return;
                }
    
                log.audit("Master Script", "Processing file: " + fileName + " (ID: " + fileId + ")");
    
                // We have multiple deployments for the same MR script:
                var mrScriptId = "customscript3412"; // your MR script ID
                var possibleDeployments = [
                    "customdeploy1",
                    "customdeploy2"
                ];
    
                // Attempt to submit the task to an available deployment
                var mrTaskId = submitAvailableDeployment(mrScriptId, possibleDeployments, {
                    custscript_creditmemo_csv_file_id: fileId,
                    custscript_creditmemo_csv_folder_id: resultFolderId
                });
    
                if (!mrTaskId) {
                    // All deployments are busy, skip or reschedule
                    log.audit("Master Script", 
                              "All deployments are busy (MAP_REDUCE_ALREADY_RUNNING). " +
                              "Skipping file " + fileName + " for now.");
                    return;
                }
    
                // If we reach here, we successfully submitted an MR task. Move the file.
                try {
                    // 1) Load the file object
                    var fileObj = file.load({ id: fileId });
                    // 2) Change its folder
                    fileObj.folder = processedFolderId;
                    // 3) Save
                    var newFileId = fileObj.save();
                    log.audit("Master Script", 
                              "Moved file '" + fileName + "' to folder " + processedFolderId + 
                              ". New File ID: " + newFileId);
                } catch (moveError) {
                    log.error("Error moving file '" + fileName + "'", moveError);
                }
    
            } catch (e) {
                log.error("Master Script Error", e);
            }
        }
    
        return {
            execute: execute
        };
    });
    