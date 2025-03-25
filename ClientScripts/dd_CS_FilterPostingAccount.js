/**
 * @NApiVersion 2.x
 * @NScriptType ClientScript
 * @NModuleScope SameAccount
 *
 * 03/2/2022 Kalyani Chintala, NS Case# 4597038
 */

define(['N/currentRecord'],
	/**
	 * @param {record} record
	 * @param {serverWidget} serverWidget
	 */
	function(currentRecord) {

		/**
		 * Function to be executed after page is initialized.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.mode - The mode in which the record is being accessed (create, copy, or edit)
		 *
		 * @since 2015.2
		 */
		function pageInit(scriptContext)
		{
			var currRec = currentRecord.get();
			var stdAcctFld = currRec.getField({fieldId: 'account'});
			var custAcctFld = currRec.getField({fieldId: 'custbody_ns_acs_acct_custom'});
			if(currRec.getValue({fieldId: 'undepfunds'}) == true || currRec.getValue({fieldId: 'undepfunds'}) == 'T')
			{
				currRec.setValue({fieldId: 'account', value: '', ignoreFieldChange: false});
				currRec.setValue({fieldId: 'custbody_ns_acs_acct_custom', value: '', ignoreFieldChange: true});
				//stdAcctFld.isDisplay = true;
				custAcctFld.isDisplay = false;
			}
			else
			{
				stdAcctFld.isDisabled = true;
				custAcctFld.isDisplay = true;

				var stdAcctVal = currRec.getValue({fieldId: 'account'});
				var custAcctVal= currRec.getValue({fieldId: 'custbody_ns_acs_acct_custom'});
				if(stdAcctVal != custAcctVal)
					currRec.setValue({fieldId: 'custbody_ns_acs_acct_custom', value: stdAcctVal, ignoreFieldChange: true});
			}
		}

		/**
		 * Function to be executed when field is changed.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 * @param {string} scriptContext.fieldId - Field name
		 * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
		 * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
		 *
		 * @since 2015.2
		 */
		function fieldChanged(scriptContext)
		{
			var currRec = currentRecord.get();
			if(scriptContext.fieldId == 'undepfunds')
			{
				debugger;
				var stdAcctFld = currRec.getField({fieldId: 'account'});
				var custAcctFld = currRec.getField({fieldId: 'custbody_ns_acs_acct_custom'});
				if(currRec.getValue({fieldId: 'undepfunds'}) == true || currRec.getValue({fieldId: 'undepfunds'}) == 'T')
				{
					currRec.setValue({fieldId: 'account', value: '', ignoreFieldChange: false});
					currRec.setValue({fieldId: 'custbody_ns_acs_acct_custom', value: '', ignoreFieldChange: true});
					//stdAcctFld.isDisplay = true;
					custAcctFld.isDisplay = false;
				}
				else
				{
					stdAcctFld.isDisabled = true;
					//stdAcctFld.isDisplay = false;
					custAcctFld.isDisplay = true;
				}
			}

			if(scriptContext.fieldId == 'custbody_ns_acs_acct_custom')
			{
				debugger;
				var fldVal = currRec.getValue({fieldId: 'custbody_ns_acs_acct_custom'});
				currRec.setValue({fieldId: 'account', value: fldVal, ignoreFieldChange: false});

				//now get account value
				var stdAcctFldVal = currRec.getValue({fieldId: 'account'});
				if(stdAcctFldVal != fldVal)
				{
					alert('Selected account is invalid, please udpate your selction!');
					currRec.setValue({fieldId: 'account', value: '', ignoreFieldChange: false});
					currRec.setValue({fieldId: 'custbody_ns_acs_acct_custom', value: '', ignoreFieldChange: true});
				}
			}
		}

		/**
		 * Function to be executed when field is slaved.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 * @param {string} scriptContext.fieldId - Field name
		 *
		 * @since 2015.2
		 */
		function postSourcing(scriptContext) {

		}

		/**
		 * Function to be executed after sublist is inserted, removed, or edited.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 *
		 * @since 2015.2
		 */
		function sublistChanged(scriptContext) {

		}

		/**
		 * Function to be executed after line is selected.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 *
		 * @since 2015.2
		 */
		function lineInit(scriptContext) {

		}

		/**
		 * Validation function to be executed when field is changed.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 * @param {string} scriptContext.fieldId - Field name
		 * @param {number} scriptContext.lineNum - Line number. Will be undefined if not a sublist or matrix field
		 * @param {number} scriptContext.columnNum - Line number. Will be undefined if not a matrix field
		 *
		 * @returns {boolean} Return true if field is valid
		 *
		 * @since 2015.2
		 */
		function validateField(scriptContext) {
			return true;
		}

		/**
		 * Validation function to be executed when sublist line is committed.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 *
		 * @returns {boolean} Return true if sublist line is valid
		 *
		 * @since 2015.2
		 */
		function validateLine(scriptContext) {
			return true;
		}

		/**
		 * Validation function to be executed when sublist line is inserted.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 *
		 * @returns {boolean} Return true if sublist line is valid
		 *
		 * @since 2015.2
		 */
		function validateInsert(scriptContext) {
			return true;
		}

		/**
		 * Validation function to be executed when record is deleted.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @param {string} scriptContext.sublistId - Sublist name
		 *
		 * @returns {boolean} Return true if sublist line is valid
		 *
		 * @since 2015.2
		 */
		function validateDelete(scriptContext) {
			return true;
		}

		/**
		 * Validation function to be executed when record is saved.
		 *
		 * @param {Object} scriptContext
		 * @param {Record} scriptContext.currentRecord - Current form record
		 * @returns {boolean} Return true if record is valid
		 *
		 * @since 2015.2
		 */
		function saveRecord(scriptContext)
		{
			return true;
		}

		return {
			pageInit: pageInit,
			fieldChanged: fieldChanged,
			postSourcing: postSourcing,
			sublistChanged: sublistChanged,
			lineInit: lineInit,
			validateField: validateField,
			validateLine: validateLine,
			validateInsert: validateInsert,
			validateDelete: validateDelete,
			saveRecord: saveRecord
		};
	});