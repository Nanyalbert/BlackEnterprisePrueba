(()=>{'use strict';
const $=id=>document.getElementById(id),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),norm=s=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9]/g,''),money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS'}).format(Number(n)||0);
let db=null,draft=null,people=[],saved=[],canView=false,canImport=false;const decisions=new Map();const key=r=>[r.vendor,r.client,r.id,r.payment,r.grossPaid].map(x=>String(x??'')).join('|');const approved=r=>(!r.reason||r.reviewDecision==='approved')&&!blockedReview(r);const pending=r=>Boolean(r.reason)&&!r.reviewDecision&&!blockedReview(r);const rounded=n=>Math.round((Number(n)||0)*100)/100;
const note=s=>$('unified-status').textContent=s;
// PostgreSQL ROUND(base_amount * rate / 100, 2): decimal half away from zero.
const sqlCommissionCents=(base,rate)=>{
 const b=Math.round(Number(base)*100),r=Math.round(Number(rate)*100);
 if(!Number.isSafeInteger(b)||!Number.isSafeInteger(r)||b<=0||r<0||r>10000||
 Math.abs(Number(base)*100-b)>0.000001||Math.abs(Number(rate)*100-r)>0.000001)return null;
 return Math.round(b*r/10000);
};

const eligible=r=>Boolean(window.BlackCommissionLedger?.included(r))&&approved(r);
const ministryUnknown=r=>Boolean(r.hasNonCommissionableLines)||(r.ministry&&/ministerio: (artículo sin identificar|venta mixta)/i.test(r.reason||''));const rxMixed=r=>r.recipeDecision==='mixed';
const blockedReview=r=>/sin venta identificada|comprobante de cobro repetido|importe de cobro inválido|cobros superiores al total de venta|vendedor diferente entre ventas y cobros|clientes distintos en el mismo comprobante|importes de venta inconsistentes|nombre de cliente diferente|ministerio: prestaciones excluidas/i.test(r.reason||'');
const eligibleLine=(l,r)=>Number(l.net)>0.90&&Number(l.gross)>0.90&&(!r.ministry||!l.excluded);
const standardNoPrescription=r=>{
 const reason=String(r.reason||'').trim(),configured=Number(draft?.settings?.other);
 const current=reason.match(/^Sin receta: (\d+(?:[.,]\d+)?)% según política sin médico; verificar$/i);
 const legacy=reason==='Sin receta: 3% provisional; revisar medico'&&configured===3;
 if(!(legacy||(current&&Number(current[1].replace(',','.'))===configured)))return false;
 return Number.isFinite(configured)&&configured>0&&!r.ministry&&!r.hasNonCommissionableLines&&!r.doctor&&
 Number(r.grossPaid)>0&&Number(r.saleGross)>0&&Number(r.saleNet)>0&&Number(r.base)>0&&
 Number(r.rate)===configured&&Number(r.commission)>0&&
 rounded(Number(r.base)*configured/100)===rounded(r.commission);
};
const requiresApprovalReason=r=>Boolean(r.reason)&&!standardNoPrescription(r);
function resetItemReview(r){if(!ministryUnknown(r))return;r.base=Number(r.originalBase??r.base);r.commission=0;delete r.selectedLines;delete r.manualItemNames}
function approveSelectedItems(r){
if(!r.saleLines?.length){alert('No hay datos del artículo. Volvé a analizar los archivos.');return false}
const selected=r.saleLines.map((line,i)=>({line,i})).filter(({line,i})=>(r.selectedLines||[]).includes(i)&&eligibleLine(line,r));
if(!selected.length){alert('Abrí «Ver artículos» y marcá las líneas que querés contemplar.');return false}
const total=Number(r.saleNet),gross=Number(r.saleGross),paid=Number(r.grossPaid),original=rounded(paid*total/gross);
if(!(total>0.90&&gross>0.90&&paid>0&&original>0)){alert('No se puede calcular una base válida.');return false}
const included=selected.reduce((a,x)=>a+Number(x.line.net),0);
const positive=r.saleLines.filter(line=>Number(line.net)>0.90&&Number(line.gross)>0.90).reduce((sum,line)=>sum+Number(line.net),0);
if(!(positive>0))return false;
// Prorrateo de descuentos negativos entre líneas positivas; las excluidas no suman.
const base=rounded(Math.min(original,Math.max(0,original*included/positive)));
const amount=sqlCommissionCents(base,r.rate)/100;
if(!(base>0&&amount>0)){alert('La selección no genera comisión válida.');return false}
r.manualItemNames=r.manualItemNames||{};
for(const {line,i} of selected){if(line.unknown&&!line.description&&!line.code){const typed=prompt('La línea '+(i+1)+' no identifica el artículo en CuboVentas. Escribí el producto VERIFICADO antes de incluirlo:',r.manualItemNames[i]||'');if(typed===null||!typed.trim()){alert('Sin identificar el artículo no es posible incluir esta línea.');return false}r.manualItemNames[i]=typed.trim()}}
const detail=selected.map(({line,i})=>'L'+(i+1)+': '+(r.manualItemNames[i]||line.article||line.description||line.code||'SIN ARTÍCULO IDENTIFICADO')).join('; ');
if(!confirm('Contemplar SOLO las líneas seleccionadas?\n'+detail+'\nBase: '+money(base)+' · Comisión: '+money(amount)))return false;
r.originalBase=original;r.base=base;r.commission=amount;r.reviewNote='Inclusión manual por línea: '+detail;return true
}

const hex=buffer=>Array.from(new Uint8Array(buffer),b=>b.toString(16).padStart(2,'0')).join('');
async function sha256(value){if(!globalThis.crypto?.subtle)throw Error('No se pudo verificar la identidad de los Excel. Usá una conexión segura HTTPS.');return hex(await crypto.subtle.digest('SHA-256',value));}
async function fingerprintFiles(from,to){const files=['ventas','cobros','recetas'].map(k=>document.getElementById(k)?.files?.[0]);if(files.some(f=>!f))throw Error('Falta uno de los tres archivos Excel.');const hashes=await Promise.all(files.map(async f=>sha256(await f.arrayBuffer())));return sha256(new TextEncoder().encode(JSON.stringify({version:2,hashes})));}

