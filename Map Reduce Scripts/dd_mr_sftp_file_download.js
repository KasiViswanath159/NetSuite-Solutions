/*
 * CONFIDENTIAL AND PROPRIETARY SOURCE CODE.
 *
 * Use and distribution of this code is subject to applicable
 * licenses and the permission of the code owner. This notice
 * does not indicate the actual or intended publication of
 * this source code.
 *
 * Portions developed for dd, Inc. by CBIZ ARC
 * and are the property of dd, Inc.
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
        'N/sftp'
    ],
    function (log, runtime, file, search, sftp) {

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
        const getInputData = () => {
            let title  = 'dd_mr_sftp_file_download.getInputData';
            log.debug(title, "Function started.");
            let scriptObj = runtime.getCurrentScript();
            let sftpUrl = scriptObj.getParameter({
                name: 'custscript_dd_sftp_url'
            });
            log.debug(title, "sftpUrl: " + sftpUrl);
            let userName = scriptObj.getParameter({
                name: 'custscript_dd_sftp_username'
            });
            log.debug(title, "userName: " + userName);
            let hostKey = scriptObj.getParameter({
                name: 'custscript_dd_sftp_hostkey'
            });
            log.debug(title, "hostKey: " + hostKey);
            let keyId = scriptObj.getParameter({
                name: 'custscript_dd_sftp_keyid'
            });
            hostKey = 'AAAAB3NzaC1yc2EAAAABIwAAAQEAvuodDo7V8D9874qvkqmk6SQou1SL/jvut5DY6FRRnPbLT/Btcj3ZU1+pLxkqfyo9r4ODNZCg+WXEXgfxJjBNbYZohZyIW7yyAWny16cbiqFqKlBJe7M2MjnJXGu4qLnrqEapVpeML4ICtoDiSO17wri176TBFuZuevcgWBpijAjo++d8nzeClwX5h0ScHxXg3eZb2xLaC2v87Q3KeHtVyNUObYKCZ5k3xIpjUoRgUrOAADDzIrXHMBKVFVr17ZvjrTqfnbNQiEV7hGnO394udMzN3Urp4vcS7kr2A4HZSdx+0F3nsS30BddUdgNySydQ7nilhkBI+QwQzBKT3NqVIw==';
            log.debug(title, "keyId: " + keyId);
            let sftpFolder = scriptObj.getParameter({
                name: 'custscript_dd_shared_sftp_folder'
            });
            log.debug(title, "sftpFolder: " + sftpFolder);
            let fileCabinetFolderId = scriptObj.getParameter({
                name: 'custscript_dd_download_folder_id'
            });
            log.debug(title, "fileCabinetFolderId: " + fileCabinetFolderId);
            let fileList = [];
            let sftpConnection = null;
            try {
                sftpConnection = establishSFTPConnection(sftpUrl, userName, hostKey, keyId, sftpFolder);
            } catch (e) {
                log.error(title,'an error occurs in establishSFTPConnection: ' + e);
                return fileList;
            }
            if (sftpConnection) {
                try {
                    let sftpFileList = sftpList(sftpConnection,'/');
                    for (let i=0;i<sftpFileList.length;i++) {
                        log.debug(title, "sftpFileList[" + i + "]: " + JSON.stringify(sftpFileList[i]));
                    }
                    let sftpFiles = sftpFileList.filter(function(el){
                        return el.directory == false; // && el.name && el.name.indexOf(prefixFileName) > -1;
                    });
                    log.debug(title, "Files to download: " + sftpFiles);
                    if (!sftpFiles || sftpFiles.length == 0) {
                        return fileList;
                    }
                    for (let i=0;i<sftpFiles.length;i++) {
                        log.debug(title, "Downloading sftp File " + i + ": " + JSON.stringify(sftpFiles[i]));
                        let downloadedFile = sftpFileDownload(sftpConnection,'/',sftpFiles[i].name);
                        downloadedFile.folder = fileCabinetFolderId;
                        downloadedFile.save();
                        if (downloadedFile)  {
                            fileList.push(downloadedFile);
                        }
                    }
                    return fileList;
                } catch (e) {
                    log.error(title,e);
                    return fileList;
                }
            }
            log.debug(title,'downloaded files: ' + fileList);
            return fileList;
        }

        /**
         * Executes when the map entry point is triggered and applies to each key/value pair.
         *
         * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
         * @since 2015.1
         */
        const map = (context) => {
            let title = 'dd_mr_sftp_file_download.map';
            log.debug(title, "Function started.");
            log.debug(title + " - context", JSON.stringify(context));
        }

        /**
         * Executes when the reduce entry point is triggered and applies to each group.
         *
         * @param {ReduceSummary} context - Data collection containing the groups to process through the reduce stage
         * @since 2015.1
         */
        const reduce = (context) => {
        }

        /**
         * Executes when the summarize entry point is triggered and applies to the result set.
         *
         * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
         * @since 2015.1
         */
        const summarize = (summary) => {
        }
        const establishSFTPConnection = (sftpUrl, userName, hostKey, keyId, directory) => {
            // Establish a connection
            log.debug('Establishing SFTP connection...');
            let connection = sftp.createConnection({
                username: userName,
                keyId: keyId,
                url: sftpUrl,
                port: 22,
                directory: directory,
                hostKey: hostKey
            });
            log.debug('Connection established!');
            return connection;
        }
        const sftpList = (connection, directory) => {
            let list = connection.list({
                path: directory
            });
            log.debug('Items in directory ' + directory + ' at the beginning: ' + list.length);
            return list;
        }
        const sftpFileDownload = (connection, directory, fileName) => {
            let downloadedFile = null;
            if (directory) {
                downloadedFile = connection.download({
                    directory: directory,
                    filename: fileName
                });
            } else {
                downloadedFile = connection.download({
                    filename: fileName
                });
            }
            return downloadedFile;
        }
        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };

    });
