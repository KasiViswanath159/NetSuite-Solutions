/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 */
define(['N/runtime', 'N/search', 'N/url', "N/render", "N/log", "N/record", 'N/email'],

    (runtime, search, url, render, log, record, email) => {
        /**
         * Defines the Suitelet script trigger point.
         * @param {Object} scriptContext
         * @param {ServerRequest} scriptContext.request - Incoming request
         * @param {ServerResponse} scriptContext.response - Suitelet response
         * @since 2015.2
         */
        const onRequest = (scriptContext) => {
            let request = scriptContext.request;
            let response = scriptContext.response;
            const poId = request.parameters.poId;
            log.debug("request.parameters", request.parameters);
            try{
                if (poId) {
                    record.submitFields({
                        type: record.Type.PURCHASE_ORDER,
                        id: poId,
                        values: {
                            custbody_dd_approval_confirm_datetime: new Date()
                        }
                    });
                    const poInfo = search.lookupFields({
                        type: record.Type.PURCHASE_ORDER,
                        id: poId,
                        columns: ["custbody_pwc_buyeremail", "tranid"]
                    });
                  // dashmartorders@doordash.com  && poInfo.custbody_pwc_buyeremail
                    poInfo && email.send({
                        author: "8266872",
                        recipients: "dashmartorders@doordash.com",
                        subject: `Purchase order ${poInfo.tranid} has been approved!`,
                        body: "PO approval has been acknowledged!",
                        relatedRecords: {
                            transactionId: poId
                        }
                    });
                }
                const message = poId ? `
                <style>
                    .message {
                      text-transform: uppercase;
                      background: #ececec;
                      color: #555;
                      cursor: help;
                      font-family: "Gill Sans", Impact, sans-serif;
                      font-size: 16px;
                      margin: 100px 75px 10px 75px;
                      padding: 15px 20px;
                      position: relative;
                      text-align: center;
                      -webkit-transform: translateZ(0);
                      -webkit-font-smoothing: antialiased;
                    }
                </style>
                <script>
                    setTimeout(
                        function(){
                            window.close();
                        }, 5000);
                </script>
                <div class="message">Approval Successfully (No actual action just a message)!</div>
                ` : sendEmail(8336006);
                response.write({output: message});
            }catch (e) {
                log.debug("exception", e);
            }
        }

        const sendEmail = (poId) => {
            const myMergeResult = render.mergeEmail({
                templateId: 382,
                entity: {
                    type: 'employee',
                    id: 8266872
                },
                recipient: {
                    type: 'vendor',
                    id: 170210
                },
                transactionId: poId,
            });
            let emailInfo = myMergeResult;
            const emailContent = emailInfo.body + `
                <br/>
                <br/>
                <a href="https://3938860.extforms.netsuite.com/app/site/hosting/scriptlet.nl?script=2271&deploy=1&compid=3938860&h=75bcf6256f998903bf6c&poId=" + poId
                 style="background-color: #4CAF50;color: white;padding: 5px 10px;text-align: center;text-decoration: none;display: inline-block;font-size: 16px;">Confirm1</a>
            `;
            if (emailContent) {
                email.send({
                    author: "8266872",
                    recipients: "500365",
                    subject: emailInfo.subject,
                    body: emailContent
                });
            }

            return "send email successfully";
        }

        return {onRequest}

    });
