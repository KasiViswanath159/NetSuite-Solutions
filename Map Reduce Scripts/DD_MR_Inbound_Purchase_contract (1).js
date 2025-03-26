/**
 * @NApiVersion 2.0
 * @NScriptType MapReduceScript
 * @NModuleScope public
 */

/*
Name                : 
Purpose             : This script will fetch the file and create Purchase Contract
Created On        : 12th Dec 2021
Author               : Anil C
Script Type        : Map Reduce
 */

define(['N/record', 'N/file', 'N/search', 'N/format', 'N/runtime', 'N/config', 'N/email'],
		function (record, file, search, format, runtime, config, email) {

	function GetInputData() {
		log.audit('GET INPUT START', new Date());

		var currentScript = runtime.getCurrentScript();   
		var fileID = runtime.getCurrentScript().getParameter({ name: 'custscript_dd_file_id' });
		log.debug('GET INPUT PROCESS: ', 'fileID : '+fileID);

		if(fileID)
		{
			//LOAD FILE
			var fileObj = file.load({
				id: fileID
			});

			log.debug('CONNECTION FILE LOADED : ', fileObj);

			/*var arrLines = fileObj.getContents().split(/\n|\n\r/);
			var sendToMapArray = [];
			var eachLine = '';
			for (var i = 1; i < arrLines.length; i++) {
				eachLine = arrLines[i].replace('\r','');

				if(eachLine)
					sendToMapArray.push(eachLine);	

			}
			log.debug('CONNECTION FILE LOADED : sendToMapArray ', sendToMapArray);*/

			return  fileObj;
		}	
	}



	function Map(context) {

		var tempData = '';
		try{
log.debug('PROCESS: MAP ', 'Eneter into MAP: '+context);
			var DEFAULT_ITEM = '253';
			var DEFAULT_CLASS = '21';
			var DEFAULT_DEPARTMENT = '1';
			var DEFAULT_COSTCENT = '45';
			var APPROVAL_STATUS = '2';
		var today = new Date();
           // log.debug('PROCESS: MAP ', 'Today Date SET: '+today);
			
		 var formattedDateString = format.format({
            value: new Date(),
            type: format.Type.DATE
        });
		var todaydateObj = format.parse({
            value: formattedDateString,
            type: format.Type.DATE
        }); 
          
          
			log.debug("MAP", "context : "+context +'todaydateObj:'+ todaydateObj);

			var contextValObj = context.value;

			if(contextValObj.indexOf('custbody_cseg_costcenter')  == -1 )
			{

				log.debug("MAP", "contextValObj : "+JSON.stringify(contextValObj));

				tempData =contextValObj.replace(/\r?\n|\r/,'');
				log.debug("MAP", "tempData : "+tempData);
				var arrOfCoulmns = tempData.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/);

				log.audit("MAP", "arrOfCoulmns : "+arrOfCoulmns);

				var externalID = arrOfCoulmns[0];

				//CREATE PURCHASE CONTRACT
				var contObj = record.create({
					type: 'purchasecontract',
					isDynamic: true
				});
				
				contObj.setValue({
					fieldId: 'startdate',
					value: todaydateObj
				}); 
				var initialDate = '1/4/2022';
			        initialDate = format.parse({value:initialDate, type: format.Type.DATE})
				contObj.setValue({
					fieldId: 'trandate',
					value: initialDate
				});
              log.debug('PROCESS: MAP ', 'Date SET: '+initialDate);

				contObj.setValue({
					fieldId: 'externalid',
					value: externalID
				});

				var entityName = arrOfCoulmns[6];
				/*if(  entityName.indexOf('"') > -1 )
				{
					entityName = entityName.replace(/"/g, '' );
				}*/
				contObj.setText({
					fieldId: 'entity',
					text: entityName
				});

				contObj.setValue({
					fieldId: 'subsidiary',
					value: arrOfCoulmns[1]
				});

				contObj.setText({
					fieldId: 'department',
					text: arrOfCoulmns[2]
				});

				contObj.setText({
					fieldId: 'class',
					text: arrOfCoulmns[3]
				});

				contObj.setText({
					fieldId: 'custbody_cseg_costcenter',
					text: arrOfCoulmns[4]
				});

				contObj.setText({
					fieldId: 'effectivitybasedon',
					text: arrOfCoulmns[5].toString()
				});

				contObj.setText({
					fieldId: 'custbody_pwc_buyer',
					text: arrOfCoulmns[7]
				});

				contObj.setValue({
					fieldId: 'maximumamount',
					value: arrOfCoulmns[8]
				});
				
                 contObj.setValue({
					fieldId: 'approvalstatus',
					value: APPROVAL_STATUS
				});


				//SET LINE
				contObj.selectNewLine({
					sublistId: "item"
				});

				contObj.setCurrentSublistValue({
					sublistId: "item",
					fieldId: "item",
					value: DEFAULT_ITEM
				});

				contObj.setCurrentSublistValue({
					sublistId: "item",
					fieldId: "quantity",
					value: 1
				});

				contObj.setCurrentSublistValue({
					sublistId: "item",
					fieldId: "class",
					value: DEFAULT_CLASS
				});
				contObj.setCurrentSublistValue({
					sublistId: "item",
					fieldId: "department",
					value: DEFAULT_DEPARTMENT
				});

				contObj.setCurrentSublistValue({
					sublistId: "item",
					fieldId: "custcol_cseg_costcenter",
					value: DEFAULT_COSTCENT
				});

				contObj.commitLine({
					sublistId: "item"
				});

				log.debug('Debug ', 'ITEM LINE ADDED' );

				var recordId = contObj.save({
					enableSourcing: true,
					ignoreMandatoryFields: true
				});

				log.audit('PROCESS: MAP ', 'CONTRACT CREATED : recordId : '+recordId);
			}

		}
		catch(e)
		{
			log.error('PROCESS: MAP :  '+externalID, 'ERROR DETAILS : '+e.toString() +'  tempData : '+tempData);

			context.write({key: e.message, value:tempData});
		}
	}

	function Summarize(context) {

		// Log details about the script's execution.
		log.audit({
			title: 'Usage units consumed',
			details: context.usage
		});
		log.audit({
			title: 'Concurrency',
			details: context.concurrency
		});
		log.audit({
			title: 'Number of yields',
			details: context.yields
		});

		// Use the context object's output iterator to gather the key/value pairs saved
		// at the end of the reduce stage. Also, tabulate the number of key/value pairs
		// that were saved. This number represents the total number of unique letters
		// used in the original string.
		var text = '';
		var totalKeysSaved = 0;
		context.output.iterator().each(function(key, value) {
			if(value  && key)
				text += (key + ' ,' + value + '\n');     		

			totalKeysSaved++;

			return true;
		});

		if(totalKeysSaved == 0)
			text = 'All Record Processed';

		// Log details about the total number of pairs saved.
		log.audit({
			title: 'Unique number of letters used in string',
			details: totalKeysSaved
		});

		// Use the N/file module to create a file that stores the reduce stage output,
		// which you gathered by using the output iterator.
		var fileObj = file.create({
			name: 'ContractImportStatus.csv',
			fileType: file.Type.PLAINTEXT,
			contents: text
		});

		//SEND EMAIL
		email.send({
			author: '2837831',
			recipients: ['anil.chaganti@ext.doordash.com,srikanth.kapavarapu@doordash.com,jessica.smith@doordash.com'],
			subject: 'Contract Import Status : ' + new Date(),
			body: 'Hi,   Attached contract import status for today ',
			attachments: [fileObj]
		});


		log.debug({
			title: 'Email Sent',
			details: 'Summary Ends'
		});
	}



	return {
		getInputData: GetInputData,
		map: Map,
		summarize:Summarize
	};
});