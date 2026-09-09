(() => {
  function ensureOpsNav(){
    if(document.querySelector('.crm-ops-nav')) return;
    document.body.classList.add('crm-ops-ready');
    const nav=document.createElement('div');
    nav.className='crm-ops-nav';
    nav.innerHTML=`
      <button data-ops="inicio" class="active"><span class="crm-ops-icon">⌂</span>Inicio</button>
      <button data-ops="clientes"><span class="crm-ops-icon">👥</span>Clientes</button>
      <button data-ops="campanas"><span class="crm-ops-icon">📣</span>Campañas</button>
      <a href="seguimiento-presupuestos.html"><span class="crm-ops-icon">◎</span>Seguimiento</a>
      <a href="automatizaciones-postventa.html"><span class="crm-ops-icon">⚡</span>Automatizaciones</a>
      <button data-ops="config"><span class="crm-ops-icon">⚙</span>Configuración</button>`;
    document.body.appendChild(nav);

    nav.querySelectorAll('button[data-ops]').forEach(btn=>btn.addEventListener('click',()=>{
      nav.querySelectorAll('button').forEach(b=>b.classList.remove('active'));
      btn.classList.add('active');
      const mode=btn.dataset.ops;
      if(mode==='inicio') renderOpsHome();
      if(mode==='clientes') window.setView?.('todos', document.getElementById('nav-todos'));
      if(mode==='campanas') window.setView?.('campanas', document.getElementById('nav-campanas-hidden'));
      if(mode==='config') window.openConfig?.();
    }));
  }

  function connectionStatus(){
    const live=document.getElementById('syncDot')?.classList.contains('live');
    return live;
  }

  function renderOpsHome(){
    const el=document.getElementById('mainContent');
    if(!el) return;
    const total=Array.isArray(window.clientes)?window.clientes.length:(Array.isArray(clientes)?clientes.length:0);
    const live=connectionStatus();
    el.innerHTML=`
      <div class="crm-ops-home">
        <div class="crm-ops-eyebrow">CRM BLACK</div>
        <h1 class="crm-ops-title">Clientes y comunicación</h1>
        <div class="crm-ops-sub">Base unificada para gestionar contactos, campañas, seguimientos y automatizaciones de WhatsApp.</div>

        <div class="crm-ops-kpis">
          <div class="crm-ops-kpi primary">
            <div class="crm-ops-kpi-label">Total de contactos</div>
            <div class="crm-ops-kpi-value">${Number(total).toLocaleString('es-AR')}</div>
            <div class="crm-ops-kpi-note">Base sincronizada con Black OS</div>
          </div>
          <div class="crm-ops-kpi">
            <div class="crm-ops-kpi-label">WhatsApp</div>
            <div class="crm-ops-kpi-value" style="font-size:20px">${live?'Conectado':'Revisar'}</div>
            <div class="crm-ops-status ${live?'ok':''}"><i></i>${live?'Supabase activo':'Verificar conexión'}</div>
          </div>
          <div class="crm-ops-kpi">
            <div class="crm-ops-kpi-label">Operación</div>
            <div class="crm-ops-kpi-value" style="font-size:20px">Simple</div>
            <div class="crm-ops-kpi-note">Sin tablero 5A en la vista principal</div>
          </div>
        </div>

        <div class="crm-ops-section-head"><strong>Acciones principales</strong><span>Uso diario</span></div>
        <div class="crm-ops-actions">
          <button class="crm-ops-action" onclick="setView('todos',document.getElementById('nav-todos'))"><div class="crm-ops-action-icon">👥</div><strong>Ver clientes</strong><span>Buscar, filtrar, etiquetar y abrir la ficha de cada contacto.</span></button>
          <button class="crm-ops-action" onclick="setView('campanas',document.getElementById('nav-campanas-hidden'))"><div class="crm-ops-action-icon">📣</div><strong>Nueva campaña</strong><span>Preparar mensajes masivos y segmentar destinatarios.</span></button>
          <button class="crm-ops-action" onclick="location.href='seguimiento-presupuestos.html'"><div class="crm-ops-action-icon">◎</div><strong>Seguimiento de presupuestos</strong><span>Detectar presupuestos pendientes y generar acciones de WhatsApp.</span></button>
        </div>
      </div>`;
  }

  function start(){
    ensureOpsNav();
    setTimeout(renderOpsHome, 200);
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',start); else start();
})();
