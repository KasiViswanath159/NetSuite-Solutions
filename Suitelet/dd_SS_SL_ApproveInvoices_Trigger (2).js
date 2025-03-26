/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * 08/13/2021 Kalyani Chintala, NS Case# 4151676
 *
 */
define(['N/error', 'N/https', 'N/record', 'N/runtime', 'N/search', 'N/task', 'N/ui/serverWidget', 'N/url', 'SuiteScripts/NetSuite/dd_UtilityFunctions_SSV2.js'],
	/**
	 * @param {error} error
	 * @param {https} https
	 * @param {record} record
	 * @param {runtime} runtime
	 * @param {search} search
	 * @param {transaction} transaction
	 * @param {serverWidget} serverWidget
	 * @param {url} url
	 */
	function(error, https, record, runtime, search, task, serverWidget, url, utilityObj) {

		/**
		 * Definition of the Suitelet script trigger point.
		 *
		 * @param {Object} context
		 * @param {ServerRequest} context.request - Encapsulation of the incoming request
		 * @param {ServerResponse} context.response - Encapsulation of the Suitelet response
		 * @Since 2015.2
		 */
		function onRequest(context)
		{
			var scriptObj = runtime.getCurrentScript();//script parameter object.
			var clScriptPath = scriptObj.getParameter({name: 'custscript_ns_inv_appr_cl_scrpt_path'});
			if(clScriptPath == '')
			{
				throw 'Missing client script path!';
				return;
			}

			if (context.request.method === 'GET')
			{
				var selecSrchId = utilityObj.convNull(context.request.parameters.custpage_ns_inv_appr_srch_id);				

				var objRequest = context.request;

				var form = serverWidget.createForm({title: 'Trigger Invoice Approvals'});
				form.clientScriptModulePath = clScriptPath; //'../NetSuite/al_CS_SL_WIPItemSummaryReport_SSV2.js';//set client script.

				var stUrl = url.resolveScript({scriptId : scriptObj.id, deploymentId : scriptObj.deploymentId, returnExternalUrl : false});
				var stUrlFld = form.addField({id: 'custpage_suitelet_url', label: 'Suitelet URL', type: serverWidget.FieldType.TEXTAREA, container: 'custpage_default_fld_grp'});
				stUrlFld.updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
				stUrlFld.defaultValue = stUrl;

				var srchFld = form.addField({id: 'custpage_ns_inv_appr_srch_id', type: 'select', label: 'Invoices Search', source: '-119'});
				if(srchFld != '')
					srchFld.defaultValue = selecSrchId;
				srchFld.isMandatory = true;

				var srchResultsFld = form.addField({id: 'custpage_ns_inv_appr_srch_results', type: serverWidget.FieldType.TEXT, label: 'Number of Invoices'});
				srchResultsFld.updateDisplayType({displayType: 'inline'});

				//log.debug('Checking', 'Adding button Export');
				form.addSubmitButton({label: 'Submit'});
				context.response.writePage(form);
				return;
			}
			else
			{
				var selecSrchId = utilityObj.convNull(context.request.parameters.custpage_ns_inv_appr_srch_id);
				if(selecSrchId == '')
				{
					throw 'Missing required values submission!';
					return;
				}

				var outputHtml = '<p>Invoice Approval Process triggered</p>';
				try{
					var invApprProcScript = task.create({taskType: task.TaskType.MAP_REDUCE});
					invApprProcScript.scriptId = 'customscript_ns_inv_appr_proc';
					var params = {'custscript_ns_inv_appr_srch': selecSrchId};
					invApprProcScript.params = params;
					var taskStatus = invApprProcScript.submit();
					log.debug({title: 'Status', details: taskStatus});
				}catch(er){
					outputHtml = '<p style="color: red;">Error occurred while triggering Invoice Approval process!' + er.message + '</p>';
				}
				var form = serverWidget.createForm({title: 'Trigger Invoice Emails'});
				var outputHtmlFld = form.addField({id: 'custpage_ns_inv_email_from', label: 'Output', type: serverWidget.FieldType.TEXT});
				outputHtmlFld.updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});
				outputHtmlFld.defaultValue = outputHtml;
				context.response.writePage(form);
				return;
			}
		}

		return {
			onRequest: onRequest
		};

	});