function scheduled() {
  var SearchResult = nlapiLoadSearch(
    "purchaseorder",
    "customsearch4843"
  );

  var ab = SearchResult.runSearch();
  var c = ab.getResults(0, 1000);
  var c2 = ab.getResults(1000, 2000);

  closePurchaseOrders(c.length, c);
  closePurchaseOrders(c2.length, c2);

  function closePurchaseOrders(recordLimit, searchResults) {
    try {
      for (var j = 1; j <= recordLimit; j++) {
        var getPOInternailId = searchResults[j].getId();
         var purchaseOrderRecord = nlapiLoadRecord('purchaseorder',getPOInternailId);

            var pocount = purchaseOrderRecord.getLineItemCount('item');

            nlapiLogExecution('debug', 'pocount', pocount);

            for (var i = 1; i <= pocount; i++) {
                purchaseOrderRecord.selectLineItem('item', i);
                purchaseOrderRecord.setCurrentLineItemValue('item', 'isclosed', 'T');
                purchaseOrderRecord.commitLineItem('item');
            }
            var updateRecord = nlapiSubmitRecord(purchaseOrderRecord, true);

            nlapiLogExecution('debug', 'updateRecord', updateRecord);
      }
    }
      catch (e) {
      nlapiLogExecution("debug", "Catch Block", e);
    }
     var usage = nlapiGetContext().getRemainingUsage();
    nlapiLogExecution("DEBUG", "Usage Remaining", usage);
    if (usage < 100) {
      var state = nlapiYieldScript();
      if (state.status == "FAILURE") throw "Failed to yield script";
      else if (state.status == "RESUME")
        nlapiLogExecution("DEBUG", "Resuming script", "RESUME");
    }
}
}
