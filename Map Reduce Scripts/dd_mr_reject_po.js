/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/runtime', 'N/search', 'N/file', 'N/format'],
	/**
	 * @param{record} record
	 * @param{search} search
	 */
	(record, runtime, search, file, format) => {
		/**
		 * Defines the function that is executed at the beginning of the map/reduce process and generates the input data.
		 * @param {Object} inputContext
		 * @param {boolean} inputContext.isRestarted - Indicates whether the current invocation of this function is the first
		 *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
		 * @param {Object} inputContext.ObjectRef - Object that references the input data
		 * @typedef {Object} ObjectRef
		 * @property {string|number} ObjectRef.id - Internal ID of the record instance that contains the input data
		 * @property {string} ObjectRef.type - Type of the record instance that contains the input data
		 * @returns {Array|Object|Search|ObjectRef|File|Query} The input data to use in the map/reduce process
		 * @since 2015.2
		 */
		const getInputData = (inputContext) => {
			try {
				let scriptObj = runtime.getCurrentScript();
				log.debug("Script parameter of custscript1: " + scriptObj.getParameter({
					name: 'custscript_dd_csv_file_id'
				}));
				let fileId = scriptObj.getParameter({
					name: 'custscript_dd_csv_file_id'
				});
				log.debug('fileId', fileId);
				let fileArray = [];
				if (fileId) {
					let fileObj = file.load({
						id: fileId
					});
					if (fileObj == null || fileObj == '' || fileObj == undefined)
						return true;
					let arrLines = fileObj.getContents().split(/\n|\n\r/);
					let lineCount = arrLines.length;
					// loop to get all lines
					if (lineCount > 0) {
						for (let i = 1; i < lineCount; i++) {
							let content = arrLines[i].split(',');
                          let text = content[1]?content[1].trim():"";
                          let comment =content[2]?content[2].trim():"";
						//	let text = content[1].trim();
						//	let comment = content[2].trim();
							fileArray.push({
								"documentid": content[0],
								"reason": text,
								'comment': comment
							});
						}
					}
				}
              log.debug('fileArray', fileArray);
				return fileArray;
			} catch (e) {
				log.error('ERROR', e)
			}
		}

		/**
		 * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
		 * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
		 * context.
		 * @param {Object} mapContext.write({key:'',value:}) - Data collection containing the key-value pairs to process in the map stage. This parameter
		 *     is provided automatically based on the results of the getInputData stage.
		 * @param {Iterator} mapContext.errors - Serialized errors that were thrown during previous attempts to execute the map
		 *     function on the current key-value pair
		 * @param {number} mapContext.executionNo - Number of times the map function has been executed on the current key-value
		 *     pair
		 * @param {boolean} mapContext.isRestarted - Indicates whether the current invocation of this function is the first
		 *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
		 * @param {string} mapContext.key - Key to be processed during the map stage
		 * @param {string} mapContext.value - Value to be processed during the map stage
		 * @since 2015.2
		 */

		const map = (mapContext) => {
			try {
				log.debug('Enter', mapContext)
				let objRec = JSON.parse(mapContext.value);
				let recordId = mapContext.key;
				let reason = objRec['reason'];
				let documentId = objRec['documentid'];
				let comment = objRec['comment'];
				reason = reason.toString();
				let values = {};
				if (documentId) {
					let filters = [];
					if (documentId) {
						filters.push(search.createFilter({
							name: 'tranid',
							operator: search.Operator.IS,
							values: documentId
						}));
					}
					filters.push(search.createFilter({
						name: 'mainline',
						operator: search.Operator.IS,
						values: 'T'
					}));

					let searchObj = search.create({
						type: 'purchaseorder',
						colums: [search.createColumn({
							name: 'internalid'
						})],
						filters: filters
					})
					var searchResultCount = searchObj.runPaged().count;
					let recordId;
					searchObj.run().each(function(result) {
						recordId = result.id;
					});
					if (recordId) {
						log.debug('recordId', recordId);
						let loadRec = record.load({
							id: recordId,
							type: 'purchaseorder'
						});
						let status = loadRec.getValue({
							fieldId: 'status'
						});
						let trnId = loadRec.getValue({
							fieldId: 'tranid'
						});
						let approvalstatus = loadRec.getValue({
							fieldId: 'approvalstatus'
						});
						if (status == "Pending Receipt" || approvalstatus == 1) {
							loadRec.setValue({
								fieldId: 'approvalstatus',
								value: 3
							});
							if (reason) {
								let reasonid;
								var rejectcanclistSearchObj = search.create({
									type: "customlist_rejectcanclist",
									filters: [],
									columns: [
										search.createColumn({
											name: "name",
											sort: search.Sort.ASC,
											label: "Name"
										}),
									]
								});
								var searchResultCount = rejectcanclistSearchObj.runPaged().count;
								log.debug("customlist_rejectcanlistSearchObj result count", searchResultCount);
								rejectcanclistSearchObj.run().each(function(result) {
									let name = result.getValue({
										name: 'name'
									});
									if (name == reason) {
										reasonid = result.id
									}
									return true;
								});
								log.debug('reasonid[reason]' + typeof reason, reasonid);
								loadRec.setValue({
									fieldId: 'memo',
									value: reason
								});
								loadRec.setValue({
									fieldId: 'custbody_rejectcancelreason',
									value: reasonid
								});
								if (comment)
									loadRec.setValue({
										fieldId: 'custbody_deliverycomments',
										value: comment
									});
								loadRec.save({
									enableSourcing: true,
									ignoreMandatoryFields: true
								});
							}
							values['trnId'] = trnId;
							values['status'] = status;
							values['process'] = true;
						} else {
							values['trnId'] = trnId;
							values['status'] = status;
							values['process'] = false;
						}
						mapContext.write({
							key: recordId,
							value: values
						});
					}
				}
			} catch (e) {
				log.error('ERROR', e.message)
			}
		}


		/**
		 * Defines the function that is executed when the summarize entry point is triggered. This entry point is triggered
		 * automatically when the associated reduce stage is complete. This function is applied to the entire result set.
		 * @param {Object} summaryContext - Statistics about the execution of a map/reduce script
		 * @param {number} summaryContext.concurrency - Maximum concurrency number when executing parallel tasks for the map/reduce
		 *     script
		 * @param {Date} summaryContext.dateCreated - The date and time when the map/reduce script began running
		 * @param {boolean} summaryContext.isRestarted - Indicates whether the current invocation of this function is the first
		 *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
		 * @param {Iterator} summaryContext.output - Serialized keys and values that were saved as output during the reduce stage
		 * @param {number} summaryContext.seconds - Total seconds elapsed when running the map/reduce script
		 * @param {number} summaryContext.usage - Total number of governance usage units consumed when running the map/reduce
		 *     script
		 * @param {number} summaryContext.yields - Total number of yields when running the map/reduce script
		 * @param {Object} summaryContext.inputSummary - Statistics about the input stage
		 * @param {Object} summaryContext.mapSummary - Statistics about the map stage
		 * @param {Object} summaryContext.reduceSummary - Statistics about the reduce stage
		 * @since 2015.2
		 */
		const summarize = (summaryContext) => {
			try {
				let type = summaryContext.toString();
				let totalProcess = 0;
				let errorArray = [];
				let data = '';
				let cells = new Array();
				cells[0] = 'Document';
				cells[1] = 'Status';
				data += cells + '\n';
				summaryContext.output.iterator().each(function(key, value) {
					log.debug('values', value);
					var jsonObj = JSON.parse(value)
					log.debug('value', jsonObj.recordid)
					var conf = jsonObj.process;
					if (conf == false) {
						errorArray.push({
							'tranid': jsonObj.trnId,
							'status': jsonObj.status
						})
					}
					totalProcess++;
					return true;
				});
				for (var e = 0; e < errorArray.length; e++) {
					cells[0] = errorArray[e].tranid;
					var status = (errorArray[e].status);
					cells[1] = status;
					data += cells + '"\n"';
				}
				if (errorArray.length > 0) {
					var errorfileObj = file.create({
						name: 'un-process.csv',
						fileType: file.Type.CSV,
						contents: data.replace('"', ''),
						encoding: file.Encoding.UTF_8,
						isOnline: true,
						description: 'This is Csv file',
						folder: 2333748
					});
					var errorfileId = errorfileObj.save();
					//log.debug('errorfileId',errorfileId);
				}
				// Log details about the total number of pairs saved.
				log.audit("Total Records:" + totalProcess, "Time:" + summaryContext.seconds + " | Yields : " + summaryContext.yields + "| Concurrency :" + summaryContext.concurrency + "| Usage: " + summaryContext.usage);

			} catch (e) {
				log.error('error', e)
			}

		}

		return {
			getInputData,
			map,
			summarize
		}

	});