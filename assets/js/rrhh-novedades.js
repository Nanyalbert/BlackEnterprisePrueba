(()=>{
const $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>v==null?'—':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(v);
const minutes=v=>Math.max(0,Number(v)||0)+' min';
let sb,rows=[],canManage=false,canFinancial=false;
const status={pending:'Pendiente',justified:'Justificada',unjustified:'Injustificada',not_applicable:'No corresponde',compensated:'Compensada',reviewed:'Revisada',approved:'Extra aprobada',not_approved:'No aprobada',compensation:'Para compensar'};
const localDate=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
function message(s){$('nov-message').textContent=s}
async function init(){
 try{sb=window.BlackPortal?.getSupabase?.()}catch(e){}
 if(!sb){message('No se pudo conectar con Supabase');return}
 const a=await sb.rpc('hr_attendance_review_access');if(a.error){message(a.error.message);return}
 if(!a.data?.view){message('No tenés permiso para consultar reportes');return}
 canManage=!!a.data.manage;canFinancial=!!a.data.financial;
 $('nov-month').value=localDate(new Date());
 const e=await sb.rpc('hr_list_employees');if(!e.error)(e.data||[]).forEach(x=>{$('nov-employee').insertAdjacentHTML('beforeend','<option value="'+esc(x.id)+'">'+esc(x.full_name)+'</option>')});
 $('nov-refresh').onclick=load;$('nov-month').onchange=load;$('nov-employee').onchange=load;
 $('nov-export').onclick=exportCsv;$('nov-print').onclick=()=>window.print();
 $('nov-close').onclick=$('nov-cancel').onclick=()=>{$('nov-modal').classList.remove('open');$('nov-modal').style.display='none'};
 $('nov-form').onsubmit=save;$('nov-history').onclick=history;
 $('nov-table').addEventListener('click',e=>{const b=e.target.closest('[data-review]');if(b)openReview(Number(b.dataset.review))});
 await load();
}
function eligible(r){return r.missing||r.late_minutes>0||r.early_minutes>0||r.extra_minutes>0||r.incomplete||r.reason}
function value(r){if(!canFinancial||r.hourly_rate==null)return null;const rate=Number(r.hourly_rate);
const absent=r.missing&&r.absence_status==='unjustified'?Number(r.expected_minutes):0;
const late=r.late_status==='reviewed'?Math.max(0,Number(r.late_minutes)-Number(r.compensation_minutes)):0;
return (absent+late)*rate/60}
function extraValue(r){if(!canFinancial||r.hourly_rate==null)return null;return Number(r.approved_extra_minutes)*Number(r.hourly_rate)/60}
function render(){
 const selected=rows.filter(eligible),missing=selected.filter(r=>r.missing),pending=selected.filter(r=>(r.missing&&r.absence_status==='pending')||(r.late_minutes>0&&r.late_status==='pending')||(r.extra_minutes>0&&r.extra_status==='pending'));
 const deduction=selected.reduce((a,r)=>a+(value(r)||0),0),extra=selected.reduce((a,r)=>a+(extraValue(r)||0),0);
 $('nov-summary').innerHTML='<div class="individual-kpis"><article><span>Jornadas con novedades</span><strong>'+selected.length+'</strong><small>Período seleccionado</small></article><article><span>Ausencias detectadas</span><strong>'+missing.length+'</strong><small>'+missing.filter(r=>r.absence_status==='unjustified').length+' injustificadas</small></article><article><span>Revisiones pendientes</span><strong>'+pending.length+'</strong><small>Sin resolución administrativa</small></article><article><span>Descuento estimado</span><strong>'+money(canFinancial?deduction:null)+'</strong><small>No aplicado a sueldos</small></article><article><span>Adicional base estimado</span><strong>'+money(canFinancial?extra:null)+'</strong><small>Sin recargos legales; no liquidado</small></article></div>';
 $('nov-table').innerHTML=selected.length?'<table><thead><tr><th>Fecha</th><th>Integrante</th><th>Situación</th><th>Resolución</th><th>Impacto</th><th>Acción</th></tr></thead><tbody>'+selected.map(r=>{
 const idx=rows.indexOf(r),situ=[r.missing?'Sin fichada':null,r.late_minutes?'Tarde '+minutes(r.late_minutes):null,r.early_minutes?'Salida anticipada '+minutes(r.early_minutes):null,r.extra_minutes?'Adicional '+minutes(r.extra_minutes):null,r.incomplete?'Fichada abierta':null].filter(Boolean).join(' · ');
 const states=[r.missing?status[r.absence_status]:null,r.late_minutes?status[r.late_status]:null,r.extra_minutes?status[r.extra_status]:null].filter(Boolean).join(' / ');
 return '<tr><td>'+esc(r.date)+'</td><td>'+esc(r.employee_name)+'<small style="display:block">'+esc(r.branch)+'</small></td><td>'+esc(situ)+'</td><td>'+esc(states||'Sin resolver')+'</td><td>'+money(value(r))+'</td><td><button type="button" class="btn btn-ghost" data-review="'+idx+'">'+(canManage?'Revisar':'Detalle')+'</button></td></tr>'
 }).join('')+'</tbody></table>':'<div class="report-empty">No hay novedades para este período.</div>';
}
async function load(){
 message('Cargando jornadas y resoluciones…');$('nov-table').innerHTML='';
 const month=$('nov-month').value;if(!month){message('Seleccioná un mes');return}
 const res=await sb.rpc('hr_attendance_review_list',{p_month:month+'-01',p_employee_id:$('nov-employee').value||null});
 if(res.error){message('No se pudo consultar: '+res.error.message);return}
 rows=res.data||[];render();message('Información actualizada. Las marcas originales se conservan sin modificaciones.');
}
function openReview(i){
 const r=rows[i];if(!r)return;
 $('nov-id').value=r.employee_id;$('nov-date').value=r.date;
 $('nov-title').textContent=r.employee_name+' · '+r.date;
 $('nov-absence').value=r.absence_status;$('nov-late').value=r.late_status;$('nov-extra').value=r.extra_status;
 $('nov-comp').value=r.compensation_minutes;$('nov-approved').value=r.approved_extra_minutes;$('nov-reason').value=r.reason||'';
 $('nov-history-content').innerHTML='<p>Horario: '+esc(r.scheduled_start||'—')+'–'+esc(r.scheduled_end||'—')+' · Tardanza: '+minutes(r.late_minutes)+' · Tiempo adicional: '+minutes(r.extra_minutes)+'</p>';
 $('nov-save').disabled=!canManage;['nov-absence','nov-late','nov-extra','nov-comp','nov-approved','nov-reason'].forEach(id=>$(id).disabled=!canManage);
 $('nov-modal').style.display='flex';$('nov-modal').classList.add('open');
}
async function save(e){
 e.preventDefault();if(!canManage)return;
 const r=rows.find(x=>x.employee_id===$('nov-id').value&&x.date===$('nov-date').value);if(!r)return;
 const comp=Number($('nov-comp').value),approved=Number($('nov-approved').value);
 if(!Number.isInteger(comp)||!Number.isInteger(approved)||comp<0||approved<0||comp>Math.min(r.late_minutes,r.extra_minutes)||approved>r.extra_minutes-comp){alert('Revisá los minutos: no pueden superar el tiempo adicional disponible.');return}
 if($('nov-reason').value.trim().length<4){alert('Indicá un motivo.');return}
 $('nov-save').disabled=true;
 const {error}=await sb.rpc('hr_attendance_review_save',{p_employee_id:r.employee_id,p_date:r.date,p_absence_status:$('nov-absence').value,p_late_status:$('nov-late').value,p_extra_status:$('nov-extra').value,p_compensation_minutes:comp,p_approved_extra_minutes:approved,p_reason:$('nov-reason').value.trim()});
 $('nov-save').disabled=false;if(error){alert('No se pudo guardar: '+error.message);return}
 $('nov-modal').classList.remove('open');$('nov-modal').style.display='none';await load();
}
async function history(){
 const {data,error}=await sb.rpc('hr_attendance_review_history_list',{p_employee_id:$('nov-id').value,p_date:$('nov-date').value});
 $('nov-history-content').innerHTML=error?esc(error.message):(!data?.length?'Sin resoluciones anteriores':data.map(x=>'<p><strong>'+esc(new Date(x.date).toLocaleString('es-AR'))+' · '+esc(x.actor)+'</strong> — '+esc(x.reason)+'</p>').join(''));
}
function exportCsv(){
 const fields=['Fecha','Empleado','Sucursal','Programado_min','Trabajado_min','Tarde_min','Salida_anticipada_min','Adicional_min','Ausencia','Estado_ausencia','Estado_tardanza','Estado_extra','Compensado_min','Extra_aprobado_min','Descuento_estimado','Extra_base_estimado','Motivo','Revisor'];
 const records=rows.filter(eligible).map(r=>[r.date,r.employee_name,r.branch,r.expected_minutes,r.worked_minutes,r.late_minutes,r.early_minutes,r.extra_minutes,r.missing?'Sí':'No',status[r.absence_status],status[r.late_status],status[r.extra_status],r.compensation_minutes,r.approved_extra_minutes,value(r)??'',extraValue(r)??'',r.reason||'',r.reviewer||'']);
 const csv='\ufeff'+[fields,...records].map(row=>row.map(v=>'"'+String(v??'').replace(/"/g,'""')+'"').join(';')).join('\r\n');
 const a=document.createElement('a');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));a.href=url;a.download='Black_Fichadas_Novedades_'+$('nov-month').value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.addEventListener('DOMContentLoaded',init);
})();