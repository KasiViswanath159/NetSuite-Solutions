/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * 01/13/2020 Kalyani Chintala, NS Case# 4005460
 * 02/22/2021 Kalyani Chintala, NS Case# 4101298
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
			var clScriptPath = scriptObj.getParameter({name: 'custscript_ns_inv_email_cl_scrpt_path'});
			if(clScriptPath == '')
			{
				throw 'Missing client script path!';
				return;
			}

			if (context.request.method === 'GET')
			{
				var selecSrchId = utilityObj.convNull(context.request.parameters.custpage_ns_inv_email_srch_id);
				var selecEmailTmplId = utilityObj.convNull(context.request.parameters.custpage_ns_inv_email_tmpl);
				var emailFrom = scriptObj.getParameter({name: 'custscript_ns_inv_email_frm'});

				var objRequest = context.request;

				var form = serverWidget.createForm({title: 'Trigger Invoice Emails'});
				form.clientScriptModulePath = clScriptPath; //'../NetSuite/al_CS_SL_WIPItemSummaryReport_SSV2.js';//set client script.

				var stUrl = url.resolveScript({scriptId : scriptObj.id, deploymentId : scriptObj.deploymentId, returnExternalUrl : false});
				var stUrlFld = form.addField({id: 'custpage_suitelet_url', label: 'Suitelet URL', type: serverWidget.FieldType.TEXTAREA, container: 'custpage_default_fld_grp'});
				stUrlFld.updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
				stUrlFld.defaultValue = stUrl;

				var srchFld = form.addField({id: 'custpage_ns_inv_email_srch_id', type: 'select', label: 'Invoices Search', source: '-119'});
				if(srchFld != '')
					srchFld.defaultValue = selecSrchId;
				srchFld.isMandatory = true;

				var srchResultsFld = form.addField({id: 'custpage_ns_inv_email_srch_results', type: serverWidget.FieldType.TEXT, label: 'Number of Invoices'});
				srchResultsFld.updateDisplayType({displayType: 'inline'});

				var emailFromFld = form.addField({id: 'custpage_ns_inv_email_from', label: 'Email From', type: 'select', source: record.Type.EMPLOYEE});
				emailFromFld.updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});
				emailFromFld.defaultValue = emailFrom;
				emailFromFld.isMandatory = true;

				var emailTmplFld = form.addField({id: 'custpage_ns_inv_email_tmpl', label: 'Email Template', type: 'select', source: '-120'});
				//emailTmplFld.updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});
				emailTmplFld.defaultValue = selecEmailTmplId;
				emailTmplFld.isMandatory = true;

				var emailSubjFld = form.addField({id: 'custpage_ns_inv_email_subject', label: 'Email Subject', type: serverWidget.FieldType.TEXT});
				emailSubjFld.isMandatory = true;

				var emailBodyFld = form.addField({id: 'custpage_ns_inv_email_body', label: 'Email Subject', type: serverWidget.FieldType.RICHTEXT});
				emailBodyFld.isMandatory = true;

				if(selecEmailTmplId != '')
				{
					var emailTmplRec = record.load({type: record.Type.EMAIL_TEMPLATE, id: selecEmailTmplId});
					var email_subject = emailTmplRec.getValue('subject');
					var email_content = emailTmplRec.getValue('content');
					emailSubjFld.defaultValue = email_subject;
					emailBodyFld.defaultValue = email_content;
				}

				//log.debug('Checking', 'Adding button Export');
				form.addSubmitButton({label: 'Submit'});
				context.response.writePage(form);
				return;
			}
			else
			{
				var selecSrchId = utilityObj.convNull(context.request.parameters.custpage_ns_inv_email_srch_id);
				var emailFrom = utilityObj.convNull(context.request.parameters.custpage_ns_inv_email_from);
				var selecEmailTmplId = utilityObj.convNull(context.request.parameters.custpage_ns_inv_email_tmpl);
				var emailBody = utilityObj.convNull(context.request.parameters.custpage_ns_inv_email_body);
				var emailSubj = utilityObj.convNull(context.request.parameters.custpage_ns_inv_email_subject);
				if(selecSrchId == '' || emailFrom == '' || selecEmailTmplId == '' || emailBody == '' || emailSubj == '')
				{
					throw 'Missing required values submission!';
					return;
				}

				//Generate ad-hoc email template
				var tmplRec = record.copy({type: record.Type.EMAIL_TEMPLATE, id: selecEmailTmplId});
				log.debug({title: 'Checking', details: 'Time: ' + (new Date().getTime())});
				log.debug({title: 'Checking', details: 'New Name: (Used In Script,DoNotUse)Invoice Email Customized_' + (new Date().getTime())});
				tmplRec.setValue({fieldId: 'name', value: '(Used In Script,DoNotUse)Invoice Email Customized_' + (new Date().getTime())});
				tmplRec.setValue({fieldId: 'scriptid', value: '_dummy_' + (new Date().getTime())});
				tmplRec.setValue({fieldId: 'content', value: emailBody});
				tmplRec.setValue({fieldId: 'subject', value: emailSubj});
				var newTmplRecId = tmplRec.save({ignoreMandatoryFields: true, enableSourcing: false});
				log.debug({title: 'Checking', details: 'Newly created Template Id: ' + newTmplRecId});

				var outputHtml = '<p>Invoice Email Process triggered</p>';
				try{
					var invEmailProcScript = task.create({taskType: task.TaskType.MAP_REDUCE});
					invEmailProcScript.scriptId = 'customscript_ns_inv_emails_proc';
					//invEmailProcScript.deploymentId = 'customdeploy_ns_inv_emails_proc';
					var params = {'custscript_ns_inv_email_tmpl': newTmplRecId, 'custscript_ns_inv_email_srch': selecSrchId, 'custscript_ns_inv_email_body': emailBody, 'custscript_ns_inv_email_subject': emailSubj};
					invEmailProcScript.params = params;
					var taskStatus = invEmailProcScript.submit();
					log.debug({title: 'Status', details: taskStatus});
				}catch(er){
					outputHtml = '<p style="color: red;">Error occurred while triggering Invoice Email process!' + er.message + '</p>';
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