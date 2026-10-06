(() => {
  const BRANCH_LABELS={'general-paz':'General Paz','cerro':'Cerro de las Rosas'};
  const state={employees:[],attendance:[]};
  let sb=null;
  try{sb=window.BlackPortal?.getSupabase?.()||null}catch(e){console.error(e)}

  const qs=s=>document.querySelector(s), qsa=s=>[...document.querySelectorAll(s)];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
  const fmtTime=v=>v?String(v).slice(0,5):'—';

  qsa('.rrhh-tab').forEach(btn=>btn.addEventListener('click',()=>{
    qsa('.rrhh-tab').forEach(x=>x.classList.toggle('active',x===btn));
    qsa('.rrhh-panel').forEach(x=>x.classList.toggle('active',x.id==='tab-'+btn.dataset.tab));
  }));

  const modal=qs('#employee-modal'), form=qs('#employee-form');
  function openModal(employee){
    form.reset(); qs('#employee-id').value=employee?.id||'';
    qs('#employee-modal-title').textContent=employee?'Editar integrante':'Nuevo integrante';
    qs('#employee-name').value=employee?.full_name||'';
    qs('#employee-branch').value=employee?.branch_code||'general-paz';
    qs('#employee-start').value=fmtTime(employee?.scheduled_start||'09:00');
    qs('#employee-end').value=fmtTime(employee?.scheduled_end||'19:00');
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
    return '<tr><td><div class="employee-cell"><strong>'+esc(e.full_name)+'</strong><small>'+esc(e.email||'Sin usuario Black OS asociado')+'</small></div></td>'+
      '<td>'+esc(BRANCH_LABELS[e.branch_code]||e.branch_code||'—')+'</td>'+
      '<td>'+fmtTime(e.scheduled_start)+'–'+fmtTime(e.scheduled_end)+' · '+Number(e.tolerance_minutes||0)+' min</td>'+
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
    if(!sb){qs('#employees-tbody').innerHTML='<tr><td colspan="6" class="empty-cell">No se pudo conectar Supabase.</td></tr>';return}
    const {data,error}=await sb.from('hr_employees').select('*').order('full_name');
    if(error){
      console.warn(error);
      qs('#employees-tbody').innerHTML='<tr><td colspan="6" class="empty-cell">RRHH está listo en interfaz. Falta aplicar la migración SQL para activar los datos.</td></tr>';
      return;
    }
    state.employees=data||[];renderEmployees();await loadToday();
  }

  async function loadToday(){
    const today=new Date().toISOString().slice(0,10);
    qs('#today-label').textContent=new Intl.DateTimeFormat('es-AR',{dateStyle:'full'}).format(new Date(today+'T12:00:00'));
    if(!sb)return;
    const {data,error}=await sb.from('hr_time_marks').select('*').gte('marked_at',today+'T00:00:00').lte('marked_at',today+'T23:59:59').order('marked_at');
    if(error){console.warn(error);return}
    state.attendance=data||[];
    const by={};
    state.attendance.forEach(m=>(by[m.employee_id]??=[]).push(m));
    const rows=Object.entries(by).map(([id,marks])=>{
      const e=state.employees.find(x=>String(x.id)===String(id));
      if(!e)return '';
      const first=marks[0],last=marks[marks.length-1];
      const firstDate=new Date(first.marked_at), sch=e.scheduled_start||'09:00';
      const [hh,mm]=sch.split(':').map(Number), target=new Date(firstDate);target.setHours(hh,mm,0,0);
      const late=Math.max(0,Math.round((firstDate-target)/60000)-Number(e.tolerance_minutes||0));
      const open=marks.length%2===1;
      return '<tr><td>'+esc(e.full_name)+'</td><td>'+firstDate.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+'</td><td>'+new Date(last.marked_at).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})+'</td><td>'+marks.length+'</td><td>'+late+'</td><td><span class="status-pill '+(open?'':'inactive')+'">'+(open?'Presente':'Jornada cerrada')+'</span></td></tr>';
    }).filter(Boolean);
    qs('#attendance-tbody').innerHTML=rows.length?rows.join(''):'<tr><td colspan="6" class="empty-cell">Todavía no hay marcaciones hoy.</td></tr>';
    qs('#kpi-present').textContent=Object.values(by).filter(m=>m.length%2===1).length;
    qs('#kpi-review').textContent=Object.values(by).filter(m=>m.length%2===1).length;
  }

  form.addEventListener('submit',async e=>{
    e.preventDefault();
    if(!sb)return alert('Supabase no está disponible.');
    const id=qs('#employee-id').value||null;
    const pin=qs('#employee-pin').value.trim();
    if(pin&&!/^\d{4,6}$/.test(pin))return alert('El PIN debe tener entre 4 y 6 dígitos.');
    const payload={full_name:qs('#employee-name').value.trim(),branch_code:qs('#employee-branch').value,scheduled_start:qs('#employee-start').value,scheduled_end:qs('#employee-end').value,tolerance_minutes:Number(qs('#employee-tolerance').value||0),monthly_reference_salary:Number(qs('#employee-salary').value||0),active:true};
    if(pin)payload.pin_plain=pin;
    const {data,error}=await sb.rpc('hr_upsert_employee',{p_employee_id:id,p_payload:payload});
    if(error)return alert(error.message||'No se pudo guardar.');
    closeModal();await loadEmployees();
  });

  qs('#refresh-btn').addEventListener('click',loadEmployees);
  qs('#report-month').value=new Date().toISOString().slice(0,7);
  qs('#kpi-present').textContent='0';qs('#kpi-late').textContent='0';qs('#kpi-review').textContent='0';
  loadEmployees();
})();