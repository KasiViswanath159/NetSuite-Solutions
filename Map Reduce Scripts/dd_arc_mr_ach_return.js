/**
 * CONFIDENTIAL AND PROPRIETARY SOURCE CODE.
 *
 * Use and distribution of this code is subject to applicable
 * licenses and the permission of the code owner. This notice
 * does not indicate the actual or intended publication of
 * this source code.
 *
 * Portions developed for DoorDash, Inc. by CBIZ ARC
 * and are the property of DoorDash, Inc.
 * ===================================================================
 * Version    Date            Author           Remarks
 * 1.0.0      21 Oct 2021     Bruce Do      	Initial version
 */
/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define([
        'N/log',
        'N/runtime',
        'N/file',
        'N/search',
        'N/error',
        '../../lib/dd_lib_import',
        '../../lib/lodash.min'
    ],
    function (log, runtime, file, search, error, libImport,_) {

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
        let sftpConfig = {};
        let sftpConnection = null;
        const getInputData = () => {
            let title  = 'dd_mr_arc_ach_return.getInputData';
            log.debug(title, "Function started.");
            let fileContents = [];
            try {
                let scriptObj = runtime.getCurrentScript();
                const inputFolderId = scriptObj.getParameter({
                    name: 'custscript_dd_ach_in_folder_id'
                });
                const prefixFileName = scriptObj.getParameter({
                    name: 'custscript_dd_ach_file_prefix'
                });
                const importScriptPath = scriptObj.getParameter({
                    name: 'custscript_dd_ach_script_path'
                });
                const delimiter = scriptObj.getParameter({
                    name: 'custscript_dd_ach_delimiter'
                });
                const endOfLine = scriptObj.getParameter({
                    name: 'custscript_dd_ach_eol'
                });
                const workingDir = scriptObj.getParameter({
                    name: 'custscript_dd_ach_sftp_folder'
                });
                const localProcessedFolder = scriptObj.getParameter({
                    name: 'custscript_dd_ach_processed_folder'
                });
                log.debug(title, "inputFolderId: " + inputFolderId);
                log.debug(title, "prefixFileName: " + prefixFileName);
                log.debug(title, "importScriptPath: " + importScriptPath);
                log.debug(title, "delimiter: " + delimiter);
                log.debug(title, "endOfLine: " + endOfLine);
                log.debug(title, "workingDir: " + workingDir);
                log.debug(title, "localProcessedFolder: " + localProcessedFolder);
                sftpConfig = libImport.getHRCsftpConfig();
                log.debug(title + " - sftpConfig", sftpConfig);
                if (!sftpConfig) return  fileContents;
                let accountId = runtime.accountId;
                if(accountId){
                    accountId = accountId.toLowerCase();
                }
                log.debug(title, 'accountId: ' + accountId);
                let setupAccId = libImport.getSetupAccountId();
                if(setupAccId){
                    setupAccId = setupAccId.toLowerCase();
                }
                log.debug(title, 'setupAccId: ' + setupAccId);
                log.debug(accountId, setupAccId);
                if (accountId != setupAccId) {
                    throw error.create({
                        name: 'INV_VALID_ACCOUNT_ID',
                        message: 'Please check the account ID and SFTP URL that provided in setup',
                        notifyOff: true
                    });

                }
                sftpConnection = libImport.establishSFTPConnection(sftpConfig.sftpUrl, sftpConfig.userName, sftpConfig.hostKey, sftpConfig.keyId, workingDir);
                if (!sftpConnection) {
                    log.error(title, "SFTP Connection failed");
                    return  fileContents;
                }
                // libImport.sftpCreateDirectory(sftpConnection,'Processed');
                // return;

                let sftpList = libImport.sftpList(sftpConnection,'/');
                for (let i=0;i<sftpList.length;i++) {
                    log.debug(title, "sftp File " + i + " in sftpList: " + JSON.stringify(sftpList[i]));
                }
                if (!sftpList) return fileContents;
                let sftpFiles = sftpList.filter(function(el){
                    return el.directory == false && el.name && el.name.indexOf(prefixFileName) > -1;
                });
                if (!sftpFiles) return fileContents;
                let downloadedFiles = [];
                for (let i=0;i<sftpFiles.length;i++) {
                    log.debug(title, "Downloading sftp File " + i + ": " + JSON.stringify(sftpFiles[i]));
                    let downloadedFile = libImport.sftpFileDownload(sftpConnection,'/',sftpFiles[i].name);
                    downloadedFile.folder = inputFolderId;
                    downloadedFile.save();
                    if (downloadedFile)  {
                        downloadedFiles.push(downloadedFile);
                        try {
                            libImport.sftpMoveFile(sftpConnection,sftpFiles[i].name,'/','/Processed/');
                        } catch (e) {
                            log.error(title, "Can not move sftp file " + downloadedFile.name + " from / to /Processed/");
                            // To Do: Email to Administrator
                        }
                    } else {
                        log.error(title, "Can not download sftp file " + sftpFiles[i].name );
                        // To Do: Email to Administrator
                    }
                }
                log.debug(title,  "downloaded Files: " + downloadedFiles);
                if (downloadedFiles.length == 0) return fileContents;
                let importModule = null;
                if (importScriptPath) {
                    require([importScriptPath], function (importScript) {
                        importModule = importScript;
                    });
                }
                let fileList = libImport.searchFileStartWith(search, prefixFileName, inputFolderId, file.Type.CSV);
                let processingFiles = [];
                if (fileList.length > 0) {
                    for (let index = 0; index < fileList.length; index++) {
                        let impFile = file.load(fileList[index]);
                        log.audit(title, "Processing file: " + impFile.name);
                        let contents = libImport.csvToJSON(impFile.getContents(),delimiter, endOfLine);
                        log.debug(title, "Number of rows: " + contents.length);
                        log.debug(title + " - contents: " , contents);
                        if (contents.length > 0) {
                            // attach fileId and fileName to each of the file lines
                            for (let i = 0; i < contents.length; i++) {
                                contents[i].fileId = fileList[index];
                                contents[i].fileName = impFile.name;
                                // log.debug(title, "fileList[index]: " + fileList[index]);
                                // log.debug(title, "contents[i]: " + JSON.stringify(contents[i]));
                            }
                            processingFiles.push(impFile);
                            if (fileContents.length == 0) {
                                fileContents = contents;
                            } else {
                                // fileContents = fileContents.push.apply(contents);
                                for (let i=0;i<contents.length;i++) {
                                    fileContents.push(contents[i]);
                                }
                                // log.debug(title, 'new fileContents: ' + fileContents);
                            }
                            log.debug(title, "Added " + contents.length + " rows into processing queue.");
                        } else {
                            impFile.name = "processed_" + impFile.name;
                            impFile.folder = localProcessedFolder;
                            impFile.save();
                        }
                    }
                }
                for (let i = 0; i < processingFiles.length; i++) {
                    log.debug(title, "Marked file as processed in File Cabinet: " + processingFiles[i].name);
                    processingFiles[i].name = "processed_" + processingFiles[i].name;
                    processingFiles[i].folder = localProcessedFolder;
                    processingFiles[i].save();
                }
                if (importModule && importModule.processingInputData && fileContents.length > 0) {
                    fileContents = importModule.processingInputData(fileContents);
                }
                log.audit(title, "Total rows to import: " + fileContents.length);
                // log.audit(title, "fileContents to import: " + fileContents);
                return fileContents;
            } catch (e) {
                log.error(title,e);
                return fileContents;
            }
        }

        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1
         */
        const map = (context) => {
            let title = 'dd_arc_mr_ach_return.map';
            log.debug(title, "Function started.");
            log.debug(title, "context " + JSON.stringify(context));
            let value = JSON.parse(context.value);
            log.debug(title, "value: " + JSON.stringify(value));
            let hrcTranID = value["HRC_Transaction_ID"];
            log.debug(title, "HRC_Transaction_ID: " + hrcTranID);
            context.write({
                key: hrcTranID,
                value: JSON.stringify(value)
            });
        }

        /**
         * Executes when the reduce entry point is triggered and applies to each group.
         *
         * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
         * @since 2015.1
         */
        const reduce = (context) => {
            let title = 'dd_arc_mr_ach_return.reduce';
            log.debug(title, "Function started.");
            // log.debug(title, "context: " + JSON.stringify(context));
            const numOfLinesInfile = 5000;
            let scriptObj = runtime.getCurrentScript();
            let now = new Date();
            let errorFolderId = scriptObj.getParameter({
                name: 'custscript_dd_ach_err_folder_id'
            });
            let archivedFolderId = scriptObj.getParameter({
                name: 'custscript_dd_ach_loaded_folder_id'
            });
            let importModule = null;
            let importScriptPath = scriptObj.getParameter({
                name: 'custscript_dd_ach_script_path'
            });
            if (importScriptPath) {
                require([importScriptPath], function (importScript) {
                    importModule = importScript;
                });
            }
            if (importModule && importModule.processingReduce) {
                try {
                    let resultContext = importModule.processingReduce(context);
                    log.debug(title, "resultContext: " + JSON.stringify(resultContext));
                } catch (error) {
                    log.error(title, 'error processing reduce: ' + error);
                }
            }
        }

        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        const summarize = (summary) => {
            let title = 'dd_arc_mr_arc_ach_return.summarize';
            log.debug(title, "Function started.summarize");
            log.debug(title, "summary: " + summary);
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };

    });