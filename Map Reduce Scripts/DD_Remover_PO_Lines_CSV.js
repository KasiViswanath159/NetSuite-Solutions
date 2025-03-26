/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url', "N/file", "N/log", "N/task", 'N/record'],

   (runtime, search, url, file, log, task, record) => {
      'use strict';


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
         let poData = [];
         let poInfoArr = []
         let scriptObj = runtime.getCurrentScript();
         let fileId = scriptObj.getParameter({
            name: 'custscript_file_id'
         });
         let fileObj = file.load({
            id: fileId
         });
         if (fileObj == null || fileObj == '' || fileObj == undefined)
            return true;
         let arrLines = fileObj.getContents().split(/\n|\n\r/);
         let lineCount = arrLines.length;
         // loop to get all lines
         if (lineCount > 0) {
            for (let i = 1; i < lineCount - 1; i++) {
               let content = arrLines[i].split(',');
               log.debug('content', content);
               if (content[0] != null && content[0] != '') {
                  poInfoArr.push({
                     'poId': content[0],
                     'lineKey': content[1].trim(),
                     'irId': content[3]
                  });
               }
            }
         }

         /*if (poInfoArr && poInfoArr.length > 0){
             let posLineInfo = {};
             poInfoArr.forEach(poLineInfo => {
                 if (!posLineInfo.hasOwnProperty(poLineInfo.poId)){
                     posLineInfo[poLineInfo.poId] = {};
                 }
                 posLineInfo[poLineInfo.poId][poLineInfo.lineKey] = true;
             })

             for (const poId in posLineInfo){
                 poData.push({
                     poId: poId,
                     lineKey: posLineInfo[poId]
                 });
             }
         }*/
         // let groupPO=groupBy(poInfoArr,'poId');
         let groupedData = poInfoArr.reduce((results, item) => {
            results[item.poId] = results[item.poId] || [];
            results[item.poId].push(item.lineKey);
            return results;
         }, {});
         log.debug("poData", poInfoArr);
         log.debug("poData.length", groupedData);
         // Get search result and pass it to map entry point.
         return groupedData;
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
         try {
            // Usage limit 1000
            const poId = mapContext.key;
            const poDataInfo = mapContext.value && JSON.parse(mapContext.value);
            //const poId = poDataInfo.poId;
            const pendingRemoveLineInfo = poDataInfo;
            // const irId=poDataInfo.irId;
            log.debug("poDataInfo", mapContext);
            log.debug("poId", poId);
            log.debug("pendingRemoveLineInfo", pendingRemoveLineInfo);

            const sublistId = "item";
            const poRecord = record.load({
               type: record.Type.PURCHASE_ORDER,
               id: poId
            }); //
            for (let i = 0; i < poRecord.getLineCount({
                  sublistId: 'links'
               }); i++) {
               let recordId = poRecord.getSublistValue({
                  sublistId: 'links',
                  fieldId: "id",
                  line: i
               });
               let recordType = poRecord.getSublistValue({
                  sublistId: 'links',
                  fieldId: "type",
                  line: i
               });
               // let status=poRecord.getSublistValue({sublistId: 'links', fieldId: "status", line: i});

               if (recordId && recordType == 'Item Receipt') {
                  const irRecord = record.load({
                     type: 'itemreceipt',
                     id: recordId
                  }); //
                  log.debug('enter Item Receipt remove')
                  for (let line = 0; line < irRecord.getLineCount({
                        sublistId: sublistId
                     }); line++) {
                     const item = irRecord.getSublistValue({
                        sublistId: sublistId,
                        fieldId: "itemname",
                        line: line
                     }); //lineuniquekey
                     const addedbymule = irRecord.getSublistValue({
                        sublistId: sublistId,
                        fieldId: "custcol_pwc_addedbymuleboolean",
                        line: line
                     }); //lineuniquekey
                     if (addedbymule == true && pendingRemoveLineInfo.indexOf(item) != -1) {
                        log.debug('IR line' + item, addedbymule);
                        irRecord.setSublistValue({
                           sublistId: sublistId,
                           fieldId: "itemreceive",
                           line: line,
                           value: false
                        });
                     }
                  }
                  const irRecordId = irRecord.save({
                     ignoreMandatoryFields: true
                  });
                  log.debug('irRecordId', irRecordId);
               }
               if (recordId && recordType == 'Bill') {
                  log.debug('enter Bill remove')
                  let billRecord = record.load({
                     type: 'vendorbill',
                     id: recordId
                  }); //

                  for (let line = 0; line < billRecord.getLineCount({
                        sublistId: sublistId
                     }); line++) {
                     const item = billRecord.getSublistText({
                        sublistId: sublistId,
                        fieldId: "item",
                        line: line
                     }); //lineuniquekey
                     // log.debug('item',item);
                     const qty = Number(billRecord.getSublistValue({
                        sublistId: sublistId,
                        fieldId: "quantity",
                        line: line
                     })); //lineuniquekey
                     const addedbymule = billRecord.getSublistValue({
                        sublistId: sublistId,
                        fieldId: "custcol_pwc_addedbymuleboolean",
                        line: line
                     }); //lineuniquekey
                     if (addedbymule == true && pendingRemoveLineInfo.indexOf(item) != -1 && qty == 0) {
                        log.debug('bill line ' + line, addedbymule + '///' + qty + '/////' + item);
                        //try{
                        billRecord.removeLine({
                           sublistId: sublistId,
                           line: line
                        });
                        --line;
                        //}catch(e){log.error('removeLine ERROR',e)}

                     }
                  }
                  let vendorrecordId = billRecord.save({
                     ignoreMandatoryFields: true
                  });
                  log.debug('vendorrecordId', vendorrecordId);
               }
            }

            for (let k = 0; k < pendingRemoveLineInfo.length; k++) {
               mapContext.write({
                  key: poId,
                  value: pendingRemoveLineInfo[k]
               })
            }
         } catch (e) {
            log.debug("Exception on Map", e);
         }
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
         // Usage limit 5000
         try {
            let poId = reduceContext.key;
            let pendingRemoveLineInfo = reduceContext.values;

            if (poId && pendingRemoveLineInfo) {
               log.debug('pendingRemoveLineInfo' + poId, pendingRemoveLineInfo)
               const sublistId = "item";
               const poRecord = record.load({
                  type: record.Type.PURCHASE_ORDER,
                  id: poId
               }); //
               for (let line = 0; line < poRecord.getLineCount({
                     sublistId: sublistId
                  }); line++) {
                  const item = poRecord.getSublistText({
                     sublistId: sublistId,
                     fieldId: "item",
                     line: line
                  }); //lineuniquekey
                  const addedbymule = poRecord.getSublistValue({
                     sublistId: sublistId,
                     fieldId: "custcol_pwc_addedbymuleboolean",
                     line: line
                  }); //lineuniquekey
                  if (addedbymule == true && pendingRemoveLineInfo.indexOf(item) != -1) {
                     log.debug('line' + line, addedbymule + '/////' + item + '///////' + pendingRemoveLineInfo);

                     // try{
                     poRecord.removeLine({
                        sublistId: sublistId,
                        line: line
                     });
                     --line;
                     // }catch(e){log.error('removeLine ERROR',e)}

                  }
               }
               let porecordId = poRecord.save({
                  ignoreMandatoryFields: true
               });
               log.debug('porecordId', porecordId);
            }
         } catch (e) {
            log.error('ERROR', e)
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
         // Usage limit 10000
         summaryContext.mapSummary.errors.iterator().each(
            function (key, error, executionNo) {
               log.error({
                  title: 'Map error for key: ' + key + ', execution no. ' + executionNo,
                  details: JSON.stringify(error)
               });
               return true;
            }
         );
      }

      const groupBy = (arr, key) => {
         const initialValue = {};
         return arr.reduce((acc, cval) => {
            const myAttribute = cval[key];
            acc[myAttribute] = [...(acc[myAttribute] || []), cval]
            return acc;
         }, initialValue);
      };

      return {
         getInputData,
         map,
         reduce,
         summarize
      }

   });