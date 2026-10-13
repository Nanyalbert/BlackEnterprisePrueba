(() => {
  const BRANCH_LABELS={
    'general-paz':'General Paz',
    'cerro-de-las-rosas':'Cerro de las Rosas',
    'alto-palermo':'Cerro de las Rosas',
    'zona-norte':'Cerro de las Rosas',
    'cerro':'Cerro de las Rosas'
  };
  const state={employees:[],attendance:[],summary:[],schedules:[],canAdjustMarks:false,canDeleteMarks:false};
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
  const DAY_LABELS={0:'Dom',1:'Lun',2:'Mar',3:'Mié',4:'Jue',5:'Vie',6:'Sáb'};
  function scheduleRows(){return qsa('#employee-schedule-days .schedule-day')}
  function setScheduleRowEnabled(row,enabled){
    const check=row.querySelector('.schedule-enabled');
    const inputs=row.querySelectorAll('.schedule-start,.schedule-end');
    if(check)check.checked=Boolean(enabled);
    row.classList.toggle('disabled',!enabled);
    inputs.forEach(input=>input.disabled=!enabled);
  }
  function resetScheduleEditor(){
    scheduleRows().forEach(row=>{
      const day=Number(row.dataset.weekday);
      const weekday=day>=1&&day<=5;
      row.querySelector('.schedule-start').value=day===6||day===0?'09:00':'09:00';
      row.querySelector('.schedule-end').value=day===6||day===0?'13:00':'19:00';
      setScheduleRowEnabled(row,weekday);
    });
  }
  function loadScheduleEditor(employeeId){
    resetScheduleEditor();
    if(!employeeId)return;
    const rows=state.schedules.filter(s=>String(s.employee_id)===String(employeeId));
    scheduleRows().forEach(row=>setScheduleRowEnabled(row,false));
    rows.forEach(s=>{
      const row=qs('#employee-schedule-days .schedule-day[data-weekday="'+Number(s.weekday)+'"]');
      if(!row)return;
      row.querySelector('.schedule-start').value=fmtTime(s.start_time);
      row.querySelector('.schedule-end').value=fmtTime(s.end_time);
      setScheduleRowEnabled(row,true);
    });
  }
  function collectSchedules(){
    const out=[];
    for(const row of scheduleRows()){
      const enabled=row.querySelector('.schedule-enabled')?.checked;
      if(!enabled)continue;
      const start=row.querySelector('.schedule-start')?.value||'';
      const end=row.querySelector('.schedule-end')?.value||'';
      if(!start||!end)throw new Error('Completá entrada y salida para cada día seleccionado.');
      if(end<=start)throw new Error('La salida debe ser posterior a la entrada en '+(row.querySelector('.day-toggle strong')?.textContent||'el día seleccionado')+'.');
      out.push({weekday:Number(row.dataset.weekday),start_time:start,end_time:end});
    }
    if(!out.length)throw new Error('Seleccioná al menos un día de trabajo.');
    return out;
  }
  scheduleRows().forEach(row=>{
    const checkbox=row.querySelector('.schedule-enabled');
    checkbox?.addEventListener('change',()=>setScheduleRowEnabled(row,checkbox.checked));
  });
  qs('#copy-weekdays-btn')?.addEventListener('click',()=>{
    const monday=qs('#employee-schedule-days .schedule-day[data-weekday="1"]');
    const start=monday?.querySelector('.schedule-start')?.value||'09:00';
    const end=monday?.querySelector('.schedule-end')?.value||'19:00';
    for(let day=1;day<=5;day++){
      const row=qs('#employee-schedule-days .schedule-day[data-weekday="'+day+'"]');
      if(!row)continue;
      row.querySelector('.schedule-start').value=start;
      row.querySelector('.schedule-end').value=end;
      setScheduleRowEnabled(row,true);
    }
  });

  function openModal(employee){
    form.reset(); qs('#employee-id').value=employee?.id||'';
    qs('#employee-modal-title').textContent=employee?'Editar integrante':'Nuevo integrante';
    qs('#employee-name').value=employee?.full_name||'';
    qs('#employee-branch').value=canonicalBranch(employee?.branch_code||'general-paz');
    qs('#employee-email').value=employee?.email||'';
    qs('#employee-active').value=employee?.active===false?'false':'true';
    loadScheduleEditor(employee?.id||null);
    qs('#employee-tolerance').value=employee?.tolerance_minutes??10;
    qs('#employee-pin').value='';
    qs('#employee-pin').required=!employee;
    qs('#employee-pin').placeholder=employee?'Dejar vacío para conservarlo':'4 a 6 dígitos';
    qs('#employee-salary').value=employee?.monthly_reference_salary??'';
    modal.classList.add('show');
    setTimeout(()=>qs('#employee-name').focus(),60);
  }
  function closeModal(){modal.classList.remove('show')}

  const markModal=qs('#mark-modal'),markForm=qs('#mark-form');
  function localDateTimeValue(value){
    const d=value?new Date(value):new Date();
    if(Number.isNaN(d.getTime()))return '';
    const pad=n=>String(n).padStart(2,'0');
    return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
  }
  function populateMarkEmployees(selectedId){
    const select=qs('#mark-employee');
    select.innerHTML=state.employees
      .filter(e=>e.active!==false||String(e.id)===String(selectedId||''))
      .map(e=>'<option value="'+esc(e.id)+'">'+esc(e.full_name)+' · '+esc(e.branch_name||BRANCH_LABELS[canonicalBranch(e.branch_code)]||'')+'</option>')
      .join('');
    if(selectedId)select.value=String(selectedId);
  }
  function openMarkModal(mark=null){
    if(!state.canAdjustMarks||!markModal)return;
    markForm.reset();
    qs('#mark-id').value=mark?.id||'';
    qs('#mark-modal-title').textContent=mark?'Corregir marcación':'Agregar marca manual';
    populateMarkEmployees(mark?.employee_id||state.employees.find(e=>e.active!==false)?.id||'');
    qs('#mark-employee').disabled=Boolean(mark);
    qs('#mark-datetime').value=localDateTimeValue(mark?.marked_at||new Date());
    qs('#mark-type').value=String(mark?.mark_type||'entrada').toLowerCase();
    qs('#mark-reason').value='';
    markModal.classList.add('show');
    setTimeout(()=>qs('#mark-reason').focus(),50);
  }
  function closeMarkModal(){markModal?.classList.remove('show')}
  qs('#manual-mark-btn')?.addEventListener('click',()=>openMarkModal());
  qs('#mark-modal-close')?.addEventListener('click',closeMarkModal);
  qs('#mark-cancel')?.addEventListener('click',closeMarkModal);
  markModal?.addEventListener('click',e=>{if(e.target===markModal)closeMarkModal()});

  qs('#new-employee-btn').addEventListener('click',()=>openModal());
  qs('#employee-modal-close').addEventListener('click',closeModal);
  qs('#employee-cancel').addEventListener('click',closeModal);
  modal.addEventListener('click',e=>{if(e.target===modal)closeModal()});

  function employeeRow(e){
    const employeeSchedules=state.schedules
      .filter(s=>String(s.employee_id)===String(e.id))
      .sort((a,b)=>{const order=[1,2,3,4,5,6,0];return order.indexOf(Number(a.weekday))-order.indexOf(Number(b.weekday))});
    const scheduleText=employeeSchedules.length
      ? employeeSchedules.map(s=>DAY_LABELS[Number(s.weekday)]+' '+fmtTime(s.start_time)+'–'+fmtTime(s.end_time)).join(' · ')
      : 'Sin días asignados';
    return '<tr><td><div class="employee-cell"><strong>'+esc(e.full_name)+'</strong><small>'+esc(e.email||'Sin usuario Black OS asociado')+'</small></div></td>'+
      '<td>'+esc(e.branch_name||BRANCH_LABELS[canonicalBranch(e.branch_code)]||e.branch_code||'—')+'</td>'+
      '<td>'+esc(scheduleText)+' · '+Number(e.tolerance_minutes||0)+' min</td>'+
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
    const [{data,error},{data:scheduleData,error:scheduleError}]=await Promise.all([
      sb.rpc('hr_list_employees'),
      sb.rpc('hr_list_employee_schedules')
    ]);
    if(error||scheduleError){
      console.warn(error||scheduleError);
      qs('#employees-tbody').innerHTML='<tr><td colspan="6" class="empty-cell">No se pudo cargar RRHH. Verificá permisos o la migración de base de datos.</td></tr>';
      return;
    }
    state.employees=(data||[]).map(e=>({...e,branch_code:canonicalBranch(e.branch_code)}));
    state.schedules=scheduleData||[];
    renderEmployees();
    await loadMarkCapability();
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
    renderDetailedMarks();
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

  function renderDetailedMarks(){
    const tbody=qs('#marks-tbody');
    if(!tbody)return;
    const rows=[...state.attendance].sort((a,b)=>new Date(b.marked_at)-new Date(a.marked_at));
    tbody.innerHTML=rows.length?rows.map(m=>{
      const dt=new Date(m.marked_at);
      const when=Number.isNaN(dt.getTime())?'—':dt.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'})+' · '+dt.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
      const source=m.is_manual?'Ajustada manualmente':(m.source==='terminal'?'Black Fichada':(m.source||'—'));
      const edit=state.canAdjustMarks?'<button class="row-btn edit-mark" data-id="'+esc(m.id)+'" title="Corregir marcación" aria-label="Corregir marcación"><svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button>':'';
      const del=state.canDeleteMarks?'<button class="row-btn danger delete-mark" data-id="'+esc(m.id)+'" title="Eliminar marcación" aria-label="Eliminar marcación"><svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M8 11v7M12 11v7M16 11v7M6 7l1 14h10l1-14"/></svg></button>':'';
      const action=(edit||del)?'<div class="mark-actions">'+edit+del+'</div>':'';
      return '<tr><td><strong>'+esc(m.employee_name)+'</strong></td><td>'+esc(when)+'</td><td><span class="status-pill">'+esc(String(m.mark_type||'').toUpperCase())+'</span></td><td>'+esc(source)+'</td><td>'+esc(m.note||'—')+'</td><td>'+action+'</td></tr>';
    }).join(''):'<tr><td colspan="6" class="empty-cell">Todavía no hay marcaciones hoy.</td></tr>';
    qsa('.edit-mark').forEach(btn=>btn.addEventListener('click',()=>openMarkModal(state.attendance.find(m=>String(m.id)===String(btn.dataset.id)))));
    qsa('.delete-mark').forEach(btn=>btn.addEventListener('click',async()=>{
      const mark=state.attendance.find(m=>String(m.id)===String(btn.dataset.id));
      if(!mark||!state.canDeleteMarks)return;
      const reason=prompt('Motivo de eliminación de la marcación:');
      if(reason===null)return;
      if(reason.trim().length<4){alert('Indicá un motivo de al menos 4 caracteres.');return}
      if(!confirm('¿Eliminar esta marcación? El movimiento se quitará del cómputo, pero quedará registrado en la auditoría.'))return;
      btn.disabled=true;
      const {error}=await sb.rpc('hr_delete_time_mark',{p_mark_id:Number(mark.id),p_reason:reason.trim()});
      if(error){btn.disabled=false;alert(error.message||'No se pudo eliminar la marcación.');return}
      await Promise.all([loadToday(),loadSummaryKpis()]);
    }));
  }

  async function loadMarkCapability(){
    if(!sb)return;
    try{
      const [{data,error},{data:isAdmin,error:adminError}]=await Promise.all([
        sb.rpc('black_os_has_permission',{p_module:'rrhh',p_permission:'settings'}),
        sb.rpc('black_os_is_admin')
      ]);
      state.canAdjustMarks=!error&&data===true;
      state.canDeleteMarks=!adminError&&isAdmin===true;
    }catch(_){state.canAdjustMarks=false;state.canDeleteMarks=false}
    const button=qs('#manual-mark-btn');
    if(button)button.hidden=!state.canAdjustMarks;
    renderDetailedMarks();
  }

  markForm?.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!sb||!state.canAdjustMarks)return;
    const id=qs('#mark-id').value?Number(qs('#mark-id').value):null;
    const employeeId=qs('#mark-employee').value;
    const localValue=qs('#mark-datetime').value;
    const reason=qs('#mark-reason').value.trim();
    if(reason.length<4)return alert('Indicá el motivo del ajuste.');
    const markedAt=new Date(localValue);
    if(Number.isNaN(markedAt.getTime()))return alert('Indicá una fecha y hora válidas.');
    const submit=markForm.querySelector('button[type="submit"]');
    submit.disabled=true;submit.textContent='Guardando…';
    const {error}=await sb.rpc('hr_save_time_mark',{
      p_mark_id:id,
      p_employee_id:employeeId,
      p_marked_at:markedAt.toISOString(),
      p_mark_type:qs('#mark-type').value,
      p_reason:reason
    });
    submit.disabled=false;submit.textContent='Guardar ajuste';
    if(error)return alert(error.message||'No se pudo guardar el ajuste.');
    closeMarkModal();
    await Promise.all([loadToday(),loadSummaryKpis()]);
  });

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
    let schedules;
    try{schedules=collectSchedules();}catch(error){alert(error.message||String(error));return}
    const payload={
      full_name:qs('#employee-name').value.trim(),
      branch_code:canonicalBranch(qs('#employee-branch').value),
      email:qs('#employee-email').value.trim()||null,
      schedules,
      tolerance_minutes:Number(qs('#employee-tolerance').value||0),
      monthly_reference_salary:Number(qs('#employee-salary').value||0),
      active:qs('#employee-active').value!=='false'
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