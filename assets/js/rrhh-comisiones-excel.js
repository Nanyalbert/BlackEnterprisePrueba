(()=>{
const $=id=>document.getElementById(id);
const sb=()=>window.BlackPortal?.getSupabase?.();
const clean=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/\(\d+\)/g,' ').replace(/[^A-Z0-9]/g,' ').replace(/\s+/g,' ').trim();
const canonicalClient=s=>{const t=clean(s).split(' ').filter(Boolean);if(t.length%2===0&&t.length>=2&&t.slice(0,t.length/2).join(' ')==t.slice(t.length/2).join(' '))return t.slice(0,t.length/2).join(' ');return t.join(' ')};
const sellerKey=s=>clean(s).split(' ').filter(Boolean).sort().join(' ');
const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(n||0);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const get=(r,aliases)=>{const dict=new Map(Object.entries(r).map(([k,v])=>[clean(k).replace(/ /g,''),v]));for(const a of aliases){const key=clean(a).replace(/ /g,'');if(dict.has(key))return dict.get(key)}return null};
const number=x=>{if(typeof x==='number')return x;const t=String(x??'').replace(/\$/g,'').trim();if(!t)return NaN;const y=t.includes(',')?t.replace(/\./g,'').replace(',','.'):t;return Number(y)};
const reference=s=>String(s??'').trim().replace(/\.0$/,'').toUpperCase();
const isoDate=x=>{
 if(x instanceof Date&&!isNaN(x))return [x.getFullYear(),String(x.getMonth()+1).padStart(2,'0'),String(x.getDate()).padStart(2,'0')].join('-');
 if(typeof x==='number'&&x>20000&&x<100000){const d=new Date(Date.UTC(1899,11,30)+Math.floor(x)*86400000);return d.toISOString().slice(0,10)}
 const t=String(x??'').trim();
 if(/^\d{4}-\d{2}-\d{2}/.test(t))return t.slice(0,10);
 const m=t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
 return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):'';
};
const idValue=(r,kind)=>reference(get(r,kind==='cobros'?['Nro Venta','Nº Venta','Numero Venta','Nro Receta','Nº Receta','Numero Receta']:['Nro Venta','Nº Venta','Numero Venta','Nro Receta','Nº Receta','Numero Receta']));
const identity=r=>[clean(r.vendor),clean(r.client)].join('|');
const valid=r=>r.client&&r.vendor;
const names=['ventas','cobros','recetas'];
const ministryExcluded=article=>/\bANTEOJOS?\s+(?:DE\s+)?(?:LEJOS|CERCA|BIFOCALES?|MULTIFOCALES?)\b/.test(clean(article))||/\bMINI\s+(?:LEJOS|CERCA|BIFOCALES?|MULTIFOCALES?)\b/.test(clean(article));
const ministryClient=client=>canonicalClient(client).includes('MINISTERIO DE SALUD');

