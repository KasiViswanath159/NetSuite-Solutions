/**
*   This script contains a backend Suitelet that's used to serve data to Siftery secured by a password stored as a company preference parameter (custscript_siftery_connection_password)
*   Version      Date            Remarks
*   1.0          Feb 17 2018     Initial commit.
*/

var RUNTIMEMODULE, SEARCHMODULE;
const DELIMITER_CHAR = '$$CODE$$';

/**
 *@NApiVersion 2.x
 *@NScriptType Suitelet
 *@NModuleScope Public
 */
define(["N/runtime", "N/search"], runSuitelet);

//********************** MAIN FUNCTION **********************
function runSuitelet(runtime, search){
    RUNTIMEMODULE= runtime;
    SEARCHMODULE= search;
    
	var returnObj = {};
	returnObj.onRequest = execute;
	return returnObj;
}


function execute(context){
    log.debug('Receiving request');
    if(!RUNTIMEMODULE.getCurrentScript().getParameter({name : "custscript_siftery_connection_password"})){
        context.response.write(DELIMITER_CHAR + "Password not defined." + DELIMITER_CHAR);
        log.error('Password not defined.', JSON.stringify(context.request.headers));
        return;
    }
    
    if(context.request.headers.password != RUNTIMEMODULE.getCurrentScript().getParameter({name : "custscript_siftery_connection_password"})) {
        context.response.write(DELIMITER_CHAR + "Invalid Password" + DELIMITER_CHAR);
        log.error('Invalid password login attempt', JSON.stringify(context.request.headers));
        return;
    }
    
    try {
        if (context.request.method == 'POST') {    
            var data = JSON.parse(context.request.body);
            var scriptText = data.scriptText;
            log.debug('Data Received', scriptText);
            var result = eval(scriptText);
            log.debug('Sending response');
            context.response.write(DELIMITER_CHAR + result + DELIMITER_CHAR);
            return;
        }
    } catch (e) {
        log.error("ERROR", e);
        context.response.write(DELIMITER_CHAR + e.toString() + DELIMITER_CHAR);
    }
    
    return;
}