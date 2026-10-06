// Black OS — visibilidad funcional según permisos
(() => {
  let accessSnapshot=null;
  const $all = (selector) => Array.from(document.querySelectorAll(selector));
  const hide = (selector, hidden=true) => $all(selector).forEach(el => {
    el.hidden = hidden;
    el.setAttribute('aria-hidden', hidden ? 'true' : 'false');
  });
  const disable = (selector, disabled=true) => $all(selector).forEach(el => {
    if ('disabled' in el) el.disabled = disabled;
    el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
  });
  const owner = user => {
    const email=String(user?.email||'').toLowerCase();
    return user?.app_metadata?.black_os_super_admin===true || accessSnapshot?.admin===true;
  };
  const can = (user,moduleId,permission=null) => {
    if(owner(user)||accessSnapshot?.admin===true) return true;
    if(!user || user?.app_metadata?.black_os_active===false || accessSnapshot?.active===false) return false;
    const cfg=accessSnapshot?.permissions?.[moduleId]||user?.app_metadata?.black_os_permissions?.[moduleId];
    if(!cfg || cfg.level==='none') return false;
    if(!permission) return true;
    if(cfg.level==='full' || cfg.items==='*') return true;
    return Array.isArray(cfg.items) && cfg.items.includes(permission);
  };
  const firstVisibleClick = selector => {
    const first=$all(selector).find(el=>!el.hidden);
    if(first && !first.classList.contains('active')) first.click();
  };

  function applyAdministration(user){
    const core=['summary','sales','profit_cost','cash','bank','social','upload'].some(p=>can(user,'administracion',p));
    if(!core&&can(user,'administracion','suppliers')){
      location.replace('proveedores.html?v=20261006-access-1');
      return;
    }
    const map={resumen:'summary',ventas:'sales',cobranzas:'cash',bancos:'bank'};
    Object.entries(map).forEach(([tab,perm])=>{
      hide('.admin-tab[data-tab="'+tab+'"]',!can(user,'administracion',perm));
      hide('#tab-'+tab,!can(user,'administracion',perm));
    });
    hide('.upload-grid',!can(user,'administracion','upload'));
    if(!can(user,'administracion','profit_cost')){
      ['#kpi-profit','#kpi-margin','#sales-cost','#sales-profit','#flow-profit'].forEach(sel=>{
        $all(sel).forEach(el=>{ const card=el.closest('.kpi-card,.result-flow>div'); if(card) card.hidden=true; else el.hidden=true; });
      });
      $all('.panel-title h3').forEach(h=>{
        if(/utilidad|costo/i.test(h.textContent||'')){ const card=h.closest('.panel-card'); if(card) card.hidden=true; }
      });
    }
    firstVisibleClick('.admin-tab');
  }

  function applySuppliers(user){
    if(can(user,'administracion','suppliers')) return;
    document.body.innerHTML='<main style="min-height:100vh;display:grid;place-items:center;background:#090909;color:#eee;font-family:system-ui;padding:24px"><div style="max-width:460px;text-align:center"><h2>Acceso restringido</h2><p style="color:#888;line-height:1.6">Tu usuario no tiene asignada la función Proveedores.</p></div></main>';
  }

  function applyMarketing(user){
    const tabs={home:'view',calendar:'view',ideas:'view',production:'production',stories:'production',ads:'ads',results:'results',settings:'settings'};
    Object.entries(tabs).forEach(([tab,perm])=>{
      hide('[data-tab="'+tab+'"]',!can(user,'marketing',perm));
      hide('#mk-tab-'+tab,!can(user,'marketing',perm));
    });
    hide('#mk-new-content',!can(user,'marketing','create_edit'));
    hide('#mk-import-open',!can(user,'marketing','import'));
    hide('#mk-new-story',!can(user,'marketing','production'));
    hide('#mk-new-campaign',!can(user,'marketing','ads'));
    hide('#mk-new-result',!can(user,'marketing','results'));
    hide('#mk-new-option',!can(user,'marketing','settings'));
    hide('#mk-import-canonical',!can(user,'marketing','import'));
    hide('#mk-refresh-suggestions',!can(user,'marketing','create_edit'));
    firstVisibleClick('nav [data-tab], .mk-tabs [data-tab]');
  }

  function applyCrm(user){
    const edit=can(user,'crm-black','create_edit');
    const follow=can(user,'crm-black','followup');
    const auto=can(user,'crm-black','automation');
    const exp=can(user,'crm-black','export');
    hide('.fab',!edit);
    hide('[onclick*="openAddModal"]',!edit);
    hide('[onclick*="editarCliente"]',!edit);
    hide('[onclick*="eliminarCliente"]',!edit);
    hide('[onclick*="duplicarCliente"]',!edit);
    hide('[onclick*="guardarCliente"]',!edit);
    hide('[onclick*="registrarRespuesta"]',!follow);
    hide('[onclick*="registrarEnvio"]',!follow);
    hide('[onclick*="enviarWAdetalle"]',!follow);
    hide('[onclick*="enviarWAcon"]',!follow);
    hide('[onclick*="marcarRespondio"]',!follow);
    hide('[onclick*="marcarNoResponde"]',!follow);
    hide('[onclick*="guardarNotaRapida"]',!follow);
    hide('[onclick*="resetSeq"]',!follow);
    hide('[onclick*="agregarEtiqueta"]',!edit);
    hide('[onclick*="quitarEtiqueta"]',!edit);
    hide('[onclick*="setView(\'campanas\'"]',!auto);
    hide('[onclick*="setView(\'ajustes\'"]',!auto);
    hide('a[href*="automatizaciones-postventa"]',!auto);
    hide('[onclick*="openConfig"]',!(auto||exp||edit));
    hide('#cfg-tab-conexion',!auto);
    hide('#cfg-tab-pasos',!auto);
    hide('#cfg-conexion',!auto);
    hide('#cfg-pasos',!auto);
    hide('[onclick*="testConexion"]',!auto);
    hide('[onclick*="testEvolution"]',!auto);
    hide('[onclick*="copiarSQL"]',!auto);
    hide('#cfg-tab-datos',!(edit||exp));
    hide('#cfg-datos',!(edit||exp));
    hide('[onclick*="exportarCSV"]',!exp);
    hide('[onclick*="openImport"]',!edit);
    hide('[onclick*="ejecutarImportacion"]',!edit);
  }

  function applyDoctors(user){
    const manage=can(user,'crm-oftalmologos','manage');
    const referrals=can(user,'crm-oftalmologos','referrals');
    const stats=can(user,'crm-oftalmologos','stats');
    hide('#fab',!manage);
    hide('#bnav-comisiones',!stats);
    hide('#page-comisiones',!stats);
    hide('[onclick*="openDoctorModal"]',!manage);
    hide('#modal-upload [type="button"],#modal-csv [type="button"],#modal-word [type="button"]',!manage);
    if(!referrals){
      $all('[onclick]').forEach(el=>{
        const v=el.getAttribute('onclick')||'';
        if(/follow|deriv|receta/i.test(v)) el.hidden=true;
      });
    }
  }

  function applyRrhh(user){
    hide('#new-employee-btn',!can(user,'rrhh','manage_employees'));
    hide('.rrhh-tab[data-tab="asistencia"]',!can(user,'rrhh','attendance'));
    hide('#tab-asistencia',!can(user,'rrhh','attendance'));
    hide('.rrhh-tab[data-tab="reportes"]',!can(user,'rrhh','reports'));
    hide('#tab-reportes',!can(user,'rrhh','reports'));
    hide('.rrhh-tab[data-tab="configuracion"]',!can(user,'rrhh','settings'));
    hide('#tab-configuracion',!can(user,'rrhh','settings'));
    if(!can(user,'rrhh','manage_employees')) hide('.edit-employee',true);
    firstVisibleClick('.rrhh-tab');
  }

  function applyRecetas(user){
    hide('#aiButton',!can(user,'recetas','interpret'));
    hide('#copyButton',!can(user,'recetas','copy'));
  }

  async function boot(){
    let client=null;
    try{ client=window.BlackPortal?.getSupabase?.(); }catch(e){}
    if(!client) return;
    const {data:{session}}=await client.auth.getSession();
    const user=session?.user;
    if(!user) return;
    try{
      const access=await client.rpc('black_os_my_access');
      if(!access.error&&access.data) accessSnapshot=access.data;
    }catch(error){}

    const path=location.pathname.toLowerCase();
    if(path.endsWith('/administracion.html')||path.endsWith('administracion.html')) applyAdministration(user);
    else if(path.endsWith('/proveedores.html')||path.endsWith('proveedores.html')) applySuppliers(user);
    else if(path.endsWith('/marketing.html')||path.endsWith('marketing.html')) applyMarketing(user);
    else if(path.endsWith('/crm-clientes.html')||path.endsWith('crm-clientes.html')) applyCrm(user);
    else if(path.endsWith('/crm-oftalmologos.html')||path.endsWith('crm-oftalmologos.html')) applyDoctors(user);
    else if(path.endsWith('/rrhh.html')||path.endsWith('rrhh.html')) applyRrhh(user);
    else if(path.endsWith('/recetas/index.html')||path.endsWith('/recetas/')) applyRecetas(user);

    window.BlackOSAccess={can:(moduleId,permission)=>can(user,moduleId,permission),user};
    const observer=new MutationObserver(()=> {
      if(path.endsWith('crm-clientes.html')) applyCrm(user);
      else if(path.endsWith('marketing.html')) applyMarketing(user);
      else if(path.endsWith('rrhh.html')) applyRrhh(user);
    });
    observer.observe(document.body,{childList:true,subtree:true});
    setTimeout(()=>observer.disconnect(),12000);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();