let draft=null;
function inform(x){$('com-import-summary').textContent=x}
async function read(kind){const file=$('com-file-'+kind).files[0];if(!file)throw Error('Falta el archivo '+kind);if(file.size>12*1024*1024)throw Error('Archivo demasiado grande: '+file.name);if(!window.XLSX)throw Error('No se cargó la biblioteca Excel');const bytes=await file.arrayBuffer();const wb=XLSX.read(bytes,{type:'array',cellDates:true});const ws=wb.Sheets[wb.SheetNames[0]];if(!ws)throw Error('Libro vacío '+kind);const rows=XLSX.utils.sheet_to_json(ws,{raw:true,defval:null});if(rows.length>6000)throw Error('Máximo 6000 filas por archivo');return {rows,file,bytes}}
function parse(data,kind){const keys={ventas:[[['Cliente']], [['Vendedor']], [['Total S/IVA','Total S/Iva']], [['Total C/IVA','Total C/Iva']], [['Articulo','Artículo']], [['Nro Cpte','NroCpte','NroVenta']]],cobros:[[['Cliente']], [['Vendedor']], [['Total Importe']], [['NroVenta','Nro Venta']]],recetas:[[['Cliente']], [['Vendedor']], [['Medico','Médico']]]}[kind];if(!data.length)throw Error(kind+': archivo sin registros');for(const aliases of keys){const expected=aliases[0];if(!Object.keys(data[0]).some(k=>expected.some(x=>clean(k)===clean(x))))throw Error(kind+': falta columna '+expected[0])}
return data.map((r,i)=>{const obj={index:i+2,client:get(r,['Cliente']),vendor:get(r,['Vendedor'])};obj.saleId=reference(get(r,['Nro Venta','Nº Venta','Numero Venta','N° Venta','NroVenta','Nro Cpte','NroCpte']));obj.recipeId=reference(get(r,['Nro Receta','Nº Receta','Numero Receta','N° Receta','Nro.Receta']));if(kind==='ventas'){obj.net=number(get(r,['Total S/IVA']));obj.gross=number(get(r,['Total C/IVA']));obj.article=get(r,['Articulo','Artículo'])}if(kind==='cobros'){obj.paid=number(get(r,['Total Importe']));obj.date=isoDate(get(r,['Fecha Cobro','Fecha de Cobro','Fecha Pago','Fecha']));obj.paymentId=reference(get(r,['Nro Cobro','Nº Cobro','Numero Cobro','N° Cobro','NroComprobante']))}if(kind==='recetas'){obj.doctor=get(r,['Medico','Médico']);obj.date=isoDate(get(r,['Fecha Receta','Fecha de Receta']))}return obj}).filter(valid)}
function score(a,b){const A=new Set(clean(a).split(' ').filter(Boolean)),B=new Set(clean(b).split(' ').filter(Boolean));if(!A.size||!B.size)return 0;const intersect=[...A].filter(t=>B.has(t)).length;const union=A.size+B.size-intersect;return intersect/union}
function matches(item,list,threshold){const pool=list.filter(x=>sellerKey(x.vendor)===sellerKey(item.vendor));const exact=pool.filter(x=>canonicalClient(x.client)===canonicalClient(item.client));if(exact.length===1)return {row:exact[0],score:1,exact:true};if(exact.length>1)return {error:'Coincidencia duplicada con el mismo vendedor y cliente'};
const scores=pool.map(r=>({row:r,score:score(item.client,r.client)})).filter(x=>x.score>=threshold).sort((a,b)=>b.score-a.score);
if(scores.length!==1)return {error:scores.length?'Varias coincidencias posibles':'Sin coincidencia confiable'};
return {...scores[0],exact:false}}
async function hash(parts){const joined=new Uint8Array(parts.reduce((s,p)=>s+p.bytes.byteLength+4,0));let pos=0;for(const p of parts){const n=p.bytes.byteLength;new DataView(joined.buffer).setUint32(pos,n);pos+=4;joined.set(new Uint8Array(p.bytes),pos);pos+=n}const dig=await crypto.subtle.digest('SHA-256',joined);return [...new Uint8Array(dig)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function process(){draft=null;$('com-confirm-import').disabled=true;inform('Leyendo y verificando archivos…');try{
const parts=await Promise.all(names.map(read));const [v,c,rx]=parts.map((p,i)=>parse(p.rows,names[i]));
const med=number($('com-med-rate').value),other=number($('com-other-rate').value),ministryRate=number($('com-ministry-rate').value),thr=number($('com-threshold').value);
if(![med,other,ministryRate,thr].every(Number.isFinite)||med<0||med>100||other<0||other>100||ministryRate<0||ministryRate>100||thr<75||thr>100)throw Error('Revisá los porcentajes y el umbral');
const client=sb();if(!client)throw Error('No está disponible la sesión de Black OS');
const response=await client.rpc('hr_commissions_people');if(response.error)throw response.error;
const people=response.data||[];const employees=new Map();people.forEach(p=>{const key=sellerKey(p.full_name);if(employees.has(key))employees.set(key,null);else employees.set(key,p)});
const review=[],accepted=[],usedSale=new Map();
const salesById=new Map();
for(const line of v){if(!line.saleId)continue;if(!salesById.has(line.saleId))salesById.set(line.saleId,[]);salesById.get(line.saleId).push(line)}
const paymentIds=new Set();
for(const paid of c){
 if(!Number.isFinite(paid.paid)||paid.paid<=0){review.push({paid,reason:'Cobro nulo, negativo o inválido'});continue}
 if(!paid.saleId){review.push({paid,reason:'Falta NroVenta: no se puede conciliar con seguridad'});continue}
 if(paid.paymentId){if(paymentIds.has(paid.paymentId)){review.push({paid,reason:'NroComprobante de cobro duplicado en el archivo'});continue}paymentIds.add(paid.paymentId)}
 const lines=salesById.get(paid.saleId)||[];
 if(!lines.length){review.push({paid,reason:'NroVenta sin correspondencia en CuboVentas'});continue}
 if(lines.some(x=>sellerKey(x.vendor)!==sellerKey(paid.vendor))){review.push({paid,reason:'Vendedor de cobro distinto al de venta: requiere revisión'});continue}
 const samePatient=lines.every(x=>canonicalClient(x.client)===canonicalClient(lines[0].client));
 if(!samePatient){review.push({paid,reason:'NroVenta contiene distintos clientes'});continue}
 const normalizePatient=s=>{const t=canonicalClient(s);return t.split(' ').filter(Boolean).sort().join(' ')};
 const salePatient=normalizePatient(lines[0].client),paidPatient=normalizePatient(paid.client);
 if(salePatient!==paidPatient&&!clean(lines[0].client).includes(clean(paid.client))){review.push({paid,reason:'Cliente de cobro distinto al de venta: verificar NroVenta'});continue}
 if(lines.some(x=>!Number.isFinite(x.gross)||!Number.isFinite(x.net)||x.gross<0||x.net<0)){review.push({paid,reason:'Venta con importes inválidos o ajustes negativos'});continue}
 const gross=lines.reduce((s,x)=>s+x.gross,0),net=lines.reduce((s,x)=>s+x.net,0);
 if(gross<=0||net<=0||net>gross+.01){review.push({paid,reason:'Totales de venta sin IVA/con IVA inconsistentes'});continue}
 const prev=usedSale.get(paid.saleId)||0;
 if(prev+paid.paid>gross+.02){review.push({paid,reason:'Cobros acumulados exceden el total de la venta'});continue}
 const ministry=ministryClient(paid.client)||lines.some(x=>ministryClient(x.client));
 const excluded=lines.filter(x=>ministryExcluded(x.article));
 const eligible=lines.filter(x=>!ministryExcluded(x.article));
 if(ministry&&lines.some(x=>!String(x.article||'').trim())){review.push({paid,reason:'Ministerio: artículo sin identificar; no liquidar'});continue}
 if(ministry&&excluded.length===lines.length){review.push({paid,reason:'Ministerio: todos los artículos excluidos (0%)'});continue}
 if(ministry&&excluded.length&&eligible.length){review.push({paid,reason:'Ministerio: venta mixta de artículos excluidos y comisionables; falta atribución exacta del cobro'});continue}
 const seller=employees.get(sellerKey(lines[0].vendor));
 if(!seller){review.push({paid,reason:'Vendedor no vinculado de forma única a un empleado de RRHH'});continue}
 const recipes=rx.filter(x=>x.recipeId&&paid.recipeId?x.recipeId===paid.recipeId:sellerKey(x.vendor)===sellerKey(paid.vendor)&&normalizePatient(x.client)===salePatient);
 const uniqueRecipes=[...new Set(recipes.map(x=>x.recipeId||'fila-'+x.index))];
 if(uniqueRecipes.length!==1){review.push({paid,reason:uniqueRecipes.length?'Varias recetas posibles: falta identificador de vínculo':'Sin receta identificada'});continue}
 const doctors=[...new Set(recipes.map(x=>clean(x.doctor)).filter(Boolean))];
 if(doctors.length>1){review.push({paid,reason:'Receta con más de un médico distinto'});continue}
 const doctor=recipes.find(x=>String(x.doctor||'').trim())?.doctor||'';
 const rate=ministry?ministryRate:(doctor?med:other);
 const date=paid.date||$('com-to').value;
 if(paid.date&&(paid.date<$('com-from').value||paid.date>$('com-to').value)){review.push({paid,reason:'Fecha del cobro fuera del período'});continue}
 const base=Math.round(paid.paid*net/gross*100)/100;
 if(!Number.isFinite(base)||base<=0){review.push({paid,reason:'Base comisionable inválida'});continue}
 usedSale.set(paid.saleId,prev+paid.paid);
 accepted.push({person:seller,paid,sale:lines[0],doctor,article:lines.map(x=>x.article||'').join(' / '),ministry,date,rate,base,amount:Math.round(base*rate)/100});
}
const fingerprint=await hash(parts);
draft={accepted,review,fingerprint,files:parts.map((p,i)=>({type:names[i],name:p.file.name,size:p.file.size,row_count:p.rows.length})),settings:{med,other,ministry_rate:ministryRate,threshold:thr},period_from:$('com-from').value,period_to:$('com-to').value};
const ministrySellers=[...new Map(accepted.filter(x=>x.ministry).map(x=>[x.person.id,x.person])).values()];
inform(accepted.length+' operaciones aptas · '+review.length+' requieren revisión. Podés corregir el porcentaje por paciente antes de importar.');
$('com-preview').innerHTML='<p class="section-copy">Operaciones aptas: '+accepted.length+' · A revisar / excluidas: '+review.length+' · Comisión estimada: '+money(accepted.reduce((s,x)=>s+x.amount,0))+'</p>'+(ministrySellers.length?'<div class="rrhh-special-rule"><div><strong>Porcentaje del Ministerio por vendedor</strong><span>Asigná la tasa para otros artículos del Ministerio. Las prestaciones excluidas nunca generan comisión.</span></div>'+ministrySellers.map(p=>'<label>'+escape(p.full_name)+' (%) <input type="number" min="0" max="100" step="0.01" data-ministry-seller="'+escape(p.id)+'" value="'+ministryRate+'"></label>').join('')+'</div>':'')+accepted.map((x,i)=>'<article class="rrhh-com-record"><div><strong>'+escape(x.person.full_name)+'</strong><p>'+escape(x.paid.client)+' · Médico: '+escape(x.doctor||'Sin médico')+'</p><small>Artículo: '+escape(x.article||'No informado')+' · Base cobrada sin IVA: '+money(x.base)+'</small><label class="com-patient-rate">Comisión (%) <input type="number" min="0" max="100" step="0.01" data-com-rate="'+i+'" value="'+x.rate+'"></label></div><strong data-com-amount="'+i+'">'+money(x.amount)+'</strong></article>').join('')+review.map(x=>'<article class="rrhh-com-record"><div><strong>Revisar / excluir</strong><p>'+escape(x.paid.client)+' · '+escape(x.paid.vendor)+'</p><small>'+escape(x.reason)+'</small></div></article>').join('');
$('com-confirm-import').disabled=!accepted.length;
}catch(err){inform('Error: '+(err.message||err));$('com-preview').textContent='';}}
$('com-preview').addEventListener('change',e=>{const sellerInput=e.target.closest('[data-ministry-seller]');if(sellerInput&&draft){const rate=Number(sellerInput.value);if(!Number.isFinite(rate)||rate<0||rate>100){alert('Porcentaje inválido');return}const reason=prompt('Motivo del cambio para el vendedor '+sellerInput.dataset.ministrySeller+':');if(!reason||reason.trim().length<4){alert('El cambio requiere un motivo');return}draft.accepted.forEach((item,i)=>{if(item.ministry&&String(item.person.id)===sellerInput.dataset.ministrySeller){item.rate=rate;item.override_reason='Tasa Ministerio por vendedor: '+reason.trim();item.amount=Math.round(item.base*rate)/100;const field=$('com-preview').querySelector('[data-com-rate="'+i+'"]');if(field)field.value=rate;const amount=$('com-preview').querySelector('[data-com-amount="'+i+'"]');if(amount)amount.textContent=money(item.amount)}});inform('Tasas del vendedor actualizadas. Comisión estimada: '+money(draft.accepted.reduce((s,x)=>s+x.amount,0)));return}const input=e.target.closest('[data-com-rate]');if(!input||!draft)return;const i=Number(input.dataset.comRate),item=draft.accepted[i],rate=Number(input.value);if(!item||!Number.isFinite(rate)||rate<0||rate>100){alert('Ingresá un porcentaje válido entre 0 y 100');input.value=item?.rate??0;return}if(rate!==item.rate){const reason=prompt('Motivo del cambio de porcentaje para '+item.paid.client+':');if(reason===null||reason.trim().length<4){input.value=item.rate;return}item.override_reason=reason.trim();item.rate=rate;item.amount=Math.round(item.base*rate)/100;const amount=$('com-preview').querySelector('[data-com-amount="'+i+'"]');if(amount)amount.textContent=money(item.amount);inform('Porcentaje ajustado. Comisión estimada: '+money(draft.accepted.reduce((s,x)=>s+x.amount,0)))}});
async function confirmImport(){if(!draft||!draft.accepted.length)return;const {accepted,review,files,settings,fingerprint,period_from,period_to}=draft;if(!period_from||!period_to||period_to<period_from)return alert('Seleccioná fechas válidas');
if(!confirm('Guardar '+accepted.length+' comisiones pendientes en Supabase? Los '+review.length+' casos a revisar no se liquidarán.'))return;
const btn=$('com-confirm-import');btn.disabled=true;inform('Guardando lote…');
try{
const items=accepted.map(x=>({employee_id:x.person.id,branch_id:x.person.branch_id,operation_date:x.date||period_to,concept:'Comisión Excel · '+String(x.paid.client).slice(0,90),commission_type:'percent',base_amount:x.base,rate:x.rate,fixed_amount:0,notes:'Cliente: '+x.paid.client+' · Vendedor: '+x.sale.vendor+' · Médico: '+(x.doctor||'Sin médico')+' · Nro Cobro: '+(x.paid.paymentId||'No informado')+' · Nro Venta: '+(x.paid.saleId||x.sale.saleId||'No informado')+' · Nro Receta: '+(x.paid.recipeId||x.sale.recipeId||'No informado')+' · Cobro fila '+x.paid.index+' · Artículo: '+(x.article||'No informado')+' · Ministerio: '+(x.ministry?'Sí':'No')+' · Venta fila '+x.sale.index+' · '+(x.override_reason?'Ajuste de tasa: '+x.override_reason:'Tasa automática')}));
const payload={p_fingerprint:fingerprint,p_from:period_from,p_to:period_to,p_files:files,p_settings:settings,p_rows:items,p_review:review.map(x=>({client:String(x.paid.client),vendor:String(x.paid.vendor),row:x.paid.index,reason:x.reason}))};
const result=await sb().rpc('hr_commissions_import',payload);if(result.error)throw result.error;
inform('Importación guardada · '+result.data.imported+' comisiones. '+result.data.review+' a revisar');draft=null;$('com-preview').textContent='Lote guardado correctamente. Consultá los movimientos y el historial.';await history();$('com-refresh').click();
}catch(err){inform('No se guardó el lote: '+(err.message||err));btn.disabled=false}}
async function history(){const client=sb();if(!client)return;const r=await client.rpc('hr_commissions_import_history');const root=$('com-import-history');if(r.error){root.textContent=r.error.message;return}root.innerHTML=(r.data||[]).map(x=>'<article class="rrhh-com-record"><div><strong>'+escape(x.period_from)+' — '+escape(x.period_to)+'</strong><p>'+x.imported_count+' movimientos importados · '+x.skipped_count+' a revisar</p><small>'+escape((x.files||[]).map(f=>f.name).join(' · '))+'</small></div><small>'+escape(new Date(x.created_at).toLocaleString('es-AR'))+'</small></article>').join('')||'<p class="section-copy">Todavía no hay lotes importados.</p>'}
$('com-process').addEventListener('click',process);$('com-confirm-import').addEventListener('click',confirmImport);document.querySelector('[data-rrhh-tool="comisiones"]')?.addEventListener('click',history);
})();