/**
 *@NApiVersion 2.x
 *@NScriptType ScheduledScript
 *@NModuleScope Public
 */
 define(["N/search", "N/record", "N/runtime", "N/task", "N/log", "N/email", "N/file", "N/error"],
    function(search, record, runtime, task, log, email, file, error) {

        function execute(context) {
            try {
                log.debug('execute', 'Script execution started');
                var title = 'dd_hrc_cust_reactivation_ss.execute';
                // Retrieve script parameters
                var scriptObj = runtime.getCurrentScript();
                var author = scriptObj.getParameter({ name: 'custscript_dd_author' });
                var recipientEmail = scriptObj.getParameter({ name: 'custscript_dd_email_recipients' });
                var localProcessedFolder = scriptObj.getParameter({
                    name: 'custscript_processed_folder'
                });
                var recipientEmailArray = recipientEmail ? recipientEmail.split(",") : [];
                log.debug(title, "localProcessedFolder: " + localProcessedFolder);
                log.debug(title, "author: " + author + ", recipientEmailArray: " + recipientEmailArray);

                //********************** CUSTOMER SEARCH **********************
                log.debug('execute', 'Loading customer search');
                var obj_customer = search.load({
                    id: 'customsearch_customer_reactivation', // Customer Reactivation Via HRC [DO NOT DELETE/MODIFY USED IN SCRIPT]
                    type: 'customer'
                });

                log.debug('execute', 'Running customer search');
                var obj_customer = obj_customer.run(); // Run Saved Search
                var customersData = []; // Array to store customer details for the report

                obj_customer.each(function(result) {
                    log.debug('Customer Record', 'Processing customer result');

                    var i_customer = result.getValue({ name: "internalid", label: "Internal ID" }); // Customer
                    var i_overdueBalance = result.getValue({ name: "overduebalance", label: "Overdue Balance" });
                   var i_customerName = result.getValue({ name: "altname", label: "Customer Name" });
                    log.debug('Customer Details', { i_customer: i_customer, i_overdueBalance: i_overdueBalance,i_customerName:i_customerName });

                    if (i_overdueBalance == 0) {
                        try {
                            log.debug('Updating Customer Fields', { customerId: i_customer });
                            var id = record.submitFields({
                                type: 'customer',
                                id: i_customer,
                                values: {
                                    'custentity7': 2,   // Activated
                                    'custentity8': 15   // ReasonReactivation: Paid or Past Due Balance
                                }
                            });
                            log.debug('Customer Update Successful', { customerId: i_customer, recordId: id });
                        } catch (e) {
                            log.error('Error Updating Customer Fields', { customerId: i_customer, error: e.message });
                        }

                        // Add customer details to the report
                        customersData.push({
                            internalId: i_customer,
                            overdueBalance: i_overdueBalance,
                            customerName: i_customerName
                        });
                    }
                    var unitsRemaining = runtime.getCurrentScript().getRemainingUsage();
                    log.debug('Usage Units Remaining', unitsRemaining);

                    if (unitsRemaining <= 9980) {
                        log.debug('Rescheduling Script', 'Usage limit nearing threshold, rescheduling script');
                        rescheduleScript();
                        return false;
                    }

                    return true; 
                });

                // If there are reactivated customers, generate the report and send an email
                if (customersData.length > 0) {
                    var csvFile = generateCSV(customersData,localProcessedFolder);
                    sendEmailWithReport(csvFile,recipientEmailArray,author);
                }

            } catch (e) {
                log.error("Error", e.message);
            }
        }

        function rescheduleScript() {
            try {
                log.debug('Rescheduling Script', 'Attempting to reschedule script');
                var scheduledScriptTask = task.create({
                    taskType: task.TaskType.SCHEDULED_SCRIPT
                });
                scheduledScriptTask.scriptId = 'customscript_customer';
                scheduledScriptTask.deploymentId = 'customdeploy1';
                var scheduledId = scheduledScriptTask.submit();
                log.debug('Reschedule Successful', { scheduledId: scheduledId });
            } catch (e) {
                log.error('Error Rescheduling Script', e.message);
            }
        }

        function generateCSV(customersData,localProcessedFolder) {
            var timestamp = new Date().toISOString().replace(/[-T:.]/g, '');
            var fileName = 'Reactivated_Customers_Report_' + timestamp + '.csv';
            var csvContent = 'Internal ID,Customer Name,Overdue Balance\n';
            customersData.forEach(function(customer) {
                csvContent += escapeCSVValue(customer.internalId) + ',' + 
                          escapeCSVValue(customer.customerName) + ',' + 
                          escapeCSVValue(customer.overdueBalance) + '\n';
            });

            var fileObj = file.create({
                name: fileName,
                fileType: file.Type.CSV,
                contents: csvContent,
                folder: localProcessedFolder
            });

            return fileObj.save();
        }
      
       function escapeCSVValue(value) {
        if (typeof value === 'string') {
            return '"' + value.replace(/"/g, '""') + '"'; 
        }
        return '"' + value + '"'; 
       }
      
        function sendEmailWithReport(fileId,recipientEmailArray,author) {
            var fileObj = file.load({ id: fileId });

            email.send({
                author: author,
                recipients: recipientEmailArray,
                subject: 'Reactivated Customers Report',
                body: 'Please find attached the report of reactivated customers.',
                attachments: [fileObj]
            });

            log.debug('Email sent with report attachment.');
        }

        return {
            execute: execute
        };
    });
