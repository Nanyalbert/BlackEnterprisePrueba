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
const identity=r=>[clean(r.vendor),clean(r.client)].join('|');
const valid=r=>r.client&&r.vendor;
const names=['ventas','cobros','recetas'];
let draft=null;
function inform(x){$('com-import-summary').textContent=x}
async function read(kind){const file=$('com-file-'+kind).files[0];if(!file)throw Error('Falta el archivo '+kind);if(file.size>12*1024*1024)throw Error('Archivo demasiado grande: '+file.name);if(!window.XLSX)throw Error('No se cargó la biblioteca Excel');const bytes=await file.arrayBuffer();const wb=XLSX.read(bytes,{type:'array',cellDates:true});const ws=wb.Sheets[wb.SheetNames[0]];if(!ws)throw Error('Libro vacío '+kind);const rows=XLSX.utils.sheet_to_json(ws,{raw:true,defval:null});if(rows.length>6000)throw Error('Máximo 6000 filas por archivo');return {rows,file,bytes}}
function parse(data,kind){const keys={ventas:[[['Cliente']], [['Vendedor']], [['Total S/IVA','Total S/Iva']], [['Total C/IVA','Total C/Iva']]],cobros:[[['Cliente']], [['Vendedor']], [['Total Importe']]],recetas:[[['Cliente']], [['Vendedor']], [['Medico','Médico']]]}[kind];if(!data.length)throw Error(kind+': archivo sin registros');for(const aliases of keys){const expected=aliases[0];if(!Object.keys(data[0]).some(k=>expected.some(x=>clean(k)===clean(x))))throw Error(kind+': falta columna '+expected[0])}
return data.map((r,i)=>{const obj={index:i+2,client:get(r,['Cliente']),vendor:get(r,['Vendedor'])};if(kind==='ventas'){obj.net=number(get(r,['Total S/IVA']));obj.gross=number(get(r,['Total C/IVA']))}if(kind==='cobros')obj.paid=number(get(r,['Total Importe']));if(kind==='recetas')obj.doctor=get(r,['Medico','Médico']);return obj}).filter(valid)}
function score(a,b){const A=new Set(clean(a).split(' ').filter(Boolean)),B=new Set(clean(b).split(' ').filter(Boolean));if(!A.size||!B.size)return 0;const intersect=[...A].filter(t=>B.has(t)).length;const union=A.size+B.size-intersect;return intersect/union}
function matches(item,list,threshold){const pool=list.filter(x=>sellerKey(x.vendor)===sellerKey(item.vendor));const exact=pool.filter(x=>canonicalClient(x.client)===canonicalClient(item.client));if(exact.length===1)return {row:exact[0],score:1,exact:true};if(exact.length>1)return {error:'Coincidencia duplicada con el mismo vendedor y cliente'};
const scores=pool.map(r=>({row:r,score:score(item.client,r.client)})).filter(x=>x.score>=threshold).sort((a,b)=>b.score-a.score);
if(scores.length!==1)return {error:scores.length?'Varias coincidencias posibles':'Sin coincidencia confiable'};
return {...scores[0],exact:false}}
async function hash(parts){const joined=new Uint8Array(parts.reduce((s,p)=>s+p.bytes.byteLength+4,0));let pos=0;for(const p of parts){const n=p.bytes.byteLength;new DataView(joined.buffer).setUint32(pos,n);pos+=4;joined.set(new Uint8Array(p.bytes),pos);pos+=n}const dig=await crypto.subtle.digest('SHA-256',joined);return [...new Uint8Array(dig)].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function process(){draft=null;$('com-confirm-import').disabled=true;inform('Leyendo y verificando archivos…');try{
const parts=await Promise.all(names.map(read));const [v,c,rx]=parts.map((p,i)=>parse(p.rows,names[i]));
const med=number($('com-med-rate').value),other=number($('com-other-rate').value),thr=number($('com-threshold').value);
if(![med,other,thr].every(Number.isFinite)||med<0||med>100||other<0||other>100||thr<75||thr>100)throw Error('Revisá los porcentajes y el umbral');
const client=sb();if(!client)throw Error('No está disponible la sesión de Black OS');
const response=await client.rpc('hr_commissions_people');if(response.error)throw response.error;
const people=response.data||[];const employees=new Map();people.forEach(p=>{const key=sellerKey(p.full_name);if(employees.has(key))employees.set(key,null);else employees.set(key,p)});
const usedSale=new Map(),review=[],accepted=[];for(const paid of c){
if(!Number.isFinite(paid.paid)||paid.paid<=0){review.push({paid,reason:'Cobro inválido o negativo'});continue}
if(canonicalClient(paid.client).includes('MINISTERIO DE SALUD')){review.push({paid,reason:'EXCLUIDO: Ministerio de Salud'});continue}
const m=matches(paid,v,thr/100);
if(m.error){review.push({paid,reason:m.error});continue}
const sale=m.row;
if(!Number.isFinite(sale.net)||!Number.isFinite(sale.gross)||sale.net<=0||sale.gross<=0||sale.net>sale.gross){review.push({paid,reason:'Venta sin importes válidos'});continue}
const key=sale.index;const previous=usedSale.get(key)||0;const after=previous+paid.paid;
if(after>sale.gross+0.01){review.push({paid,reason:'Cobros acumulados superan total de venta'});continue}
if(usedSale.has(key)&&!m.exact){review.push({paid,reason:'Venta ya asociada; coincidencia aproximada no aceptada'});continue}
const seller=employees.get(sellerKey(sale.vendor));if(!seller){review.push({paid,reason:'Vendedor no identificado de forma única en RRHH'});continue}
const recipes=rx.filter(r=>sellerKey(r.vendor)===sellerKey(sale.vendor)&&canonicalClient(r.client)===canonicalClient(sale.client));
if(recipes.length>1){review.push({paid,reason:'Varias recetas para el mismo cliente y vendedor'});continue}
if(!recipes.length){review.push({paid,reason:'No hay receta exacta; requiere confirmar el origen'});continue}
const hasDoctor=String(recipes[0].doctor??'').trim().length>0;const rate=hasDoctor?med:other;
const base=Math.round((paid.paid*sale.net/sale.gross)*100)/100;
if(base<=0){review.push({paid,reason:'Base sin IVA inválida'});continue}
usedSale.set(key,after);
accepted.push({person:seller,paid,sale,doctor:recipes[0].doctor,rate,base,amount:Math.round(base*rate)/100});
}
const fingerprint=await hash(parts);
draft={accepted,review,fingerprint,files:parts.map((p,i)=>({type:names[i],name:p.file.name,size:p.file.size,row_count:p.rows.length})),settings:{med,other,threshold:thr},period_from:$('com-from').value,period_to:$('com-to').value};
inform(accepted.length+' operaciones aptas · '+review.length+' requieren revisión. Podés corregir el porcentaje por paciente antes de importar.');
$('com-preview').innerHTML='<p class="section-copy">Operaciones aptas: '+accepted.length+' · A revisar / excluidas: '+review.length+' · Comisión estimada: '+money(accepted.reduce((s,x)=>s+x.amount,0))+'</p>'+accepted.slice(0,150).map(x=>'<article class="rrhh-com-record"><div><strong>'+escape(x.person.full_name)+'</strong><p>'+escape(x.paid.client)+' · '+escape(x.doctor||'Sin médico')+'</p><small>Base '+money(x.base)+' · '+x.rate+'%</small></div><strong>'+money(x.amount)+'</strong></article>').join('')+review.slice(0,150).map(x=>'<article class="rrhh-com-record"><div><strong>Revisar</strong><p>'+escape(x.paid.client)+' · '+escape(x.paid.vendor)+'</p><small>'+escape(x.reason)+'</small></div></article>').join('');
$('com-confirm-import').disabled=!accepted.length;
}catch(err){inform('Error: '+(err.message||err));$('com-preview').textContent='';}}
$('com-preview').addEventListener('change',e=>{const input=e.target.closest('[data-com-rate]');if(!input||!draft)return;const i=Number(input.dataset.comRate),item=draft.accepted[i],rate=Number(input.value);if(!item||!Number.isFinite(rate)||rate<0||rate>100){alert('Ingresá un porcentaje válido entre 0 y 100');input.value=item?.rate??0;return}if(rate!==item.rate){const reason=prompt('Motivo del cambio de porcentaje para '+item.paid.client+':');if(reason===null||reason.trim().length<4){input.value=item.rate;return}item.override_reason=reason.trim();item.rate=rate;item.amount=Math.round(item.base*rate)/100;const amount=$('com-preview').querySelector('[data-com-amount="'+i+'"]');if(amount)amount.textContent=money(item.amount);inform('Porcentaje ajustado. Comisión estimada: '+money(draft.accepted.reduce((s,x)=>s+x.amount,0)))}});
async function confirmImport(){if(!draft||!draft.accepted.length)return;const {accepted,review,files,settings,fingerprint,period_from,period_to}=draft;if(!period_from||!period_to||period_to<period_from)return alert('Seleccioná fechas válidas');
if(!confirm('Guardar '+accepted.length+' comisiones pendientes en Supabase? Los '+review.length+' casos a revisar no se liquidarán.'))return;
const btn=$('com-confirm-import');btn.disabled=true;inform('Guardando lote…');
try{
const items=accepted.map(x=>({employee_id:x.person.id,branch_id:x.person.branch_id,operation_date:period_to,concept:'Comisión Excel · '+String(x.paid.client).slice(0,90),commission_type:'percent',base_amount:x.base,rate:x.rate,fixed_amount:0,notes:'Cliente: '+x.paid.client+' · Vendedor: '+x.sale.vendor+' · Médico: '+(x.doctor||'Sin médico')+' · Cobro fila '+x.paid.index+' · Venta fila '+x.sale.index+' · '+(x.override_reason?'Ajuste de tasa: '+x.override_reason:'Tasa automática')}));
const payload={p_fingerprint:fingerprint,p_from:period_from,p_to:period_to,p_files:files,p_settings:settings,p_rows:items,p_review:review.map(x=>({client:String(x.paid.client),vendor:String(x.paid.vendor),row:x.paid.index,reason:x.reason}))};
const result=await sb().rpc('hr_commissions_import',payload);if(result.error)throw result.error;
inform('Importación guardada · '+result.data.imported+' comisiones. '+result.data.review+' a revisar');draft=null;$('com-preview').textContent='Lote guardado correctamente. Consultá los movimientos y el historial.';await history();$('com-refresh').click();
}catch(err){inform('No se guardó el lote: '+(err.message||err));btn.disabled=false}}
async function history(){const client=sb();if(!client)return;const r=await client.rpc('hr_commissions_import_history');const root=$('com-import-history');if(r.error){root.textContent=r.error.message;return}root.innerHTML=(r.data||[]).map(x=>'<article class="rrhh-com-record"><div><strong>'+escape(x.period_from)+' — '+escape(x.period_to)+'</strong><p>'+x.imported_count+' movimientos importados · '+x.skipped_count+' a revisar</p><small>'+escape((x.files||[]).map(f=>f.name).join(' · '))+'</small></div><small>'+escape(new Date(x.created_at).toLocaleString('es-AR'))+'</small></article>').join('')||'<p class="section-copy">Todavía no hay lotes importados.</p>'}
$('com-process').addEventListener('click',process);$('com-confirm-import').addEventListener('click',confirmImport);document.querySelector('[data-rrhh-tool="comisiones"]').addEventListener('click',history);
})();