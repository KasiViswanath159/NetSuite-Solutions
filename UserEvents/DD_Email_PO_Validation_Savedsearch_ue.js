/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define(['N/email', 'N/log', 'N/query', 'N/record', 'N/runtime', 'N/search'],
    /**
 * @param{email} email
 * @param{log} log
 * @param{query} query
 * @param{record} record
 * @param{runtime} runtime
 * @param{search} search
 */
    (email, log, query, record, runtime, search) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {
            const newRecord = scriptContext.newRecord;
            const sublistId = "item";
            const lineCount = newRecord.getLineCount({sublistId: sublistId});
            const itemsInfo = {};
            for (let lineIndex = 0; lineIndex < lineCount; lineIndex++){
                const itemId = "'" + newRecord.getSublistValue({sublistId: sublistId, fieldId: "item", line: lineIndex}) + "'";
                if (itemsInfo.hasOwnProperty(itemId)){
                    itemsInfo[itemId] = true;
                } else {
                    itemsInfo[itemId] = false;
                }
            }
            sendEmailForPOSavedsearch(newRecord, Object.keys(itemsInfo));
        }

        function sendEmailForPOSavedsearch(poRecord, itemIdArr){
            log.debug("itemIdArr", itemIdArr);
            var emailContent = getSavedSearchData(poRecord, itemIdArr);
            log.debug("emailContent", emailContent);
            emailContent && email.send({
                author: "500365",// Nicholas Horowitz
                recipients: "3069442", // sukra x zhang
                cc: ["500365"],
                subject: "Test Savedsearch Result Html Template Final",
                body: emailContent
            });
        };

        function addExtraFilter(searchInstant, paramInfo){
            searchInstant.filters.unshift(search.createFilter({name: "internalid", operator: search.Operator.ANYOF, values: paramInfo.id}));
        }

        function padCustom(pendingPadStr, length, padStr, isPadStart){
            pendingPadStr = pendingPadStr + "";
            if (pendingPadStr.length < length){
                var padString = "";
                for (var index = 0; index < length - pendingPadStr.length; index++){
                    padString += (padStr ? padStr : "&nbsp;");
                }
                if (isPadStart){
                    pendingPadStr = padString + pendingPadStr;
                } else {
                    pendingPadStr += padString;
                }
            }

            return pendingPadStr;
        }

        function getSavedSearchResultHtml(searchInstant, poId, searchTitle, ignoreContent){
            var tableHtml = "";
            if (ignoreContent){
                // Add column label line
                addExtraFilter(searchInstant, {id: poId});
                var result = getAllData(searchInstant, "", true);
                if (result && result.length > 0){
                    tableHtml = '<div>' + searchTitle + '</div><hr/><br/>';
                }
            } else {
                tableHtml = '<div>' + searchTitle + '</div><table>';

                // Add title line
                tableHtml += '<thead><tr>';
                searchInstant.columns.forEach(function(colInfo){
                    var columnName = colInfo.label || colInfo.name;
                    tableHtml += ('<th align="center">' + columnName + '</th>');
                });
                tableHtml += '</tr></thead>';

                // Add column label line
                addExtraFilter(searchInstant, {id: poId});
                var result = getAllData(searchInstant, "", true);
                result && result.length > 0 && result.forEach(function (columnValueArr) {
                    tableHtml += '<tr>';
                    columnValueArr.forEach(function (columnValue) {
                        tableHtml += ('<td align="center" line-height="150%"><p>' + columnValue + '</p></td>');
                    });
                    tableHtml += '</tr>';
                });
                tableHtml += '</table><hr/><br/>';
            }
            log.debug("tableHtml", tableHtml);
            return tableHtml;
        }

        function getDataFromSuiteQL(suiteQl, searchTitle, columnsLabelArr){
            var tableHtml = '<div>' + searchTitle + '</div><table>';

            // Add title line
            tableHtml += '<thead><tr>';
            columnsLabelArr.forEach(function(columnName){
                tableHtml += ('<th align="center">' + columnName + '</th>');
            });
            tableHtml += '</tr></thead>';

            // Add column label line
            var resultSet = query.runSuiteQL({query: suiteQl});
            // query.result[]
            var resultArr = resultSet.results;
            resultArr && resultArr.forEach(function (result) {
                const columnValueArr = result.values;
                tableHtml += '<tr>';
                columnValueArr.forEach(function (columnValue) {
                    tableHtml += ('<td align="center" line-height="150%"><p>' + columnValue + '</p></td>');
                });
                tableHtml += '</tr>';
            })
            tableHtml += '</table><hr/><br/>';
            log.debug("tableHtml", tableHtml);
            return tableHtml;
        }

        function getSavedSearchData(poRecord, itemIdArr) {
            try {
                const poId = poRecord.id;
                log.debug("poId", poId);
                if (poId){
                    var data = '<html lang="ru=RU" xml:lang="ru-RU"><head></head><body>';
                    var searchTitle = "DDE Export PO Lines Pending Receipt w Duplicate SKUs(24 Hours)";
                    var searchInstant = search.load({type: search.Type.PURCHASE_ORDER, id: "customsearch_dd_po_line_duplicate_sku"});
                    data += getSavedSearchResultHtml(searchInstant, poId, searchTitle);

                    searchTitle = "DDE POs Purchase prices are often missing or inaccurate";
                    searchInstant = search.load({type: search.Type.PURCHASE_ORDER, id: "customsearch_dd_missing_inaccurate_rate"});
                    data +=getSavedSearchResultHtml(searchInstant, poId, searchTitle);

                    searchTitle = "DDE Price More Than 10% of WAC";
                    searchInstant = search.load({type: search.Type.PURCHASE_ORDER, id: "customsearch_dd_more_than_10_wac"});
                    data += getSavedSearchResultHtml(searchInstant, poId, searchTitle);

                    searchTitle = "DDE Quantity like Upc Code";
                    searchInstant = search.load({type: search.Type.PURCHASE_ORDER, id: "customsearch_dd_item_qty_like_upc_code"});
                    data += getSavedSearchResultHtml(searchInstant, poId, searchTitle);

                    searchTitle = "DDE POs UPCs are missing";
                    searchInstant = search.load({type: search.Type.PURCHASE_ORDER, id: "customsearch_dd_item_upc_missing"});
                    data += getSavedSearchResultHtml(searchInstant, poId, searchTitle);

                    searchTitle = "DDE Blank Expected Receipt Date";
                    searchInstant = search.load({type: search.Type.PURCHASE_ORDER, id: "customsearch_dd_item_blank_exp_rece_date"});
                    // DDE Blank Expected Receipt Date is only 1 field {duedate} in header of PO.  So add logic to print the title if it is blank, otherwise don't print anything.
                    data += getSavedSearchResultHtml(searchInstant, poId, searchTitle, true);

                    searchTitle = "DDE POs Location is Blank";
                    searchInstant = search.load({type: search.Type.PURCHASE_ORDER, id: "customsearch_dd_item_location_blank"});
                    // DDE POs Location is Blank is only 1 field {location} in the header of PO.  So add logic to print the title if it is blank, otherwise don't print anything.
                    data += getSavedSearchResultHtml(searchInstant, poId, searchTitle, true);

                    searchTitle = "Invalid Vendor SKU";
                    var columnsLabelArr = ["Date", "PO Number", "Vendor", "Line", "DDID", "Display Name", "Vendor_SKU", "UPC Code"];
                    data += getDataFromSuiteQL(getInvalidSkuSuiteQL(poId), searchTitle, columnsLabelArr);

                    searchTitle = "Last 2 Transactions AVG Quantity Compare";
                    var columnsLabelArr = ["PO Number", "Vendor", "Tranid", "Date", "Item Id", "Location Id", "DDID", "Quantity", "Recent2AVG"];
                    data += getDataFromSuiteQL(getTwoOrdersAvgQtySuiteQL(poRecord, itemIdArr), searchTitle, columnsLabelArr);

                    data += '</body></html>';
                    return data;
                }
            } catch (e) {
                log.debug("Exception on sendEmailForPOSavedsearch method", e)
            }
        }

        function getInvalidSkuSuiteQL(poId){
            var suiteQL = "select";
            suiteQL += " th.trandate, th.trandisplayname as ponbr, vendor.altname as vendor, tl.linesequencenumber as line, item.itemid as ddid, item.displayname,";
            suiteQL += " NVL(iv.vendorcode, ' ') as Vendor_SKU, item.upccode";
            suiteQL += " from transaction th";
            suiteQL += " left join transactionLine tl on th.id = tl.transaction";
            suiteQL += " left join item on item.id = tl.item";
            suiteQL += " left join itemVendor iv on item.id = iv.item and tl.subsidiary = iv.subsidiary and th.entity = iv.vendor";
            suiteQL += " left join vendor on th.entity = vendor.id";
            suiteQL += " where";
            suiteQL += " th.type = 'PurchOrd'";
            suiteQL += " and tl.mainline = 'F'";
            suiteQL += " and tl.taxline= 'F'";
            suiteQL += " and tl.iscogs= 'F'";
            suiteQL += " and tl.isfullyshipped= 'F'";
            suiteQL += " and iv.vendorcode is null";
            // Suppress Invalid Vendor SKU Exception
            suiteQL += " and (vendor.custentity_pwc_suppressinvalidvendorsku <> 'T' or vendor.custentity_pwc_suppressinvalidvendorsku is null)";
            suiteQL += (" and th.id = " + poId);
            suiteQL += " order by th.tranid, tl.linesequencenumber";
            log.debug("suiteQL", suiteQL);
            return suiteQL;
        }

        function getTwoOrdersAvgQtySuiteQL(poRecord, itemIdArr){
            const poId = poRecord.id;
            const vendorId = poRecord.getValue({fieldId: "entity"});
            const locationId = poRecord.getValue({fieldId: "location"});
            var suiteQL = "select";
            suiteQL += " th.trandisplayname as ponbr, vendor.altname as vendor,";
            suiteQL += " th.tranid, th.trandate,tl.item as itemId,tl.location as location,item.itemid as ddid,tl.quantity as qty,avgTable.recent2AVG";
            suiteQL += " from transaction th";
            suiteQL += " left join transactionLine tl on th.id = tl.transaction";
            suiteQL += " left join item on item.id = tl.item";
            suiteQL += " left join vendor on th.entity = vendor.id";
            suiteQL += " left join";

            suiteQL += " (select vid, vendor, itemId, itemName, location, avg(qty) as recent2AVG";
            suiteQL += " from";

            suiteQL += " (select";
            suiteQL += " th.trandisplayname, th.trandate,item.itemid as itemName,vendor.altname as vendor,";
            suiteQL += " th.id as poId, vendor.id as vid,tl.item as itemId,tl.location as location,location.fullname as locationName,";
            suiteQL += " DENSE_RANK() over(partition by item.id, tl.location,vendor.id order by vendor.id,item.id,tl.location,th.trandate desc, th.id) as lineno,";
            suiteQL += " tl.quantity as qty";
            suiteQL += " from transaction th";
            suiteQL += " left join transactionLine tl on th.id = tl.transaction";
            suiteQL += " left join item on item.id = tl.item";
            suiteQL += " left join vendor on th.entity = vendor.id";
            suiteQL += " left join location on tl.location = location.id";
            suiteQL += " where";
            suiteQL += " th.type = 'PurchOrd'";
            suiteQL += (" and th.entity = " + vendorId);
            locationId && (suiteQL += (" and tl.location = " + locationId));
            suiteQL += (" and tl.item in (" + itemIdArr.join() + ")");
            suiteQL += " and tl.mainline = 'F'";
            suiteQL += " and tl.taxline= 'F'";
            suiteQL += " and tl.iscogs= 'F'";
            suiteQL += " order by vendor.id,item.id, tl.location,th.trandate desc, th.id)";

            suiteQL += " where lineno < 3";
            suiteQL += " group by vid, vendor, itemid, itemName, location";
            suiteQL += " order by vid, itemid, location)  avgTable on avgTable.itemid = tl.item and avgTable.location = tl.location and avgTable.vid = th.entity";

            suiteQL += " where";
            suiteQL += " th.type = 'PurchOrd'";
            suiteQL += (" and th.id = " + poId);
            suiteQL += " and tl.mainline = 'F'";
            suiteQL += " and tl.taxline= 'F'";
            suiteQL += " and tl.iscogs= 'F'";
            suiteQL += " order by th.id, item.id";

            log.debug("suiteQL", suiteQL);
            return suiteQL;
        }

        function getAllData(searchInstance, columnInfoArr, getTextFirst, padEndLength) {
            var resultSet = searchInstance.run();
            var dataResultArr = [];
            var processStatus = true;
            var startIndex = 0;
            var pageSize = 999;
            while (processStatus) {
                //10 unit
                var data = resultSet.getRange({start: startIndex || 0, end: startIndex + pageSize});
                if (data && data.length > 0) {
                    data.forEach(function (result) {
                        if (columnInfoArr) {
                            var outputResult = "";
                            columnInfoArr && columnInfoArr.length > 0 && columnInfoArr.forEach(function (columnInfo) {
                                if (columnInfo && columnInfo.outKey) {
                                    if (!outputResult) {
                                        outputResult = {};
                                    }
                                    outputResult[columnInfo.outKey] = columnInfo.method ? result[method](columnInfo.colInfo) : result.getValue(columnInfo.colInfo);
                                }
                            });

                            outputResult && dataResultArr.push(outputResult);
                        } else {
                            var resultArr = [];
                            result.columns.forEach(function(colInfo){
                                var columnValue = getTextFirst ?
                                    ((result.getText ? result.getText(colInfo) : "") || (result.getValue ? result.getValue(colInfo) : "")) :
                                    ((result.getValue ? result.getValue(colInfo) : "") || (result.getText ? result.getText(colInfo) : ""));
                                resultArr.push(padEndLength ? padCustom(columnValue, padEndLength) : columnValue);
                            });
                            dataResultArr.push(resultArr);
                            // dataResultArr.push(result);
                        }
                    });
                } else {
                    processStatus = false;
                }
                startIndex += pageSize;
            }
            return dataResultArr;
        }

        return {beforeLoad, beforeSubmit, afterSubmit}

    });
