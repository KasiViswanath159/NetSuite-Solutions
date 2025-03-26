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
 * 2.0.0      09 Sep 2021     Bruce Do      	Change from Contact Internal IDs to Email Addresses as keys
 */
/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define([
    'N/email',
    'N/log',
    'N/runtime',
    'N/file',
    'N/search',
    'N/error',
    '../../lib/dd_lib_import',
    '../../lib/lodash.min'
],
function(email, log, runtime, file, search, error, libImport, _) {

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
        let title = 'dd_mr_arc_csv_import.getInputData';
        log.debug(title, "Function started.");
        let fileContents = [];
        try {
            let scriptObj = runtime.getCurrentScript();
            const inputFolderId = scriptObj.getParameter({
                name: 'custscript_dd_csv_in_folder_id'
            });
            const prefixFileName = scriptObj.getParameter({
                name: 'custscript_dd_csv_file_prefix'
            });
            const importScriptPath = scriptObj.getParameter({
                name: 'custscript_dd_imp_script_path'
            });
            const delimiter = scriptObj.getParameter({
                name: 'custscript_dd_csv_delimiter'
            });
            const endOfLine = scriptObj.getParameter({
                name: 'custscript_dd_csv_eol'
            });
            const workingDir = scriptObj.getParameter({
                name: 'custscript_dd_sftp_folder'
            });
            const localProcessedFolder = scriptObj.getParameter({
                name: 'custscript_dd_processed_folder'
            });
            const FileReferenceID = scriptObj.getParameter({
                name: 'custscript_file_reference_number'
            });
            const ThresholdValue = scriptObj.getParameter({
                name: 'custscript_threshold_valiue'
            });

            const author = scriptObj.getParameter({
                name: 'custscript_author'
            });
            const recipientEmail = scriptObj.getParameter({
                name: 'custscript_emai_recipients'
            });
            const auditFolderId = scriptObj.getParameter({
                name: 'custscript_dd_audit_folder_id'
            });
            var recipientEmailArray = recipientEmail.split(",");


            log.debug(title, "inputFolderId: " + inputFolderId);
            log.debug(title, "prefixFileName: " + prefixFileName);
            log.debug(title, "importScriptPath: " + importScriptPath);
            log.debug(title, "delimiter: " + delimiter);
            log.debug(title, "endOfLine: " + endOfLine);
            log.debug(title, "workingDir: " + workingDir);
            log.debug(title, "localProcessedFolder: " + localProcessedFolder);
            log.debug(title, "FileReferenceID: " + FileReferenceID);
            log.debug(title, "ThresholdValue: " + ThresholdValue);
            log.debug(title, "author: " + author + ", "+"recipientEmailArray: " + recipientEmailArray);
            
            if (!FileReferenceID){
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
        }
            let importModule = null;
            if (importScriptPath) {
                require([importScriptPath], function(importScript) {
                    importModule = importScript;
                });
            }
            //Code added to add threshold on customer deactivation list.
            let fileList = new Array();
            if (!FileReferenceID) {
                fileList = libImport.searchFileStartWith(search, prefixFileName, inputFolderId, file.Type.CSV);
            } else {
                fileList.push(FileReferenceID);
            }
            let processingFiles = [];
            if (fileList.length > 0) {
                for (let index = 0; index < fileList.length; index++) {
                    let impFile = file.load(fileList[index]);
                    log.audit(title, "Processing file: " + impFile.name);
                    let contents = libImport.csvToJSON(impFile.getContents(), delimiter, endOfLine);
                    log.debug(title, "Number of rows: " + contents.length);
                    //log.debug(title + " - contents: ", contents);
                    if (contents.length > 0) {
                        if (!FileReferenceID && shouldFlagForThresholdAudit(contents.length, ThresholdValue)) {
                            log.debug("Threshold Exceeded", `File ${impFile.name} has exceeded the threshold.`);
                            try {
                                handleThresholdExceededFile({
                                    impFile: impFile,
                                    contents: contents,
                                    auditFolderId: auditFolderId,
                                    author: author,
                                    recipientEmailArray: recipientEmailArray,
                                    thresholdValue: ThresholdValue
                                });
                            } catch (error) {
                                log.error("Error handling corrupted file", {
                                    message: error.message,
                                    stack: error.stack,
                                    fileName: impFile.name,
                                    rowCount: contents.length
                                });
                            }
                            continue; // Skip to the next file
                        }                                        
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
                            for (let i = 0; i < contents.length; i++) {
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
            log.debug(title, "fileContents to import: " + fileContents);
            return fileContents;
        } catch (e) {
            log.error(title, e);
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
        let title = 'dd_mr_arc_csv_import.map';
        log.debug(title, "Function started.");
        log.debug(title + " - context", JSON.stringify(context));
        let scriptObj = runtime.getCurrentScript();
        let importModule = null;
        let importScriptPath = scriptObj.getParameter({
            name: 'custscript_dd_imp_script_path'
        });
        let value = JSON.parse(context.value);
        log.debug(title + " - value", value);
        // initial loading status
        value.loadStatus = "Tentative";
        value.statusReason = "ProcessingNotStart";
        // grouping by file Id and load status
        let resultContext = {
            key: value.loadStatus + "_" + value.fileName,
            value: value
        };

            if (importScriptPath) {
                require([importScriptPath], function(importScript) {
                    importModule = importScript;
                });
            }

        if (importModule && importModule.processingMap) {
            try {
                resultContext = importModule.processingMap(context);
                log.debug(title, "resultContext: " + JSON.stringify(resultContext));
            } catch (error) {
                //let value = JSON.parse(context.value);
                value.loadStatus = "Failed";
                value.statusReason = "ErrorProcessingMap";
                resultContext.key = value.loadStatus + "_" + value.fileName;
                resultContext.value = value;
            }
        }

        if (resultContext) {
            context.write({
                key: resultContext.key,
                value: resultContext.value
            });
        }
    }

    /**
     * Executes when the reduce entry point is triggered and applies to each group.
     *
     * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
     * @since 2015.1
     */
    const reduce = (context) => {
        let title = 'dd_mr_arc_csv_import.reduce';
        log.debug(title, "Function started.");
        const numOfLinesInfile = 5000;
        let scriptObj = runtime.getCurrentScript();
        let now = new Date();
        let errorFolderId = scriptObj.getParameter({
            name: 'custscript_dd_err_folder_id'
        });
        let archivedFolderId = scriptObj.getParameter({
            name: 'custscript_dd_loaded_folder_id'
        });
        let error = null;
        try {
            let values = context.values;
            let dataToLog = '';
            if (_.isArray(values) && values.length > 0) {
                let headers = JSON.parse(values[0]);
                log.debug(title, "headers: " + JSON.stringify(headers));
                headers = _.keys(JSON.parse(values[0]));
                log.debug(title, "headers: " + JSON.stringify(headers));
                headers = _.reduce(_.keys(JSON.parse(values[0])), function(h1, h2) {
                    return h1 + "," + h2;
                });
                log.debug(title, "headers: " + headers);
                dataToLog = dataToLog + headers + '\r\n';
                for (let i = 0; i < values.length; i++) {
                    let line = _.reduce(_.values(JSON.parse(values[i])), function(v1, v2) {
                        return v1 + "," + v2;
                    });
                    dataToLog = dataToLog + line + '\r\n';
                }
            }
            log.debug(title + " - dataToLog", dataToLog);
            let resultFileName = context.key;
            log.debug(title + " - resultFileName", resultFileName);
            // let resultFileContent = context.values;
            // log.debug(title + " - resultFileContent", resultFileContent);
            if (resultFileName.indexOf('Failed') != -1) {
                log.debug(title, 'Saving failed result file');
                libImport.saveResultFile(errorFolderId, resultFileName, dataToLog, 'Failed records from ' + resultFileName.substring(7));
            }
            if (resultFileName.indexOf('Loaded') != -1) {
                log.debug(title, 'Saving loaded result file');
                libImport.saveResultFile(archivedFolderId, resultFileName, dataToLog, 'Loaded records from ' + resultFileName.substring(7));
            }
        } catch (e) {
            log.error(title, e);
            error = e;
        }
        if (error) {
            context.write({
                key: resultFileName.substring(7),
                value: error
            });
        } else {
            context.write({
                key: resultFileName.substring(7),
                value: resultFileName.substring(7)
            });
        }
    }

    /**
     * Executes when the summarize entry point is triggered and applies to the result set.
     *
     * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
     * @since 2015.1
     */
    const summarize = (summary) => {
        let title = 'dd_mr_arc_csv_import.summarize';
        log.debug(title, "Function started.summarize");
        log.debug(title, "summary: " + summary);
    }

    return {
        getInputData: getInputData,
        map: map,
        reduce: reduce,
        summarize: summarize
    };
    function shouldFlagForThresholdAudit(rowCount, ThresholdValue) {
        return ThresholdValue && rowCount > parseInt(ThresholdValue);
    }
    
    function handleThresholdExceededFile(fileOptions) {
        const { impFile, contents, auditFolderId, author, recipientEmailArray, thresholdValue } = fileOptions;
        impFile.folder = auditFolderId;
        const thresholdExceededFileId = impFile.save();
    
        log.debug("File Moved to Audit Folder", `File ${impFile.name} successfully moved to the audit folder (Folder ID: ${auditFolderId}).`);

            const emailContent = prepareEmailContent({
            username: 'Team',
            filename: impFile.name,
            rowCount: contents.length,
            threshold: thresholdValue
        });
    
        email.send({
            author: author,
            recipients: recipientEmailArray,
            subject: emailContent.subject,
            body: emailContent.body,
            attachments: [file.load({ id: thresholdExceededFileId })]
        });
    
        log.debug("Email Notification", `Email successfully sent for file ${impFile.name} to ${recipientEmailArray.join(", ")}.`);
    }
    
    function prepareEmailContent(options) {
        const { username, filename, rowCount, threshold } = options;
    
        // Subject and body built directly as plain strings
        const subject = `System Alert: Customer Deactivation File Exceeds Threshold`;
    
        const body = `
            <p>Dear ${username},</p> 
            <p>The file <strong>${filename}</strong> has <strong>${rowCount}</strong> rows, 
            which exceeds the threshold of <strong>${threshold}</strong>.</p> 
            <p>The file has been moved to the <strong>Audit Folder</strong> for review. Please review the file and take the necessary action.</p>
            <p>--</p> 
            <p><strong>This is a system-generated notification. Please do not reply to this email.</strong></p> 
            <p>---</p>
        `;
    
        return { subject, body };
    }
    

});