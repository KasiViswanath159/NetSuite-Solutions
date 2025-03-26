/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 * @NModuleScope SameAccount
 */
define(['N/email', 'N/file', 'N/format', 'N/record', 'N/runtime', 'N/search', 'N/error', 'N/sftp', 'N/config', 'N/cache', 'N/task'],
    /**
     * @param {email} email
     * @param {file} file
     * @param {format} format
     * @param {https} https
     * @param {record} record
     * @param {runtime} runtime
     * @param {search} search
     */
    function (email, file, format, record, runtime, search, error, sftp, config, cache, task) {

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
            var inputdata = new Array();
            var sftpDetails = getSFTPDetails();

            inputdata.push(sftpDetails);

            log.debug('inputdata', inputdata);
            return inputdata;
        }

        /**
        * Executes when the map entry point is triggered and applies to each key/value pair.
        *
        * @param {MapSummary} context - Data collection containing the key/value pairs to process through the map stage
        * @since 2015.1
        */
        function map(context) {
            try {

                //log.debug('map', context.value);
                var values = JSON.parse(context.value);


                var jeMapping = getJSONData(values['jemapping'].replace(/(\r\n|\n|\r)/gm, ""));

                var sftpDetails = getSFTPDetails();
                var connection = connectSFTP(sftpDetails['username'], sftpDetails['keyid'], sftpDetails['sftpurl'], sftpDetails['port'], '', sftpDetails['hostkey'], sftpDetails['guid']);

                if (connection) {

                    var fileList = connection.list({ path: values['directory'] });
                    log.debug('Items in directory : ' + fileList.length);
                    log.debug('Items in directory : ' + fileList.length);

                    for (var fo = 0; fo < fileList.length; fo++) {

                        try {
                            var scriptObj = runtime.getCurrentScript();
                            
                            log.debug('DIRECTORY:' + fileList[fo].name);
                            if ((!fileList[fo].directory) && fileList[fo].name) {
                                log.debug('Items in directory :' + fo, fileList[fo]);
                                var tempFileName = JSON.stringify(fileList[fo]['name']);
                                log.debug('Item name:' + fo, tempFileName);
                                
                                var fileOBJSFTP = '';
                                var fileOBJ = connection.download({
                                    directory: values['directory'],
                                    filename: fileList[fo].name
                                });
                             
                                fileOBJSFTP = fileOBJ;

                                if (values['folder']) {
                                    fileOBJSFTP.folder = values['folder'];

                                    var fileid = fileOBJSFTP.save();
                                    log.debug("fileid", fileid);
                                }

                                if (values['prosdirectory']) {
                                    connection.move({
                                        from: values['directory'] + '/' + fileList[fo].name,
                                        to: values['prosdirectory'] + '/' + fileList[fo].name,
                                    });
                                    log.debug("file move completed");
                                }
                                if (!fileOBJ) {
                                    continue;
                                }

                                if (((fileOBJ.fileType) != 'CSV') && ((fileOBJ.fileType) != 'csv')) {
                                    continue;
                                }
                                var iterator = fileOBJ.lines.iterator();

                                var headers = '';

                                iterator.each(function (line) {
                                    headers = line.value.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                                    return false;
                                });
                                log.debug("headers ", headers);
                                var filelineID = parseInt(1);
                                // Process each line in the file
                                iterator.each(function (line) {
                                    log.debug('data', line.value);
                                    //log.debug('data', line);
                                    if (line.value) {
                                        var dataArray = new Array();
                                        var data = line.value.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);
                                        if (data) {
                                            var uniqueID = data[0];
                                            if (uniqueID) {
                                                log.debug('uniqueID', uniqueID);
                                                
                                                dataArray.push(jeMapping);         

                                                var dataObject = {};
                                                headers.forEach(function (k, i) {
                                                    dataObject[k] = data[i];
                                                })
                                                dataArray.push(dataObject);
                                                
                                                var datatoProcess = {};
                                                //datatoProcess[filelineID] = dataArray;
                                                datatoProcess['lineId'] = filelineID;
                                                datatoProcess['data'] = dataArray;

                                                context.write({
                                                    key: uniqueID,
                                                    value: JSON.stringify(datatoProcess)
                                                });
                                                
                                                filelineID++;
                                            }
                                        }
                                    }
                                    return true;
                                });
                            }
                        } catch (e) {
                            log.error('Error while downloading the file', e);
                        }
                    }
                }

            } catch (e) {
                log.error('Error in Map', e);
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
                log.audit("context in reduce", context);
               
                log.debug({
                    title: context.key,
                    details: context.values
                });
                var dataArray = [];
                for (var k = 0; k < context.values.length; k++) {
                    dataArray.push(JSON.parse(context.values[k]));
                }
                //log.debug({ title: 'dataArray', details : dataArray });
                var dataToProcess = dataArray.sort(compare_lineID);
                //log.debug({ title: 'dataToProcess', details : dataToProcess });

                for (var i = 0; i < dataToProcess.length; i++) {

                    if (!dataToProcess[i]['data']) {
                        continue;
                    }
                   
                    log.debug({
                        title: context.key,
                        details: dataToProcess[i]['data']
                    });

                    var dataDetails = dataToProcess[i]['data']; 
                    var jeMapping = dataDetails[0];
                    var data = dataDetails[1];
                    
                    var recID = createJE(jeMapping, data);
                   
                }

                    context.write({ key: "success" + "---" + context.key, value: context.values });

            } catch (e) {
                log.error({
                    title: 'Error Occured at reduce level: ' + context.key,
                    details: e
                });

                
                context.write({
                    key: "failure" + "---" + context.key + '---' + e.message,
                    value: context.values
                });
            }
        }


        /**
        * Executes when the summarize entry point is triggered and applies to the result set.
        *
        * @param {Summary} summary - Holds statistics regarding the execution of a map/reduce script
        * @since 2015.1
        */
        function summarize(summary) 
		{  
            log.debug("summary :", summary);
        }


        function compare_lineID(a, b) {
            // a should come before b in the sorted order
            if (a.lineId < b.lineId) {
                return -1;
                // a should come after b in the sorted order
            } else if (a.lineId > b.lineId) {
                return 1;
                // and and b are the same
            } else {
                return 0;
            }
        }

        function setBodyLevelFieldValues(fldName, context, rec) {
            log.debug(fldName, context[fldName]);
            
            if (fldName == 'trandate') {
                if (context[fldName]) {
                    var datecomp = context[fldName].split('-')
                    var d = new Date();
                    d.setFullYear(datecomp[0]);
                    d.setMonth((datecomp[1] - 1));
                    d.setDate(datecomp[2]);
                    var dateValue = format.parse({ value: d, type: format.Type.DATE });
                    dateValue = format.format({ value: dateValue, type: format.Type.DATE });
                    dateValue = format.parse({ value: dateValue, type: format.Type.DATE });
                    log.debug('dateValue', dateValue);
                    rec.setValue(fldName, dateValue);
                }
            } else {
                if (context[fldName] == 'true') {
                    rec.setValue(fldName, true);
                } else if (context[fldName] == 'false') {
                    rec.setValue(fldName, false);
                } else {
                    rec.setValue(fldName, context[fldName]);
                }
            }

        }


        function createJE(mapping, data) {

            var jsonData = {};
            var bodyFields = {};
            var sublistFields = {};

            var lineAmount = (data['line_item_payment_amount'] < 0) ? data['line_item_payment_amount'] * -1 : data['line_item_payment_amount'];
            //data['line_item_payment_amount'] = lineAmount;
            jsonData['amount'] = lineAmount;

            for (var column in data) {
                var value = data[column];
                var nsID = mapping[column];

                //log.debug("JE  value, nsID :" + column,  value+'--'+ nsID);
                if (nsID) {
                    if (nsID.indexOf('.') > -1) {
                        var temp = nsID.split('.');
                        if (temp[0] == 'line') {
                            if (column == 'bank_account_number') {
                                if (!value) {
                                    
                                    sublistFields['debitaccount'] = value;
                                } else {
                                    sublistFields['debitaccount'] = value;
                                }

                            } else if (column == 'invoice_ar_account') {
                                if (!value) {
                                    
                                    sublistFields['creditaccount'] = value;
                                } else {
                                    sublistFields['creditaccount'] = value;
                                }

                            } else {
                                sublistFields[temp[1]] = value;
                            }
                        }
                    } else {
                        bodyFields[nsID] = value;
                    }
                }
            }

            log.debug("bodyFields:", bodyFields);
            log.debug("sublistFields:", sublistFields);

            if (bodyFields) {

                var rec = record.create({
                    type: 'journalentry',
                    isDynamic: true
                });

                for (var key in bodyFields) {
                    log.debug(key, bodyFields[key]);
                    if (bodyFields[key]) {
                        setBodyLevelFieldValues(key, bodyFields, rec);
                        
                    }
                }
                rec.setValue('memo', 'EIPP REFUND'); // Adding memo to header
                rec.setValue('approvalstatus', 2);

                //Line one
                rec.selectNewLine({
                    sublistId: 'line'
                });
              // Memo for line item
              rec.setCurrentSublistValue({ 
                     sublistId: 'line', 
                     fieldId: 'memo', 
                     value: 'EIPP REFUND' 
              });

                for (var subkeyline in sublistFields) {

                    log.debug('sublist data :' + subkeyline, sublistFields[subkeyline]);
                    /*if(subkeyline == 'amount'){
                            jsonData['amount'] = sublistFields[subkeyline];
                        }*/
                    if (subkeyline == 'debitaccount') {
                        rec.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: 'account',
                            value: sublistFields[subkeyline]
                        });
                    } else if (subkeyline == 'amount') {
                        rec.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: 'debit',
                            value: sublistFields[subkeyline]
                        });
                    } else if (subkeyline != 'creditaccount') {
                        rec.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: subkeyline,
                            value: sublistFields[subkeyline]
                        });
                    }

                }
                rec.commitLine({
                    sublistId: 'line'
                });

                //Line two
                rec.selectNewLine({
                    sublistId: 'line'
                });
              rec.setCurrentSublistValue({ 
                  sublistId: 'line', 
                  fieldId: 'memo', 
                  value: 'EIPP REFUND' 
              }); // Memo for line item

                for (var subkeyline in sublistFields) {

                    
                    if (subkeyline == 'creditaccount') {
                        rec.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: 'account',
                            value: sublistFields[subkeyline]
                        });
                    } else if (subkeyline == 'amount') {
                        rec.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: 'credit',
                            value: sublistFields[subkeyline]
                        });
                    } else if ((subkeyline != 'debitaccount')) {  //&& (subkeyline != 'entity')
                        rec.setCurrentSublistValue({
                            sublistId: 'line',
                            fieldId: subkeyline,
                            value: sublistFields[subkeyline]
                        });
                    }
                }
                rec.commitLine({
                    sublistId: 'line'
                });


                var recordId = rec.save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                });
                log.debug('JE ', recordId);

                return recordId;

            } else {
                var custom_error = error.create({
                    name: 'USER_ERROR',
                    message: 'failed to create the JE with details :' + data,
                    notifyOff: false
                });
                throw custom_error;
            }
        }

        function getSFTPDetails() 
		{
            try {
                var sftpDetails = {};
                var scriptObj = runtime.getCurrentScript();
                sftpDetails['username'] = scriptObj.getParameter({
                    name: 'custscript_dd_hrc_sftp_instance'
                });
                sftpDetails['sftpurl'] = scriptObj.getParameter({
                    name: 'custscript_dd_hrc_sftp_url'
                });
                sftpDetails['hostkey'] = scriptObj.getParameter({
                    name: 'custscript_dd_hrc_sftp_host_key'
                });
               /* sftpDetails['port'] = scriptObj.getParameter({
                    name: 'custscript_dd_sftp_port'
                }); */
                sftpDetails['directory'] = scriptObj.getParameter({
                    name: 'custscript_dd_hrc_sftp_refund_folder'
                });
               log.error(' SFTP Directory: ' +''+ sftpDetails['directory']);
                sftpDetails['folder'] = scriptObj.getParameter({
                    name: 'custscript_dd_file_cabinet_folder'
                });
                sftpDetails['jemapping'] = scriptObj.getParameter({
                    name: 'custscript_dd_je_mapping'
                });
                sftpDetails['keyid'] = scriptObj.getParameter({
                    name: 'custscript_dd_hrc_sftp_key_id'
                });

                sftpDetails['prosdirectory'] = scriptObj.getParameter({
                    name: 'custscript_dd_sftp_proc_directory'
                });

                return sftpDetails;
            } catch (e) {
                log.error('Error while extracting setup details', e);

            }

            return sftpDetails;
        }

       function delaySFTPConnection(milliseconds) {
		var timeStart = new Date().getTime();
		while (true) {
			var elapsedTime = new Date().getTime() - timeStart;
			if (elapsedTime > milliseconds) {
				break;
			}
		}
	}

        function connectSFTP(username, keyId, sftpurl, port, directory, hostkey){

           
            log.debug('Establishing SFTP connection...');
            var options = {
                'username': username,
                'url': sftpurl,
                'port': (port)? parseInt(port) : 22,
                'directory': directory,
                'hostKey': hostkey,
                'keyId' : keyId 
            };
            
            for(var con=0; con<5; con++){
                try{
                    var connection = sftp.createConnection(options);
                    log.debug('Connection established!');
                    break;
                }catch (e) {
                    log.error('Error connecting SFTP :'+con, e);
                    delaySFTPConnection(5000);
                }
            }
            return connection;
        }
     
	 function getJSONData(data) {
			var mapping = {};
			var dataArray = data.split(',');
			for (var p = 0; p < dataArray.length; p++) {
				//log.debug('dataArray'+[p], dataArray[p]);
				if (dataArray[p]) {
					var tempdata = dataArray[p].split(':');
					mapping[tempdata[0].trim()] = tempdata[1].trim();
				}
			}
			log.debug('JSON mapping', mapping);
			return mapping;
		}


        function isEmpty(obj) {
            for (var key in obj) {
                if (obj.hasOwnProperty(key))
                    return false;
            }
            return true;
        }

        return {
            getInputData: getInputData,
            map: map,
            reduce: reduce,
            summarize: summarize
        };
	});