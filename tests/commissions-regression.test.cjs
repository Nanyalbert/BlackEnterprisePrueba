'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'assets/js/comisiones-mensuales.js'), 'utf8');
const row = (article, net, gross) => ({
 Cliente: 'CASTILLO SALVADOR', Vendedor: 'ORTEGA CASTRO, VALENTIN',
 'Nro Cpte': '00005-00000972', Articulo: article,
 'Total S/Iva': net, 'Total C/Iva': gross
});
const baseCobro = (amount = 64400) => ({
 Cliente:'CASTILLO SALVADOR',Vendedor:'ORTEGA CASTRO, VALENTIN',
 NroVenta:'00005-00000972',NroComprobante:'00005-00000440','Total Importe':amount
});
async function calculate(ventas, cobros = [baseCobro()]) {
 const events = []; const elements = new Map();
 const get = id => {
  if (!elements.has(id)) elements.set(id, {
   value: ({med:'2',other:'3',ministry:'0',consumer:'2'})[id] ?? '',
   disabled:false,innerHTML:'',textContent:'',className:'',files:[],
   addEventListener(type,listener){this['on_'+type]=listener}
  });
  return elements.get(id);
 };
 for(const kind of ['ventas','cobros','recetas'])
  get(kind).files=[{name:kind+'.xlsx',size:1024,arrayBuffer:async()=>({kind})}];
 const sheets={
  ventas,cobros,
  recetas:[{Cliente:'CASTILLO SALVADOR',Vendedor:'ORTEGA CASTRO, VALENTIN',Medico:null}]
 };
 const XLSX={read:buf=>({Sheets:{Datos:{rows:sheets[buf.kind]}},SheetNames:['Datos']}),utils:{sheet_to_json:sheet=>sheet.rows}};
 class CustomEvent {constructor(type,options={}){this.type=type;this.detail=options.detail}}
 const document={getElementById:get,addEventListener(){},querySelectorAll(){return []}};
 const window={XLSX,dispatchEvent(event){if(event.type==='black:commissions-analyzed')events.push(event.detail)},addEventListener(){}};
 vm.runInNewContext(source,{window,document,XLSX,CustomEvent,console,Blob:class{},URL:{}},{timeout:2000});
 for (const k of ['ventas','cobros','recetas']) await get(k).on_change();
 assert.equal(get('analyze').disabled,false);
 get('analyze').on_click();
 assert.ok(events.length,'Expected commission analysis event');
 return JSON.parse(JSON.stringify(events.at(-1).rows));
}
test('a balanced negative discount is included in net, not an invalid sale',async()=>{
 const result=await calculate([row(null,-57851.24,-70000),row('ARMAZON',76033.06,92000),row('ORGANICO',35041.32,42400)]);
 assert.equal(result[0].hasSalesAdjustment,true);
 assert.equal(result[0].base,53223.14);
 assert.equal(result[0].commission,1596.69);
});
test('a zero-priced line is flagged and blocked from automatic commission',async()=>{
 const result=await calculate([row('MUESTRA',0,0),row('ORGANICO',60000,72600)]);
 assert.equal(result[0].hasNonCommissionableLines,true);
 assert.equal(result[0].commission,0);
 assert.match(result[0].reason,/Revisar líneas/);
});
test('refunds and negative receipts never create positive commission',async()=>{
 const result=await calculate([row(null,-826.45,-1000)],[baseCobro(-1000)]);
 assert.equal(result[0].commission,0);
 assert.match(result[0].reason,/Importe de cobro inválido/);
});
test('0.90 ARS net values require manual review',async()=>{
 const result=await calculate([row('SIMBOLICO',0.90,1.09),row('ORGANICO',60000,72600)]);
 assert.equal(result[0].commission,0);
 assert.equal(result[0].lowPriceCount,1);
});
test('a sale and receipt must match, otherwise no commission is generated',async()=>{
 const result=await calculate([row('ORGANICO',60000,72600)],[{...baseCobro(),NroVenta:'00005-99999999'}]);
 assert.equal(result[0].commission,0);
 assert.match(result[0].reason,/Sin venta identificada/);
});
