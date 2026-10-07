(() => {
  const BRANCH_LABELS={
    'general-paz':'General Paz',
    'cerro-de-las-rosas':'Cerro de las Rosas',
    'alto-palermo':'Cerro de las Rosas',
    'zona-norte':'Cerro de las Rosas',
    'cerro':'Cerro de las Rosas'
  };
  const state={employees:[],attendance:[],summary:[]};
  let sb=null;
  try{sb=window.BlackPortal?.getSupabase?.()||null}catch(e){console.error(e)}

  const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const fmtTime=v=>v?String(v).slice(0,5):'—';
  const fmtMinutes=m=>{
    const n=Math.max(0,Number(m)||0),h=Math.floor(n/60),min=Math.round(n%60);
    return h?(h+' h '+(min?min+' min':'')).trim():(min+' min');
  };
  const fmtMoney=n=>n==null?'—':new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(n)||0);
  const monthKey=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');

  qsa('.rrhh-tab').forEach(btn=>btn.addEventListener('click',()=>{
    qsa('.rrhh-tab').forEach(x=>x.classList.toggle('active',x===btn));
    qsa('.rrhh-panel').forEach(x=>x.classList.toggle('active',x.id==='tab-'+btn.dataset.tab));
    if(btn.dataset.tab==='reportes') loadMonthlyReport();
  }));

  const modal=qs('#employee-modal'), form=qs('#employee-form');
  function canonicalBranch(code){
    if(['alto-palermo','zona-norte','cerro'].includes(code)) return 'cerro-de-las-rosas';
    return code||'general-paz';
  }
  function openModal(employee){
    form.reset(); qs('#employee-id').value=employee?.id||'';
    qs('#employee-modal-title').textContent=employee?'Editar integrante':'Nuevo integrante';
    qs('#employee-name').value=employee?.full_name||'';
    qs('#employee-branch').value=canonicalBranch(employee?.branch_code||'general-paz');
    qs('#employee-start').value=fmtTime(employee?.scheduled_start||'09:00');
    qs('#employee-end').value=fmtTime(employee?.scheduled_end||'19:00');
    qs('#employee-sat-start').value=fmtTime(employee?.sat_start||'09:00');
    qs('#employee-sat-end').value=fmtTime(employee?.sat_end||'13:00');
    qs('#employee-tolerance').value=employee?.tolerance_minutes??10;
    qs('#employee-pin').value='';
    qs('#employee-pin').required=!employee;
    qs('#employee-pin').placeholder=employee?'Dejar vacío para conservarlo':'4 a 6 dígitos';
    qs('#employee-salary').value=employee?.monthly_reference_salary??'';
    modal.classList.add('show');
    setTimeout(()=>qs('#employee-name').focus(),60);
  }
  function closeModal(){modal.classList.remove('show')}
  qs('#new-employee-btn').addEventListener('click',()=>openModal());
  qs('#employee-modal-close').addEventListener('click',closeModal);
  qs('#employee-cancel').addEventListener('click',closeModal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});

  function employeeRow(e){
    const weekday=fmtTime(e.scheduled_start)+'–'+fmtTime(e.scheduled_end);
    const saturday=e.sat_start&&e.sat_end?' · Sáb '+fmtTime(e.sat_start)+'–'+fmtTime(e.sat_end):'';
    return '<tr><td><div class="employee-cell"><strong>'+esc(e.full_name)+'</strong><small>'+esc(e.email||'Sin usuario Black OS asociado')+'</small></div></td>'+
      '<td>'+esc(e.branch_name||BRANCH_LABELS[canonicalBranch(e.branch_code)]||e.branch_code||'—')+'</td>'+
      '<td>'+weekday+saturday+' · '+Number(e.tolerance_minutes||0)+' min</td>'+
      '<td>••••</td><td><span class="status-pill '+(e.active===false?'inactive':'')+'">'+(e.active===false?'Inactivo':'Activo')+'</span></td>'+
      '<td><button class="row-btn edit-employee" data-id="'+esc(e.id)+'" title="Editar" aria-label="Editar"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button></td></tr>';
  }
  function renderEmployees(){
    const term=qs('#employee-search').value.trim().toLowerCase();
    const rows=state.employees.filter(e=>!term||String(e.full_name||'').toLowerCase().includes(term));
    qs('#employees-tbody').innerHTML=rows.length?rows.map(employeeRow).join(''):'<tr><td colspan="6" class="empty-cell">No hay integrantes para mostrar.</td></tr>';
    qsa('.edit-employee').forEach(b=>b.addEventListener('click',()=>openModal(state.employees.find(e=>String(e.id)===b.dataset.id))));
    qs('#kpi-active').textContent=state.employees.filter(e=>e.active!==false).length;
  }
  qs('#employee-search').addEventListener('input',renderEmployees);

  async function loadEmployees(){
    if(!sb){
      qs('#employees-tbody').innerHTML='<tr><td colspan="6" class="empty-cell">No se pudo conectar Supabase.</td></tr>';
      return;
    }
    const {data,error}=await sb.rpc('hr_list_employees');
    if(error){
      console.warn(error);
      qs('#employees-tbody').innerHTML='<tr><td colspan="6" class="empty-cell">No se pudo cargar RRHH. Verificá permisos o la migración de base de datos.</td></tr>';
      return;
    }
    state.employees=(data||[]).map(e=>({...e,branch_code:canonicalBranch(e.branch_code)}));
    renderEmployees();
    await Promise.all([loadToday(),loadSummaryKpis()]);
  }

  function localRangeForDate(date){
    const from=new Date(date);from.setHours(0,0,0,0);
    const to=new Date(date);to.setHours(23,59,59,999);
    return {from:from.toISOString(),to:to.toISOString()};
  }
  async function loadToday(){
    const now=new Date(),range=localRangeForDate(now);
    qs('#today-label').textContent=new Intl.DateTimeFormat('es-AR',{dateStyle:'full'}).format(now);
    if(!sb)return;
    const {data,error}=await sb.rpc('hr_list_marks',{p_from:range.from,p_to:range.to});
    if(error){console.warn(error);return}
    state.attendance=data||[];
    const by={};
    state.attendance.forEach(m=>(by[m.employee_id]??=[]).push(m));
    const rows=Object.entries(by).map(([id,marks])=>{
      marks.sort((a,b)=>new Date(a.marked_at)-new Date(b.marked_at));
      const e=state.employees.find(x=>String(x.id)===String(id));
      if(!e)return '';
      const first=marks[0],last=marks[marks.length-1];
      const late=Number(first.late_minutes||0);
      const open=['entrada','reingreso'].includes(String(last.mark_type||'').toLowerCase());
      return '<tr><td>'+esc(e.full_name)+'</td><td>'+new Date(first.marked_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+'</td><td>'+new Date(last.marked_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+'</td><td>'+marks.length+'</td><td>'+late+'</td><td><span class="status-pill '+(open?'':'inactive')+'">'+(open?'Presente':'Jornada cerrada')+'</span></td></tr>';
    }).filter(Boolean);
    qs('#attendance-tbody').innerHTML=rows.length?rows.join(''):'<tr><td colspan="6" class="empty-cell">Todavía no hay marcaciones hoy.</td></tr>';
    qs('#kpi-present').textContent=Object.values(by).filter(m=>{
      const last=[...m].sort((a,b)=>new Date(a.marked_at)-new Date(b.marked_at)).at(-1);
      return ['entrada','reingreso'].includes(String(last?.mark_type||'').toLowerCase());
    }).length;
  }

  async function fetchMonthlySummary(month){
    if(!sb)return [];
    const {data,error}=await sb.rpc('hr_monthly_summary',{p_month:month+'-01'});
    if(error){console.warn(error);return []}
    return data||[];
  }

  async function loadSummaryKpis(){
    const rows=await fetchMonthlySummary(monthKey(new Date()));
    state.summary=rows;
    qs('#kpi-late').textContent=rows.reduce((a,r)=>a+Number(r.late_days||0),0);
    qs('#kpi-review').textContent=rows.reduce((a,r)=>a+Number(r.incomplete_days||0),0);
  }

  function summaryTable(rows){
    if(!rows.length)return '<div class="report-empty">Todavía no hay datos para este período.</div>';
    return '<div class="table-scroll"><table class="monthly-table"><thead><tr>'+
      '<th>Integrante</th><th>Esperadas a la fecha</th><th>Trabajadas</th><th>Tardanza</th><th>Puntualidad</th><th>Impacto informativo</th><th>Revisar</th>'+
      '</tr></thead><tbody>'+rows.map(r=>'<tr>'+
      '<td><strong>'+esc(r.full_name)+'</strong></td>'+
      '<td>'+fmtMinutes(r.expected_to_date_minutes)+'</td>'+
      '<td>'+fmtMinutes(r.worked_minutes)+'</td>'+
      '<td>'+fmtMinutes(r.late_minutes)+' <small>· '+Number(r.late_days||0)+' día(s)</small></td>'+
      '<td>'+(r.punctuality_pct==null?'—':Number(r.punctuality_pct).toFixed(0)+'%')+'</td>'+
      '<td>'+fmtMoney(r.late_value_reference)+'</td>'+
      '<td>'+(Number(r.incomplete_days||0)?Number(r.incomplete_days)+' jornada(s)':'—')+'</td>'+
      '</tr>').join('')+'</tbody></table></div>';
  }

  async function loadMonthlyReport(){
    const month=qs('#report-month').value||monthKey(new Date());
    const target=qs('#monthly-report');
    target.innerHTML='<div class="report-empty">Calculando resumen…</div>';
    target.innerHTML=summaryTable(await fetchMonthlySummary(month));
  }
  qs('#report-month').addEventListener('change',loadMonthlyReport);

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!sb)return alert('Supabase no está disponible.');
    const id=qs('#employee-id').value||null;
    const pin=qs('#employee-pin').value.trim();
    if(pin&&!/^\d{4,6}$/.test(pin))return alert('El PIN debe tener entre 4 y 6 dígitos.');
    const payload={
      full_name:qs('#employee-name').value.trim(),
      branch_code:canonicalBranch(qs('#employee-branch').value),
      scheduled_start:qs('#employee-start').value,
      scheduled_end:qs('#employee-end').value,
      sat_start:qs('#employee-sat-start').value||null,
      sat_end:qs('#employee-sat-end').value||null,
      tolerance_minutes:Number(qs('#employee-tolerance').value||0),
      monthly_reference_salary:Number(qs('#employee-salary').value||0),
      active:true
    };
    if(pin)payload.pin_plain=pin;
    const submit=form.querySelector('button[type="submit"]');
    submit.disabled=true;submit.textContent='Guardando…';
    const {error}=await sb.rpc('hr_upsert_employee',{p_employee_id:id,p_payload:payload});
    submit.disabled=false;submit.textContent='Guardar integrante';
    if(error)return alert(error.message||'No se pudo guardar.');
    closeModal();await loadEmployees();
  });

  qs('#refresh-btn').addEventListener('click',loadEmployees);
  qs('#report-month').value=monthKey(new Date());
  qs('#kpi-present').textContent='0';qs('#kpi-late').textContent='0';qs('#kpi-review').textContent='0';
  loadEmployees();
})();