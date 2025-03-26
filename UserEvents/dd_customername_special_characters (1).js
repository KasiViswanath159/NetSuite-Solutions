/**
 *@NApiVersion 2.x
 *@NScriptType UserEventScript
 */
define(['N/record', 'N/runtime','N/error'], function(record, runtime,error) {

    function beforeSubmit(context) {
        if (context.type !== context.UserEventType.CREATE || context.type !== context.UserEventType.EDIT)
            return;

        var RecordOBJ = context.newRecord;
        var scriptObj = runtime.getCurrentScript();
      log.debug('script Obj: ' + ''+scriptObj );
        var fieldList = scriptObj.getParameter({
            name: 'custscript_dd_customer_name'
        });
        if(!fieldList){
            return;
        }
        fieldList = fieldList.split(',');
        for (var fid = 0; fid < fieldList.length; fid++) {
            var fieldValue = RecordOBJ.getValue(fieldList[fid].trim());
			var spChare = ['<>','{}','()','"'];
          log.debug('Special Character: ' + ''+spChare );
            //let spChars = '/[%^&*\=\[\]{};\\|<>\/]/';
			var tempValue = fieldValue;
			for (var s=0; s<spChare.length;s++)
			{
				if(tempValue.indexOf(spChare[s] >-1))
				{
				tempValue= 	tempValue.split(spChare[s]).join('');
				}
				
			}
			if((tempValue!=fieldValue) && (tempValue))
			{
			RecordOBJ.setValue(fieldList[fid].trim(),tempValue);
			}
           
        }

    }
    return {
        //beforeLoad: beforeLoad,
        beforeSubmit: beforeSubmit,
        //afterSubmit: afterSubmit
    };
});
