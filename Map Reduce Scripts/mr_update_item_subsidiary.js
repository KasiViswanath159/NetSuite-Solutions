/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
var itemtype={'NonInvtPart':'noninventoryitem','InvtPart':'inventoryitem'}
define(['N/record', 'N/runtime', 'N/search','N/format'],
		/**
		 * @param{record} record
		 * @param{runtime} runtime
		 * @param{search} search
		 */
		( record, runtime, search,format) => {
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
				try{
					//load employee search
					return search.load({id:'customsearch5043'});
				}catch(e){log.error('ERROR GET INPUT ',e)}

			}

			/**
			 * Defines the function that is executed when the map entry point is triggered. This entry point is triggered automatically
			 * when the associated getInputData stage is complete. This function is applied to each key-value pair in the provided
			 * context.
			 * @param {Object} mapContext - Data collection containing the key-value pairs to process in the map stage. This parameter
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
				try{
					log.debug('ContextValue',mapContext.value);
                  
					var value     	   = JSON.parse(mapContext.value);
					//var objectValues   = value["values"];
					//var type	   = objectValues['type'].value;
					var id=mapContext.key;
                  	var recordtype= value.recordType;
					// log.debug('employee',objectValues['custentity_mcs_item'].value);
					log.debug('keys',id+"======="+recordtype);
	
							// load  the record item  
                  let recordObj=record.load({id:id,type:recordtype})
				 let lineCount=recordObj.getLineCount({
      			sublistId: 'itemvendor'
      		});
                 for(let i=0;i<lineCount;i++){
                   recordObj.setSublistValue({
      					sublistId: 'itemvendor',
      					fieldId: 'subsidiary',
      					line: i,
      					value: 41
      				});
                 }
                  if(lineCount>0){
						var recordId = recordObj.save({
          enableSourcing: true,
          ignoreMandatoryFields: true
        });
                    mapContext.write({key:recordId,value:recordId});
                    
                  }
				}catch(e){log.error('ERROR IN MAP ',e)}
			}

			/**
			 * Defines the function that is executed when the reduce entry point is triggered. This entry point is triggered
			 * automatically when the associated map stage is complete. This function is applied to each group in the provided context.
			 * @param {Object} reduceContext - Data collection containing the groups to process in the reduce stage. This parameter is
			 *     provided automatically based on the results of the map stage.
			 * @param {Iterator} reduceContext.errors - Serialized errors that were thrown during previous attempts to execute the
			 *     reduce function on the current group
			 * @param {number} reduceContext.executionNo - Number of times the reduce function has been executed on the current group
			 * @param {boolean} reduceContext.isRestarted - Indicates whether the current invocation of this function is the first
			 *     invocation (if true, the current invocation is not the first invocation and this function has been restarted)
			 * @param {string} reduceContext.key - Key to be processed during the reduce stage
			 * @param {List<String>} reduceContext.values - All values associated with a unique key that was passed to the reduce stage
			 *     for processing
			 * @since 2015.2
			 */
			const reduce = (reduceContext) => {
			
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
				try{
					var type = summaryContext.toString();
					var totalProcess  = 0;
					summaryContext.output.iterator().each(function(key, value) {
						totalProcess++;
						return true;
					});
					// Log details about the total number of pairs saved.
					log.audit("Total Records:"+totalProcess, "Time:"+summaryContext.seconds +" | Yields : "+summaryContext.yields +"| Concurrency :"+ summaryContext.concurrency +"| Usage: "+summaryContext.usage);

				}catch (e) {
					log.error('error',e)
				}
			}

			return {getInputData, map, summarize}

		});
