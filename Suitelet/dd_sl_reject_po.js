/**
 * @NApiVersion 2.x
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 */
define(['N/ui/serverWidget','N/url','N/file','N/task','N/redirect'],

		function(ui,url,file,task,redirect) {

	/**
	 * Definition of the Suitelet script trigger point.
	 *
	 * @param {Object} context
	 * @param {ServerRequest} context.request - Encapsulation of the incoming request
	 * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
	 * @Since 2015.2
	 */
	function onRequest(context) {
		try{
			if (context.request.method === 'GET') {
				var taskidString = context.request.parameters.custparam_taskid;
				log.debug('taskid',taskidString);
				/* Build the upload form. */
				var form = ui.createForm({title: 'Reject Purchase Order'});
				var fileField 		= form.addField({id: 'custpage_file',type: ui.FieldType.FILE,label: 'File'});
				fileField.isMandatory=true;
				form.addSubmitButton({label : 'Upload'});
				form.addResetButton({  label : 'Reset '});
				if(taskidString!=null && taskidString!=''){
					var currentStatus = task.checkStatus(taskidString);
					log.debug('currentStatus',currentStatus['status']);
					if(currentStatus['status'] != 'COMPLETE' && currentStatus['status'] != 'FAILED'){
						var html = '';
						html += '<html>';
						html += '<head>';
						html += '<script>function reloadPage(){setTimeout("location.reload(true);","10000");}</script>';
						html += '</head>';
						html += '<body onload="reloadPage();" style="background-color:black";>';
						html += '<div style="text-align:center;margin: 0;position: absolute;top: 50%; left: 50%;margin-right: -50%;transform: translate(-50%, -50%)">';
						html += '<p style="font-size:14pt;font-weight:bold;"><img src="https://3938860-sb2.app.netsuite.com/core/media/media.nl?id=9135517&c=3938860_SB2&h=VDTvTne2GEVKKrmDXbnYP1y3p0mfaRf5AzW04EAnVJVKCLMs"></p>';
						html += '<p style="font-size:14pt;font-weight:bold;color:white">Status : '+currentStatus['status']+'</p>';
						html += '<p style="font-size:14pt;font-weight:bold;color:white"> Your file is uploaded sucessfully.<br> Please do not upload the until the process is completed.</p>';
						html += '</div>';
						html += '</body>';
						html += '</html>';
						context.response.write(html);
					}else{
						context.response.writePage(form);
					}
				}else{
					context.response.writePage(form);	
				}   	 
			} else {
				/* 
				 * Executes when the form is submitted.
				 * Saves the file on a folder in the File Cabinet
				 */
				var csvFile = context.request.files.custpage_file;
				csvFile.folder = 2349231;
				var fileId = csvFile.save();
				log.debug('fileId',fileId);
				try {
					var mrTask = task.create({
						taskType : task.TaskType.MAP_REDUCE,
						scriptId : 'customscript_dd_mr_reject_po',
						deploymentId : 'customdeploy_dd_mr_reject_po',
						params : {custscript_dd_csv_file_id : fileId}	
					});
					var taskId = mrTask.submit();
					log.debug('taskId in post',taskId);
				} catch (error) {
					log.error('Error while submitting the task', error);
				}
				redirect.toSuitelet({
					scriptId: 'customscript_dd_sl_uploadcsvfile' ,
					deploymentId: 'customdeploy_dd_sl_uploadcsvfile',
					parameters: {'custparam_taskid':taskId} 
				});
			}
		}catch(e){log.error('ERROR ',e)}
	}
	return {
		onRequest: onRequest
	};

});
