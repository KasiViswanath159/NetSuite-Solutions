/**
 *@NApiVersion 2.x
 *@NScriptType ClientScript
 */
define(['N/record', 'N/search', 'N/error'],
    function(record, search, error) {

        function fieldChanged(context) {
            var currentRecord = context.currentRecord;
            var sublistName = context.sublistId;
            var sublistFieldName = context.fieldId;

            if (sublistFieldName === 'entity') {

                var getVendor = currentRecord.getValue({
                    fieldId: 'entity'
                });

                log.debug('getVendor', getVendor);

                if (getVendor) {

var listChecking=checkTransaction(getVendor);

if(listChecking){
alert("The selected Vendor already has Purchase Contract !");

currentRecord.setValue({
                    fieldId: 'entity',
                    value:""
                });

}

                }

            }
        }

        function checkTransaction(vendorId) {

            var purchasecontractSearchObj = search.create({
                type: "purchasecontract",
                filters: [
                    ["type", "anyof", "PurchCon"],
                    "AND",
                    ["mainline", "is", "T"],
                    "AND",
                    ["name", "anyof", vendorId],
                    "AND",
                   ["enddate","isempty",""],
                ],
                columns: [
                    search.createColumn({
                        name: "tranid",
                        label: "Document Number"
                    }),
                    search.createColumn({
                        name: "entity",
                        label: "Name"
                    }),
                    search.createColumn({
                        name: "trandate",
                        label: "Date"
                    }),
                    search.createColumn({
                        name: "statusref",
                        label: "Status"
                    })
                ]
            });


            var get_values = purchasecontractSearchObj.run()
                .getRange({
                    start: 0,
                    end: 1000
                });

            var count = get_values.length;

            if (get_values.length > 0) {

                return true;

            }
        }

        return {

            fieldChanged: fieldChanged
        };
    });