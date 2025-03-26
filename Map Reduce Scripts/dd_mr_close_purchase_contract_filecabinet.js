/**
 *@NApiVersion 2.x
 *@NScriptType MapReduceScript
 */
var Error_List = [];
const ERROR_FOLDER = 1792035
define(['N/record', 'N/search', 'N/runtime', 'N/file', 'N/email'], function(record, search, runtime, file, email) {

    function getInputData() {

        var csvFiles = getCSVFiles();
        log.debug('csvFiles.length', csvFiles.length);

        if (csvFiles.length > 0) {
            var batches = csvFiles.map(convertCSVtoJSON);

            return batches;
        } else {
            log.debug('File Not Found', 'File Not Found');
            return null;
        }


    }


    function convertCSVtoJSON(fileid) {
        var csvFile = file.load({
            id: fileid
        }).getContents().split(/\n|\n\r/);

        //  log.debug('csvFile', JSON.stringify(csvFile));

        var iterator = csvFile.length;
        var getProcessRowList = [];
        var errors = [];
        //  log.debug('iterator', JSON.stringify(iterator));
        for (var y = 1; y < iterator; y++) {

            if (csvFile[y] == "") {
                continue;
            }
            //split each line by the column delimiter
            var tempRowList = csvFile[y].split(',');

           // log.debug("tempRowList", tempRowList);
            // log.debug("In input", tempRowList);
            //getProcessRowList.push(tempRowList);

            //Get Item Internal Id  Start
            var listOfRecords = tempRowList[1];


          //  log.debug("listOfRecords", listOfRecords)

            if (!listOfRecords) {
                errors.push({
                    line: y,
                    dump: tempRowList,
                    reason: "listOfRecords name issue"
                })
                continue;
            }


                var getContractFullName = listOfRecords;
           // log.debug("getContractFullName", getContractFullName)

                var finalContractName=getContractFullName.substring(getContractFullName.lastIndexOf("#") + 1);
          //  log.debug("finalContractName", finalContractName)

               var purchasecontractSearchObj = search.create({
               type: "purchasecontract",
               filters:
               [
                  ["type","anyof","PurchCon"], 
                  "AND", 
                  ["number","equalto",finalContractName], 
                  "AND", 
                  ["mainline","is","T"]
               ],
               columns:
               [
                  search.createColumn({name: "trandate", label: "Date"}),
                  search.createColumn({name: "tranid", label: "Document Number"})
               ]
            });


            var find_Record_Search = purchasecontractSearchObj.run().getRange({
                start: 0,
                end: 1000
            });
            var getRecordId;
           //  log.debug('getRecordId', getRecordId)


            if (find_Record_Search.length > 0) {
                getRecordId = find_Record_Search[0].id;
            } else {


                errors.push({
                    line: y,
                    dump: tempRowList,
                    reason: "item not found"
                })
                continue;
            }
           //  log.debug('getRecordId', getRecordId);


            if (tempRowList.length > 0) {

                getProcessRowList.push({
                    'record_id': getRecordId,
                     "fileid": fileid
                    
                   
                });
            } else {
                continue
            }
        }

        Error_List = Error_List.concat(errors);

        log.debug("errors", Error_List);

        if (Error_List.length > 0) {
            saveError(Error_List, ERROR_FOLDER, fileid)
        }

    
        return getProcessRowList;

    }

    function saveError(errorlist, folder, name) {

        var fileObj = file.create({
            name: name + '_errors.csv',
            fileType: file.Type.PLAINTEXT,
            contents: jsontocsv(errorlist)
        });

        fileObj.folder = folder;

        var id = fileObj.save();
    }

    function jsontocsv(json) {
         log.debug("json", json);
        if (Array.isArray(json) && json.length > 0) {
            var fields = Object.keys(json[0])
            var replacer = function(key, value) {
                return value === null ? '' : value
            }
            var csv = json.map(function(row) {
                return fields.map(function(fieldName) {
                    return JSON.stringify(row[fieldName], replacer)
                }).join(',')
            })
            csv.unshift(fields.join(',')) // add header column
            csv = csv.join('\r\n');
            return csv;
        }
        return ""

    }

    function groupBy(xs, key) {
        return xs.reduce(function(rv, x) {
            (rv[x[key]] = rv[x[key]] || []).push(x);
            return rv;
        }, {});
    };


    function map(context) {

        try {


            var getProcessRowList = JSON.parse(context.value);
            //log.debug("getProcessRowList", getProcessRowList);

            var recordCount=getProcessRowList.length;

            // var script = runtime.getCurrentScript();

            // var getSelectedDate = script.getParameter("custscript_script_select_date");
            // log.debug("getSelectedDate", getSelectedDate);

            for(i=0;i<recordCount;i++){

                 var getRecordId=  getProcessRowList[i].record_id;


             //Load  Record

                            var loadRecord = record.load({
                                type:'purchasecontract',
                                id: getRecordId,
                                isDynamic: true
                            });

                           // log.debug("loadRecord", JSON.stringify(loadRecord));

                               
                            // loadRecord.setValue({
                            //     fieldId: "enddate",
                            //     value: getSelectedDate
                            // });

                              loadRecord.setValue({
                                fieldId: "custbody_pwc_buyer",
                                value: '6229353'
                            });

                            var updatedRecord = loadRecord.save({
                                ignoreMandatoryFields: true,
                                enableSourcing: true
                            });
                            log.debug('updatedRecord', JSON.stringify(updatedRecord));

}

                                //move the file to archived
            var csvfile = file.load({
                id: getProcessRowList[0].fileid
            });

            var date = new Date();
            csvfile.name = date.toISOString() + csvfile.name
            csvfile.folder = 1792034

            csvfile.save();

            log.debug('File Moved','File Moved');


        } catch (e) {

            log.debug("error", e);
            Error_List.push({
                line: 0,
                dump: "",
                reason: "Record not found",
                exception: JSON.stringify(e)
            })

            //move the file to error
            var csvfile = file.load({
                id: getProcessRowList[0].fileid
            });

            var date = new Date();
            csvfile.name = date.toISOString() + "issue_in_file" + csvfile.name
            csvfile.folder = ERROR_FOLDER

            csvfile.save();
        }

    }



    function summarize(context) {
            var scriptObj = runtime.getCurrentScript();
        log.debug({
            title: "Remaining usage units: ",
            details: scriptObj.getRemainingUsage()
        });
        //  log.debug("summary", context);
        if (Error_List.length > 0)
            saveError(Error_List, ERROR_FOLDER, "errors");
    }


    function getCSVFiles() {
        var filecol = search.createColumn({
            name: "internalid",
            join: "file",
            label: "Internal ID"
        })

        var folderSearchObj = search.create({
            type: "folder",
            filters: [
                ["internalidnumber", "equalto", "1792033"]
            ],
            columns: [
                search.createColumn({
                    name: "name",
                    join: "file",
                    label: "Name"
                }),
                filecol
            ]
        });
        var searchResult = folderSearchObj.run().getRange({
            start: 0,
            end: 1000
        });

        log.debug("searchResult", JSON.stringify(searchResult));

        var result = [];

        for (var i = 0; i < searchResult.length; i++) {
            
           // log.debug("For result", searchResult[i].getValue(filecol));

            if (searchResult[i].getValue(filecol)) {

                //log.debug("inside searchResult if", "inside searchResult if");

                result.push(searchResult[i].getValue(filecol));
            }

        }
       // log.debug("result", result);

        return result;
    }


    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    }
});