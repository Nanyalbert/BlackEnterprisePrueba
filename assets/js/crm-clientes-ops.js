(() => {
  const originalSetView = window.setView;

  const ICONS={
    home:`<svg viewBox="0 0 24 24"><path d="M3.5 10.5 12 3.5l8.5 7"/><path d="M5.5 9.5V20h13V9.5"/><path d="M9.5 20v-6h5v6"/></svg>`,
    users:`<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.2"/><path d="M3.5 20v-1.2A4.8 4.8 0 0 1 8.3 14h1.4a4.8 4.8 0 0 1 4.8 4.8V20"/><path d="M15.5 5.2a3.1 3.1 0 0 1 0 5.8"/><path d="M17 14.7a4.1 4.1 0 0 1 3.5 4V20"/></svg>`,
    campaign:`<svg viewBox="0 0 24 24"><path d="M4 10.5v3A1.5 1.5 0 0 0 5.5 15H8l5 3V6L8 9H5.5A1.5 1.5 0 0 0 4 10.5Z"/><path d="M16 8.5a5 5 0 0 1 0 7"/><path d="M18.5 6a8.5 8.5 0 0 1 0 12"/></svg>`,
    budget:`<svg viewBox="0 0 24 24"><path d="M6 3.5h12v17l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4-2 1.4Z"/><path d="M9 8h6M9 12h6M9 16h4"/></svg>`,
    bolt:`<svg viewBox="0 0 24 24"><path d="m13 2.5-8 11h5l-1 8 10-12h-6Z"/></svg>`,
    search:`<svg viewBox="0 0 24 24"><circle cx="10.8" cy="10.8" r="6.2"/><path d="m16 16 4.2 4.2"/></svg>`,
    settings:`<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1-2.9 2.9-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21h-4v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1-2.9-2.9.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3v-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1 2.9-2.9.1.1a1.7 1.7 0 0 0 1.8.3 1.7 1.7 0 0 0 1-1.5V3h4v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1 2.9 2.9-.1.1a1.7 1.7 0 0 0-.3 1.8 1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>`,
    plus:`<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>`,
    arrow:`<svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg>`,
    back:`<svg viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>`
  };
  const icon=(name)=>`<span class="crm-svg-icon" aria-hidden="true">${ICONS[name]}</span>`;

  async function cargarTodosLosClientes(){
    if(typeof sbQ!=='function') return;
    const pageSize=500;let offset=0,rows=[];
    while(true){
      const page=await sbQ(`clientes?order=created_at.desc&offset=${offset}&limit=${pageSize}`);
      if(!Array.isArray(page)) return;
      rows=rows.concat(page);
      if(page.length<pageSize) break;
      offset+=pageSize;
      if(offset>10000) break;
    }
    clientes=rows.map(mapRow);nextId=clientes.length+1;lastPoll=new Date().toISOString();
    if(typeof setSyncState==='function') setSyncState('live');
    try{guardarLocal();}catch{}
    renderOpsHome();
  }
  window.cargarDesdeSupabase=cargarTodosLosClientes;

  function upgradeStaticControls(){
    document.querySelectorAll('.topbar .topbar-btn').forEach(btn=>{
      const t=(btn.textContent||'').trim();
      if(t.includes('🔍')){btn.innerHTML=icon('search');btn.classList.add('icon-only');btn.setAttribute('aria-label','Buscar');}
      else if(t.includes('⚙')){btn.innerHTML=icon('settings');btn.classList.add('icon-only');btn.setAttribute('aria-label','Configuración');}
      else if(t==='←'||btn.classList.contains('portal-back-btn')){btn.innerHTML=icon('back');btn.classList.add('icon-only');}
    });
    const fab=document.querySelector('.fab');if(fab){fab.innerHTML=icon('plus');fab.setAttribute('aria-label','Agregar cliente');}
  }

  function ensureOpsNav(){
    if(document.querySelector('.crm-ops-nav')) return;
    document.body.classList.add('crm-ops-ready');
    const nav=document.createElement('nav');nav.className='crm-ops-nav';nav.setAttribute('aria-label','Navegación CRM Black');
    nav.innerHTML=`
      <button data-ops="inicio" class="active">${icon('home')}<span>Inicio</span></button>
      <button data-ops="clientes">${icon('users')}<span>Clientes</span></button>
      <button data-ops="campanas">${icon('campaign')}<span>Campañas</span></button>
      <a data-ops="seguimiento" href="seguimiento-presupuestos.html">${icon('budget')}<span>Presupuestos</span></a>
      <a data-ops="automatizaciones" href="automatizaciones-postventa.html">${icon('bolt')}<span>Automatizaciones</span></a>`;
    document.body.appendChild(nav);
    nav.querySelector('[data-ops="inicio"]').onclick=()=>renderOpsHome();
    nav.querySelector('[data-ops="clientes"]').onclick=()=>goView('todos','clientes');
    nav.querySelector('[data-ops="campanas"]').onclick=()=>goView('campanas','campanas');
  }

  function setActive(id){document.querySelectorAll('.crm-ops-nav [data-ops]').forEach(x=>x.classList.toggle('active',x.dataset.ops===id));}

  const VIEW_INFO={
    clientes:{title:'Clientes',desc:'Buscá y administrá toda la base de contactos. Podés filtrar, etiquetar, abrir cada ficha y decidir quién puede recibir comunicaciones.'},
    campanas:{title:'Campañas',desc:'Prepará mensajes masivos para grupos de clientes. Elegí destinatarios, revisá el mensaje y hacé el envío de forma controlada.'}
  };

  function addViewIntro(id){
    const info=VIEW_INFO[id],el=document.getElementById('mainContent');if(!info||!el)return;
    if(el.querySelector('.crm-view-intro'))return;
    const box=document.createElement('div');box.className='crm-view-intro';
    box.innerHTML=`<div class="crm-view-intro-icon">${icon(id==='clientes'?'users':'campaign')}</div><div><div class="crm-view-intro-title">${info.title}</div><div class="crm-view-intro-desc">${info.desc}</div></div>`;
    el.prepend(box);
  }

  function goView(view,id){
    if(typeof originalSetView==='function'){const fake=document.createElement('button');originalSetView(view,fake);}
    setActive(id);setTimeout(()=>addViewIntro(id),0);
  }

  function evolutionConfigured(){try{return !!(cfg?.evoUrl&&cfg?.evoKey&&cfg?.evoInstance);}catch{return false;}}

  function renderOpsHome(){
    const el=document.getElementById('mainContent');if(!el)return;
    try{updateStats();}catch{}
    const list=Array.isArray(clientes)?clientes:[],total=list.length,optOut=list.filter(c=>c.optOut).length,conTelefono=list.filter(c=>String(c.tel||'').replace(/\D/g,'').length>=8).length,wa=evolutionConfigured();
    el.innerHTML=`<div class="crm-ops-home">
      <div class="crm-ops-eyebrow">CRM BLACK</div><h1 class="crm-ops-title">Clientes y comunicación</h1><div class="crm-ops-sub">Centralizá la base de clientes y usala para campañas, seguimiento comercial y automatizaciones de WhatsApp.</div>
      <div class="crm-ops-kpis">
        <div class="crm-ops-kpi primary"><div class="crm-ops-kpi-label">Total de contactos</div><div class="crm-ops-kpi-value">${total.toLocaleString('es-AR')}</div><div class="crm-ops-kpi-note">Base completa sincronizada con Supabase</div></div>
        <div class="crm-ops-kpi"><div class="crm-ops-kpi-label">WhatsApp</div><div class="crm-ops-kpi-value compact">${wa?'Configurado':'Pendiente'}</div><div class="crm-ops-status ${wa?'ok':''}"><i></i>${wa?'Evolution API lista':'Completar conexión'}</div></div>
        <div class="crm-ops-kpi"><div class="crm-ops-kpi-label">Contactables</div><div class="crm-ops-kpi-value">${Math.max(0,conTelefono-optOut).toLocaleString('es-AR')}</div><div class="crm-ops-kpi-note">Con teléfono y sin exclusión automática</div></div>
      </div>
      <div class="crm-ops-section-head"><div><strong>Herramientas operativas</strong><p>Elegí qué querés hacer con la base de clientes.</p></div><span>Uso diario</span></div>
      <div class="crm-ops-actions">
        <button class="crm-ops-action" onclick="CRMOPS.clientes()"><div class="crm-ops-action-top">${icon('users')}<span class="crm-ops-action-arrow">${icon('arrow')}</span></div><strong>Clientes</strong><span>Consultar, buscar, filtrar, etiquetar y abrir la ficha de cada contacto.</span></button>
        <button class="crm-ops-action" onclick="CRMOPS.campanas()"><div class="crm-ops-action-top">${icon('campaign')}<span class="crm-ops-action-arrow">${icon('arrow')}</span></div><strong>Campañas</strong><span>Crear mensajes masivos y segmentar qué clientes los van a recibir.</span></button>
        <button class="crm-ops-action" onclick="location.href='seguimiento-presupuestos.html'"><div class="crm-ops-action-top">${icon('budget')}<span class="crm-ops-action-arrow">${icon('arrow')}</span></div><strong>Seguimiento de presupuestos</strong><span>Detectar presupuestos pendientes y recuperar oportunidades que todavía no compraron.</span></button>
        <button class="crm-ops-action" onclick="location.href='automatizaciones-postventa.html'"><div class="crm-ops-action-top">${icon('bolt')}<span class="crm-ops-action-arrow">${icon('arrow')}</span></div><strong>Automatizaciones</strong><span>Programar comunicaciones de postventa, recordatorios y acciones que no necesiten gestión manual.</span></button>
      </div></div>`;
    setActive('inicio');
  }

  window.CRMOPS={inicio:renderOpsHome,clientes:()=>goView('todos','clientes'),campanas:()=>goView('campanas','campanas'),recargar:cargarTodosLosClientes};
  function start(){upgradeStaticControls();ensureOpsNav();renderOpsHome();setTimeout(()=>cargarTodosLosClientes(),500);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
