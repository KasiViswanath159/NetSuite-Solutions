/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope public
 */

/*
Name                : DD | MR Process Journal Payments
Purpose             : To allocate journals for the payments
Created On          : Feb 15 2024
Author              : Abhiram 
Script Type         : Map Reduce

 */

define(['N/record', 'N/search', 'N/runtime'],
    function (record, search, runtime) {

        function GetInputData() {
            log.audit('Map / Reduce START', new Date());

            try {
                var currentScript = runtime.getCurrentScript();
                var savedSearchID = currentScript.getParameter({
                    name:'custscript_dd_mr_proc_je_paymnts_ss_id'
                });
               log.debug('savedSearchID',savedSearchID);

                return search.load({
                   id: savedSearchID
                });
                
            

            } catch (err) {
                log.debug('Error In GetInputData', 'Error in GetInputData::' + err);
            }
        }

        function Map(context) {

            try {
                log.debug('Context', 'Context::' + JSON.stringify(context));
                var contextValue = JSON.parse(context.value);
                log.debug('In Map', 'In Map::' + JSON.stringify(contextValue));
                var rowId = contextValue.id;
                log.debug('Row ID', 'Row ID::' + rowId);

                var values = contextValue.values;

                var journalID = values["GROUP(internalid)"].value;
                log.debug('Journal ID', 'Journal ID::' + journalID);

                var customerName = values["GROUP(internalid.customer)"].text;
                log.debug('Customer Name', 'Customer Name::' + customerName);

                var customerID = values["GROUP(internalid.customer)"].value;
                log.debug('Customer ID', 'Customer ID::' + customerID);

                var journalRecord = search.lookupFields({
                    type: 'journalentry',
                    id: journalID,
                    columns: ['number', 'reversalnumber', 'class', 'department']
                });
                log.debug('Journal Object', 'Journal Obj:' + JSON.stringify(journalRecord));
                log.debug('Journal Number', 'Journal Number::' + journalRecord.number);
                log.debug('Reversal Journal Number', 'Reversal Journal Number::' + journalRecord.reversalnumber);

                var classID = journalRecord.class[0] ? journalRecord.class[0].value : undefined;
                log.debug('Class', 'Class ID::' + classID);

                var departmentID = journalRecord.department[0] ? journalRecord.department[0].value : undefined;
                log.debug('Department', 'Department ID::' + departmentID);


                /**
                 * Customer Payment
                 */
                var customerPayment = record.create({
                    type: 'customerpayment',
                    isDynamic: true,
                });

                //Set the Customer
                customerPayment.setValue({fieldId: 'customer', value: customerID});

                //Set the Class
                if (classID) customerPayment.setValue({fieldId: 'class', value: classID});

                //Set the Department
                if (departmentID) customerPayment.setValue({fieldId: 'department', value: departmentID});

                var aracct = customerPayment.getValue({fieldId: 'aracct'});
                log.debug('A/R account', 'A/R account::' + aracct);

                if (customerPayment.getValue({fieldId: 'autoapply'}))
                {
                    log.debug('Auto Apply', 'turing off Auto Apply');
                    customerPayment.setValue({fieldId: 'autoapply', value: false});
                }

                //Find the Line Number of the Journal Entry that exists on Apply Tab
                var isJournalFound = findAndApplyLine(customerPayment, 'apply', journalRecord.reversalnumber);
				log.debug('isJournalFound ',isJournalFound);
                dumpTab(customerPayment, 'apply');
                dumpTab(customerPayment, 'credit');

                //Find the Line Number of the Reversal Journal Entry that exists on Credit Tab
                var isReversalJounalFound = findAndApplyLine(customerPayment, 'credit', journalRecord.number);
				log.debug('isReversalJounalFound ',isReversalJounalFound);
                dumpTab(customerPayment, 'apply');
                dumpTab(customerPayment, 'credit');
				
				//===========================================================================================
				if(isJournalFound == false){
					isJournalFound = findAndApplyLine(customerPayment, 'apply', journalRecord.number);
					dumpTab(customerPayment, 'apply');
					dumpTab(customerPayment, 'credit');
				}
                if(isReversalJounalFound ==false){
					isReversalJounalFound = findAndApplyLine(customerPayment, 'credit', journalRecord.reversalnumber);
					dumpTab(customerPayment, 'apply');
					dumpTab(customerPayment, 'credit');
			    }
				//===========================================================================================

                if (isJournalFound && isReversalJounalFound) {
                    var paymentID = customerPayment.save();
                    log.debug('Payment Created', 'Payment Created::' + paymentID);
                }

            } catch (err) {
                log.debug('Error in Map', 'Error in Map::' + err);

                throw err;
            }
        }

        function findAndApplyLine(payment, tab, refNum) {
            var lines = payment.getLineCount({ sublistId: tab });
            var journalFound = false;
            for (var lineNumber = 0; lineNumber < lines; lineNumber++) {
                payment.selectLine({ sublistId: tab, line: lineNumber });
                var lineRefNum = payment.getCurrentSublistValue({ sublistId: tab, fieldId: 'refnum' });
                log.debug('refNum',refNum);
                log.debug('lineRefNum',lineRefNum);
                if (refNum == lineRefNum) {
                    payment.setCurrentSublistValue({ sublistId: tab, fieldId: 'apply', value: true });
                    payment.commitLine({sublistId: tab});
                    log.debug('Journal Found', 'Journal Found on ' + tab + ' Tab - line:' + lineNumber + " refnum:" + lineRefNum);
                    journalFound = true;
                }
            }
            if (!journalFound) {
                log.debug('Journal Not Found', 'Journal Not Found under ' + tab + ' Tab!');
            }
            return journalFound;
        }

        function dumpTab(payment, tab) {
            var res = [];
            var fields = ['doc', 'refnum'];
            var lines = payment.getLineCount({ sublistId: tab });
            for (var i = 0; i < lines; i++) {
                var isApplied = payment.getSublistValue({ sublistId: tab, fieldId: 'apply', line: i });
                if (isApplied) {
                    var row ={'apply' : isApplied};
                    for (var f in fields) row[fields[f]] = payment.getSublistValue({ sublistId: tab, fieldId: fields[f], line: i });
                    res.push(row);
                }
            }
            log.debug("Payment sublist " + tab, JSON.stringify(res));
        }

        function Reduce(context) {

            var key = context.key;
            var values = context.values;

            try {

            } catch (err) {
                log.error("Reduce", err);

                throw err;
            }
        }


        function Summarize(summary) {


            try {
                var currentScript = runtime.getCurrentScript();

                /**
                 * Re-trigger the Map Reduce if any of the result is left in the saved search
                 */

                var savedSearchID = 'customsearch_dd_unapplied_journals';
                log.debug('Saved Search ID', 'Saved Search ID::' + savedSearchID);

                var searchObj = search.load({
                    id: savedSearchID
                });

                var count = searchObj.runPaged().count;
                log.debug('No Of Results left in Search', 'No Of Results left in Search::' + count);

                /**
                 * Below code is to re-trigger map reduce if any of the results get failed and remain in Saved Search
                 */
                /*if(count>0)
                    {
                        require(["N/task"], function (task) {
                            var mrTask = task.create({
                                taskType: task.TaskType.MAP_REDUCE
                            });
                            mrTask.scriptId = runtime.getCurrentScript().id;
                            mrTask.deploymentId=runtime.getCurrentScript().deploymentId;
                            mrTask.params = {
                                    custscript_dd_auto_fulfill_log_flag: ''
                            };
    
                            var mrTaskId = mrTask.submit();
                            log.debug('Map / Reduce Re-Triggered','Map / Reduce Re-Triggered::'+ mrTaskId);
                        });
                    }
                    else*/

                throw "No more results to process!";

            } catch (err) {
                log.debug("Summarize", err);
            }
            log.audit('Map / Reduce END', new Date());
        }

        return {
            getInputData: GetInputData,
            map: Map,
            //reduce: Reduce,
            summarize: Summarize
        };
    });