const dates=()=>{const d=new Date(),iso=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0');return [iso(new Date(d.getFullYear(),d.getMonth(),1)),iso(d)]};
async function init(){const [a,b]=dates();$('unified-from').value=a;$('unified-to').value=b;try{db=window.BlackPortal.getSupabase()}catch(e){note('No se pudo conectar con Supabase');return}
const auth=await db.auth.getUser();if(!auth.data?.user){note('Iniciá sesión en Black OS para consultar y guardar liquidaciones.');return}
const checks=await Promise.all(['commissions_view','commissions_manage'].map(p=>db.rpc('black_os_has_permission',{p_module:'rrhh',p_permission:p})));
canView=!checks[0].error&&checks[0].data===true;canImport=!checks[1].error&&checks[1].data===true;
if(!canView){note('No tenés permiso para consultar comisiones.');return}
const res=await db.rpc('hr_commissions_people');if(res.error){note(res.error.message);return}people=res.data||[];
$('unified-save').disabled=true;$('unified-save').hidden=!canImport;
$('unified-save').onclick=save;$('unified-reload').onclick=history;$('unified-generate').onclick=generate;$('unified-print').onclick=print;
$('unified-source').onchange=()=>{refreshOptions();$('unified-print').disabled=true};$('unified-from').onchange=()=>{history();$('unified-print').disabled=true};$('unified-to').onchange=()=>{history();$('unified-print').disabled=true};
await history({latestIfEmpty:true});if(draft)renderMatches();if(!$('unified-status').textContent.startsWith('Error'))note('Conectado. Consultá la última liquidación guardada o cargá nuevos Excel.');
}
window.addEventListener('black:commissions-period-detected',e=>{if(!e.detail?.from||!e.detail?.to)return;const info=$('commission-date-hint');if(info)info.textContent='Fechas sugeridas por CuboCobros: '+e.detail.from+' a '+e.detail.to+'. El período definido manualmente es definitivo.';});
window.addEventListener('black:commissions-invalidated',()=>{draft=null;decisions.clear();bulkArticles.clear();$('unified-save').disabled=true;$('unified-matches').innerHTML='';$('unified-print').disabled=true;$('unified-preview').innerHTML='<p class="com-empty">El análisis cambió. Generá nuevamente el informe.</p>';refreshOptions()});
window.addEventListener('black:commissions-rendered',()=>{if(draft)window.dispatchEvent(new CustomEvent('black:commissions-review-changed',{detail:{rows:draft.rows}}))});
window.addEventListener('black:commissions-analyzed',e=>{draft=e.detail;reviewFilter='pending';reviewSearch='';bulkArticles.clear();for(const r of draft.rows){const d=decisions.get(key(r));if(d&&r.reason&&d.reason===r.reason&&Number(d.rate)===Number(r.rate)&&Number(d.grossPaid)===Number(r.grossPaid)&&Number(d.saleNet)===Number(r.saleNet)&&Number(d.saleGross)===Number(r.saleGross)&&JSON.stringify(d.recipeMatches||[])===JSON.stringify(r.recipeMatches||[])){r.reviewDecision=d.action;r.reviewNote=d.note;r.selectedLines=d.selectedLines||[];r.manualItemNames=d.manualItemNames||{};r.itemDecisions=d.itemDecisions||{};if(Number.isFinite(d.originalBase))r.originalBase=d.originalBase;if(Number.isFinite(d.base))r.base=d.base;if(d.action==='rejected')r.commission=0;else if(d.action==='approved'&&Number.isFinite(d.commission))r.commission=rounded(Number(r.base)*Number(r.rate)/100)}}$('unified-source').value='preview';renderMatches();refreshOptions();$('unified-print').disabled=true;$('unified-preview').innerHTML='<p class="com-empty">Hay un nuevo análisis. Volvé a generar el informe.</p>';});
const sellerKey=v=>String(v??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase().replace(/[^A-Z0-9 ]/g,' ').trim().split(/\s+/).filter(Boolean).sort().join('|');
function match(v){const candidates=people.filter(p=>sellerKey(p.full_name)===sellerKey(v));return candidates.length===1?candidates[0]:null}
function accepted(){return (draft?.rows||[]).filter(r=>eligible(r)&&match(r.vendor))}
function rejected(){return (draft?.rows||[]).filter(r=>!eligible(r)||!match(r.vendor))}
let reviewFilter='pending',reviewSearch='',bulkArticles=new Set();
function renderMatches(){if(!draft)return;
const all=draft.rows.map((r,i)=>({...r,i}));const review=all.filter(r=>Boolean(r.reason));
const unresolved=review.filter(pending).length,approvedReview=review.filter(r=>r.reviewDecision==='approved').length,rejectedReview=review.filter(r=>r.reviewDecision==='rejected').length,excludedReview=review.filter(r=>blockedReview(r)).length;
const distinct=[...new Set(draft.rows.map(r=>r.vendor))];
const shown=review.filter(r=>(reviewFilter==='all'||(reviewFilter==='pending'&&pending(r))||(reviewFilter==='approved'&&r.reviewDecision==='approved')||(reviewFilter==='rejected'&&r.reviewDecision==='rejected')||(reviewFilter==='excluded'&&blockedReview(r)))&&norm([r.vendor,r.client,r.id,r.payment,r.reason,r.doctor,r.articles].join(' ')).includes(norm(reviewSearch)));
const summary='<div class="review-stats"><span><strong>'+accepted().length+'</strong> conciliadas aprobables</span><span><strong>'+unresolved+'</strong> pendientes</span><span><strong>'+approvedReview+'</strong> aprobadas manualmente</span><span><strong>'+rejectedReview+'</strong> rechazadas</span><span><strong>'+excludedReview+'</strong> excluidas por validación</span></div>';
const vendors='<details class="review-vendors"><summary>Conciliación de vendedores y coincidencias ('+distinct.length+')</summary><div class="scroll"><table><thead><tr><th>Vendedor en Excel</th><th>Integrante Black OS</th></tr></thead><tbody>'+distinct.map(v=>'<tr><td>'+esc(v)+'</td><td>'+esc(match(v)?.full_name||'SIN COINCIDENCIA — no se guardará')+'</td></tr>').join('')+'</tbody></table></div></details>';
const tabs=[['pending','Pendientes',unresolved],['approved','Aprobadas',approvedReview],['rejected','Rechazadas',rejectedReview],['excluded','Excluidas',excludedReview],['all','Todas',review.length]].map(([id,label,count])=>'<button type="button" class="review-filter '+(reviewFilter===id?'is-active':'')+'" data-review-filter="'+id+'" aria-pressed="'+(reviewFilter===id)+'">'+label+' <span class="review-count">'+count+'</span></button>').join('');
const rows=shown.map(r=>{const canApprove=canImport&&pending(r)&&!ministryUnknown(r)&&Boolean(match(r.vendor))&&Number(r.base)>0&&Number(r.commission)>0&&!blockedReview(r);
const status=r.reviewDecision==='approved'?'Aprobada':r.reviewDecision==='rejected'?'Rechazada':blockedReview(r)?'Excluida automáticamente':'Pendiente',kind=r.reviewDecision==='approved'?'approved':r.reviewDecision==='rejected'||blockedReview(r)?'rejected':'pending';const approveTooltip=standardNoPrescription(r)?'Aprobar sin explicación: comisión estándar':'Aprobar excepción con justificación';
return '<tr><td><strong>'+esc(r.vendor)+'</strong><div class="review-muted">'+esc(r.client)+'</div></td><td>'+esc(r.id||'—')+'<div class="review-muted">Cobro '+esc(r.payment||'—')+'</div></td><td>'+esc(r.reason)+(r.recipeWarning?'<div class="review-warning">'+esc(r.recipeWarning)+'</div>':'')+(r.recipeMatches?.length?'<details class="review-item-details"><summary>Recetas consideradas ('+r.recipeMatches.length+')</summary>'+r.recipeMatches.map(x=>'<div class="review-item-line">'+esc(x.recipe||'Sin número')+' · '+esc(x.doctor||'SIN MÉDICO')+(x.sale?' · Venta '+esc(x.sale):'')+'</div>').join('')+'</details>':'')+(r.hasSalesAdjustment?'<div class="review-muted">Incluye '+r.adjustmentCount+' ajuste(s) negativo(s) descontado(s) del neto</div>':'')+(r.saleLines?.length?'<details class="review-item-details" '+(pending(r)?'open':'')+'><summary>Artículos ('+r.saleLines.length+') · '+r.saleLines.filter(x=>x.nonCommissionable||r.ministry&&x.excluded).length+' excluidos por regla</summary>'+r.saleLines.map((line,i)=>'<div class="review-item-line">'+'<div>'+(eligibleLine(line,r)?'<label class="review-muted"><input type="checkbox" data-bulk-article="'+r.i+':'+i+'" '+(bulkArticles.has(r.i+':'+i)?'checked':'')+' '+(!canImport||blockedReview(r)||!r.reason?'disabled':'')+' aria-label="Seleccionar artículo para decisión masiva"> Seleccionar artículo</label>':'<span class="review-muted">Exclusión automática · no modificable</span>')+'<div class="review-muted">'+(line.nonCommissionable?'EXCLUIDO · IMPORTE SIMBÓLICO':r.ministry&&line.excluded?'EXCLUIDO · MINISTERIO':r.itemDecisions?.[i]==='approved'?'APROBADO':r.itemDecisions?.[i]==='rejected'?'RECHAZADO':'PENDIENTE DE DECISIÓN')+'</div>'+(eligibleLine(line,r)&&!blockedReview(r)?'<div class="review-inline-actions"><span class="review-muted">Decisión individual:</span><button type="button" data-single-item-action="approved" data-single-item-row="'+r.i+'" data-single-item-line="'+i+'">Comisionar</button><button type="button" data-single-item-action="rejected" data-single-item-row="'+r.i+'" data-single-item-line="'+i+'">Excluir</button><button type="button" data-single-item-action="pending" data-single-item-row="'+r.i+'" data-single-item-line="'+i+'">Pendiente</button></div>':'')+'<strong>'+esc(line.article||line.description||line.code||'SIN ARTÍCULO IDENTIFICADO')+'</strong>'+(line.code?' · Código '+esc(line.code):'')+(line.description?' · Descripción '+esc(line.description):'')+(line.sourceRow?' · Fila '+line.sourceRow+' de CuboVentas':'')+' · '+money(line.net)+' <span class="review-muted">sin IVA</span>'+(line.net<0?'<div class="review-warning">Descuento / ajuste negativo: ya está descontado del neto del comprobante; no suma comisión por separado</div>':line.nonCommissionable?'<div class="review-warning">Artículo de valor cero o ≤ $0,90: no comisionable</div>':line.excluded?'<div class="review-warning">Prestación excluida</div>':line.unknown?'<div class="review-warning">Sin descripción: verificar producto antes de incluir</div>':'')+'</div></div>').join('')+'</details>':'<div class="review-warning">Sin detalle de artículos; volvé a analizar</div>')+'</td><td class="num">'+money(r.base)+'</td><td class="num">'+esc(r.rate)+'%</td><td class="num">'+money(r.commission)+'</td><td><span class="review-badge '+kind+'">'+status+'</span>'+(r.reviewNote?'<div class="review-muted">'+esc(r.reviewNote)+'</div>':'')+'</td><td><div class="review-actions">'+(canApprove?'<button type="button" class="review-action approve" title="'+approveTooltip+'" aria-label="'+approveTooltip+'" data-review-action="approved" data-review-index="'+r.i+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg></button>':'')+(canImport&&pending(r)&&!ministryUnknown(r)?'<button type="button" class="review-action reject" title="Rechazar operación" aria-label="Rechazar operación" data-review-action="rejected" data-review-index="'+r.i+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button><button type="button" class="review-action reset" title="Dejar pendiente" aria-label="Dejar pendiente" data-review-action="pending" data-review-index="'+r.i+'"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 11a9 9 0 1 1 2.7 6.4"/><path d="M3 4v7h7"/></svg></button>':'')+'</div></td></tr>'}).join('');
$('unified-matches').innerHTML=summary+vendors+'<section class="review-workspace"><div class="review-head"><div><h3>Revisión de operaciones</h3><p>Las pendientes no se incorporan a la liquidación hasta que las revises. Las operaciones sin receta que aplican la tasa vigente y están correctamente conciliadas se aprueban con un clic, sin comentario obligatorio. Las excepciones requieren justificación; los errores de conciliación se corrigen en los Excel.</p></div><label class="review-search-label">Buscar operación<input id="review-search" type="search" placeholder="Paciente, venta, motivo…" value="'+esc(reviewSearch)+'"></label></div><div class="review-filters" role="group" aria-label="Filtrar operaciones">'+tabs+'</div><div class="review-bulk-panel"><div class="review-bulk-head"><div><strong>Revisión por artículos</strong><span class="review-muted">Seleccioná artículos de una o varias ventas y resolvelos juntos.</span></div><span class="review-bulk-count">'+bulkArticles.size+' seleccionados</span></div><div class="review-bulk-groups"><div class="review-bulk-group"><button type="button" class="secondary" data-bulk-item-select="visible">Seleccionar visibles</button><button type="button" class="secondary" data-bulk-item-select="clear">Limpiar selección</button></div><div class="review-bulk-group review-bulk-actions"><button type="button" class="review-bulk-btn review-bulk-approve" data-bulk-item-action="approved">Comisionar</button><button type="button" class="review-bulk-btn review-bulk-reject" data-bulk-item-action="rejected">Excluir</button><button type="button" class="review-bulk-btn" data-bulk-item-action="pending">Dejar pendiente</button></div></div></div><div class="review-table scroll"><table><thead><tr><th>Vendedor / paciente</th><th>Venta / cobro</th><th>Motivo de revisión</th><th class="num">Base sin IVA</th><th class="num">Tasa</th><th class="num">Comisión</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+ (rows||'<tr><td colspan="8" class="review-empty">No hay operaciones en esta categoría.</td></tr>')+'</tbody></table></div><p class="review-footer">Mostrando '+shown.length+' de '+review.length+' operaciones observadas. '+(unresolved?'Faltan '+unresolved+' decisiones para poder guardar.':'Todas las observaciones tienen una decisión.')+'</p></section>';
$('unified-save').disabled=!canImport||accepted().length===0||unresolved>0;
}

const bulkItemKey=(row,line)=>row+':'+line;
function recalcReviewedItems(r){
 if(!r.reason||blockedReview(r)||!r.saleLines?.length)return;
 const eligible=r.saleLines.map((line,i)=>({line,i})).filter(x=>eligibleLine(x.line,r));
 // Las líneas de importe simbólico y prestaciones excluidas nunca generan comisión.
 const unresolved=eligible.filter(x=>!['approved','rejected'].includes(r.itemDecisions?.[x.i]));
 if(unresolved.length){delete r.reviewDecision;delete r.reviewNote;r.commission=0;return;}
 const approvedLines=eligible.filter(x=>r.itemDecisions[x.i]==='approved');
 if(!approvedLines.length){r.reviewDecision='rejected';r.reviewNote='Exclusión por artículos: ninguno comisionable';r.commission=0;return;}
 const saleNet=Number(r.saleNet),saleGross=Number(r.saleGross),paid=Number(r.grossPaid);
 const positive=r.saleLines.filter(l=>Number(l.net)>0.90&&Number(l.gross)>0.90).reduce((s,l)=>s+Number(l.net),0);
 if(!(saleNet>0.90&&saleGross>0.90&&paid>0&&positive>0&&Number(r.rate)>0)){delete r.reviewDecision;return;}
 const original=rounded(paid*saleNet/saleGross);
 const included=approvedLines.reduce((s,x)=>s+Number(x.line.net),0);
 const base=rounded(Math.min(original,Math.max(0,original*included/positive)));
 const commission=sqlCommissionCents(base,r.rate)/100;
 if(!(base>0&&commission>0)){delete r.reviewDecision;return;}
 r.originalBase=original;r.base=base;r.commission=commission;
 r.selectedLines=approvedLines.map(x=>x.i);
 r.reviewDecision='approved';
 r.reviewNote='Artículos aprobados masivamente: '+approvedLines.map(x=>'fila '+(x.line.sourceRow||x.i+2)+' '+(x.line.code||x.line.article||x.line.description)).join('; ');
}
$('unified-matches').addEventListener('click',e=>{const btn=e.target.closest('[data-single-item-action]');if(!btn||!draft||!canImport)return;const ri=Number(btn.dataset.singleItemRow),li=Number(btn.dataset.singleItemLine),row=draft.rows[ri],line=row?.saleLines?.[li];if(!row||!line||blockedReview(row)||!eligibleLine(line,row)||!match(row.vendor))return alert('Este artículo no permite una decisión manual.');const action=btn.dataset.singleItemAction;if(action==='approved'&&(Number(row.rate)<=0||line.unknown&&!line.description&&!line.code))return alert('Artículo sin identificar o tasa inválida: se requiere verificar el Excel.');row.itemDecisions=row.itemDecisions||{};if(action==='pending')delete row.itemDecisions[li];else row.itemDecisions[li]=action;recalcReviewedItems(row);if(row.reviewDecision)decisions.set(key(row),{action:row.reviewDecision,note:row.reviewNote||'',reason:row.reason,rate:row.rate,grossPaid:row.grossPaid,saleNet:row.saleNet,saleGross:row.saleGross,recipeMatches:row.recipeMatches||[],commission:row.commission,base:row.base,originalBase:row.originalBase,selectedLines:row.selectedLines||[],manualItemNames:row.manualItemNames||{},itemDecisions:{...row.itemDecisions}});else decisions.delete(key(row));bulkArticles.delete(ri+':'+li);renderMatches();window.dispatchEvent(new CustomEvent('black:commissions-review-changed',{detail:{rows:draft.rows}}));$('unified-print').disabled=true;$('unified-preview').innerHTML='<p class="com-empty">Cambió la revisión individual. Volvé a generar el informe.</p>';});
$('unified-matches').addEventListener('change',e=>{
 const item=e.target.closest('[data-bulk-article]');if(!item)return;
 if(item.checked){const [ri,li]=item.dataset.bulkArticle.split(':').map(Number),r=draft?.rows?.[ri];if(r&&eligibleLine(r.saleLines?.[li]||{},r))bulkArticles.add(item.dataset.bulkArticle);}else bulkArticles.delete(item.dataset.bulkArticle);
 renderMatches();
});
$('unified-matches').addEventListener('click',e=>{
 const b=e.target.closest('[data-bulk-item-select]');if(!b||!draft)return;
 if(b.dataset.bulkItemSelect==='clear')bulkArticles.clear();
 else for(const [rowIndex,r] of draft.rows.entries()){
   if(!r.reason||blockedReview(r)||!norm([r.vendor,r.client,r.id,r.payment,r.reason,r.doctor,r.articles].join(' ')).includes(norm(reviewSearch)))continue;
   if(!(reviewFilter==='all'||reviewFilter==='pending'&&pending(r)||reviewFilter==='approved'&&r.reviewDecision==='approved'||reviewFilter==='rejected'&&r.reviewDecision==='rejected'))continue;
   for(let i=0;i<(r.saleLines||[]).length;i++)if(eligibleLine(r.saleLines[i],r))bulkArticles.add(bulkItemKey(rowIndex,i));
 }
 renderMatches();
});
$('unified-matches').addEventListener('click',e=>{
 const btn=e.target.closest('[data-bulk-item-action]');if(!btn||!draft||!canImport)return;
 const action=btn.dataset.bulkItemAction;
 const groups=new Map();let skipped=0;
 for(const id of bulkArticles){
   const [ri,li]=id.split(':').map(Number),r=draft.rows[ri],line=r?.saleLines?.[li];
   if(!r?.reason||!line||blockedReview(r)||!eligibleLine(line,r)||!match(r.vendor)||action==='approved'&&line.unknown&&!line.description&&!line.code||action==='approved'&&Number(r.rate)<=0){skipped++;continue;}
   if(!groups.has(ri))groups.set(ri,[]);
   groups.get(ri).push(li);
 }
 const count=[...groups.values()].reduce((n,x)=>n+x.length,0);
 if(!count)return alert('No hay artículos aptos para esta acción. Los de $0,01 y las prestaciones excluidas no pueden comisionar.');
 if(!confirm('Aplicar '+(action==='approved'?'COMISIONAR':action==='rejected'?'EXCLUIR':'PENDIENTE')+' a '+count+' artículos de '+groups.size+' operaciones? '+(skipped?'Se omitirán '+skipped+' artículos que no cumplen las reglas.':'')))return;
 for(const [ri,indices] of groups){
   const row=draft.rows[ri];
   row.itemDecisions=row.itemDecisions||{};
   for(const i of indices){if(action==='pending')delete row.itemDecisions[i];else row.itemDecisions[i]=action;}
   recalcReviewedItems(row);
   if(row.reviewDecision)decisions.set(key(row),{action:row.reviewDecision,note:row.reviewNote||'',reason:row.reason,rate:row.rate,grossPaid:row.grossPaid,saleNet:row.saleNet,saleGross:row.saleGross,recipeMatches:row.recipeMatches||[],commission:row.commission,base:row.base,originalBase:row.originalBase,selectedLines:row.selectedLines||[],manualItemNames:row.manualItemNames||{},itemDecisions:{...row.itemDecisions}});
   else decisions.delete(key(row));
 }
 bulkArticles.clear();renderMatches();
 window.dispatchEvent(new CustomEvent('black:commissions-review-changed',{detail:{rows:draft.rows}}));
 $('unified-print').disabled=true;$('unified-preview').innerHTML='<p class="com-empty">Revisión por artículos modificada. Generá nuevamente el informe.</p>';
});

$('unified-matches').addEventListener('click',e=>{if(e.target.id!=='review-reset-all'||!draft||!canImport)return;if(!confirm('Reiniciar todas las decisiones de ESTE análisis? No borra importaciones, liquidaciones ni pagos guardados.'))return;decisions.clear();bulkArticles.clear();for(const row of draft.rows){delete row.itemDecisions;delete row.reviewDecision;delete row.reviewNote;resetItemReview(row)}reviewFilter='pending';reviewSearch='';renderMatches();window.dispatchEvent(new CustomEvent('black:commissions-review-changed',{detail:{rows:draft.rows}}));$('unified-print').disabled=true;$('unified-preview').innerHTML='<p class="com-empty">Revisión reiniciada. Generá nuevamente el informe.</p>';});
$('unified-matches').addEventListener('click',e=>{const btn=e.target.closest('[data-review-filter]');if(!btn)return;reviewFilter=btn.dataset.reviewFilter;renderMatches()});
$('unified-matches').addEventListener('input',e=>{if(e.target.id!=='review-search')return;reviewSearch=e.target.value;const start=e.target.selectionStart;renderMatches();const input=$('review-search');input.focus();input.setSelectionRange(start,start)});
$('unified-matches').addEventListener('click',e=>{const btn=e.target.closest('[data-review-action]');if(!btn||!draft||!canImport)return;const row=draft.rows[Number(btn.dataset.reviewIndex)];if(!row||!row.reason||blockedReview(row))return;const action=btn.dataset.reviewAction;if(action==='pending'){delete row.reviewDecision;delete row.reviewNote;resetItemReview(row);decisions.delete(key(row));renderMatches();window.dispatchEvent(new CustomEvent('black:commissions-review-changed',{detail:{rows:draft.rows}}));$('unified-print').disabled=true;$('unified-preview').innerHTML='<p class="com-empty">Cambió la revisión. Volvé a generar el informe.</p>';return}if(action==='approved'&&(blockedReview(row)||!match(row.vendor)||Number(row.base)<=0||(!ministryUnknown(row)&&!rxMixed(row)&&Number(row.commission)<=0)))return alert('No se puede aprobar: operación sin conciliación confiable. Corregí los Excel.');if(action==='approved'&&ministryUnknown(row))return alert('Esta venta se revisa por artículos. Seleccioná los productos válidos y utilizá «Comisionar». Los artículos excluidos por regla no se pueden aprobar.');let noteText='';if(action==='approved'&&rxMixed(row)){const rates=[Number(draft.settings.med),Number(draft.settings.other)].filter((v,i,a)=>Number.isFinite(v)&&v>0&&a.indexOf(v)===i);const answer=prompt('Recetas con y sin médico: elegí tasa ('+rates.join(' o ')+' %), según documentación de la venta:',String(row.rate||''));if(answer===null)return;const selected=Number(String(answer).replace(',','.'));if(!rates.includes(selected))return alert('Tasa inválida: seleccioná una tasa configurada.');row.rate=selected;row.commission=rounded(Number(row.base)*selected/100);if(!(row.commission>0))return alert('La tasa no genera comisión válida.')}if(action==='approved'&&requiresApprovalReason(row)){const response=prompt('Justificación de aprobación excepcional (mínimo 8 caracteres):',row.reviewNote||'');if(response===null||response.trim().length<8)return alert('Se requiere una justificación de al menos ocho caracteres.');noteText=response.trim()}if(action==='rejected'){const response=prompt('Motivo del rechazo de '+row.client+' (opcional; Cancelar no modifica la operación):','');if(response===null)return;noteText=response.trim()}if(action==='rejected'&&ministryUnknown(row))resetItemReview(row);row.reviewDecision=action;row.reviewNote=noteText;decisions.set(key(row),{action,note:row.reviewNote,reason:row.reason,rate:row.rate,grossPaid:row.grossPaid,saleNet:row.saleNet,saleGross:row.saleGross,recipeMatches:row.recipeMatches||[],commission:row.commission,base:row.base,originalBase:row.originalBase,selectedLines:row.selectedLines||[],manualItemNames:row.manualItemNames||{}});renderMatches();window.dispatchEvent(new CustomEvent('black:commissions-review-changed',{detail:{rows:draft.rows}}));$('unified-print').disabled=true;$('unified-preview').innerHTML='<p class="com-empty">Cambió la revisión. Volvé a generar el informe.</p>';});
async function save(){if(!canImport||!draft)return;const from=$('unified-from').value,to=$('unified-to').value;if(!from||!to||from>to)return alert('Seleccioná un período válido');const unresolved=(draft.rows||[]).filter(pending).length;if(unresolved)return alert('Quedan '+unresolved+' operaciones sin decidir. Aprobá o rechazá cada una antes de guardar el lote.');const rows=accepted();if(!rows.length)return alert('No hay comisiones conciliadas con integrantes del sistema.');if(!confirm('PERÍODO DEFINITIVO DE LIQUIDACIÓN\nDesde: '+from+'\nHasta: '+to+'\n\nLas fechas de los Excel no reemplazan esta selección. ¿Confirmás?'))return;const unmatched=(draft.rows||[]).filter(r=>eligible(r)&&!match(r.vendor));if(unmatched.length)note(unmatched.length+' operaciones sin vendedor vinculado serán excluidas; revisá la conciliación de vendedores.');
const review=rejected();
const invalid=rows.filter(r=>!Number.isFinite(Number(r.base))||!Number.isFinite(Number(r.rate))||Number(r.base)<=0||Number(r.rate)<0||Number(r.rate)>100||sqlCommissionCents(r.base,r.rate)!==Math.round(Number(r.commission)*100));
if(invalid.length)return alert('Hay '+invalid.length+' comisiones cuyo cálculo no coincide con base × porcentaje. Corregí o recalculá antes de guardar.');const roundingMismatch=rows.filter(r=>sqlCommissionCents(r.base,r.rate)!==Math.round(Number(r.commission)*100));
if(roundingMismatch.length){const first=roundingMismatch[0];return alert('IMPORTACIÓN BLOQUEADA: '+roundingMismatch.length+' operación(es) requieren recalcular con el redondeo correcto.\nVenta: '+first.id+' · Vendedor: '+first.vendor+'\nComisión actual: '+money(first.commission)+' · Correcta: '+money(sqlCommissionCents(first.base,first.rate)/100)+'.\nHacé clic en ANALIZAR nuevamente antes de guardar. No se modificaron datos.');}if(rows.some(r=>r.reason&&(blockedReview(r)||(requiresApprovalReason(r)&&(!r.reviewNote||r.reviewNote.trim().length<8)))))return alert('Hay excepciones aprobadas sin justificación o con errores de conciliación.');
const ledger=window.BlackCommissionLedger;if(!ledger)return alert('No se encuentra el motor de conciliación.');const totalAutomatic=ledger.sumCents(rows.filter(r=>!r.reason))/100;
const totalManual=ledger.sumCents(rows.filter(r=>r.reason))/100;
const totalSave=ledger.sumCents(rows)/100;
const auditedManual=rows.filter(r=>r.reason).map(r=>({vendor:r.vendor,client:r.client,venta:r.id,cobro:r.payment,reason:r.reason,note:r.reviewNote||'',recipe_candidates:r.recipeMatches||[],recipe_match_source:r.recipeMatchSource||'',approval_mode:standardNoPrescription(r)?'regla_sin_receta':'excepcion_justificada',base:r.base,rate:r.rate,commission:r.commission,selected_items:(r.selectedLines||[]).map(i=>({line:i+1,article:r.manualItemNames?.[i]||r.saleLines?.[i]?.article||r.saleLines?.[i]?.description||'',net:r.saleLines?.[i]?.net||0}))}));
if(!confirm('RESUMEN DE IMPORTACIÓN — '+from+' a '+to+'\n\nConciliadas: '+money(totalAutomatic)+'\nAprobadas manualmente: '+money(totalManual)+'\nTOTAL A GUARDAR: '+money(totalSave)+'\n\n'+rows.length+' comisiones · '+review.length+' excluidas/observadas.\n\nSe registrarán como pendientes de pago. ¿Confirmás?'))return;
const payload=rows.map(r=>{const p=match(r.vendor);return {employee_id:p.id,branch_id:p.branch_id,operation_date:to,concept:'Comisión Excel · '+String(r.client||'Cliente').slice(0,90),commission_type:'percent',base_amount:Number(r.base),rate:Number(r.rate),fixed_amount:0,notes:['Cliente: '+r.client,'Vendedor: '+r.vendor,'Nro venta: '+r.id,'Nro cobro: '+r.payment,'Fecha venta en CuboVentas: '+(r.sourceSaleDate||'No disponible'),'Médico: '+r.doctor,'Recetas: '+(r.recipeMatches?.length||0)+' · '+(r.recipeMatchSource||'sin vínculo'),'Artículos: '+r.articles,r.reviewDecision==='approved'?(standardNoPrescription(r)?'Confirmada bajo regla sin receta ('+r.rate+'%)':'Aprobación excepcional'+(r.reviewNote?': '+r.reviewNote:''))+' · Observación original: '+r.reason:'Aprobación automática'].join(' · ').slice(0,500)}});
$('unified-save').disabled=true;note('Verificando archivos y guardando lote…');try{const fingerprint=await fingerprintFiles(from,to);const {data,error}=await db.rpc('hr_commissions_import',{p_fingerprint:fingerprint,p_from:from,p_to:to,p_files:draft.files,p_settings:{...draft.settings,audit:{total_automatic:totalAutomatic,total_manual:totalManual,total_saved:totalSave,approved_manual:auditedManual}},p_rows:payload,p_review:review.map(r=>({client:r.client,vendor:r.vendor,reference:r.id,reason:(r.reviewDecision==='rejected'?'Rechazada manualmente'+(r.reviewNote?': '+r.reviewNote:'')+' · ':'')+(r.reason||'Sin coincidencia / no comisionable')}))});if(error)throw error;const loaded=await db.rpc('hr_commissions_list',{p_from:from,p_to:to,p_employee_id:null,p_branch_id:null,p_status:null});
if(loaded.error)throw Error('GUARDADO REGISTRADO; no se pudo verificar la lectura: '+loaded.error.message+'. NO IMPORTES DE NUEVO.');
const persisted=Array.isArray(loaded.data)?loaded.data:[];
const storedExcel=persisted.filter(r=>String(r.source_type||'').toLowerCase()==='excel'&&String(r.operation_date||'').slice(0,10)===to);
const expectedByEmployee=new Map();
for(const r of rows){const id=String(match(r.vendor).id);expectedByEmployee.set(id,(expectedByEmployee.get(id)||0)+Math.round(Number(r.commission)*100));}
const persistedByEmployee=new Map();
for(const r of storedExcel){const id=String(r.employee_id);persistedByEmployee.set(id,(persistedByEmployee.get(id)||0)+Math.round(Number(r.amount)*100));}
const mismatches=[...expectedByEmployee].filter(([id,cents])=>persistedByEmployee.get(id)!==cents);
if(mismatches.length||storedExcel.length!==rows.length){
 $('unified-print').disabled=true;
 throw Error('GUARDADO REGISTRADO PERO NO CONCILIADO: '+mismatches.length+' vendedores diferentes; filas esperadas '+rows.length+', encontradas '+storedExcel.length+'. NO REPITAS LA IMPORTACIÓN. Revisá el historial.');
}
const selectedVendor=$('unified-person').value;const preferredEmployee=match(selectedVendor)?.full_name||selectedVendor;draft=null;decisions.clear();$('unified-source').value='saved';await history();const options=[...new Set(saved.map(r=>r.employee_name))];if(options.includes(preferredEmployee))$('unified-person').value=preferredEmployee;$('unified-preview').innerHTML='<p class="com-empty">Liquidación guardada. Elegí un vendedor y presioná «Generar informe individual».</p>';note('Lote guardado: '+(data?.imported??payload.length)+' comisiones. Los vendedores ya están disponibles en «Informes individuales».');}catch(e){note('No se pudo guardar: '+e.message);$('unified-save').disabled=false}}
async function history(options={}){
 if(!canView)return;
 const from=$('unified-from'),to=$('unified-to');
 const fetchSaved=()=>db.rpc('hr_commissions_list',{p_from:from.value,p_to:to.value,p_employee_id:null,p_branch_id:null,p_status:null});
 const [h,l]=await Promise.all([db.rpc('hr_commissions_import_history'),fetchSaved()]);
 const batches=h.error?[]:(h.data||[]);
 let listing=l;
 if(options?.latestIfEmpty===true&&!h.error&&!l.error&&!(l.data||[]).length&&batches.length){
  const latest=batches.find(b=>/^\d{4}-\d{2}-\d{2}$/.test(String(b.period_from||''))&&/^\d{4}-\d{2}-\d{2}$/.test(String(b.period_to||'')));
  if(latest){from.value=latest.period_from;to.value=latest.period_to;listing=await fetchSaved();}
 }
 if(h.error)$('unified-history').textContent='Error al consultar el historial: '+h.error.message;
 else $('unified-history').innerHTML=batches.map(x=>'<div class="card" style="margin:8px 0"><strong>'+esc(x.period_from)+' — '+esc(x.period_to)+'</strong><p>'+Number(x.imported_count||0)+' movimientos · '+Number(x.skipped_count||0)+' observados · '+esc(new Date(x.created_at).toLocaleString('es-AR'))+'</p></div>').join('')||'<p>No hay importaciones guardadas.</p>';
 if(listing.error){saved=[];note('Error al cargar vendedores e informes: '+listing.error.message)}
 else saved=Array.isArray(listing.data)?listing.data:[];
 refreshOptions();renderSavedReview();
 if(!listing.error&&$('unified-source').value==='saved'&&!saved.length)$('unified-preview').innerHTML='<p class="com-empty">No hay liquidaciones en este período. Cambiá las fechas o consultá el historial.</p>';
}
function renderSavedReview(){let root=$('unified-saved-review');if(!root){root=document.createElement('section');root.id='unified-saved-review';root.className='card';root.style.marginTop='18px';$('unified-history').after(root)}if(!canImport){root.innerHTML='';return}const rows=saved.filter(r=>r.source_type==='excel'&&(r.status==='pendiente'||r.status==='anulada'));root.innerHTML='<details><summary><strong>Modificar comisiones ya guardadas ('+rows.length+')</strong></summary><p>Podés cambiar porcentaje, aprobar o anular comisiones mientras no estén liquidadas ni pagadas. Cada cambio queda auditado.</p><div class="scroll"><table><thead><tr><th>Vendedor</th><th>Operación</th><th>Base</th><th>Tasa (%)</th><th>Importe</th><th>Estado</th><th>Acción</th></tr></thead><tbody>'+rows.map(r=>'<tr><td>'+esc(r.employee_name)+'</td><td>'+esc(r.concept)+'</td><td>'+money(r.base_amount)+'</td><td><input type="number" min="0" max="100" step="0.01" style="width:75px" data-saved-rate="'+r.id+'" value="'+Number(r.rate)+'"></td><td>'+money(r.amount)+'</td><td>'+esc(r.status)+'</td><td><button type="button" class="secondary" data-saved-action="approve" data-saved-id="'+r.id+'">Aprobar / actualizar</button> <button type="button" class="secondary" data-saved-action="reject" data-saved-id="'+r.id+'">Desaprobar</button></td></tr>').join('')+'</tbody></table></div></details>'}
document.addEventListener('click',async e=>{const btn=e.target.closest('[data-saved-action]');if(!btn||!canImport)return;const id=Number(btn.dataset.savedId),action=btn.dataset.savedAction,row=saved.find(x=>Number(x.id)===id);if(!row)return;const rateInput=document.querySelector('[data-saved-rate="'+id+'"]');const rate=rateInput&&rateInput.value.trim()!==''?Number(rateInput.value):NaN;if(!Number.isFinite(rate)||rate<0||rate>100)return alert('Porcentaje inválido');const reason=prompt('Motivo del cambio de '+row.employee_name+':');if(!reason||reason.trim().length<5)return;btn.disabled=true;const {error}=await db.rpc('hr_commissions_review_update',{p_id:id,p_action:action,p_rate:rate,p_reason:reason.trim()});if(error){btn.disabled=false;return alert('No se pudo actualizar: '+error.message)}await history();$('unified-print').disabled=true;$('unified-preview').innerHTML='<p class="com-empty">Las comisiones cambiaron. Volvé a generar el informe.</p>';});
function refreshOptions(){
 const picker=$('unified-person'),previous=picker.value,source=$('unified-source').value;
 const names=[...new Set((source==='preview'?(draft?.rows||[]).map(x=>x.vendor):saved.map(x=>x.employee_name)).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'es'));
 picker.innerHTML='<option value="">Seleccionar vendedor ('+names.length+')</option>'+names.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');
 picker.disabled=names.length===0;
 picker.value=names.includes(previous)?previous:(names.length===1?names[0]:'');
 $('unified-generate').disabled=names.length===0;
 if(!names.length&&source==='preview'&&!draft)$('unified-preview').innerHTML='<p class="com-empty">El análisis preliminar terminó al guardar. Elegí «Liquidación guardada» para generar el informe.</p>';
}
function generate(){
 const person=$('unified-person').value,preview=$('unified-source').value==='preview';
 if(!person)return alert('Seleccioná vendedor');
 const ledger=window.BlackCommissionLedger;
 if(!ledger)return alert('El motor de conciliación no está disponible. Actualizá con Ctrl + F5.');
 const previewSource=(draft?.rows||[]).filter(r=>ledger.key(r.vendor)===ledger.key(person));
 const previewRows=previewSource.map(x=>({operation_date:$('unified-to').value,concept:x.client+' · '+x.articles,base_amount:x.base,rate:x.rate,amount:x.commission,
 status:ledger.included(x)?x.reviewDecision==='approved'?'Aprobada manualmente':'Conciliada':x.reviewDecision==='rejected'?'Rechazada':blockedReview(x)?'Excluida por validación':x.reason?'A revisar':'No comisionable',
 source_reference:x.id,counted:ledger.included(x)}));
 const savedRows=saved.filter(x=>ledger.key(x.employee_name)===ledger.key(person)).map(x=>({...x,counted:!['anulada','rechazada','rejected','cancelada'].includes(String(x.status||'').toLowerCase())&&Number.isFinite(Number(x.amount))}));
 const rows=preview?previewRows:savedRows;
 const totalCents=preview?ledger.sumCents(previewSource):rows.filter(r=>r.counted).reduce((s,r)=>s+ledger.cents(r.amount),0);
 const total=totalCents/100;
 const summaryCents=ledger.totals.get(ledger.key(person));
 if(preview&&(summaryCents===undefined||summaryCents!==totalCents)){
  $('unified-preview').innerHTML='<p class="com-empty">DIFERENCIA DE CONCILIACIÓN: no se habilita la impresión. Resumen: '+money((summaryCents||0)/100)+' · Informe: '+money(total)+' · Diferencia: '+money((totalCents-(summaryCents||0))/100)+'. Volvé a analizar los Excel.</p>';
  $('unified-print').disabled=true;return;
 }
 const sourceNote=preview?'Fuente: análisis actual de los tres Excel · conciliado con el resumen mensual':'Fuente: comisiones guardadas en Supabase · distinta del análisis actual';
 const sourceComparison=!preview&&draft&&summaryCents!==undefined?'<p style="font-size:12px">Análisis actual: '+money(summaryCents/100)+' · Diferencia entre fuentes: '+money((totalCents-summaryCents)/100)+'. Son conjuntos de movimientos diferentes; elegí «Vista previa (sin guardar)» para obtener el mismo total del resumen mensual.</p>':'';
 $('unified-preview').innerHTML='<article class="unified-sheet"><div class="sheet-top"><div><strong style="letter-spacing:.12em">BLACK ÓPTICA</strong><h2>Informe individual de comisiones</h2><p>'+esc(person)+'</p></div><div style="text-align:right"><strong>'+esc($('unified-from').value)+' — '+esc($('unified-to').value)+'</strong><p>'+(preview?'PRELIMINAR · SIN GUARDAR':'MOVIMIENTOS REGISTRADOS')+'</p></div></div><p>'+esc(sourceNote)+'</p><div class="scroll"><table><thead><tr><th>Fecha imputación</th><th>Concepto / cliente</th><th>Referencia</th><th>Base sin IVA</th><th>Tasa</th><th>Comisión calculada</th><th>Importe incluido</th><th>Estado</th></tr></thead><tbody>'+rows.map(x=>'<tr><td>'+esc(x.operation_date)+'</td><td>'+esc(x.concept)+'</td><td>'+esc(x.source_reference||'—')+'</td><td>'+money(x.base_amount)+'</td><td>'+esc(x.rate)+'%</td><td>'+money(x.amount)+'</td><td>'+money(x.counted?x.amount:0)+'</td><td>'+esc(x.status)+'</td></tr>').join('')+'</tbody></table></div><p style="text-align:right">Total informativo <span class="sheet-total">'+money(total)+'</span></p>'+sourceComparison+'<p>Documento informativo. No acredita pago ni reemplaza recibo salarial.</p><div class="sheet-signatures"><span>Firma de recepción del integrante</span><span>Firma del responsable</span></div><footer>Emitido el '+esc(new Date().toLocaleDateString('es-AR'))+' · BLACK ÓPTICA</footer></article>';
 $('unified-print').disabled=false;
}
function print(){if($('unified-print').disabled||!$('unified-preview').querySelector('.unified-sheet'))return;document.body.classList.add('print-employee');window.addEventListener('afterprint',()=>document.body.classList.remove('print-employee'),{once:true});window.print()}
document.addEventListener('DOMContentLoaded',init);
})();