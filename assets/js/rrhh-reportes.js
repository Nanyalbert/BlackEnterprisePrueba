(() => {
  const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
  let sb=null; try{sb=window.BlackPortal?.getSupabase?.()||null}catch(e){}
  const state={employees:[],rows:[],employee:null};
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const isoDate=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const fmtTime=v=>v?String(v).slice(0,5):'—';
  const localTime=v=>v?new Date(v).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'}):'—';
  const fmtMinutes=m=>{const n=Math.max(0,Math.round(Number(m)||0)),h=Math.floor(n/60),min=n%60;return h?(h+' h '+(min?min+' min':'')).trim():(min+' min')};
  const signedMinutes=m=>{const n=Math.round(Number(m)||0),sign=n>0?'+':n<0?'−':'';return sign+fmtMinutes(Math.abs(n))};
  const csvEscape=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  const statusMeta=status=>({complete:['Completo','ok'],partial:['Con diferencia','warn'],incomplete:['Fichada abierta','bad'],missing:['Sin fichada','bad'],extra:['Día extra','neutral'],off:['Sin jornada','neutral'],future:['Futuro','neutral']}[status]||['Revisar','warn']);

  async function loadEmployees(){
    if(!sb)return;
    const {data,error}=await sb.rpc('hr_list_employees');
    if(error){console.warn(error);return}
    state.employees=(data||[]).filter(e=>e.active!==false);
    const select=qs('#individual-employee'); if(!select)return;
    const current=select.value;
    select.innerHTML='<option value="">Seleccionar integrante</option>'+state.employees.map(e=>'<option value="'+esc(e.id)+'">'+esc(e.full_name)+'</option>').join('');
    if(state.employees.some(e=>String(e.id)===String(current)))select.value=current;
  }

  function metrics(rows){
    const today=isoDate(new Date());
    const relevant=rows.filter(r=>String(r.work_date)<=today&&r.status!=='future');
    const scheduled=relevant.filter(r=>r.scheduled);
    const withEntry=scheduled.filter(r=>r.first_entry);
    const expected=scheduled.reduce((a,r)=>a+Number(r.expected_minutes||0),0);
    const worked=relevant.reduce((a,r)=>a+Number(r.worked_minutes||0),0);
    const late=relevant.reduce((a,r)=>a+Number(r.late_minutes||0),0);
    const balance=worked-expected;
    const punctual=withEntry.length?Math.round(withEntry.filter(r=>Number(r.late_minutes||0)===0).length/withEntry.length*100):null;
    const compliance=expected>0?Math.round(worked/expected*100):null;
    const missed=scheduled.filter(r=>r.status==='missing').length;
    const incomplete=relevant.filter(r=>r.incomplete).length;
    return {scheduled:scheduled.length,expected,worked,late,balance,punctual,compliance,missed,incomplete};
  }

  function renderKpis(rows){
    const k=metrics(rows),cards=qsa('#individual-kpis article');
    const values=[
      [String(k.scheduled),k.missed?String(k.missed)+' día(s) sin fichada':'Sin ausencias registradas'],
      [fmtMinutes(k.worked),'Esperadas: '+fmtMinutes(k.expected)],
      [k.compliance==null?'—':String(k.compliance)+'%',k.compliance!=null&&k.compliance>100?'Incluye tiempo adicional':'Trabajadas / esperadas'],
      [k.punctual==null?'—':String(k.punctual)+'%',k.punctual==null?'Sin entradas para medir':'Sobre días con entrada'],
      [fmtMinutes(k.late),k.late?'Fuera de tolerancia':'Sin tardanzas'],
      [signedMinutes(k.balance),k.incomplete?String(k.incomplete)+' jornada(s) abierta(s)':'Balance del período']
    ];
    cards.forEach((card,i)=>{const strong=card.querySelector('strong'),small=card.querySelector('small');if(strong)strong.textContent=values[i][0];if(small)small.textContent=values[i][1];card.classList.toggle('negative',i===5&&k.balance<0);card.classList.toggle('positive',i===5&&k.balance>0)});
  }

  function tableHtml(rows){
    if(!rows.length)return '<div class="report-empty">No hay datos para este período.</div>';
    return '<div class="table-scroll"><table class="daily-report-table"><thead><tr><th>Fecha</th><th>Programado</th><th>Entrada</th><th>Salida final</th><th>Marcas</th><th>Trabajado</th><th>Cumplimiento</th><th>Tardanza</th><th>Salida anticipada</th><th>Balance</th><th>Estado</th></tr></thead><tbody>'+rows.map(r=>{
      const meta=statusMeta(r.status);
      const date=new Date(String(r.work_date)+'T12:00:00').toLocaleDateString('es-AR',{weekday:'short',day:'2-digit',month:'2-digit'});
      const schedule=r.scheduled?fmtTime(r.scheduled_start)+'–'+fmtTime(r.scheduled_end):'—';
      const compliance=Number(r.expected_minutes)>0?Math.round(Number(r.worked_minutes||0)/Number(r.expected_minutes)*100):null;
      return '<tr><td><strong>'+esc(date)+'</strong></td><td>'+schedule+'</td><td>'+localTime(r.first_entry)+'</td><td>'+localTime(r.last_mark)+'</td><td>'+Number(r.mark_count||0)+'</td><td>'+fmtMinutes(r.worked_minutes)+'</td><td>'+(compliance==null?'—':compliance+'%')+'</td><td class="'+(Number(r.late_minutes)>0?'metric-bad':'')+'">'+(Number(r.late_minutes)>0?fmtMinutes(r.late_minutes):'—')+'</td><td class="'+(Number(r.early_leave_minutes)>0?'metric-warn':'')+'">'+(Number(r.early_leave_minutes)>0?fmtMinutes(r.early_leave_minutes):'—')+'</td><td class="'+(Number(r.balance_minutes)<0?'metric-bad':Number(r.balance_minutes)>0?'metric-ok':'')+'">'+signedMinutes(r.balance_minutes)+'</td><td><span class="report-status '+meta[1]+'">'+meta[0]+'</span></td></tr>';
    }).join('')+'</tbody></table></div>';
  }

  async function run(){
    if(!sb)return alert('Supabase no está disponible.');
    const id=qs('#individual-employee')?.value||'',from=qs('#individual-from')?.value||'',to=qs('#individual-to')?.value||'';
    if(!id)return alert('Seleccioná un integrante.');
    if(!from||!to)return alert('Seleccioná el rango de fechas.');
    if(to<from)return alert('La fecha Hasta no puede ser anterior a Desde.');
    state.employee=state.employees.find(e=>String(e.id)===String(id))||null;
    qs('#individual-title').textContent=state.employee?.full_name||'Reporte individual';
    qs('#individual-period').textContent=new Date(from+'T12:00:00').toLocaleDateString('es-AR')+' al '+new Date(to+'T12:00:00').toLocaleDateString('es-AR');
    const target=qs('#individual-report');target.innerHTML='<div class="report-empty">Calculando reporte individual…</div>';
    const {data,error}=await sb.rpc('hr_employee_daily_report',{p_employee_id:id,p_from:from,p_to:to});
    if(error){console.warn(error);target.innerHTML='<div class="report-empty">No se pudo generar el reporte: '+esc(error.message||'Error desconocido')+'</div>';return}
    state.rows=data||[];renderKpis(state.rows);target.innerHTML=tableHtml(state.rows);
    qs('#individual-export').disabled=!state.rows.length;qs('#individual-print').disabled=!state.rows.length;
  }

  function exportCsv(){
    if(!state.rows.length||!state.employee)return;
    const headers=['Fecha','Programado_desde','Programado_hasta','Entrada','Salida_final','Marcas','Min_esperados','Min_trabajados','Tardanza_min','Salida_anticipada_min','Extra_min','Balance_min','Estado'];
    const rows=state.rows.map(r=>[r.work_date,r.scheduled_start||'',r.scheduled_end||'',r.first_entry?localTime(r.first_entry):'',r.last_mark?localTime(r.last_mark):'',r.mark_count,r.expected_minutes,r.worked_minutes,r.late_minutes,r.early_leave_minutes,r.overtime_minutes,r.balance_minutes,statusMeta(r.status)[0]]);
    const content='\ufeff'+[headers,...rows].map(row=>row.map(csvEscape).join(';')).join('\n');
    const safe=String(state.employee.full_name||'integrante').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9]+/g,'_');
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));a.download='RRHH_'+safe+'_'+qs('#individual-from').value+'_'+qs('#individual-to').value+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function printReport(){if(!state.rows.length)return;document.body.classList.add('print-individual');window.print();setTimeout(()=>document.body.classList.remove('print-individual'),500)}

  function boot(){
    const now=new Date(),monthStart=new Date(now.getFullYear(),now.getMonth(),1);
    if(qs('#individual-from'))qs('#individual-from').value=isoDate(monthStart);
    if(qs('#individual-to'))qs('#individual-to').value=isoDate(now);
    qs('#individual-run')?.addEventListener('click',run);
    qs('#individual-export')?.addEventListener('click',exportCsv);
    qs('#individual-print')?.addEventListener('click',printReport);
    qs('#individual-employee')?.addEventListener('change',()=>{if(qs('#individual-employee').value)run()});
    loadEmployees();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();