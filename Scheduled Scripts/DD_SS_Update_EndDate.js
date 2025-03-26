function UpdateEndDate(type) {

	 var records = nlapiSearchRecord('transaction', 3690, null, null); 
    for (var i = 0; records != null && i < records.length; i++) {

        try {

            var record = nlapiLoadRecord(records[i].getRecordType(), records[i].getId());

            record.setFieldValue('enddate', '6/30/2022');

            var updatedRec= nlapiSubmitRecord(record, false, true);
            nlapiLogExecution('debug', 'updatedRec:', updatedRec);


        } catch (e) {

            nlapiLogExecution('debug', 'Error:', JSON.stringify(e));
        }

    }
    
}