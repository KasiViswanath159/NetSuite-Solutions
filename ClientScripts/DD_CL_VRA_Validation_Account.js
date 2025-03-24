function clientValidateLine(type) {
    if (type == 'expense') {

        var getAccount = nlapiGetCurrentLineItemValue('expense', 'account');

        var getStatus=nlapiLookupField('account', getAccount,'custrecord7');

        if (getStatus =='F') {
            alert("You are not authorized use this account! Please choose another...");
            nlapiSetCurrentLineItemValue('expense', 'account', "");
            return false;
        } else {
            return true;
        }

    }
}
