function afterSubmit(type){
	
if(type=='create'){

	try{

var loadRec=nlapiLoadRecord(nlapiGetRecordType(),nlapiGetRecordId());

var getLocationValue=loadRec.getFieldValue('location');
nlapiLogExecution('debug', 'getLocationValue', JSON.stringify(getLocationValue));


if(getLocationValue){

var loadLocationRec=nlapiLoadRecord('location',getLocationValue);
nlapiLogExecution('debug', 'loadLocationRec', JSON.stringify(loadLocationRec));

var getShipAddressee=loadLocationRec.getFieldValue('custrecord_dd_po_addresse_pdf');
nlapiLogExecution('debug', 'getShipAddressee', JSON.stringify(getShipAddressee));

var getShipAddress1=loadLocationRec.getFieldValue('custrecord_dd_po_address1_pdf');
nlapiLogExecution('debug', 'getShipAddress1', JSON.stringify(getShipAddress1));

var getShipAddress2=loadLocationRec.getFieldValue('custrecord_dd_po_address2_pdf');
nlapiLogExecution('debug', 'getShipAddress2', JSON.stringify(getShipAddress2));

var getShipAddress3=loadLocationRec.getFieldValue('custrecord_dd_po_address3_pdf');
nlapiLogExecution('debug', 'getShipAddress3', JSON.stringify(getShipAddress3));

var getShipCity=loadLocationRec.getFieldValue('custrecord_dd_po_city_pdf');
nlapiLogExecution('debug', 'getShipCity', JSON.stringify(getShipCity));

var getShipState=loadLocationRec.getFieldValue('custrecord_dd_po_state_pdf');
nlapiLogExecution('debug', 'getShipState', JSON.stringify(getShipState));

var getShipZip=loadLocationRec.getFieldValue('custrecord_dd_po_zip_pdf');
nlapiLogExecution('debug', 'getShipZip', JSON.stringify(getShipZip));

var getShipCountry=loadLocationRec.getFieldValue('custrecord_dd_po_country_pdf');
nlapiLogExecution('debug', 'getShipCountry', JSON.stringify(getShipCountry));

loadRec.setFieldValue('shipaddresslist','');

if(getShipAddressee){
loadRec.setFieldValue('shipaddressee',getShipAddressee);
}
if(getShipAddress1){
	loadRec.setFieldValue('shipaddr1',getShipAddress1);
}
if(getShipAddress2){
	loadRec.setFieldValue('shipaddr2',getShipAddress2);
}
if(getShipAddress3){
loadRec.setFieldValue('shipaddr3',getShipAddress3);
	
}
if(getShipCity){
loadRec.setFieldValue('shipcity',getShipCity);
	
}
if(getShipState){
loadRec.setFieldValue('shipstate',getShipState);
	
}
if(getShipZip){
loadRec.setFieldValue('shipzip',getShipZip);

	
}
if(getShipCountry){
loadRec.setFieldValue('shipcountry',getShipCountry);
	
}
var updatedRecord=nlapiSubmitRecord(loadRec,null,true);
nlapiLogExecution('debug', 'updatedRecord', JSON.stringify(updatedRecord));

}

	}
	catch(e){
 
    nlapiLogExecution('debug', 'Error:', JSON.stringify(e));

	}

}
  
}
