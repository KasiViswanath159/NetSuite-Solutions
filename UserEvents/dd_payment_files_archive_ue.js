/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
 define(['N/record', 'N/runtime', 'N/search', 'N/file', 'N/format'],
 function (record, runtime, search, file, format) {

     function afterSubmit(context) {
         try {
             var executionCtx = runtime.executionContext;
             if (context.type == "create" && executionCtx == "WEBSERVICES") {
                 var recordObj = context.newRecord;
                 var fileName = recordObj.getValue("custrecord_file_name");
                 log.debug("fileName", fileName);
                 var processsingFolderId = runtime.getCurrentScript().getParameter('custscript_dd_procssing_folder_id');
                 var BackupFolderId = runtime.getCurrentScript().getParameter('custscript_dd_backup_folder_id');

                 var folderSearchObj = search.create({
                     type: "folder",
                     filters:
                         [
                             ["internalid", "anyof", processsingFolderId], // Processing Files
                             "AND",
                             ["file.name", "is", fileName]
                         ],
                     columns:
                         [
                             search.createColumn({
                                 name: "name",
                                 sort: search.Sort.ASC,
                             }),
                             search.createColumn({
                                 name: "name",
                                 join: "file",
                             }),
                             search.createColumn({
                                 name: "internalid",
                                 join: "file",
                             })
                         ]
                 });
                 var results = executeSearch(folderSearchObj);
                 log.debug("results", results);

                 if (results.length > 0) {
                     var fileId = results[0].getValue({
                         name: "internalid",
                         join: "file",
                     });
                     var fileObj = file.load({
                         id: fileId
                     });
                     fileObj.folder = BackupFolderId; // Backup folder 
                     var fileObjId = fileObj.save();

                     if (!isNullOrEmpty(fileObjId)) {
                         var jmbRecId = record.submitFields({
                             type: "customrecord_bank_details",
                             id: recordObj.id,
                             values: { "custrecord_dd_file_archive_status": true, "custrecord_dd_file_archive_date": getNSDateFormat(new Date()) },
                         });
                     }
                 }
             }
         } catch (e) {
             var msg = '';
             if (e.hasOwnProperty('message')) {
                 msg = e.name + ': ' + e.message;
                 log.error('afterSubmit - EXPECTED_ERROR', msg);
                 log.error('afterSubmit - stack', e.stack);
             } else {
                 msg = e.toString();
                 log.error('afterSubmit - UNEXPECTED_ERROR', msg);
                 log.error('afterSubmit - stack', e.stack);
             }
         }
         throw msg;
     };


     /*
* helper function to get the search results
*/
     function executeSearch(srch) {
         var results = [];

         var pagedData = srch.runPaged({
             pageSize: 1000
         });
         pagedData.pageRanges.forEach(function (pageRange) {
             var page = pagedData.fetch({
                 index: pageRange.index
             });
             page.data.forEach(function (result) {
                 results.push(result);
             });
         });
         return results;
     };

     var getNSDateFormat = function (date) {
         var date = new Date(date);
         var day = date.getDate();
         var month = date.getMonth() + 1;
         var year = date.getFullYear();
         var formattedDate = month + "/" + day + "/" + year;
         return format.parse({
             value: formattedDate.toString(),
             type: format.Type.DATE
         });
     };

     function getNSFormatDate(date) {
         var parseDate = format.parse({
             value: date.toString(),
             type: format.Type.DATE
         });
         return parseDate;
     }

     /*
    * Validating if value is null or empty
    */
     function isNullOrEmpty(val) {
         if (val == null || val == '' || val == "" || val == 'undefined' || val == undefined || val == [] || val == {} || val == '{}' || val == NaN) {
             return true;
         } else {
             return false;
         }
     };

     return {
         afterSubmit: afterSubmit
     };
 });
