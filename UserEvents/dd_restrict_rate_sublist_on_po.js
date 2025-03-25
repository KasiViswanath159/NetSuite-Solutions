var flag = '';
var user = nlapiGetUser()
var usersList = ['2105896','659577','6241761','5954342','3162615','4134892','1962796','3946379']
function clientPageInit(type) {
    flag = type;
}
function clientLineInit(type){

		if (flag == "edit" && usersList.indexOf(user)== -1){
 nlapiDisableLineItemField('item', 'rate', true);
 nlapiDisableLineItemField('item', 'amount', true);
 nlapiDisableLineItemField('item', 'custcol_dd_purchase_price', true);

		}
} 

function clientValidateLine(type){

		if (flag == "edit" && usersList.indexOf(user)== -1){
 nlapiDisableLineItemField('item', 'rate', true);
 nlapiDisableLineItemField('item', 'amount', true);
 nlapiDisableLineItemField('item', 'custcol_dd_purchase_price', true);
 
 return true;
}
else{
	return true;
}
}

function clientPostSource(type, name){
 if (type == 'item' && name == 'item'){
 	if(flag == "edit" && usersList.indexOf(user)== -1){
 nlapiDisableLineItemField('item', 'rate', true);
 nlapiDisableLineItemField('item', 'amount', true);
 nlapiDisableLineItemField('item', 'custcol_dd_purchase_price', true);
 	}

 }
}