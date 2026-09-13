(()=>{
  const VERSION='20260913-1';
  const state={client:null,scenarios:[],opportunities:[],loaded:false,statusFilter:'open'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const labelStatus=v=>({waiting:'En espera',scheduled:'Programado',paused:'Pausado',replied:'Respondió',won:'Ganado',lost:'Perdido',opted_out:'Baja',completed:'Completado',cancelled:'Cancelado'}[v]||v||'—');
  const labelTrigger=v=>({quote_no_reply:'Cotización sin respuesta',pending_confirmation:'Quedó en confirmar',interested_no_close:'Interesado sin cierre',custom:'Personalizado'}[v]||v||'—');
  const resolveClient=()=>{try{if(window.parent&&window.parent!==window&&window.parent.BlackPortal?.getSupabase)return window.parent.BlackPortal.getSupabase()}catch(_){ }return window.BlackPortal?.getSupabase?.()||null};
  const fmtDate=v=>v?new Date(v).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'}):'—';

  function ensureShell(){
    if(!document.querySelector('link[data-followups-css]')){const l=document.createElement('link');l.rel='stylesheet';l.href=`assets/css/black-ai-followups.css?v=${VERSION}`;l.dataset.followupsCss='1';document.head.appendChild(l)}
    const nav=document.querySelector('.ai-tabs');
    if(nav&&!nav.querySelector('[data-tab="seguimientos"]')){
      const anchor=nav.querySelector('[data-tab="catalogo"]')||nav.querySelector('[data-tab="conocimiento"]');
      const btn=document.createElement('button');btn.className='ai-tab';btn.dataset.tab='seguimientos';btn.type='button';btn.textContent='Seguimientos';anchor?.after(btn);btn.addEventListener('click',activate);
    }
    if(!document.getElementById('tab-seguimientos')){
      const panel=document.createElement('section');panel.className='tab-panel';panel.id='tab-seguimientos';panel.innerHTML='<div class="followups-loading">Cargando seguimientos…</div>';
      const anchor=document.getElementById('tab-catalogo')||document.getElementById('tab-conocimiento');anchor?.after(panel);
    }
  }

  function activate(){
    document.querySelectorAll('.ai-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='seguimientos'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-seguimientos'));
    if(!state.loaded)load();else render();
  }

  async function load(){
    const panel=document.getElementById('tab-seguimientos');if(!panel)return;
    panel.innerHTML='<div class="followups-loading">Leyendo escenarios y oportunidades…</div>';
    state.client=resolveClient();if(!state.client){panel.innerHTML='<div class="followups-error">Supabase no está disponible.</div>';return}
    const [{data:scenarios,error:e1},{data:opps,error:e2}]=await Promise.all([
      state.client.from('black_ai_followup_scenarios').select('*').order('created_at',{ascending:true}),
      state.client.from('black_ai_followup_opportunities').select('id,scenario_id,phone,status,followup_count,last_patient_message_at,last_business_message_at,last_followup_at,next_followup_at,pause_until,context,stop_reason,updated_at').order('updated_at',{ascending:false}).limit(200)
    ]);
    if(e1||e2){panel.innerHTML=`<div class="followups-error">${esc(e1?.message||e2?.message||'No se pudieron cargar los seguimientos.')}</div>`;return}
    state.scenarios=scenarios||[];state.opportunities=opps||[];state.loaded=true;render();
  }

  function openOpps(){return state.opportunities.filter(x=>['waiting','scheduled','paused'].includes(x.status))}
  function dueCount(){const now=Date.now();return state.opportunities.filter(x=>['waiting','scheduled'].includes(x.status)&&x.next_followup_at&&new Date(x.next_followup_at).getTime()<=now).length}

  function render(){
    const panel=document.getElementById('tab-seguimientos');if(!panel)return;
    const activeScenarios=state.scenarios.filter(x=>x.is_active).length,open=openOpps().length,due=dueCount(),sent=state.opportunities.reduce((a,x)=>a+Number(x.followup_count||0),0);
    panel.innerHTML=`
      <div class="section-intro followups-intro"><div><h2>Seguimientos</h2><p>Configurá cómo Black AI retoma cotizaciones y conversaciones pendientes sin depender de que el equipo recuerde cada contacto.</p></div><button class="btn-secondary" id="followups-refresh" type="button">Actualizar</button></div>
      <div class="followups-warning"><strong>Etapa de configuración:</strong> los escenarios todavía no ejecutan envíos por sí solos. Primero definimos reglas y validamos la detección; después conectamos el motor programado.</div>
      <div class="followups-stats"><div><span>Escenarios activos</span><strong>${activeScenarios}</strong></div><div><span>Oportunidades abiertas</span><strong>${open}</strong></div><div><span>Seguimientos vencidos</span><strong>${due}</strong></div><div><span>Intentos acumulados</span><strong>${sent}</strong></div></div>
      <div class="followups-section-head"><div><h3>Escenarios</h3><p>Cada escenario define cuándo contactar, cuántas veces y con qué nivel de autonomía.</p></div></div>
      <div class="followups-scenarios">${state.scenarios.map(scenarioCard).join('')}</div>
      <div class="followups-section-head opportunities-head"><div><h3>Pacientes en seguimiento</h3><p>Vista operativa de las conversaciones que entren al recorrido.</p></div><select id="followups-status-filter"><option value="open" ${state.statusFilter==='open'?'selected':''}>Abiertos</option><option value="all" ${state.statusFilter==='all'?'selected':''}>Todos</option><option value="closed" ${state.statusFilter==='closed'?'selected':''}>Cerrados</option></select></div>
      ${opportunitiesTable()}`;
    bind();
  }

  function scenarioCard(s){
    const delays=Array.isArray(s.followup_delays_hours)?s.followup_delays_hours.join(', '):'';
    return `<article class="followup-card" data-scenario="${s.id}">
      <div class="followup-card-head"><div><span class="followup-kicker">${esc(labelTrigger(s.trigger_type))}</span><h4>${esc(s.name)}</h4><p>${esc(s.description||'')}</p></div><label class="followup-switch"><input data-field="is_active" type="checkbox" ${s.is_active?'checked':''}><span></span></label></div>
      <div class="followup-grid">
        <label>Modo<select data-field="send_mode"><option value="assisted" ${s.send_mode==='assisted'?'selected':''}>Asistido</option><option value="automatic" ${s.send_mode==='automatic'?'selected':''}>Automático</option></select></label>
        <label>Primer contacto<input data-field="initial_delay_hours" type="number" min="1" value="${esc(s.initial_delay_hours)}"><small>horas</small></label>
        <label>Máximo de intentos<input data-field="max_attempts" type="number" min="1" max="10" value="${esc(s.max_attempts)}"></label>
        <label>Secuencia de demoras<input data-field="followup_delays_hours" value="${esc(delays)}"><small>horas separadas por coma</small></label>
        <label>Desde<input data-field="business_hours_start" type="time" value="${esc(String(s.business_hours_start||'09:00').slice(0,5))}"></label>
        <label>Hasta<input data-field="business_hours_end" type="time" value="${esc(String(s.business_hours_end||'19:00').slice(0,5))}"></label>
      </div>
      <div class="followup-stops"><label><input data-field="stop_on_reply" type="checkbox" ${s.stop_on_reply?'checked':''}> Frenar si responde</label><label><input data-field="stop_on_sale" type="checkbox" ${s.stop_on_sale?'checked':''}> Frenar si compra</label><label><input data-field="stop_on_optout" type="checkbox" ${s.stop_on_optout?'checked':''}> Frenar ante baja</label></div>
      <label class="followup-instructions"><span>Instrucciones para la IA</span><textarea data-field="ai_instructions" rows="3">${esc(s.ai_instructions||'')}</textarea></label>
      <div class="followup-card-actions"><span class="scenario-save-state">Sin cambios</span><button class="btn-primary" data-save-scenario type="button">Guardar escenario</button></div>
    </article>`;
  }

  function opportunitiesTable(){
    let rows=state.opportunities;
    if(state.statusFilter==='open')rows=rows.filter(x=>['waiting','scheduled','paused'].includes(x.status));
    if(state.statusFilter==='closed')rows=rows.filter(x=>!['waiting','scheduled','paused'].includes(x.status));
    const scenarios=new Map(state.scenarios.map(x=>[x.id,x.name]));
    if(!rows.length)return '<div class="followups-empty">Todavía no hay pacientes dentro de un recorrido de seguimiento.</div>';
    return `<div class="followups-table-wrap"><table class="followups-table"><thead><tr><th>Paciente</th><th>Escenario</th><th>Estado</th><th>Intentos</th><th>Próximo contacto</th><th>Última actividad</th></tr></thead><tbody>${rows.map(x=>`<tr><td><strong>${esc(x.phone)}</strong></td><td>${esc(scenarios.get(x.scenario_id)||'—')}</td><td><span class="followup-status ${esc(x.status)}">${esc(labelStatus(x.status))}</span></td><td>${Number(x.followup_count||0)}</td><td>${fmtDate(x.next_followup_at)}</td><td>${fmtDate(x.updated_at)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function bind(){
    document.getElementById('followups-refresh')?.addEventListener('click',()=>{state.loaded=false;load()});
    document.getElementById('followups-status-filter')?.addEventListener('change',e=>{state.statusFilter=e.target.value;render()});
    document.querySelectorAll('[data-scenario]').forEach(card=>{
      card.querySelectorAll('input,select,textarea').forEach(el=>el.addEventListener('change',()=>{const s=card.querySelector('.scenario-save-state');if(s)s.textContent='Cambios sin guardar'}));
      card.querySelector('[data-save-scenario]')?.addEventListener('click',()=>saveScenario(card));
    });
  }

  async function saveScenario(card){
    const id=card.dataset.scenario,btn=card.querySelector('[data-save-scenario]'),status=card.querySelector('.scenario-save-state');
    const get=f=>card.querySelector(`[data-field="${f}"]`);
    const delays=String(get('followup_delays_hours')?.value||'').split(',').map(v=>Number(v.trim())).filter(v=>Number.isFinite(v)&&v>=1);
    if(!delays.length){alert('Cargá al menos una demora válida para los seguimientos.');return}
    const payload={
      is_active:!!get('is_active')?.checked,
      send_mode:get('send_mode')?.value||'assisted',
      initial_delay_hours:Number(get('initial_delay_hours')?.value||24),
      max_attempts:Number(get('max_attempts')?.value||3),
      followup_delays_hours:delays,
      business_hours_start:get('business_hours_start')?.value||'09:00',
      business_hours_end:get('business_hours_end')?.value||'19:00',
      stop_on_reply:!!get('stop_on_reply')?.checked,
      stop_on_sale:!!get('stop_on_sale')?.checked,
      stop_on_optout:!!get('stop_on_optout')?.checked,
      ai_instructions:String(get('ai_instructions')?.value||'').trim(),
      updated_at:new Date().toISOString()
    };
    btn.disabled=true;btn.textContent='Guardando…';if(status)status.textContent='Guardando';
    const {error}=await state.client.from('black_ai_followup_scenarios').update(payload).eq('id',id);
    if(error){alert(error.message||'No se pudo guardar el escenario.');btn.disabled=false;btn.textContent='Guardar escenario';if(status)status.textContent='Error';return}
    const target=state.scenarios.find(x=>x.id===id);if(target)Object.assign(target,payload);
    btn.disabled=false;btn.textContent='Guardar escenario';if(status)status.textContent='Guardado';render();
  }

  ensureShell();
  window.BlackAiFollowups={activate,reload:async()=>{state.loaded=false;await load()}};
})();