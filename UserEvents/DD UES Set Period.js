/**
 *@NApiVersion 2.1
 *@NScriptType UserEventScript
 *@NModuleScope SameAccount
 */

 define(['N/runtime','N/log', 'N/error', 'N/search', 'N/record'],
 function (runtime, log, error, search, record) {
	 const setPeriod = function (context) {
		 var currentUserId = runtime.getCurrentUser().id;
		 log.debug('currentUserId ',currentUserId);
		 if (runtime.executionContext == runtime.ContextType.USER_INTERFACE || currentUserId == 8634185) {
		   // Check if the subsidiary is allowed
		 var allowedSubsidiaryIds = ['5', '41']; 
		 var subsidiaryId = context.newRecord.getValue({ fieldId: 'subsidiary' });
 
		 if (allowedSubsidiaryIds.indexOf(subsidiaryId) === -1) {
			 // Subsidiary not allowed, log or handle accordingly
			 log.debug('Subsidiary Restriction', 'This subsidiary is not allowed.');
			 return;
		 }
			  var record =  context.newRecord;
			 if (context.type == context.UserEventType.CREATE) 
			 {
				 var customrecord_ap_period_close_tableSearchObj = search.create({
					type: "customrecord_ap_period_close_table",
					filters:
					[
					],
					columns:
					[
					   search.createColumn({name: "custrecord_accounting_period", label: "Accounting Period"}),
					   search.createColumn({name: "custrecord_date_time", sort: search.Sort.DESC, label: "Date/Time"})
					]
				 });
				 var myResults = getAllResults(customrecord_ap_period_close_tableSearchObj);
				 var latestClosedPeriodDate = myResults[0].getValue({name:"custrecord_date_time", label:"Date/Time"});
				 var latestClosedPeriod= myResults[0].getValue({name: "custrecord_accounting_period", label: "Accounting Period"});
				 latestClosedPeriodDate = convertStringToDate(latestClosedPeriodDate);
				 var currentPostingPeriod = record.getValue({fieldId:'postingperiod'});
				 var periodCloseDate = new Date(); //record.getValue({fieldId:'trandate'});
				 //periodCloseDate = convertStringToDate(periodCloseDate);
				 
				 var accountingperiodSearchObj = search.create({
					type: "accountingperiod",
					filters:
					[
					   ["internalid","anyof",currentPostingPeriod]
					],
					columns:
					[
					   search.createColumn({
						  name: "periodname",
						  sort: search.Sort.ASC,
						  label: "Name"
					   })
					]
				 });
				 var myResults1 = getAllResults(accountingperiodSearchObj);
				 var currentPostingPeriodText = myResults1[0].getValue({name:"periodname", label:"Name"});
				 log.debug('currentPostingPeriodText ',currentPostingPeriodText)
				 
				 if(latestClosedPeriod == currentPostingPeriod && latestClosedPeriodDate <= periodCloseDate)
				 {
					 var periodObj = currentPostingPeriodText.split(' ');
					 var i_month = periodObj[0];
					 var i_year = periodObj[1];
					 if(i_month == 'Jan')
						 i_month = 1
					 else if(i_month == 'Feb')
						 i_month = 2
					 else if(i_month=='Mar')
						 i_month = 3
					 else if(i_month=='Apr')
						 i_month =4
					 else if(i_month == 'May')
						 i_month =5
					 else if(i_month == 'Jun')
						 i_month = 6
					 else if(i_month == 'Jul')
						 i_month = 7
					 else if(i_month == 'Aug')
						 i_month = 8
					 else if(i_month == 'Sep')
						 i_month = 9
					 else if(i_month =='Oct')
						 i_month = 10
					 else if(i_month == 'Nov')
						 i_month = 11
					 else if(i_month == 'Dec')
						 i_month = 12;

						 // Check if the latestClosedPeriodDate and periodCloseDate are the same
					if (latestClosedPeriodDate.getTime() === periodCloseDate.getTime() || latestClosedPeriodDate <= periodCloseDate) {
					 if(i_month!=12){
						 i_month = i_month+1;
					 }
					 else 
					 {
						 i_month = 1;
						 i_year++
					 }
					}
					 log.debug('i_month '+i_month,'i_year '+i_year);
					 var newPostingPeriod = parseInt(currentPostingPeriod)+1;
					 var transactionDate = getMonthStartDate(i_month,i_year);
					 record.setValue({
						 fieldId:'postingperiod',
						 value: newPostingPeriod
					 });
					 record.setValue({
						 fieldId:'trandate',
						 value: transactionDate
					 });
				 }
			 }
		 }
	 };
	 function getAllResults(s) {
		 var results = s.run();
		 var searchResults = [];
		 var searchid = 0;
		 do {
			 var resultslice = results.getRange({start:searchid,end:searchid+1000});
			 resultslice.forEach(function(slice) {
				 searchResults.push(slice);
				 searchid++;
				 }
			 );
		 } while (resultslice.length >=1000);
		 return searchResults;
	 }
 
		 function getMonthStartDate(month,year) {
			 if (month < 1 || month > 12) {
				 throw new Error('Invalid month. Month should be between 1 and 12.');
			 }
			 var startDate = new Date(year, month - 1, 1); // Note: Months are zero-based in JavaScript
			 return startDate;
		 }
 
		 function convertStringToDate(dateString) {
			 var jsDate = new Date(Date.parse(dateString));
 
			 // Check if the parsing was successful
			 if (isNaN(jsDate.getTime())) {
				 throw new Error('Invalid date string.');
			 }
 
			 return jsDate;
		 }
	 
	 return {
		 beforeSubmit: setPeriod
	 };
 
 });