'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'assets/js/comisiones-mensuales.js'), 'utf8');const recipeSource = fs.readFileSync(path.join(__dirname, '..', 'assets/js/comisiones-recetas.js'), 'utf8');
const row = (article, net, gross) => ({
 Cliente: 'CASTILLO SALVADOR', Vendedor: 'ORTEGA CASTRO, VALENTIN',
 'Nro Cpte': '00005-00000972', Articulo: article,
 'Total S/Iva': net, 'Total C/Iva': gross
});
const baseCobro = (amount = 64400) => ({
 Cliente:'CASTILLO SALVADOR',Vendedor:'ORTEGA CASTRO, VALENTIN',
 NroVenta:'00005-00000972',NroComprobante:'00005-00000440','Total Importe':amount
});
async function calculate(ventas, cobros = [baseCobro()], rxRows = null, expectInvalid = false) {
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
  recetas:rxRows ?? [{Cliente:'CASTILLO SALVADOR',Vendedor:'ORTEGA CASTRO, VALENTIN',Medico:null}]
 };
 const XLSX={read:buf=>({Sheets:{Datos:{rows:sheets[buf.kind]}},SheetNames:['Datos']}),utils:{sheet_to_json:sheet=>sheet.rows}};
 class CustomEvent {constructor(type,options={}){this.type=type;this.detail=options.detail}}
 const document={getElementById:get,addEventListener(){},querySelectorAll(){return []}};
 const window={XLSX,dispatchEvent(event){if(event.type==='black:commissions-analyzed')events.push(event.detail)},addEventListener(){}};
 vm.runInNewContext(recipeSource,{window},{timeout:2000});
 vm.runInNewContext(source,{window,document,XLSX,CustomEvent,console,Blob:class{},URL:{}},{timeout:2000});
 for (const k of ['ventas','cobros','recetas']) await get(k).on_change();
 if(expectInvalid){assert.equal(get('analyze').disabled,true);assert.match(get('status-ventas').textContent,/Importe vacío o inválido/);return [];}
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

test('Ministry mixed sales require explicit line-based review',async()=>{
 const ventas=[{...row('ANTEOJO DE LEJOS',30000,36300),Cliente:'MINISTERIO DE SALUD'},{...row('LIQUIDO LIMPIACRISTALES',30000,36300),Cliente:'MINISTERIO DE SALUD'}];
 const cobros=[{...baseCobro(72600),Cliente:'MINISTERIO DE SALUD'}];
 const rows=await calculate(ventas,cobros,[]);
 assert.match(rows[0].reason,/venta mixta/);
 assert.equal(rows[0].commission,0);
 assert.equal(rows[0].base,60000);
});
test('Sales with different vendors are never automatically commissionable',async()=>{
 const rows=await calculate([{...row('ORGANICO',60000,72600),Vendedor:'OTRA PERSONA'}]);
 assert.equal(rows[0].commission,0);
 assert.match(rows[0].reason,/Vendedor diferente/);
});
test('Multiple receipts for same sale are limited to the collected amount',async()=>{
 const one=baseCobro(36300);
 const two={...baseCobro(36300),NroComprobante:'00005-00000441'};
 const rows=await calculate([row('ORGANICO',60000,72600)],[one,two]);
 assert.equal(rows.length,2);
 assert.equal(rows[0].base,30000);
 assert.equal(rows[1].base,30000);
 assert.equal(rows[0].commission,900);
 assert.equal(rows[1].commission,900);
});
test('Duplicate receipts are blocked',async()=>{
 const rows=await calculate([row('ORGANICO',60000,72600)],[baseCobro(36300),baseCobro(36300)]);
 assert.equal(rows[1].commission,0);
 assert.match(rows[1].reason,/Comprobante de cobro repetido/);
});
test('Invalid financial cells fail file validation',async()=>{
 const rows=await calculate([row('ORGANICO','',72600)],[baseCobro()],null,true);
 assert.equal(rows.length,0);
});

const prescription=(id,doctor,sale='')=>({Cliente:'CASTILLO SALVADOR',Vendedor:'ORTEGA CASTRO, VALENTIN',Medico:doctor,'Nro.Receta':id,NroVenta:sale});
test('Two prescriptions from one physician do not generate review',async()=>{const r=await calculate([row('ORGANICO',60000,72600)],[baseCobro(72600)],[prescription('1','ANA LOPEZ'),prescription('2','LOPEZ ANA')]);assert.equal(r[0].reason,'');assert.equal(r[0].commission,1200)});
test('Two physicians same rate but unresolved physician attribution',async()=>{const r=await calculate([row('ORGANICO',60000,72600)],[baseCobro(72600)],[prescription('1','ANA LOPEZ'),prescription('2','MARIA GARCIA')]);assert.equal(r[0].reason,'');assert.equal(r[0].commission,1200);assert.equal(r[0].doctorAttributionAmbiguous,true)});
test('Mixed physician presence blocks automatic rate selection',async()=>{const r=await calculate([row('ORGANICO',60000,72600)],[baseCobro(72600)],[prescription('1','ANA LOPEZ'),prescription('2','')]);assert.equal(r[0].rate,0);assert.equal(r[0].commission,0);assert.match(r[0].reason,/porcentaje ambiguo/)});
test('Explicit sale link wins over unrelated sale',async()=>{const r=await calculate([row('ORGANICO',60000,72600)],[baseCobro(72600)],[prescription('1','ANA LOPEZ','00005-00000972'),prescription('2','','00005-00000888')]);assert.equal(r[0].commission,1200);assert.equal(r[0].recipeMatches.length,1)});
test('Other sale prescriptions are ignored',async()=>{const r=await calculate([row('ORGANICO',60000,72600)],[baseCobro(72600)],[prescription('1','ANA LOPEZ','00005-00000888')]);assert.equal(r[0].commission,1800);assert.match(r[0].reason,/Sin receta/)});
test('All blank physician fields imply provisional no-physician rate',async()=>{const r=await calculate([row('ORGANICO',60000,72600)],[baseCobro(72600)],[prescription('1',''),prescription('2',null)]);assert.equal(r[0].commission,1800);assert.match(r[0].reason,/Receta sin médico/)});
