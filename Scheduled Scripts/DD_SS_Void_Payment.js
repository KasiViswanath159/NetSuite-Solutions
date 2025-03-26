/**
 * @NApiVersion 2.1
 * @NScriptType ScheduledScript
 * @NModuleScope SameAccount
 */
define(['N/search', 'N/file','N/record','N/format'], function (search, file,record,format) {

    function execute(context) 
	{
		try
		{
			 /************ Search to get the lists of Accounts START ***************/
			var account,FilePrefix,FileFolderLocation;
			var customrecord_dd_void_pmt_acctSearchObj = search.create({
			   type: "customrecord_dd_void_pmt_acct",
			   filters:
			   [
			   ],
			   columns:
			   [
				  search.createColumn({name: "custrecord_dd_void_acc_id", label: "Account"}),
				  search.createColumn({name: "custrecord_dd_void_file_name_prefix", label: "File Prefix"}),
				  search.createColumn({name: "custrecord_dd_void_file_location", label: "File Location"}),
			   ]
			});
			var searchResultAccountCount = customrecord_dd_void_pmt_acctSearchObj.runPaged().count;
			log.debug("customrecord_dd_void_pmt_acctSearchObj result count",searchResultAccountCount);
			customrecord_dd_void_pmt_acctSearchObj.run().each(function(result)
			{
			   // .run().each has a limit of 4,000 results
			   account = result.getValue({name:"custrecord_dd_void_acc_id"});
			   FilePrefix = result.getValue({name:"custrecord_dd_void_file_name_prefix"});
			   FileFolderLocation = result.getValue({name:"custrecord_dd_void_file_location"});
			   
			  /****Adding account in the search****/
			  
				var currentDate = sysDate();
				var currentTime = getCurrentTime(); // returns the time in HH:MM:SS 
				log.debug('currentTime 37',currentTime);
				var currentDateAndTime = currentDate + ' ' + currentTime;
				log.debug('currentDateAndTime 14', currentDateAndTime);
				
				var formattedDateString;
				//format the date 
				formattedDateString = format.parse({value:currentDate, type: format.Type.DATE})
				log.debug('formattedDateString 22',formattedDateString);
					
				 /********* Define search filters and columns to fetch all the void payments based upon each Accounts START ********/
				
				var vendorBillPayementID,VoidPaymentBatchId; 
				
				var vendorpaymentSearchObj = search.create({
                    type: "transaction",
                    settings: [{
                        "name": "consolidationtype",
                        "value": "ACCTTYPE"
                    }],
                    filters: [
                        [[
                            ["type", "anyof", "VendPymt"], "AND", ["systemnotes.field", "anyof", "TRANDOC.KSTATUS"], "AND", ["systemnotes.newvalue", "is", "Voided"], "AND", ["mainline", "is", "T"], "AND", ["systemnotes.date", "within", "today"], "AND", ["account", "anyof", account], "AND", ["custbody_9997_is_for_ep_eft", "is", "F"], "AND", ["custbody_dd_void_payment_batch_referen", "anyof", "@NONE@"], "AND", ["formulatext: {tranid}","isnotempty",""]
                        ], //Inhouse Check Payments 
                        "OR",
                        [
                            ["type", "anyof", "VendPymt"], "AND", ["systemnotes.field", "anyof", "TRANDOC.KSTATUS"], "AND", ["systemnotes.newvalue", "is", "Voided"], "AND", ["mainline", "is", "T"], "AND", ["systemnotes.date", "within", "today"], "AND", ["account", "anyof", account], "AND", ["custbody_dd_void_payment_batch_referen", "anyof", "@NONE@"], "AND", ["custbody_dd_bank_payment_method", "anyof", "2", "4"], "AND", ["custbody_9997_is_for_ep_eft", "is", "T"], "AND", ["formulatext: {tranid}","isnotempty",""]
                        ]] //Paysource Check Payments 
                    ],
                    columns: [
                        search.createColumn({
                            name: "internalid",
                            label: "Internal ID"
                        })
                    ]
                });
						var searchResultCount = vendorpaymentSearchObj.runPaged().count;
						log.debug("vendorpaymentSearchObj result count",searchResultCount);
						
						if(searchResultCount > 0)
						{
							//Create Vendor Payments Batch record
							
							var objparentId = record.create({
							type: 'customrecord_void_payments',
							isDynamic: true
							});

							objparentId.setValue({
								fieldId: 'custrecord_dd_date',
								value: formattedDateString
							});
							objparentId.setValue({
								fieldId: 'custrecord_dd_bank_account',
								value: account 
							});

							// Save the Vendor Payments Batch record
							
							VoidPaymentBatchId = objparentId.save();
							log.debug('VoidPaymentBatchId 77',VoidPaymentBatchId);
						}	
						vendorpaymentSearchObj.run().each(function(result)
						{
						   vendorBillPayementID = result.getValue({name: "internalid"});
						   
						  // To assign each Bill payment record a batch with a void payment batch ID 
						   var objBillRecord = record.load({
									type: record.Type.VENDOR_PAYMENT,
									id: vendorBillPayementID
								});	
							objBillRecord.setValue({fieldId:'custbody_dd_void_payment_batch_referen',value:VoidPaymentBatchId});
							objBillRecord.save();
								
						  return true;
						});
						/***** Calling function to create the xml file for each account void payment ****/
						CreateXmlFile(VoidPaymentBatchId,currentTime,FilePrefix,FileFolderLocation)
			 return true;
			});		
			/************ Search to get the lists of Accounts END ***************/
		}	
		 catch(e)
		 {
			log.debug('Error message',e.message);
		 }
    }
	
		function CreateXmlFile(VoidPaymentBatchId,currentTime,FilePrefix,FileFolderLocation)
		{
			/********************START search for every bill payment record based upon the void payment Batch ID for xml header details***********************/
			
			if(VoidPaymentBatchId)
			{	
				var voidSumAmount, voidTotalTransaction, voidpaymentbatchrefID,voidSubsidary,voidbankAccountnumber,voidRoutingnumber,voidAccountSubsidary;
				
				var voidpaymentSearchObj = search.create({
						   type: "vendorpayment",
						   filters:
						   [
							  ["type","anyof","VendPymt"], 
							  "AND", 
							  ["custbody_dd_void_payment_batch_referen","anyof",VoidPaymentBatchId],// VoidPaymentBatchId
							  "AND", 
							  ["mainline","is","T"]
						   ],
						   columns:
						   [
							  search.createColumn({
								 name: "internalid",
								 summary: "COUNT",
								 label: "Internal ID"
							  }),
							  search.createColumn({
								 name: "custbody_dd_void_payment_batch_referen",
								 summary: "GROUP",
								 label: "Void Payment Batch Reference"
							  }),
							  search.createColumn({
								 name: "amount",
								 summary: "SUM",
								 label: "Amount"
							  }),
							  search.createColumn({
								 name: "subsidiarynohierarchy",
								 summary: "GROUP",
								 label: "Subsidiary (no hierarchy)"
							  }),
							  search.createColumn({
								 name: "custrecord_acct_bank_account_number",
								 join: "account",
								 summary: "GROUP",
								 label: "Bank Account Number"
							  }),
							  search.createColumn({
								 name: "custrecord_bank_routing_number",
								 join: "account",
								 summary: "GROUP",
								 label: "Bank Account Routing Number"
							  }),
							  search.createColumn({
								 name: "subsidiarynohierarchy",
								 join: "account",
								 summary: "GROUP",
								 label: "Bank Account Subsidary"
							  })
						   ]
						});
						var searchResultCount = voidpaymentSearchObj.runPaged().count;
						log.debug("voidpaymentSearchObj result count",searchResultCount);
						voidpaymentSearchObj.run().each(function(result)
						{
						   voidpaymentbatchrefID = result.getValue({name: "custbody_dd_void_payment_batch_referen",summary: "GROUP"});
						   log.debug('voidpaymentbatchrefID 153',voidpaymentbatchrefID);
						   
						   voidTotalTransaction = result.getValue({ name: "internalid",summary: "COUNT"});
						   log.debug('voidTotalTransaction 156',voidTotalTransaction);
						   
						   voidSumAmount = result.getValue({ name: "amount", summary: "SUM"});
						   voidSumAmount = voidSumAmount* -1;
						   log.debug('voidSumAmount 160',voidSumAmount);
						   
						   voidSubsidary = result.getValue({ name: "subsidiarynohierarchy", summary: "GROUP"});
						   log.debug('voidSubsidary 163',voidSubsidary);
						   
						   voidbankAccountnumber = result.getValue({name: "custrecord_acct_bank_account_number",join: "account",summary: "GROUP"});
						   log.debug('voidbankAccountnumber 165',voidbankAccountnumber);
						   
						   voidRoutingnumber = result.getValue({name: "custrecord_bank_routing_number",join: "account",summary: "GROUP"});
						   log.debug('voidRoutingnumber 169',voidRoutingnumber);
						   
						   voidAccountSubsidary = result.getValue({name: "subsidiarynohierarchy",join: "account",summary: "GROUP"});
						   log.debug('voidAccountSubsidary 172',voidAccountSubsidary);
						   
						   return true;
						});
				
				/********************END search for every bill payment record based upon the void payment Batch ID for xml header details***********************/
				
				/***Changing the format of DATE as YYYY-MM-DD for xml document***/
				
				
				var MyDate = new Date();
				MyDate.setDate(MyDate.getDate());

				var currentDateXML = MyDate.getFullYear()+'-'+('0' + (MyDate.getMonth()+1)).slice(-2)+'-'+('0' + MyDate.getDate()).slice(-2);
				 
				  // Generate XML content
				  
				 var xmlContent = '<?xml version="1.0" encoding="UTF-8"?>';
				 xmlContent += '<Document xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">';
				 xmlContent +='<CstmrCdtTrfInitn>';
				 xmlContent += '<GrpHdr>';
				 xmlContent += '<MsgId>'+voidpaymentbatchrefID+'</MsgId>'; //VoidPaymentBatchId
				 xmlContent += '<CreDtTm>'+currentDateXML+'T'+currentTime+'</CreDtTm>'; // 2023-04-12T08:17:17
				 xmlContent += '<NbOfTxs>'+voidTotalTransaction+'</NbOfTxs>';
				 xmlContent += '<CtrlSum>'+voidSumAmount+'</CtrlSum>';
				 xmlContent += '<InitgPty>';
				 xmlContent += '<Nm>'+voidSubsidary+'</Nm>';
				 xmlContent +=	'</InitgPty>';
				 xmlContent +=	'</GrpHdr>';
				 xmlContent +=	'<PmtInf>';
				 xmlContent +=	'<PmtInfId>'+voidpaymentbatchrefID+'</PmtInfId>';
				 xmlContent +=	'<PmtMtd>CHK</PmtMtd>';
				 xmlContent +=	'<NbOfTxs>'+voidTotalTransaction+'</NbOfTxs>';
				 xmlContent +=	'<CtrlSum>'+voidSumAmount+'</CtrlSum>';
				 xmlContent +=	'<PmtTpInf>';
				 xmlContent +=	'<LclInstrm>';
				 xmlContent +=	'<Prtry>VOID</Prtry>';
				 xmlContent +=	'</LclInstrm>';
				 xmlContent +=	'</PmtTpInf>';
				 xmlContent +=	'<ReqdExctnDt>'+currentDateXML+'</ReqdExctnDt>';
				 xmlContent +=	'<Dbtr>';
				 xmlContent +=	'<Nm>'+voidAccountSubsidary+'</Nm>';
				 xmlContent +=	'<PstlAdr>';
				 xmlContent +=	'<Ctry>US</Ctry>';
				 xmlContent +=	'</PstlAdr>';
				 xmlContent +=	'</Dbtr>';
				 xmlContent +=	'<DbtrAcct>';
				 xmlContent +=	'<Id>';
				 xmlContent +=	'<Othr>';
				 xmlContent +=	'<Id>'+voidbankAccountnumber+'</Id>';
				 xmlContent +=	'</Othr>';
				 xmlContent +=	'</Id>';
				 xmlContent +=	'<Ccy>USD</Ccy>';
				 xmlContent += '</DbtrAcct>';
				 xmlContent += '<DbtrAgt>';
				 xmlContent += '<FinInstnId>';
				 xmlContent +=	'<ClrSysMmbId>';
				 xmlContent +=	'<MmbId>'+voidRoutingnumber+'</MmbId>';
				 xmlContent += '</ClrSysMmbId>';
				 xmlContent += '<PstlAdr>';
				 xmlContent += '<Ctry>US</Ctry>';
				 xmlContent += '</PstlAdr>';
				 xmlContent += '</FinInstnId>';
				 xmlContent += '</DbtrAgt>';
				 
				
				/*********************** Creating search on bill payments which contains VoidPaymentBatchId*********************************/
				
				var vendorpaymentVoidPaymentObj = search.create({
				   type: "vendorpayment",
				   filters:
				   [
					  ["type","anyof","VendPymt"], 
					  "AND", 
					  ["custbody_dd_void_payment_batch_referen","anyof",VoidPaymentBatchId], 
					  "AND", 
					  ["mainline","is","T"]
				   ],
				   columns:
				   [
					  search.createColumn({name: "internalid", label: "Internal ID"})
				   ]
				});
				var searchResultCount = vendorpaymentVoidPaymentObj.runPaged().count;
				log.debug("vendorpaymentVoidPaymentObj result count",searchResultCount);
				
				vendorpaymentVoidPaymentObj.run().each(function(result)
				{
				   var transactionBillPaymentID = result.getValue({ name: 'internalid' });
					log.debug('transactionBillPaymentID 267',transactionBillPaymentID);
					
					var vendorName,checkTransNumber,billAmount,vendorAdd1,vendorPostalCode, vendorCity,vendorState, vendorCountry,billTranid,vendorBillAdd1,vendorShipAdd1,BillElectBankPayment,vendorAdd1Str;
					
					/*************Search to get the details of each indiviual record details of bill payment **************/
					
					var vendorpaymentvoidbatchSearchObj = search.create({
						   type: "vendorpayment",
						   filters:
						   [
							  ["type","anyof","VendPymt"], 
							  "AND", 
							  ["internalidnumber","equalto",transactionBillPaymentID], 
							  "AND", 
							  ["mainline","is","T"]
						   ],
						    columns:
						   [
							  search.createColumn({
								 name: "entityid",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Name"
							  }),
							  search.createColumn({
								 name: "transactionnumber",
								 summary: "GROUP",
								 label: "Transaction Number"
							  }),
							  search.createColumn({
								 name: "amount",
								 summary: "MAX",
								 label: "Amount"
							  }),
							  search.createColumn({
								 name: "tranid",
								 summary: "GROUP",
								 label: "Document Number"
							  }),
							  search.createColumn({
								 name: "billaddress1",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Billing Address 1"
							  }),
							  search.createColumn({
								 name: "billcity",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Billing City"
							  }),
							  search.createColumn({
								 name: "billstate",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Billing State/Province"
							  }),
							  search.createColumn({
								 name: "billzipcode",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Billing Zip"
							  }),
							  search.createColumn({
								 name: "billcountrycode",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Billing Country Code"
							  }),
							  search.createColumn({
								 name: "shipaddress1",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Shipping Address 1"
							  }),
							  search.createColumn({
								 name: "shipcity",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Shipping City"
							  }),
							  search.createColumn({
								 name: "shipstate",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Shipping State/Province"
							  }),
							  search.createColumn({
								 name: "shipzip",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Shipping Zip"
							  }),
							  search.createColumn({
								 name: "shipcountrycode",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Shipping Country Code"
							  }),
							  search.createColumn({
								 name: "address1",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Address 1"
							  }),
							  search.createColumn({
								 name: "city",
								 join: "vendor",
								 summary: "GROUP",
								 label: "City"
							  }),
							  search.createColumn({
								 name: "state",
								 join: "vendor",
								 summary: "GROUP",
								 label: "State/Province"
							  }),
							  search.createColumn({
								 name: "zipcode",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Zip Code"
							  }),
							  search.createColumn({
								 name: "countrycode",
								 join: "vendor",
								 summary: "GROUP",
								 label: "Country Code"
							  }),
							   search.createColumn({
								 name: "custbody_9997_is_for_ep_eft",
								 summary: "GROUP",
								 label: "For Electronic Bank Payment"
							  })
						   ]
						});
						var searchResultCount = vendorpaymentvoidbatchSearchObj.runPaged().count;
						log.debug("vendorpaymentvoidbatchSearchObj result count",searchResultCount);
						var searchResults = vendorpaymentvoidbatchSearchObj.run().getRange({ start: 0, end: 1 })
						
						  var result = searchResults[0];
						  
						   vendorName = result.getValue({ name: "entityid",join: "vendor",summary: "GROUP"});
						   vendorName = vendorName.replace(/&/g, '');
						   checkTransNumber = result.getValue({name: "transactionnumber",summary: "GROUP"});
						   billAmount = result.getValue({ name: "amount",summary: "MAX"});
						   billAmount = billAmount*-1;
						   billTranid = result.getValue({name: "tranid",summary: "GROUP"});
						   log.debug('billTranid 443',billTranid);
						   
						   vendorAdd1 = result.getValue({name:"address1",join: "vendor",summary: "GROUP"});
						   log.debug('vendorAdd1',vendorAdd1);
						   vendorBillAdd1 = result.getValue({name: "billaddress1",join: "vendor",summary: "GROUP"});
						   log.debug('vendorBillAdd1',vendorBillAdd1);
						   vendorShipAdd1 = result.getValue({name: "shipaddress1",join: "vendor",summary: "GROUP"});
						   log.debug('vendorShipAdd1',vendorShipAdd1);
						   
						   BillElectBankPayment = result.getValue({name: "custbody_9997_is_for_ep_eft",summary: "GROUP"});
						   log.debug('BillElectBankPayment',BillElectBankPayment);
						   
						  if(!isEmpty(vendorBillAdd1))
						  {
							  log.debug('billing add');
							  vendorAdd1Str = vendorBillAdd1;
							  vendorAdd1Str = vendorAdd1Str.replace(/&/g, '');
						   vendorPostalCode = result.getValue({name: "billzipcode",join: "vendor",summary: "GROUP"});
						   vendorCity = result.getValue({name:"billcity", join: "vendor", summary: "GROUP"});
						   vendorState = result.getValue({name:"billstate", join: "vendor", summary: "GROUP"});
						   vendorCountry = result.getValue({name:"billcountrycode", join: "vendor", summary: "GROUP"});
						   log.debug('values465',vendorCity);
						   log.debug('values466',vendorPostalCode);
						   log.debug('vendorState467',vendorState);
						   log.debug('vendorCountry468',vendorCountry);
						  }
						 else if(!isEmpty(vendorShipAdd1))
						 {
							  log.debug('ship add');
							  vendorAdd1Str = vendorShipAdd1;
							  vendorAdd1Str = vendorAdd1Str.replace(/&/g, '');
						   vendorPostalCode = result.getValue({name:"shipzip",join: "vendor",summary: "GROUP"});
						   vendorCity = result.getValue({name:"shipcity", join: "vendor", summary: "GROUP"});
						   vendorState = result.getValue({name:"shipstate", join: "vendor", summary: "GROUP"});
						   vendorCountry = result.getValue({name:"shipcountrycode", join: "vendor", summary: "GROUP"});
						 } 
						 else if(!isEmpty(vendorAdd1))
						 {
							  log.debug('add');
							  vendorAdd1Str = vendorAdd1;
							  vendorAdd1Str = vendorAdd1Str.replace(/&/g, '');
						   vendorPostalCode = result.getValue({name: "zipcode",join:"vendor",summary: "GROUP"});
						   vendorCity = result.getValue({name:"city", join: "vendor", summary: "GROUP"});
						   vendorState = result.getValue({name:"state", join: "vendor", summary: "GROUP"});
						   vendorCountry = result.getValue({name:"countrycode", join: "vendor", summary: "GROUP"});
						   log.debug('values471',vendorCity);
						   log.debug('vendorState473',vendorState);
						   log.debug('vendorCountry474',vendorCountry);
							 
						 }
					
						var checqnumber;
						
						if(!isEmpty(billTranid) && BillElectBankPayment == true)
						{
							checqnumber = billTranid.substring(3);
							log.debug("BillElectBankPayment",checqnumber);
						}
						else if(!isEmpty(billTranid) && BillElectBankPayment == false)
						{
							checqnumber = billTranid;
							log.debug("checqnumber",checqnumber);
						}
						
					//Construct XML nodes for each void payment
					
					xmlContent += '<CdtTrfTxInf>';
					xmlContent +='<PmtId>';
					xmlContent += '<InstrId>'+transactionBillPaymentID+'</InstrId>';
					xmlContent += '<EndToEndId>'+checqnumber+'</EndToEndId>';
					xmlContent += '</PmtId>';
					xmlContent += '<Amt>';
					xmlContent += '<InstdAmt Ccy="USD">'+billAmount+'</InstdAmt>';
					xmlContent += '</Amt>';
					xmlContent += '<ChqInstr>';
					xmlContent += '<ChqNb>'+checqnumber+'</ChqNb>';
					xmlContent += '</ChqInstr>';
					xmlContent += '<Cdtr>';
					xmlContent += '<Nm>'+vendorName+'</Nm>';
					xmlContent += '<PstlAdr>';
					xmlContent += '<StrtNm>'+vendorAdd1Str+'</StrtNm>';
					xmlContent += '<PstCd>'+vendorPostalCode+'</PstCd>';
					xmlContent += '<TwnNm>'+vendorCity+'</TwnNm>';
					xmlContent += '<CtrySubDvsn>'+vendorState+'</CtrySubDvsn>';
					xmlContent += '<Ctry>'+vendorCountry+'</Ctry>';
					xmlContent += '</PstlAdr>';
					xmlContent +='</Cdtr>';
					xmlContent += '</CdtTrfTxInf>';
				   
				   return true;
				});
				
				 xmlContent += '</PmtInf>';
				 xmlContent += '</CstmrCdtTrfInitn>';
				 xmlContent += '</Document>';
	 
				 // Create a file and save XML content
				 
				var xmlFile = file.create({
					name: FilePrefix+VoidPaymentBatchId+".xml",
					fileType: file.Type.XMLDOC,
					contents: xmlContent,
					folder:FileFolderLocation
				});

				var fileId = xmlFile.save();
				log.debug('XML File ID:', fileId);	
				
				// Storing the name of the xml file to the void payment custom record
					
				var objVoidPaymentRec = record.load({type:'customrecord_void_payments',id:VoidPaymentBatchId });	 
				objVoidPaymentRec.setValue({fieldId:'custrecord_dd_file_name',value:FilePrefix+VoidPaymentBatchId+".xml"});
				objVoidPaymentRec.save();
			}		
			
		}
		
function sysDate() 
{
	var date = new Date();
	var tdate = date.getDate();
	var month = date.getMonth() + 1; // jan = 0
	var year = date.getFullYear();
	return currentDate = month + '/' + tdate + '/' + year;
}
			
function getCurrentTime() 
{
    var now = new Date();
    var hours = ("0" + now.getHours()).slice(-2);
    var minutes = ("0" + now.getMinutes()).slice(-2);
    var seconds = ("0" + now.getSeconds()).slice(-2);
    return hours + ":" + minutes + ":" + seconds;
}
		
 const isEmpty = (stValue) => {
if (stValue == "" || stValue == null || typeof stValue == "undefined" || stValue == '' || stValue == "null" || stValue == [] || stValue == "[]"||stValue =="- None -") {
	return true;
}
return false;
    }

    return {
        execute: execute
    };

});
