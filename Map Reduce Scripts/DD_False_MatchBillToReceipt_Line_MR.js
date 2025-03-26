/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/runtime', 'N/search', 'N/url', "N/redirect", "N/log", "N/task", 'N/record', 'N/query', 'N/format'],

    (runtime, search, url, redirect, log, task, record, query, format) => {
        'use strict';

        const getSuiteQLPageData = (suiteQL, asMappingResult, pageInfo, pageSize) => {
            if (!suiteQL || !suiteQL.match(/(?<=select)(\s|.)+?(?=from)/ig)) {
                return "";
            }
            const columnInfoArr = suiteQL.replace(/(\/|--).*?\n/g, "").match(/(?<=select)(\s|.)+?(?=from)/ig)[0].match(/[^\s]+?(?=,)|[^\s]+\s*$/g);
            const columnsIndexNameMapping = {};
            columnInfoArr && columnInfoArr.forEach((name, index) => {
                let correctName = /\(|\)/.test(name) ? name.replace(/`/g, "") : name.replace(/['\s]/g, "").replace(/.*\./, "");
                columnsIndexNameMapping[correctName] = index;
            });
            let queryResults = query.runSuiteQLPaged( {query: suiteQL, pageSize: (pageInfo && pageInfo.pageSize) || pageSize || 1000} );
            const iterator = queryResults.iterator();
            // Result total counts
            // queryResults.count;
            let pageDataArr = [];
            iterator && iterator.each(pageResult => {
                // query.page
                const currentPage = pageResult.value;
                // query.pagedata   The set of paged query results that this page is from.  {fetch: xxx, iterator(): xxxxx, count: xxxxx, pageRanges: xxxxx, size: xxxx}
                // const currentPageDataInfo = currentPage.pagedData;
                let matchedPage = false;
                // query.pageRange  {index: current page location index, size: current page data total count}
                const currentPageRange = currentPage.pageRange;
                if (pageInfo) {
                    if (pageInfo.pageNum && currentPageRange.index == pageInfo.pageNum - 1) {
                        // Get Specify page data
                        matchedPage = true;
                    }
                    if (pageInfo.getFirst && currentPageRange.isFirst) {
                        // Get the first page data
                        matchedPage = true;
                    }
                    if (pageInfo.getLast && currentPageRange.isLast) {
                        // Get the last page data
                        matchedPage = true;
                    }
                } else {
                    // Get all data
                    matchedPage = true;
                }

                if (matchedPage) {
                    // The query results contained in this page.
                    const currentPageData = currentPage.data;
                    if (asMappingResult) {
                        const currentResults = currentPageData.results;
                        currentResults && currentResults.length > 0 && currentResults.forEach(currentLineValuesInfo => {
                            const currentLineData = {};
                            currentLineValuesInfo && currentLineValuesInfo.values && currentLineValuesInfo.values.forEach((value, index) => {
                                const name = columnInfoArr[index];
                                let correctName = /\(|\)/.test(name) ? name.replace(/`/g, "") : name.replace(/['\s]/g, "").replace(/.*\./, "");
                                currentLineData[correctName] = value;
                            });
                            pageDataArr.push(currentLineData);
                        });
                    } else {
                        if (currentPageData.results && currentPageData.results.length > 0) {
                            currentPageData.results.forEach(columnsValueInfo => {
                                const columnValuesArr = columnsValueInfo.values;
                                columnValuesArr.length == 1 ? pageDataArr.push(columnValuesArr[0]) : pageDataArr.push(columnValuesArr);
                            })

                        }
                    }
                }

                return true;
            });

            return asMappingResult ? pageDataArr : {colNameIndexMapping: columnsIndexNameMapping, valueArr: pageDataArr};
        };

        const getPurchaseOrderIdArr = () => {
            const currentScript = runtime.getCurrentScript();
            var dueDateFrom = currentScript.getParameter({name: "custscript_dd_duedate_from"});
            dueDateFrom = format.format({value:new Date(dueDateFrom), type: format.Type.DATE});
            var dueDateTo = currentScript.getParameter({name: "custscript_dd_duedate_to"});
            dueDateTo = format.format({value:new Date(dueDateTo), type: format.Type.DATE});
            let suiteQL = `
                select
                    DISTINCT
                    tl.transaction poid
                from transactionLine tl
                     left join NextTransactionLineLink ntl on ntl.previousline = tl.id and ntl.previousdoc = tl.transaction and nexttype = 'VendBill'
                     LEFT JOIN transaction th on th.id = tl.transaction
                     left join item on item.id = tl.item
                where
                    th.type = 'PurchOrd'
                    AND th.trandate >= TO_DATE('4/1/2021', 'MM/DD/YYYY')
                    AND tl.subsidiary in (5, 24, 27, 41)
                    AND tl.matchbilltoreceipt = 'T'
                    and tl.mainline = 'F'
                    and tl.iscogs = 'F'
                    and tl.taxline = 'F'
                    and ntl.nextdoc is null
            `;
            // AND th.duedate >= TO_DATE('4/1/2021', 'MM/DD/YYYY')
            // AND th.duedate <= TO_DATE('10/01/2022', 'MM/DD/YYYY')
            if (dueDateFrom) {
                suiteQL += ` and th.duedate >= to_date('${dueDateFrom}', 'MM/DD/YYYY')`
            }
            if (dueDateFrom) {
                suiteQL += ` and th.duedate <= to_date('${dueDateTo}', 'MM/DD/YYYY')`
            }
            log.debug("suiteQL", suiteQL);
            const poIdInfo = getSuiteQLPageData(suiteQL);
            return poIdInfo ? poIdInfo.valueArr : [];
        }

        const getLinesNonLinkedBill = (poId) => {
            let suiteQL = `
                select
                    tl.id line,
                    tl.item itemid,
                    tl.transaction poid,
                    item.itemid DDId
                from transactionLine tl
                    left join NextTransactionLineLink ntl on ntl.previousline = tl.id and ntl.previousdoc = tl.transaction and nexttype = 'VendBill'
                    left join item on item.id = tl.item
                where tl.transaction = ${poId}
                  and tl.mainline = 'F'
                  and tl.iscogs = 'F'
                  and tl.taxline = 'F'
                  and ntl.nextdoc is null
                `;
            // let records = [];
            // let moreRecords = true;
            // let paginatedRowBegin = 0;
            // do {
            //     var queryResults = query.runSuiteQL( {query: suiteQL} ).asMappedResults();
            //     records = records.concat(queryResults);
            //     if ( queryResults.length < 5000 ) {
            //         moreRecords = false;
            //     }
            //     paginatedRowBegin = paginatedRowBegin + 5000;
            // } while ( moreRecords );
            //

            const records = getSuiteQLPageData(suiteQL, true);

            const poLineInfo = {};
            records && records.length > 0 && records.forEach(lineInfo => {
                poLineInfo[lineInfo.line] = {
                    line: lineInfo.line,
                    item: lineInfo.itemId
                };
            });
            return poLineInfo;
        }

        const correctLine = (poId) => {
            if (poId){
                const nonBilledLineInfo = getLinesNonLinkedBill(poId);
                const poRecord = record.load({type: record.Type.PURCHASE_ORDER, id: poId});
                const sublistId = "item";
                const itemCounts = poRecord.getLineCount({sublistId: sublistId});
                let poChanged = false;
                for (let index = 0; index < itemCounts; index++) {
                    const line = poRecord.getSublistValue({sublistId: sublistId, fieldId: "line", line: index});
                    const matchBillToReceipt = poRecord.getSublistValue({sublistId: sublistId, fieldId: "matchbilltoreceipt", line: index});
                    if (nonBilledLineInfo && nonBilledLineInfo.hasOwnProperty(line) && matchBillToReceipt) {
                        //CLOSED
                        poRecord.setSublistValue({sublistId: sublistId, fieldId: "matchbilltoreceipt", value: false, line: index});
                        poChanged = true;
                    }
                }
                if (poChanged) {
                    poRecord.save({ignoreMandatoryFields: true});
                    log.audit("success:" + poId, nonBilledLineInfo);
                }
            }
        }

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
                let poIdArr = getPurchaseOrderIdArr();
                log.debug("poIdArr.length", poIdArr && poIdArr.length);
                // Get search result and pass it to map entry point.
                return poIdArr;
            } catch (e) {
                log.error("Exception on getInputData entry point", e);
            }
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
            // Usage limit 1000
            const poId = mapContext.value;
            if (poId) {
                mapContext.write({
                    key: poId,
                    value: poId
                });
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
            const startTime = new Date().getTime();
            const poId = reduceContext.key;
            try {
                // update po
                correctLine(poId);
            } catch (e) {
                log.error("Exception on reduce entry point for poId:" + poId, e);
                if (e.name == "UNEXPECTED_ERROR") {
                    correctLine(poId);
                }
            } finally {
                const endTime = new Date().getTime();
                const secondsOfProcessing = Math.floor((endTime - startTime)/1000);
                log.debug("secondsOfProcessing for poId:" + poId, secondsOfProcessing);
                reduceContext.write({
                    key: poId,
                    value: poId
                });
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

            let countOld = 0;
            summaryContext.output.iterator().each((key, poIdArr) => {
                ++countOld;
                return true;
            });
            log.audit("Old Count", countOld);
            let poIdArr = getPurchaseOrderIdArr();
            log.audit("Remaining Count", poIdArr ? poIdArr.length : 0);
            if (poIdArr && poIdArr.length > 0 && countOld > 0 && poIdArr.length < countOld) {
                log.audit("Retrigger MR again", `Old count: ${countOld}   Remaining count: ${poIdArr.length}`);
                const currentScript = runtime.getCurrentScript();
                const mrTask = task.create({
                    taskType: task.TaskType.MAP_REDUCE,
                    scriptId: currentScript.id,
                    deploymentId: currentScript.deploymentId,
                    params: {
                        custscript_dd_duedate_from: currentScript.getParameter({name: "custscript_dd_duedate_from"}),
                        custscript_dd_duedate_to: currentScript.getParameter({name: "custscript_dd_duedate_to"})
                    }
                });
                mrTask && mrTask.submit();
            }
        }

        return {getInputData, map, reduce, summarize}

    });
