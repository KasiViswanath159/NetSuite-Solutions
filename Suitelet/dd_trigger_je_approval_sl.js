/**
 * @NApiVersion 2.0
 * @NScriptType Suitelet
 * @NModuleScope SameAccount
 *
 * 
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

			if (context.request.method === 'GET')
			{
				var selecSrchId = utilityObj.convNull(context.request.parameters.custpage_ns_inv_appr_srch_id);				

				var objRequest = context.request;

				var form = serverWidget.createForm({title: 'Trigger JE Approvals'});
				form.clientScriptModulePath = 'SuiteScripts/dd_trigger_je_approval_cs.js';
				
				var stUrl = url.resolveScript({scriptId : scriptObj.id, deploymentId : scriptObj.deploymentId, returnExternalUrl : false});
				var stUrlFld = form.addField({id: 'custpage_suitelet_url', label: 'Suitelet URL', type: serverWidget.FieldType.TEXTAREA, container: 'custpage_default_fld_grp'});
				stUrlFld.updateDisplayType({displayType: serverWidget.FieldDisplayType.HIDDEN});
				stUrlFld.defaultValue = stUrl;

				var srchFld = form.addField({id: 'custpage_ns_inv_appr_srch_id', type: 'text', label: 'JE Search'});
				srchFld.defaultValue = "JE Approval [Used in Script]";
				srchFld.updateDisplayType({displayType: 'inline'});

				var countJe = getCount();
				var srchResultsFld = form.addField({id: 'custpage_ns_je_appr_srch_results', type: serverWidget.FieldType.INTEGER, label: 'Number of JEs'});
				srchResultsFld.defaultValue = countJe;
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

				var outputHtml = '<p>JE  Approval Process triggered</p>';
				try{
					var invApprProcScript = task.create({taskType: task.TaskType.MAP_REDUCE});
					invApprProcScript.scriptId = 'customscript_dd_approve_journal_mr';
					var params = {'custscript_je_search_id': 'customsearch_je_approval'};
					invApprProcScript.params = params;
					var taskStatus = invApprProcScript.submit();
					log.debug({title: 'Status', details: taskStatus});
				}catch(er){
					outputHtml = '<p style="color: red;">Error occurred while triggering JE Approval process!' + er.message + '</p>';
				}
				var form = serverWidget.createForm({title: 'Trigger JE Emails'});
				var outputHtmlFld = form.addField({id: 'custpage_ns_inv_email_from', label: 'Output', type: serverWidget.FieldType.TEXT});
				outputHtmlFld.updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});
				outputHtmlFld.defaultValue = outputHtml;

				var countFld = form.addField({id: 'custpage_count', label: 'Record Processed Count', type: serverWidget.FieldType.TEXT});
				countFld.updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});
				countFld.defaultValue = getCount()+'/'+getCount();

				var messageFld = form.addField({id: 'custpage_message', label: 'Message', type: serverWidget.FieldType.TEXT});
				messageFld.updateDisplayType({displayType: serverWidget.FieldDisplayType.INLINE});
				messageFld.defaultValue = 'Journal are Processed within few minutes you will receive an email';



				context.response.writePage(form);
				return;
			}
		}
		
		function getCount(){
			
			var mySearch = search.load({
							id: 'customsearch_je_approval'
						});
			var searchResultCount = mySearch.runPaged().count;
				log.debug("mySearch result count",searchResultCount);
				
					return Number(searchResultCount);
				
				
			
			
			
			
			// var journalentrySearchObj = search.create({
				   // type: "journalentry",
				   // filters:
				   // [
					  // ["type","anyof","Journal"], 
					  // "AND", 
					  // ["datecreated","within","thisyear"], 
					  // "AND", 
					  // ["linesequencenumber","equalto","0"], 
					  // "AND", 
					  // ["createdby","anyof","166528"], 
					  // "AND", 
					  // ["custbody2","anyof","1"], 
					  // "AND", 
					  // ["approvalstatus","anyof","1"]
				   // ],
				   // columns:
				   // [
					  // "entity",
					  // "tranid",
					  // "approvalstatus",
					  // "custbody2"
				   // ]
				// });
				// var searchResultCount = journalentrySearchObj.runPaged().count;
				// log.debug("journalentrySearchObj result count",searchResultCount);
				// return searchResultCount;
				
				
				
		}

		return {
			onRequest: onRequest
		};

	});