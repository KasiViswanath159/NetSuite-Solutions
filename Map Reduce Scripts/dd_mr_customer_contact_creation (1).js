/**
 * @NApiVersion 2.x
 * @NScriptType MapReduceScript
 */

define(['N/search', 'N/record'], function (search, record) {

    function getInputData() {
        try {
            return search.load({
                id: 'customsearch_customer_without_contact'
            })

            // return search.create({
            //     type: "customer",
            //     filters: [
            //         ["internalid", "anyof", 429]
            //     ],
            //     columns: [
            //         search.createColumn({
            //             name: "entityid",
            //             sort: search.Sort.ASC,
            //             label: "Name"
            //         }),
            //         search.createColumn({
            //             name: "email",
            //             label: "Email"
            //         }),
            //         search.createColumn({
            //             name: "internalid",
            //             label: "Internal ID"
            //         }),
            //     ]
            // });
        } catch (e) {
            log.error('Error is', e);
        }
    }

    function map(context) {
        try {


            log.debug('context', context);
            var custData = JSON.parse(context.value)['values'];
            var contactData = {
                customerid: custData['internalid']['value'],
            }
            log.debug('contactData 1', contactData);
            //log.debug('context 1', context.value);

            log.debug('custData', custData);
            //log.debug('custData 1', JSON.parse(custData)['values']);

            if (custData['email']) {
                contactData['email'] = custData['email'];
                createContect(contactData);
            }
            //log.debug('contact Data 1', custData);
            if (custData['custentitydd_additional_trx_email']) {
                var emailList = custData['custentitydd_additional_trx_email'].split(',');
                for (var el = 0; el < emailList.length; el++) {
                    contactData['email'] = emailList[el];
                    createContect(contactData);
                }
            }
        } catch (e) {
            log.error('Error is', e);
        }
    }

    function summarize(context) {

        log.debug({
            title: 'script completed',
            details: context
        });
        /*log.audit({
            title: 'Concurrency',
            details: context.concurrency
        });
        log.audit({
            title: 'Number of yields',
            details: context.yields
        });*/

    }


    function createContect(contactData) {
        try {
            if(isContctExist(contactData['email'], contactData['customerid'])){
                log.debug('Contact already exist', contactData['email']);
                return;
            }
            log.debug('contactData', contactData);
            var contactRec = record.create({
                type: record.Type.CONTACT,
                isDynamic: true
            });

            contactRec.setValue({
                fieldId: 'company',
                value: contactData['customerid']
            });

            contactRec.setValue({
                fieldId: 'email',
                value: contactData['email']
            });

            contactRec.setValue({
                fieldId: 'entityid',
                value: contactData['email']
            });

            contactRec.save();
        } catch (e) {
            log.error('Error while creating contact', e);
        }
    }

    function isContctExist(email, customerId) {

        var subSearchObj = search.create({
            type: "contact",
            filters: [
                [
                    ["entityid", "is", email.trim()],
                    "OR",
                    ["email", "is", email.trim()]
                ],
                "AND",
                ["company", "anyof", customerId]
            ],
            columns: [
                search.createColumn({
                    name: "internalid",
                    sort: search.Sort.DESC,
                    label: "Internal ID"
                }),
            ]
        });
        var searchResultCount = subSearchObj.runPaged().count;
        log.debug("subSearchObj result count", searchResultCount);
        if(searchResultCount > 0){
            return true;
        }
        return false;
        
    }

    return {
        getInputData: getInputData,
        map: map,
        //reduce: reduce,
        summarize: summarize
		
		   };
});