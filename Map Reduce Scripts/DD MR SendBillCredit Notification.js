/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 */
define(['N/record', 'N/runtime', 'N/search', 'N/file', 'N/format','N/email', 'N/log', 'N/render'],
	/**
	 * @param{record} record
	 * @param{search} search
	 */
	(record, runtime, search, file, format,email, log, render) => {
		const getInputData = (inputContext) => {
			try {
			    var vendorArray = [];
				var vendorcreditSearchObj = search.create({
					type: "vendorcredit",
					filters: [
						["type", "anyof", "VendCred"],
						"AND",
						["mainline", "is", "F"],
						"AND",
						["custbody_created_from_shortpay", "is", "T"],
						"AND",
						["vendor.custentity_dd_edi_shortpay_enabled", "is", "T"],
						"AND",
						["datecreated", "onorafter", "daysago7"], 
                        "AND", 
                        ["vendor.custentity_dd_shortpay_daily_email","is","F"]
					],
					columns: [
						search.createColumn({
							name: "internalid",
							join: "vendor",
							label: "Vendor Internal Id"
						})

					]
				});
				
				var searchResultCount = vendorcreditSearchObj.runPaged().count;
                log.debug("vendorcreditSearchObj result count", searchResultCount);
				var myResults = getAllResults(vendorcreditSearchObj);
				myResults.forEach(function(result){ 
				var vendorId = result.getValue({
                    name: "internalid",
                    join: "vendor",
                    label: "Vendor Internal Id"
                });
				if(vendorArray.indexOf(vendorId)==-1)
					vendorArray.push(vendorId);
                // .run().each has a limit of 4,000 results
                return true;
				});
				log.debug('vendorArray', vendorArray);
				return vendorArray;
			} catch (e) {
				log.error('ERROR', e)
			}
		}

		const reduce = (mapContext) => {
			try {
				log.debug('Enter', mapContext)
				let vendorArray = mapContext.values;
				log.debug('vendorArray map ', vendorArray);
				    
					try {
						var pdfArray = new Array();
						var billCreditArray = [];
						var mySearch = search.load({
							id: 'customsearch_dd_billcredit_added_shrtpay'
						});
						mySearch.filters.push(search.createFilter({
							name: 'internalid',
							join: 'vendor',
							operator: search.Operator.ANYOF,
							values: vendorArray
						}));
						mySearch.columns.push(search.createColumn({
							name: 'internalid',
							label: 'Internal Id'							
						}));
						var resultSet = mySearch.run();
						//=========================================================
						var mySearch1 = search.load({
							id: 'customsearch_dd_billcredit_added_shrtpay'
						});
						mySearch1.filters.push(search.createFilter({
							name: 'internalid',
							join: 'vendor',
							operator: search.Operator.ANYOF,
							values: vendorArray
						}));
						
						var resultSet1 = mySearch1.run();
						//==========================================================
						var resultSet = mySearch.run();
						var csvContent = formatSearchResultsToCSV(resultSet1);
						// Create a file
						var csvFile = file.create({
							name: 'ShortPay BillCredits.csv',
							fileType: file.Type.CSV,
							contents: csvContent
						});
						resultSet.each(function(result) {
							
							var billCreditId = result.getValue({
								name: "internalid",
								label: "Internal Id"
							});
							//log.debug('billCreditId ',billCreditId);
							
							if(billCreditArray.indexOf(billCreditId)==-1)
								billCreditArray.push(billCreditId);
							// .run().each has a limit of 4,000 results
							return true;
						});
						
						
						log.debug('billCreditArray ',billCreditArray);
						// Format the search results into CSV
						
						
						for(var ii=0; ii<billCreditArray.length;ii++)
						{
							var billCredit = parseInt(billCreditArray[ii]);
							var pdfFile = render.transaction({
								entityId: billCredit,
								printMode: render.PrintMode.PDF,
								templateId: 'CUSTTMPL_138_3938860_157' 
							});
							pdfArray.push(pdfFile);
						}
						var vendorName = search.lookupFields({
							type: search.Type.VENDOR,
							id: vendorArray,
							columns: ['companyname','custentity_dd_accuratepay_emails']
						});
						var toArray = new Array();
						toArray.push(vendorArray);
						if(vendorName.custentity_dd_accuratepay_emails)
							toArray.push(vendorName.custentity_dd_accuratepay_emails);
						log.debug('toArray ',toArray);
						pdfArray.push(csvFile);
						var defaultFile = file.load({      //FINAPPS-5609
							id: 16991009
						});
						pdfArray.push(defaultFile);
						log.debug('pdfArray  '+pdfArray,'pdfFile '+pdfFile);

                      var csvTemplate = file.load({      //FINAPPS-5609
							id: 16010165
						});
						pdfArray.push(csvTemplate);
						// Send an email with the CSV file as an attachment
					   
						
						var emailBody = 'Hi '+vendorName.companyname;
						emailBody += '<p>Please find our weekly list of invoices processed with the corresponding itemized adjustments in PDF & CSV format. <br>Invoices are processed to match what our records indicate as the quantity we have received,at the cost we listed on our Purchase Order. <br>Items delivered that were not listed on our original Purchase Orders will be deducted from the invoice. A separate payment remittance report will continue to be emailed at the time of payment. <br>If you have any items you would like to dispute, please follow our attached (attached PDF) dispute process. We appreciate your valuable business partnership!<br><br>Thanks,<br>DashMart Team';
					
						email.send({
							author: 8266872,
							recipients: toArray,//vendorArray,
							subject: 'DoorDash - Weekly itemized adjustments.',
							body: emailBody,
							attachments: pdfArray
						});

					} catch (ex) {
						log.error('Error ', ex);
					}
					
				
			} catch (e) {
				log.error('ERROR', e.message)
			}
		}

		const summarize = (summaryContext) => {
			

		}
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
	    function formatSearchResultsToCSV(resultSet) {
			var columns = resultSet.columns;

			// Create header row
			var csvContent = columns.map(function(column) {
				return '"' + column.label + '"';
			}).join(',') + '\n';

			// Iterate over search results
			resultSet.each(function(result) {
				// Create a row for each result
				var row = columns.map(function(column) {
					return result.getText(column)?'"' + result.getText(column) + '"':'"' + result.getValue(column) + '"';
				}).join(',') + '\n';

				csvContent += row;

				return true;
			});

			return csvContent;
		}		
		return {
			getInputData,
			reduce,
			summarize
		}

	});