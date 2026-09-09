(() => {
  const originalSetView = window.setView;

  async function cargarTodosLosClientes(){
    if(typeof sbQ!=='function') return;
    const pageSize=500;
    let offset=0;
    let rows=[];
    while(true){
      const page=await sbQ(`clientes?order=created_at.desc&offset=${offset}&limit=${pageSize}`);
      if(!Array.isArray(page)) return;
      rows=rows.concat(page);
      if(page.length<pageSize) break;
      offset+=pageSize;
      if(offset>10000) break;
    }
    clientes=rows.map(mapRow);
    nextId=clientes.length+1;
    lastPoll=new Date().toISOString();
    if(typeof setSyncState==='function') setSyncState('live');
    try{guardarLocal();}catch{}
    renderOpsHome();
  }

  // El CRM histórico cargaba solo 500. Desde esta capa se pagina toda la base.
  window.cargarDesdeSupabase=cargarTodosLosClientes;

  function ensureOpsNav(){
    if(document.querySelector('.crm-ops-nav')) return;
    document.body.classList.add('crm-ops-ready');
    const nav=document.createElement('nav');
    nav.className='crm-ops-nav';
    nav.setAttribute('aria-label','Navegación CRM Black');
    nav.innerHTML=`
      <button data-ops="inicio" class="active"><span class="crm-ops-icon">⌂</span>Inicio</button>
      <button data-ops="clientes"><span class="crm-ops-icon">👥</span>Clientes</button>
      <button data-ops="campanas"><span class="crm-ops-icon">↗</span>Campañas</button>
      <a data-ops="seguimiento" href="seguimiento-presupuestos.html"><span class="crm-ops-icon">◎</span>Presupuestos</a>
      <a data-ops="automatizaciones" href="automatizaciones-postventa.html"><span class="crm-ops-icon">⚡</span>Automatizaciones</a>`;
    document.body.appendChild(nav);

    nav.querySelector('[data-ops="inicio"]').onclick=()=>renderOpsHome();
    nav.querySelector('[data-ops="clientes"]').onclick=()=>goView('todos','clientes');
    nav.querySelector('[data-ops="campanas"]').onclick=()=>goView('campanas','campanas');
  }

  function setActive(id){
    document.querySelectorAll('.crm-ops-nav [data-ops]').forEach(x=>x.classList.toggle('active',x.dataset.ops===id));
  }

  function goView(view,id){
    if(typeof originalSetView==='function'){
      const fake=document.createElement('button');
      originalSetView(view,fake);
    }
    setActive(id);
  }

  function evolutionConfigured(){
    try{return !!(cfg?.evoUrl&&cfg?.evoKey&&cfg?.evoInstance);}catch{return false;}
  }

  function renderOpsHome(){
    const el=document.getElementById('mainContent');
    if(!el) return;
    try{updateStats();}catch{}
    const list=Array.isArray(clientes)?clientes:[];
    const total=list.length;
    const optOut=list.filter(c=>c.optOut).length;
    const conTelefono=list.filter(c=>String(c.tel||'').replace(/\D/g,'').length>=8).length;
    const wa=evolutionConfigured();

    el.innerHTML=`
      <div class="crm-ops-home">
        <div class="crm-ops-eyebrow">CRM BLACK</div>
        <h1 class="crm-ops-title">Clientes y comunicación</h1>
        <div class="crm-ops-sub">Una base simple para clientes, campañas, seguimiento de presupuestos y automatizaciones.</div>

        <div class="crm-ops-kpis">
          <div class="crm-ops-kpi primary">
            <div class="crm-ops-kpi-label">Total de contactos</div>
            <div class="crm-ops-kpi-value">${total.toLocaleString('es-AR')}</div>
            <div class="crm-ops-kpi-note">Base completa sincronizada con Supabase</div>
          </div>
          <div class="crm-ops-kpi">
            <div class="crm-ops-kpi-label">WhatsApp</div>
            <div class="crm-ops-kpi-value" style="font-size:18px">${wa?'Configurado':'Pendiente'}</div>
            <div class="crm-ops-status ${wa?'ok':''}"><i></i>${wa?'Evolution API lista':'Completar conexión'}</div>
          </div>
          <div class="crm-ops-kpi">
            <div class="crm-ops-kpi-label">Contactables</div>
            <div class="crm-ops-kpi-value">${Math.max(0,conTelefono-optOut).toLocaleString('es-AR')}</div>
            <div class="crm-ops-kpi-note">Con teléfono y sin exclusión automática</div>
          </div>
        </div>

        <div class="crm-ops-section-head"><strong>Herramientas operativas</strong><span>Uso diario</span></div>
        <div class="crm-ops-actions">
          <button class="crm-ops-action" onclick="CRMOPS.clientes()"><div class="crm-ops-action-icon">⌕</div><strong>Clientes</strong><span>Buscar, filtrar, etiquetar y abrir la ficha de cada contacto.</span></button>
          <button class="crm-ops-action" onclick="CRMOPS.campanas()"><div class="crm-ops-action-icon">↗</div><strong>Campañas</strong><span>Preparar mensajes masivos y segmentar destinatarios.</span></button>
          <button class="crm-ops-action" onclick="location.href='seguimiento-presupuestos.html'"><div class="crm-ops-action-icon">◎</div><strong>Seguimiento de presupuestos</strong><span>Cruzar clientes, presupuestos y recetas para recuperar ventas pendientes.</span></button>
        </div>
      </div>`;
    setActive('inicio');
  }

  window.CRMOPS={
    inicio:renderOpsHome,
    clientes:()=>goView('todos','clientes'),
    campanas:()=>goView('campanas','campanas'),
    recargar:cargarTodosLosClientes
  };

  function start(){
    ensureOpsNav();
    renderOpsHome();
    setTimeout(()=>cargarTodosLosClientes(),500);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
