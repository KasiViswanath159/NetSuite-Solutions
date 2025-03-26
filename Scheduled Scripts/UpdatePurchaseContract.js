function UpdatePurchaseContract()
{

var records = nlapiSearchRecord('transaction', 1009, null, null); //you will have to specify the internalid of the saved search you need to grab specifically the records you need to update. Refer to the dev guide this API

for ( var i = 0; records != null && i < records.length; i++ )
{

var record = nlapiLoadRecord( records[i].getRecordType(), records[i].getId() );

record.setFieldText('effectivitybasedon','Expected Receipt Date');

/* for (var line = 1; line <= record.getLineItemCount('item'); ++line) {
record.setLineItemValue('item', 'isclosed', line, 'F');
}
 */
nlapiSubmitRecord(record, false, true);

}

} 
