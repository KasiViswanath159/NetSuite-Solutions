/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 */
define([ 'N/log', 'N/query', 'N/ui/serverWidget' , 'N/record'],
    /**
 * @param{record} record
 */
    (log, query, serverWidget, record) => {
        /**
         * Defines the function definition that is executed before record is loaded.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @param {Form} scriptContext.form - Current form
         * @param {ServletRequest} scriptContext.request - HTTP request information sent from the browser for a client action only.
         * @since 2015.2
         */
        const beforeLoad = (scriptContext) => {
            if(scriptContext.type == scriptContext.UserEventType.VIEW){
                scriptContext.form.addTab(
                    {
                        id : 'custpage_dd_sql_tab',
                        label : 'PO-IR-VB-JE Information'
                    }
                );

                scriptContext.form.addField(
                    {
                        id: 'custpage_dd_suiteql_field',
                        type: serverWidget.FieldType.INLINEHTML,
                        label: 'SuiteQL Query Results',
                        container: 'custpage_dd_sql_tab'
                    }
                );

                let baseData = "";
                if (scriptContext.newRecord.type == record.Type.PURCHASE_ORDER) {
                    baseData = sqlQueryRunForPO(scriptContext.newRecord.id);
                } else {
                    baseData = sqlQueryRunForVB(scriptContext.newRecord.id);
                }
                const records = dataConversion(baseData);
                scriptContext.newRecord.setValue(
                    {
                        fieldId: 'custpage_dd_suiteql_field',
                        value: sqlResultsTableGenerate( records )
                    }
                );
            }
        }

        /**
         * Defines the function definition that is executed before record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const beforeSubmit = (scriptContext) => {

        }

        /**
         * Defines the function definition that is executed after record is submitted.
         * @param {Object} scriptContext
         * @param {Record} scriptContext.newRecord - New record
         * @param {Record} scriptContext.oldRecord - Old record
         * @param {string} scriptContext.type - Trigger type; use values from the context.UserEventType enum
         * @since 2015.2
         */
        const afterSubmit = (scriptContext) => {

        }

        const sqlQueryRunForVB = (vbId) => {
            if (!vbId) {
                return "";
            }
            const poIdQuerySql = `
                SELECT
                distinct 
                poline.transaction as 'po id'
                FROM
                transactionLine billLine
                inner join transaction billHead on billHead.id = billLine.transaction
                left join PreviousTransactionLineLink previousTran on previousTran.nextdoc = billLine.transaction and previousTran.nextline = billLine.id
                left join transactionline poline on previousTran.previousdoc = poline.transaction and previousTran.previousline = poline.id
                WHERE
                billLine.transaction = ${vbId}
                AND previousTran.linktype = 'OrdBill'
            `;
            const poResultArr = query.runSuiteQL( { query: poIdQuerySql, params: [] } ).asMappedResults();
            const poId = poResultArr && poResultArr.length > 0 && poResultArr[0]["po id"];
            if (!poId) {
                return "";
            }
            const sql= `	
                SELECT
                distinct 
                poHead.tranid as 'po num',
                poHead.type 'po type',
                poline.item 'po item',
                item.itemid 'dd id',
                poline.uniquekey,
                poline.rate,
                poline.quantity,
                poline.foreignamount,
                poline.quantitybilled 'bill qty',
                poline.quantityshiprecv 'receipt qty',
                poline.transaction as 'PO ID',
                irBillLine.transaction as 'ib id',
                irBillHead.transactionnumber as 'ib num',
                irBillHead.type  'ib type',
                irBillHead.custbody_dd_created_by_edi_script 'from edi',
                irBillLine.item 'ib item',
                irBillLine.uniquekey 'ib uniquekey',
                irBillLine.rate 'ib rate',
                irBillLine.quantity 'ib qty',
                irBillLine.foreignamount 'ib amount',
                vbLine.transaction as 'vb id',
                vbHead.transactionnumber as 'vb num',
                vbHead.type  'vb type',
                vbLine.item 'vb item',
                vbLine.uniquekey 'vb uniquekey',
                vbLine.quantity 'vb qty',
                vbLine.rate 'vb rate',
                vbLine.foreignamount 'vb amount',
                journal.linktype,
                JournalHead.transactionnumber as 'journal num',
                JournalHead.type 'journal Type',
                journalLne.item 'journal item',
                journalLne.uniquekey 'journal unique',
                journalLne.transaction 'journal id',
                journalLne.creditforeignamount 'credit amount',
                journalLne.debitforeignamount 'debit amount',
                journalLne.memo 'jline memo'
                FROM
                transactionLine poline
                inner join transaction poHead on poHead.id = poline.transaction
                inner join item item on item.id = poline.item
                left join NextTransactionLineLink nextVbIr on nextVbIr.previousdoc = poline.transaction and nextVbIr.previousline = poline.id
                right join transactionline irBillLine on nextVbIr.nextdoc = irBillLine.transaction and nextVbIr.nextline = irBillLine.id
                right join transaction irBillHead on irBillHead.id = irBillLine.transaction
                left join NextTransactionLineLink nextJournal on nextJournal.previousdoc = irBillLine.transaction and nextJournal.previousline = irBillLine.id and nextJournal.linktype = 'RcptBill'
                left join transactionline vbLine on nextJournal.nextdoc = vbLine.transaction and nextJournal.nextline = vbLine.id
                left join transaction vbHead on vbHead.id = vbLine.transaction
                left join NextTransactionLineLink journal on journal.previousdoc = irBillLine.transaction and journal.previousline = irBillLine.id and journal.linktype = 'BillVar'
                Left join transactionline journalLne on journal.nextdoc = journalLne.transaction and journal.nextline = journalLne.id
                left join transaction JournalHead on JournalHead.id = journalLne.transaction
                WHERE
                poHead.id = ${poId}
                AND (irBillHead.id = ${vbId} or (irBillHead.type = 'ItemRcpt' and vbHead.id is not null AND vbHead.id = ${vbId}))
                AND (journalLne.id is null or (journalLne.memo = 'Bill Price Variance' or journalLne.memo = 'Bill Quantity Variance'))
                AND poline.mainline = 'F'
                AND irBillLine.mainline = 'F'
                ORDER BY 'po num', poline.item, irBillHead.type, irBillLine.transaction		
	        `;
            return query.runSuiteQL( { query: sql, params: [] } ).asMappedResults();
        }

        const sqlQueryRunForPO = (poId) => {
            const sql= `	
                SELECT
                distinct 
                poHead.tranid as 'po num',
                poHead.type 'po type',
                poline.item 'po item',
                item.itemid 'dd id',
                poline.uniquekey,
                poline.rate,
                poline.quantity,
                poline.foreignamount,
                poline.transaction as 'po id',
                irBillHead.transactionnumber as 'ib num',
                irBillHead.type  'ib type',
                irBillLine.item 'ib item',
                irBillLine.uniquekey 'ib uniquekey',
                irBillLine.transaction as 'ib id',
                irBillLine.rate 'ib rate',
                irBillLine.quantity 'ib qty',
                irBillLine.foreignamount 'ib amount',
                JournalHead.transactionnumber as 'journal num',
                JournalHead.type 'journal type',
                journalLne.item 'journal item',
                journalLne.uniquekey 'journal unique',
                journalLne.transaction as 'journal id',
                journalLne.creditforeignamount 'credit amount',
                journalLne.debitforeignamount 'debit amount',
                journalLne.memo 'jline memo'
                FROM
                transactionLine poline
                left join transaction poHead on poHead.id = poline.transaction
                left join item item on item.id = poline.item
                left join NextTransactionLineLink nextVbIr on nextVbIr.previousdoc = poline.transaction and nextVbIr.previousline = poline.id
                left join transactionline irBillLine on nextVbIr.nextdoc = irBillLine.transaction and nextVbIr.nextline = irBillLine.id
                left join transaction irBillHead on irBillHead.id = irBillLine.transaction
                left join NextTransactionLineLink nextJournal on nextJournal.previousdoc = irBillLine.transaction and nextJournal.previousline = irBillLine.id and nextJournal.linktype = 'BillVar'
                Left join transactionline journalLne on nextJournal.nextdoc = journalLne.transaction and nextJournal.nextline = journalLne.id and (journalLne.memo = 'Bill Price Variance' or journalLne.memo = 'Bill Quantity Variance')
                left join transaction JournalHead on JournalHead.id = journalLne.transaction
                WHERE
                poHead.id = ${poId}
                AND poline.mainline = 'F'
                AND irBillLine.mainline = 'F'
                ORDER BY 'po num', poline.item		
	        `;
            return query.runSuiteQL( { query: sql, params: [] } ).asMappedResults();

        }

        const dataConversion = (dataaArr) => {
            const convertedDataArr = [];
            if (dataaArr && dataaArr.length > 0) {
                const posLineInfo = {};
                dataaArr.forEach(lineInfo => {
                    const poId = lineInfo["po id"];
                    const poNum = lineInfo["po num"];
                    const lineUniqueKey = lineInfo.uniquekey;
                    const ibLineUniqueKey = lineInfo["ib uniquekey"];
                    const lineType = lineInfo["ib type"];
                    const itemId = lineInfo["po item"];
                    const sku = lineInfo["dd id"];
                    const poRate = Number(lineInfo.rate);
                    const poQty = Number(lineInfo.quantity);
                    const poAmount = Number(lineInfo.foreignamount);
                    const irVbRate = Number(lineInfo["ib rate"]);
                    const irVbQty = Number(lineInfo["ib qty"]);
                    const irVbAmount = Number(lineInfo["ib amount"]);
                    const credit = Number(lineInfo["credit amount"]);
                    const debit = Number(lineInfo["debit amount"]);
                    const varianceType = lineInfo["jline memo"];
                    const ibId = lineInfo["ib id"];
                    const jLineUnique = lineInfo["journal unique"];
                    const ibLineId = ibId + "_" + ibLineUniqueKey;
                    const lineKey = "l" + lineUniqueKey;

                    if (!posLineInfo[poId]) {
                        posLineInfo[poId] = {
                            id: poId,
                            poNum: poNum,
                            lineGroup: {},
                            itemGroup: {}
                        }
                    }
                    const poInfo = posLineInfo[poId]
                    if (!poInfo.lineGroup[lineKey]) {
                        poInfo.lineGroup[lineKey] = {
                            ir: {
                                qty: 0,
                                price: 0,
                                amount: 0,
                                ibIdLine: {},
                                arr: []
                            },
                            vb: {
                                qty: 0,
                                price: 0,
                                amount: 0,
                                ibIdLine: {},
                                arr: []
                            },
                            je: {
                                credit: {price: 0, qty: 0},
                                debit: {price: 0, qty: 0},
                                jLineUnique: {},
                                arr: []
                            },
                            itemId: itemId,
                            sku: sku,
                            qty: poQty,
                            price: poRate,
                            amount: poAmount,
                        }
                    }
                    const poLineInfo = poInfo.lineGroup[lineKey];

                    if (lineType == "VendBill") {
                        if (!poLineInfo.vb.ibIdLine[ibLineId]){
                            poLineInfo.vb.arr.push(lineInfo);
                            poLineInfo.vb.price += irVbRate;
                            poLineInfo.vb.qty += irVbQty;
                            poLineInfo.vb.amount += irVbAmount;
                            poLineInfo.vb.ibIdLine[ibLineId] = true;
                        }

                        if (varianceType == "Bill Price Variance") {
                            if (!poLineInfo.je.jLineUnique[jLineUnique]){
                                poLineInfo.je.credit.price += credit;
                                poLineInfo.je.debit.price += debit;
                                poLineInfo.je.arr.push(lineInfo);
                                poLineInfo.je.jLineUnique[jLineUnique] = true;
                            }
                        } else if (varianceType == "Bill Quantity Variance") {
                            if (!poLineInfo.je.jLineUnique[jLineUnique]){
                                poLineInfo.je.credit.qty += credit;
                                poLineInfo.je.debit.qty += debit;
                                poLineInfo.je.arr.push(lineInfo);
                                poLineInfo.je.jLineUnique[jLineUnique] = true;
                            }
                        }
                    } else if (lineType == "ItemRcpt") {
                        if (!poLineInfo.ir.ibIdLine[ibLineId]){
                            poLineInfo.ir.arr.push(lineInfo);
                            poLineInfo.ir.price += irVbRate;
                            poLineInfo.ir.qty += irVbQty;
                            poLineInfo.ir.amount += irVbAmount;
                        }
                    }
                });

                for (const poId in posLineInfo) {
                    const poInfo = posLineInfo[poId];
                    const poNum = posLineInfo.poNum;
                    const poLineGroupInfo = poInfo.lineGroup;
                    for (const lineKey in poLineGroupInfo) {
                        const poLineInfo = poLineGroupInfo[lineKey];
                        const poQty = poLineInfo.qty;
                        const poPrice = poLineInfo.price;
                        const poAmount = poLineInfo.amount;
                        if (poLineInfo.ir.arr.length > 0) {
                            poLineInfo.ir.avgPriceOfRecord = poLineInfo.ir.price/poLineInfo.ir.arr.length;
                            poLineInfo.ir.avgPriceOfQty = poLineInfo.ir.qty ? poLineInfo.ir.amount/poLineInfo.ir.qty : 0;
                        }
                        const irQty = poLineInfo.ir.qty;
                        const irPrice = poLineInfo.ir.avgPriceOfQty || 0;
                        const irAmount = poLineInfo.ir.amount;

                        if (poLineInfo.vb.arr.length > 0) {
                            poLineInfo.vb.avgPriceOfRecord = poLineInfo.vb.price/poLineInfo.vb.arr.length;
                            poLineInfo.vb.avgPriceOfQty = poLineInfo.vb.qty ? poLineInfo.vb.amount/poLineInfo.vb.qty : 0;
                        }
                        const vbQty = poLineInfo.vb.qty;
                        const vbPrice = poLineInfo.vb.avgPriceOfQty || 0;
                        const vbAmount = poLineInfo.vb.amount;

                        const sku = poLineInfo.sku;
                        let jePriceVariance = 0;
                        let jeQtyVariance = 0;
                        if (poLineInfo.je.arr.length > 0){
                            jePriceVariance = poLineInfo.je.credit.price - poLineInfo.je.debit.price;
                            jeQtyVariance = poLineInfo.je.credit.qty - poLineInfo.je.debit.qty;
                        }

                        const pricePPV$ = Number(irQty)*(vbPrice - irPrice);
                        const qtyPPV$ = Number(vbQty - irQty)*vbPrice
                        const pricePPVPercent = vbAmount !== 0 ? 100 * pricePPV$ / vbAmount : "";
                        const qtyPPVPercent = vbAmount !== 0 ? 100 * qtyPPV$ / vbAmount : "";
                        const totalPpv = pricePPV$ + qtyPPV$;
                        const precision = 4;
                        convertedDataArr.push({
                            poNum: poNum,
                            sku: sku,
                            poQty: Number(poQty.toFixed(precision)),
                            poPrice: Number(poPrice.toFixed(precision)),
                            poAmount: Number(poAmount.toFixed(precision)),
                            irQty: Number(irQty.toFixed(precision)),
                            irPrice: Number(irPrice.toFixed(precision)),
                            irAmount: Number(irAmount.toFixed(precision)),
                            vbQty: Number(vbQty.toFixed(precision)),
                            vbPrice: Number(vbPrice.toFixed(precision)),
                            vbAmount: Number(vbAmount.toFixed(precision)),
                            qtyPpv: Number(qtyPPV$.toFixed(precision)),
                            pricePpv: Number(pricePPV$.toFixed(precision)),
                            qtyPPVPercent: Number(qtyPPVPercent === "" ? "" : qtyPPVPercent.toFixed(precision)),
                            pricePPVPercent: Number(pricePPVPercent === "" ? "" : pricePPVPercent.toFixed(precision)),
                            totalPpv: Number(totalPpv.toFixed(precision)),
                            priceVariance: Number(jePriceVariance.toFixed(precision)),
                            qtyVariance: Number(jeQtyVariance.toFixed(precision))
                        });
                    }
                }
            }

            return convertedDataArr;
        }

        const sqlResultsTableGenerate = (records) => {

            if ( records.length === 0 ) {
                return '<div><p>No records were found.</p></div>';
            }

            let thead = `
		<thead>
			<tr>
				<th>DDID</th>
				<th>IR QTY</th>
				<th>IR PRICE</th>
				<th>IR VALUE</th>			
				<th>VB QTY</th>
				<th>VB PRICE</th>
				<th>VB VALUE</th>
				<th>QTY PPV $</th>	
				<th>QTY PPV %</th>			
				<th>PRICE PPV $</th>		
				<th>PRICE PPV %</th>
				<th>TOTAL PPV</th>
				<th>JE Price Variance</th>
				<th>JE Qty Variance</th>
			</tr>
		</thead>`;


            let tbody = '<tbody>';

            for ( let r = 0; r < records.length; r++ ) {

                const record = records[r];

                tbody += `
				<tr>			
					<td>${record.sku}</td>
					<td>${record.irQty}</td>
					<td>${record.irPrice}</td>
					<td>${record.irAmount}</td>
					<td>${record.vbQty}</td>
					<td>${record.vbPrice}</td>
					<td>${record.vbAmount}</td>
					<td>${record.qtyPpv}</td>
					<td>${record.qtyPPVPercent}</td>
					<td>${record.pricePpv}</td>
					<td>${record.pricePPVPercent}</td>
					<td>${record.totalPpv}</td>
					<td>${record.priceVariance}</td>
					<td>${record.qtyVariance}</td>
				</tr>`;

            }

            tbody += '</tbody>';

            let stylesheet = `
		<style type = "text/css"> 
	
			/* Styled Table */
			/* https://dev.to/dcodeyt/creating-beautiful-html-tables-with-css-428l */
	
			.styled-table {
				border-collapse: collapse;
				margin: 25px 0;
				font-size: 0.9em;
				font-family: sans-serif;
				min-width: 400px;
				box-shadow: 0 0 20px rgba(0, 0, 0, 0.15);
				width: 100%;
			}			
	
			.styled-table th,
			.styled-table td {
				padding: 6px;
			}
	
			.styled-table thead tr {
				background-color: #607799;
				color: #ffffff;
				text-align: left;
			}			
	
			.styled-table tbody tr {
				border-bottom: thin solid #dddddd;
			}

			.styled-table tbody tr:nth-of-type(even) {
				background-color: #f3f3f3;
			}
	
			.styled-table tbody tr.active-row {
				font-weight: bold;
				color: #009879;
			}	
	
			.styled-table tbody tr:hover {
				background-color: #ffff99;
			}	
			
		</style>
	`;


            return `
		
		${stylesheet}
	
		<link rel="stylesheet" type="text/css" href="https://cdn.datatables.net/1.10.25/css/jquery.dataTables.css">
		<script type="text/javascript" charset="utf8" src="https://cdn.datatables.net/1.10.25/js/jquery.dataTables.js"></script>	
		
		<div style="margin-top: 6px; border: 1px solid #ccc; padding: 24px;">
	
			<table id="sqlResultsTable" class="styled-table" style="width: 100%;">
				${thead}
				${tbody}
			</table>
		
		</div>
		
		<script>
		
			window.jQuery = window.$ = jQuery;	
			
			$('#sqlResultsTable').DataTable( { "pageLength": 10, "lengthMenu": [ 10, 25, 50, 75, 100 ] } );
			
		</script>
	
	`;

        }

        return {beforeLoad, beforeSubmit, afterSubmit}
    });


