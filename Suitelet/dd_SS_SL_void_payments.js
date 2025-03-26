/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 *
 *Version    Date             Author            Details
 *1.0        March 30, 2022   Lubna Waheed      Initial version - NS ACS Case #4609811
 *1.1        April 22, 2022   Lubna Waheed      Updated with new requirements
 *1.2        May 25, 2022     Lubna Waheed      Updated to include updating of Memo on Voided JE
 *1.3        June 27, 2022    Lubna Waheed      Updated to include Refresh button
 *1.3        August 16, 2022  Lubna Waheed      Deployed to Production
 *
 */
define(['N/ui/serverWidget', 'N/search', 'N/runtime', 'N/format', 'N/transaction', 'N/url', 'N/record'],
    /**
 * @param{serverWidget} serverWidget
 * @param{search} search
 * @param{runtime} runtime
 * @param{format} format
 * @param {transaction} transaction
 * @param {url} url
 * @param {record} record
 */
    (serverWidget, search, runtime, format, transaction, url, record) => {


        var maxPayments = 45;   //testing with tracking governance estimates this as 50 with submitfield on je (but time limit may be exceeded)

        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            var scriptObj = runtime.getCurrentScript();

            if(scriptContext.request.method === 'GET'){

                var paymentSearchId = scriptObj.getParameter({
                    name: 'custscript_ns_acs_payment_search'
                });
                //log.debug('paymentSearchId', paymentSearchId);

                var selected_params = scriptContext.request.parameters;
                log.debug('selected_params', selected_params);

                var vendorMultiSelected_param = selected_params['namefilter'];
                if (vendorMultiSelected_param != null && vendorMultiSelected_param != '') {
                    selected_params['namefilter'] = JSON.parse(vendorMultiSelected_param);
                }

                var datecreatedFromSelected_param = selected_params['datecreatedfromfilter'];
                var datecreatedToSelected_param = selected_params['datecreatedtofilter'];
                if ((datecreatedFromSelected_param == '' || datecreatedFromSelected_param == null) &&
                    (datecreatedToSelected_param == '' || datecreatedToSelected_param == null)){
                    log.debug('both date created to and from empty');
                    setDefaultFromToMonthDates(selected_params);

                }



                var formObj = serverWidget.createForm({
                    title: 'Void Payments'
                });

                formObj.clientScriptModulePath = '/SuiteScripts/NetSuite/dd_CS_void_payments.js';

                formObj.addButton({
                    id : 'custpage_refresh_button',
                    label : 'Refresh',
                    functionName: 'refreshButton()'
                });

                var sublistObj = formObj.addSublist({
                    id : 'custpage_bill_payments',
                    type : serverWidget.SublistType.LIST,
                    label : 'Bill Payments List'
                });




                var paymentSearchObj = search.load({
                    id: paymentSearchId,
                    type: search.Type.TRANSACTION
                });

                addSublistFields(paymentSearchObj, sublistObj);
                addFilterFields(formObj, selected_params);
                addSelectedFilters(paymentSearchObj, selected_params);
                var searchResultsCount = addRows(paymentSearchObj, sublistObj);
                log.debug('searchResultsCount', searchResultsCount);

                if (searchResultsCount <= maxPayments && searchResultsCount > 0) {
                    sublistObj.addMarkAllButtons();
                }


                formObj.addFieldGroup({
                    id : 'processfieldsgroup',
                    label : 'Fields'
                });


                formObj.addField({
                    id: 'custpage_selectedpaymentstovoid',
                    label: 'Internal IDs of Payments to Void',
                    type: serverWidget.FieldType.TEXTAREA,
                    container: 'processfieldsgroup'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.HIDDEN
                });



                formObj.addField({
                    id: 'custpage_searchresultscount',
                    label: 'Number of Bill Payments Retrieved',
                    type: serverWidget.FieldType.TEXT,
                    container: 'processfieldsgroup'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = searchResultsCount;

                formObj.addField({
                    id: 'custpage_currselectedbillpaymentscount',
                    label: 'Number of Bill Payments Selected',
                    type: serverWidget.FieldType.TEXT,
                    container: 'processfieldsgroup'
                }).updateDisplayType({
                    displayType: serverWidget.FieldDisplayType.INLINE
                }).defaultValue = '0';

                formObj.addField({
                    id: 'custpage_nextapprover',
                    label: 'Next Approver',
                    type: serverWidget.FieldType.SELECT,
                    source: -4,
                    container: 'processfieldsgroup'
                }).updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                });

                formObj.addField({
                    id: 'custpage_postingdate',
                    label: 'Posting Date',
                    type: serverWidget.FieldType.DATE,
                    container: 'processfieldsgroup'
                }).defaultValue = getTodaysDate();

                formObj.addField({
                    id: 'custpage_memo',
                    label: 'Memo',
                    type: serverWidget.FieldType.TEXTAREA,
                    container: 'processfieldsgroup'
                }).updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTCOL
                });



                formObj.addField({
                    id : 'custpage_limitmsg',
                    type : serverWidget.FieldType.INLINEHTML,
                    label : 'Limitations',
                    container: 'processfieldsgroup'
                }).updateLayoutType({
                    layoutType: serverWidget.FieldLayoutType.OUTSIDEBELOW
                }).updateBreakType({
                    breakType: serverWidget.FieldBreakType.STARTROW
                }).defaultValue = 'Only 4000 payments are displayed a time.  Please select up to ' + maxPayments + ' payments to void.';



                formObj.addSubmitButton({
                    label: 'Submit'
                });

                scriptContext.response.writePage(formObj);


            }else {

                var submittedformObj = serverWidget.createForm({
                    title: 'Void Payments Status'
                });


                var voidedStatusSublistObj = submittedformObj.addSublist({
                    id : 'custpage_void_bill_payment_status',
                    type : serverWidget.SublistType.LIST,
                    label : 'Processed Bill Payments List'
                });

                voidedStatusSublistObj.addField({
                    id: 'custpage_view_processed_billpayment',
                    type: serverWidget.FieldType.URL,
                    label: 'View'
                }).linkText = 'View';

                voidedStatusSublistObj.addField({
                    id: 'custpage_to_void_bill_payment_internal_id',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Bill Payment Internal ID'
                });

                voidedStatusSublistObj.addField({
                    id: 'custpage_to_void_bill_payment_void_status',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Void Status'
                });


                voidedStatusSublistObj.addField({
                    id: 'custpage_to_void_bill_payment_void_je',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Voiding Journal Internal ID'
                });

                voidedStatusSublistObj.addField({
                    id: 'custpage_to_void_bill_payment_void_error',
                    type: serverWidget.FieldType.TEXT,
                    label: 'Error'
                });

                var selectedPaymentsToVoidStr = scriptContext.request.parameters.custpage_selectedpaymentstovoid;
                var memo = scriptContext.request.parameters.custpage_memo;
                log.debug('memo', memo);
                var nextApproverId = scriptContext.request.parameters.custpage_nextapprover;
                log.debug('nextApproverId', nextApproverId);
                var postingDate = scriptContext.request.parameters.custpage_postingdate;
                log.debug('postingDate', postingDate);


                var selectedPaymentsToVoidStrArr = selectedPaymentsToVoidStr.split(',');
                log.audit('selectedPaymentsToVoidStrArr', selectedPaymentsToVoidStrArr);

                var paymentsToVoidCount = selectedPaymentsToVoidStrArr.length;
                log.debug('paymentsToVoidCount', paymentsToVoidCount);

                var successfullyVoidedCount = 0;
                var paymentsToVoidIndex = 0;

                while (paymentsToVoidIndex < paymentsToVoidCount) {

                    var selectedPaymentToVoidStr = selectedPaymentsToVoidStrArr[paymentsToVoidIndex];
                    log.debug('selectedPaymentToVoidStr - line ' + paymentsToVoidIndex, selectedPaymentToVoidStr);

                    voidedStatusSublistObj.setSublistValue({
                        id: 'custpage_to_void_bill_payment_internal_id',
                        line: paymentsToVoidIndex,
                        value: selectedPaymentToVoidStr
                    });

                    var processedvpUrl = url.resolveRecord({
                        recordType: 'vendorpayment',
                        recordId: selectedPaymentToVoidStr
                    });
                    log.debug('processedvpUrl', processedvpUrl);

                    voidedStatusSublistObj.setSublistValue({
                        id: 'custpage_view_processed_billpayment',
                        line: paymentsToVoidIndex,
                        value: processedvpUrl
                    });


                    var voidedId = voidBillPayment(selectedPaymentToVoidStr);


                    var voidMessage = 'Failure';
                    var errMessage = '';

                    if (typeof(voidedId) == 'number' && voidedId != '' && voidedId != null){

                        successfullyVoidedCount++;
                        var nxtApprPostDateSubmitFieldError = '';


                        if (voidedId == selectedPaymentToVoidStr){
                            voidMessage = 'Success - direct void';
                        }else{
                            voidMessage = 'Success - created Voiding JE';

                            try {

                                var submitValsJE = {};
                                if (nextApproverId != '' && nextApproverId != null) {
                                    submitValsJE['nextapprover'] = nextApproverId;
                                }
                                if (postingDate != '' && postingDate != null){
                                    submitValsJE['trandate'] = postingDate;
                                }

                                if (memo != '' && memo != null){
                                    submitValsJE['memo'] = memo;
                                }

                                log.debug('submitValsJE', JSON.stringify(submitValsJE));

                                if (Object.keys(submitValsJE).length !== 0) {

                                    log.debug('setting next approver / posting date / memo on voiding JE', 'JE Internal ID: ' + voidedId);

                                    record.submitFields({
                                        type: record.Type.JOURNAL_ENTRY,
                                        id: voidedId,
                                        values: submitValsJE,
                                        options: {
                                            ignoreMandatoryFields: true
                                        }
                                    });

                                    log.debug('successfully set next approver / posting date / memo on voiding JE', 'JE Internal ID: ' + voidedId);
                                }
                            } catch (err_nxtapprpostdte) {
                                var nxtApprPostDateSubmitFieldError = 'Unable to set Next Approver / Posting Date / Memo on Voiding JE due to Error: ' + JSON.stringify(err_nxtapprpostdte.name);
                                log.error('Voiding JE: ' + voidedId, nxtApprPostDateSubmitFieldError);
                            }

                        }

                        errMessage += nxtApprPostDateSubmitFieldError;
                        voidMessage = voidMessage.substring(0, 300);  //max char length is 300
                    } else {
                        errMessage += voidedId;
                    }

                    if (voidMessage != '' && voidMessage != null) {

                        voidedStatusSublistObj.setSublistValue({
                            id: 'custpage_to_void_bill_payment_void_status',
                            line: paymentsToVoidIndex,
                            value: voidMessage
                        });
                    }

                    if (typeof(voidedId) == 'number' && voidedId != '' && voidedId != null) {
                        var jeUrl = url.resolveRecord({
                            recordType: 'journalentry',
                            recordId: voidedId
                        });

                        voidedStatusSublistObj.setSublistValue({
                            id: 'custpage_to_void_bill_payment_void_je',
                            line: paymentsToVoidIndex,
                            value: '<a href = "' + jeUrl + '" target="_blank">' + voidedId + '</a>'
                        });
                    }

                    if (errMessage != '' && errMessage != null) {
                        voidedStatusSublistObj.setSublistValue({
                            id: 'custpage_to_void_bill_payment_void_error',
                            line: paymentsToVoidIndex,
                            value: errMessage.substring(0, 300)  //max char length is 300
                        });
                    }

                    paymentsToVoidIndex++;
                    log.audit('Remaining governance units IN submit loop: ' + scriptObj.getRemainingUsage());
                }

                log.debug('successfullyVoidedCount', successfullyVoidedCount);

                var totalVoidProcessed = submittedformObj.addField({
                    id : 'custpage_totalvoidprocessed',
                    type : serverWidget.FieldType.INLINEHTML,
                    label : 'Void Process Totals'
                }).defaultValue = 'Successfully voided ' + successfullyVoidedCount + ' out of ' + paymentsToVoidCount +
                    ' selected Bill Payments';


                scriptContext.response.writePage(submittedformObj);

                log.audit('Remaining governance units after writing submit page: ' + scriptObj.getRemainingUsage());

            }
        }


        const voidBillPayment = (billPaymentId) => {

            var voidedId = null;

            try{
                log.debug('Attempting to Void Vendor Payment Internal ID: ' + billPaymentId);

                var voidedId = transaction.void({
                    type: transaction.Type.VENDOR_PAYMENT,
                    id: billPaymentId,
                });
                log.debug('voidedId', voidedId);

                if (voidedId == billPaymentId){
                    log.audit('Bill Payment Internal ID ' + billPaymentId,
                        'Successfully Voided');
                }else{
                    log.audit('Bill Payment Internal ID ' + billPaymentId,
                        'Successfully Voided - Created Voiding JE Internal ID ' + voidedId);
                }

            }catch(e){
                log.error('Bill Payment Internal ID ' + billPaymentId,
                    'Error occurred while Voiding Bill Payment: ' + JSON.stringify(e.toString()));

                voidedId = JSON.stringify(e.toString());
            }

            return voidedId;
        }


        const addSublistFields = (searchObj, sublistObj) => {

            sublistObj.addField({
                id: 'custpage_void',
                type: serverWidget.FieldType.CHECKBOX,
                label: 'Void'
            });
            sublistObj.addField({
                id: 'custpage_view',
                type: serverWidget.FieldType.URL,
                label: 'View'
            }).linkText = 'View';

            var searchColumns = searchObj.columns;

            for (searchColumn of searchColumns){
                log.debug('searchColumn.name: '+ searchColumn.name, 'searchColumn.label: ' + searchColumn.label);

                if (searchColumn.name == 'amount'){
                    sublistObj.addField({
                        id: 'custpage_' + searchColumn.name,
                        type: serverWidget.FieldType.CURRENCY,
                        label: searchColumn.label
                    });
                } else {
                    sublistObj.addField({
                        id: 'custpage_' + searchColumn.name,
                        type: serverWidget.FieldType.TEXT,
                        label: searchColumn.label
                    });
                }
            }

        }


        const addSelectedFilters = (searchObj, selected_params) => {


            var searchFilters_original = searchObj.filters;
            //log.debug('searchFilters_original', searchFilters_original);

            var addedDateCreatedSearchFilter = false;


             for (var selected_param in selected_params){
                    log.debug(selected_param, selected_params[selected_param]);

                    if (selected_param == 'subsidiaryfilter' || selected_param == 'namefilter' ||
                        selected_param == 'accountfilter' || selected_param == 'createdbyfilter' ||
                        selected_param == 'datecreatedfromfilter' || selected_param == 'datecreatedtofilter' ){

                        if (selected_params[selected_param] != null && selected_params[selected_param] != '' &&
                            selected_params[selected_param] != undefined) {

                            if (selected_param == 'datecreatedfromfilter' || selected_param == 'datecreatedtofilter') {

                                if (!addedDateCreatedSearchFilter) {
                                    var datecreatedFromSelected_param = selected_params['datecreatedfromfilter'];
                                    var datecreatedToSelected_param = selected_params['datecreatedtofilter'];

                                    if ((datecreatedFromSelected_param != '' && datecreatedFromSelected_param != null) &&
                                        (datecreatedToSelected_param != '' && datecreatedToSelected_param != null)) {
                                        log.audit('Both date created to and from NOT empty', 'searching WITHIN dates');

                                        var datecreatedFromSelected_param_formattedDate = formatDateforSearchFilter(datecreatedFromSelected_param);
                                        log.debug('datecreatedFromSelected_param_formattedDate', datecreatedFromSelected_param_formattedDate);
                                        var datecreatedToSelected_param_formattedDate = formatDateforSearchFilter(datecreatedToSelected_param);
                                        log.debug('datecreatedToSelected_param_formattedDate', datecreatedToSelected_param_formattedDate);

                                        var searchFilter_datecreated_selected_param = search.createFilter({
                                            name: 'datecreated',
                                            operator: search.Operator.WITHIN,
                                            values: [datecreatedFromSelected_param_formattedDate, datecreatedToSelected_param_formattedDate]
                                        });

                                    } else if ((datecreatedFromSelected_param != '' && datecreatedFromSelected_param != null)
                                        && (datecreatedToSelected_param == '' || datecreatedToSelected_param == null)) {
                                        log.audit('date created FROM is NOT empty, date created TO is empty', 'searching ONORAFTER from date');

                                        var datecreatedFromSelected_param_formattedDate = formatDateforSearchFilter(datecreatedFromSelected_param);
                                        log.debug('datecreatedFromSelected_param_formattedDate', datecreatedFromSelected_param_formattedDate);


                                        var searchFilter_datecreated_selected_param = search.createFilter({
                                            name: 'datecreated',
                                            operator: search.Operator.ONORAFTER,
                                            values: datecreatedFromSelected_param_formattedDate
                                        });

                                    } else if ((datecreatedToSelected_param != '' && datecreatedToSelected_param != null)
                                        && (datecreatedFromSelected_param == '' || datecreatedFromSelected_param == null)) {
                                        log.audit('date created TO is NOT empty, date created FROM is empty', 'searching ONORBEFORE to date');

                                        var datecreatedToSelected_param_formattedDate = formatDateforSearchFilter(datecreatedToSelected_param);
                                        log.debug('datecreatedToSelected_param_formattedDate', datecreatedToSelected_param_formattedDate);


                                        var searchFilter_datecreated_selected_param = search.createFilter({
                                            name: 'datecreated',
                                            operator: search.Operator.ONORBEFORE,
                                            values: datecreatedToSelected_param_formattedDate
                                        });

                                    }
                                    //else both cannot be null as default values of first/last date of month will be set

                                    searchFilters_original.push(searchFilter_datecreated_selected_param);
                                    addedDateCreatedSearchFilter = true;

                                }
                            }else if (selected_param == 'namefilter'){
                                var searchFilter_selected_param = search.createFilter({
                                    name: selected_param.slice(0,-6),
                                    operator: search.Operator.ANYOF,
                                    values: selected_params[selected_param]
                                });
                                searchFilters_original.push(searchFilter_selected_param);


                            }else{
                                var searchFilter_selected_param = search.createFilter({
                                    name: selected_param.slice(0,-6),
                                    operator: search.Operator.ANYOF,
                                    values: parseInt(selected_params[selected_param])
                                });
                                searchFilters_original.push(searchFilter_selected_param);
                            }

                        }
                    }
             }


            var searchFilters_after = searchObj.filters;
            log.debug('searchFilters_after', searchFilters_after);


        }


        const addRows = (searchObj, sublistObj) => {

            var searchColumns = searchObj.columns;


            var rowIndex = 0;
            searchObj.run().each(function(paymentSearchResult) {

                //log.debug('rowIndex: ' + rowIndex, 'paymentSearchResult: ' + paymentSearchResult);

                var vpId = paymentSearchResult.getValue({
                    name: 'internalid'
                });

                var vpUrl = url.resolveRecord({
                    recordType: 'vendorpayment',
                    recordId: vpId
                });
                //log.debug('vpUrl', vpUrl);

                sublistObj.setSublistValue({
                    id: 'custpage_view',
                    line: rowIndex,
                    value: vpUrl
                });


                for (searchColumn of searchColumns) {

                    var paymentSearchResultCol;
                    if (searchColumn.name == 'entity' || searchColumn.name == 'account' || searchColumn.name == 'subsidiary'){
                        paymentSearchResultCol = paymentSearchResult.getText(searchColumn);
                    }else{
                        paymentSearchResultCol = paymentSearchResult.getValue(searchColumn);

                    }
                    //log.debug('paymentSearchResultCol', paymentSearchResultCol);


                    if (paymentSearchResultCol != null && paymentSearchResultCol != '') {


                        if (searchColumn.name == 'amount'){

                            var vpAmount = paymentSearchResultCol;
                            if (vpAmount < 0){
                                vpAmount = vpAmount * -1;
                            }
                            //log.debug('vpAmount', vpAmount);

                            sublistObj.setSublistValue({
                                id: 'custpage_' + searchColumn.name,
                                line: rowIndex,
                                value: vpAmount
                            });
                        }else {
                            sublistObj.setSublistValue({
                                id: 'custpage_' + searchColumn.name,
                                line: rowIndex,
                                value: paymentSearchResultCol
                            });
                        }

                    }
                }
                rowIndex++;

                if (rowIndex == 4000){
                    return false;
                }


                return true;

            });

            return rowIndex;

        }


        const addFilterFields = (formObj, selected_params) => {


            formObj.addFieldGroup({
                id : 'filterfieldsgroup',
                label : 'Filters'
            });

            formObj.addField({
                id: 'custpage_subsidiary_filter',
                type: serverWidget.FieldType.SELECT,
                label: 'Subsidiary',
                source: -117,
                container: 'filterfieldsgroup'
            }).defaultValue = selected_params['subsidiaryfilter'];
            //log.audit('selected_params[subsidiaryfilter]', selected_params['subsidiaryfilter']);


            formObj.addField({
                id: 'custpage_vendor_multiselect_filter',
                type: serverWidget.FieldType.MULTISELECT,
                label: 'Payee/Vendor',
                source: -3,
                container: 'filterfieldsgroup'
            }).defaultValue = selected_params['namefilter'];


            formObj.addField({
                id: 'custpage_account_filter',
                type: serverWidget.FieldType.SELECT,
                label: 'Bank/Payment Account',
                source: -112,
                container: 'filterfieldsgroup'
            }).updateBreakType({
                breakType : serverWidget.FieldBreakType.STARTCOL
            }).defaultValue = selected_params['accountfilter'];


            formObj.addField({
                id: 'custpage_createdby_filter',
                type: serverWidget.FieldType.SELECT,
                label: 'Created By',
                source: -4,
                container: 'filterfieldsgroup'
            }).defaultValue = selected_params['createdbyfilter'];


            //date created filter
            var dateCreated_selected_formatted = formatDateforSuiteletField(selected_params['datecreatedfromfilter']);
            log.debug('dateCreated_selected_formatted', dateCreated_selected_formatted);

            formObj.addField({
                id: 'custpage_datecreated_from_filter',
                type: serverWidget.FieldType.DATE,
                label: 'Date Created - From',
                container: 'filterfieldsgroup'
            }).updateBreakType({
                breakType : serverWidget.FieldBreakType.STARTCOL
            }).defaultValue = dateCreated_selected_formatted;


            var dateCreatedTo_selected_formatted = formatDateforSuiteletField(selected_params['datecreatedtofilter']);
            log.debug('dateCreatedTo_selected_formatted', dateCreatedTo_selected_formatted);

            formObj.addField({
                id: 'custpage_datecreated_to_filter',
                type: serverWidget.FieldType.DATE,
                label: 'Date Created - To',
                container: 'filterfieldsgroup'
            }).defaultValue = dateCreatedTo_selected_formatted;
        }


        const formatDateforSuiteletField = (dateCreated_selected) => {

            //suiteanswers id 18223

            log.debug('dateCreated_selected', dateCreated_selected);

            var dateCreated_formatted;
            if (dateCreated_selected != null && dateCreated_selected != '' && dateCreated_selected != undefined) {

                var newDate = new Date(dateCreated_selected);
                newDate = newDate.setDate(newDate.getDate() + 1);  //have to add 1 as date seems to start at 0

                var dateCreated_formatted = format.parse({
                    value:new Date(newDate),
                    type: format.Type.DATE
                });

            }else{
                dateCreated_formatted = null;
            }

            return dateCreated_formatted;
        }

        const formatDateforSearchFilter = (dateCreated_selected) => {
            //suiteanswers id 23249

            var myDate = new Date(dateCreated_selected);
            myDate = myDate.setDate(myDate.getDate() + 1); //adding 1 because date seems to start at 0
            var formattedDate = format.format({
                value: new Date(myDate),
                type: format.Type.DATE
            });
            log.debug('formattedDate', formattedDate);
            return formattedDate;
        }


        const setDefaultFromToMonthDates = (selected_params) => {

            var myDate = new Date();

            //date is set back 1 because will add 1 in function 'formatDateforSuiteletField'
            var monthfirstDate = new Date(myDate.getFullYear(), myDate.getMonth(), 0);
            var monthlastDate = new Date(myDate.getFullYear(), myDate.getMonth() + 1, -1);

            log.debug('monthfirstDate', monthfirstDate);
            log.debug('monthlastDate', monthlastDate);

            selected_params['datecreatedfromfilter'] = monthfirstDate;
            selected_params['datecreatedtofilter'] = monthlastDate;
        }

        const getTodaysDate = () => {
            var todaysDate = new Date();
            todaysDate = todaysDate.setDate(todaysDate.getDate() - 1);
            //subtracting 'formatDateforSuiteletField' function seems to add 1

            var todaysDate_formatted = formatDateforSuiteletField(todaysDate);
            log.debug('todaysDate_formatted', todaysDate_formatted);

            return todaysDate_formatted;
        }


        return {onRequest}

    });
