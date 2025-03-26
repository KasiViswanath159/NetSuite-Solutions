/**
 * @NApiVersion 2.x
 * @NScriptType ScheduledScript
 */
define(['N/email', 'N/search', 'N/file', 'N/log', 'N/render'], function(email, search, file, log, render) {
    function execute(context) {
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
					["datecreated","within","12/11/2023 12:00 am","12/31/2023 11:59 pm"]
                    //["datecreated", "onorafter", "daysago60"]
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
			
           
            log.debug('vendorArray ', vendorArray);

            if (vendorArray.length > 0) {
                for(var i=0; i<vendorArray.length;i++)
                {
                    try {
						var pdfArray = new Array();
						
						var billCreditArray = [];
                        /*var mySearch = search.load({
                            id: 'customsearch_dd_billcredit_added_shrtpay'
                        });
                        mySearch.filters.push(search.createFilter({
                            name: 'internalid',
                            join: 'vendor',
                            operator: search.Operator.ANYOF,
                            values: vendorArray[i]
                        }));
						mySearch.columns.push(search.createColumn({
                            name: 'internalid',
							label: 'Internal Id'							
                        }));
                        var resultSet = mySearch.run();*/
						//=========================================================
						var mySearch1 = search.load({
                            id: 'customsearch_dd_billcredit_added_shrtpay'
                        });
                        mySearch1.filters.push(search.createFilter({
                            name: 'internalid',
                            join: 'vendor',
                            operator: search.Operator.ANYOF,
                            values: vendorArray[i]
                        }));
						
                        var resultSet1 = mySearch1.run();
						//==========================================================
						//var resultSet = mySearch.run();
						var csvContent = formatSearchResultsToCSV(resultSet1);
						// Create a file
                        var csvFile = file.create({
                            name: 'ShortPay BillCredits.csv',
                            fileType: file.Type.CSV,
                            contents: csvContent
                        });
						/*resultSet.each(function(result) {
							
							var billCreditId = result.getValue({
								name: "internalid",
								label: "Internal Id"
							});
							log.debug('billCreditId ',billCreditId);
							
							if(billCreditArray.indexOf(billCreditId)==-1)
								billCreditArray.push(billCreditId);
							// .run().each has a limit of 4,000 results
							return true;
						});*/
						
						
						//log.debug('billCreditArray ',billCreditArray);
                        // Format the search results into CSV
                        
						
						/*for(var ii=0; ii<billCreditArray.length;ii++)
						{
							log.debug('billCreditArray[ii] ',billCreditArray[ii]);
							var billCredit = parseInt(billCreditArray[ii]);
							var pdfFile = render.transaction({
								entityId: billCredit,
								printMode: render.PrintMode.PDF,
								templateId: 'CUSTTMPL_138_3938860_157' 
							});
							pdfArray.push(pdfFile);
						}*/
						var vendorName = search.lookupFields({
							type: search.Type.VENDOR,
							id: vendorArray[i],
							columns: ['companyname','custentity_dd_accuratepay_emails']
						});
						var toArray = new Array();
						toArray.push(vendorArray[i]);
						if(vendorName.custentity_dd_accuratepay_emails)
							toArray.push(vendorName.custentity_dd_accuratepay_emails);
						log.debug('toArray ',toArray);
						pdfArray.push(csvFile);
						/*var defaultFile = file.load({
                            id: 13750558
                        });
						pdfArray.push(defaultFile);*/
						//log.debug('pdfArray  '+pdfArray,'pdfFile '+pdfFile);
                        // Send an email with the CSV file as an attachment
                       
						
						var emailBody = 'Dear '+vendorName.companyname+' Team-';
						emailBody += '<p>We identified an issue in our weekly CSV deduction reporting that was causing several columns in the report to appear blank. <br>This issue began on 12/18 so every report you received from that point onwards has been impacted by this issue. <br>We have identified the error and corrected it internally so all reports moving forward will contain the proper information. <br>Attached is a one time historical report of all deductions taken since 12/11 to 12/31. <br>Should you have any questions or concerns please email ap.inquiry.dde@doordash.com .<br><br>Thanks,<br>DashMart Team';
					
						email.send({
                            author: 8266872,
                            recipients: toArray,//vendorArray[i],
                            subject: 'DoorDash - Weekly itemized adjustments.',
                            body: emailBody,
                            attachments: pdfArray
                        });

                    } catch (ex) {
                        log.error('Error ', ex);
                    }
                }
            }



        } catch (ex) {
            log.error('Scheduled Script Error', ex);
        }
    }
    // Function to format search results into CSV
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
                return '"' + result.getValue(column) + '"';
            }).join(',') + '\n';

            csvContent += row;

            return true;
        });

        return csvContent;
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
    return {
        execute: execute
    };
});