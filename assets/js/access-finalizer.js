// Black OS — cierre de UX/permisos del portal
(() => {
  const READ_PRESETS={
    'crm-black':['view'],
    administracion:['summary','sales','cash','bank','social','suppliers'],
    'crm-oftalmologos':['view'],
    recetas:['view'],
    marketing:['view'],
    rrhh:['view'],
    catalogo:['view']
  };

  function updateSummary(card){
    const select=card?.querySelector('.permission-level');
    const summary=card?.querySelector('[data-permission-summary]');
    if(!select||!summary)return;
    const count=card.querySelectorAll('[data-permission-module]:checked').length;
    const labels={
      none:'No aparecerá para este usuario',
      read:'Acceso de consulta',
      operator:'Acceso operativo',
      full:'Acceso total',
      custom:`${count} función${count===1?'':'es'} habilitada${count===1?'':'s'}`
    };
    summary.textContent=labels[select.value]||'Acceso configurado';
  }

  function applyReadPreset(card){
    const moduleId=card?.dataset?.module;
    const allowed=READ_PRESETS[moduleId]||[];
    const select=card?.querySelector('.permission-level');
    if(!select)return;
    select.value=allowed.length?'read':'none';
    card.classList.toggle('open',allowed.length>0);
    card.querySelectorAll('[data-permission-module]').forEach(box=>{box.checked=allowed.includes(box.value)});
    updateSummary(card);
  }

  function disableUnavailableModules(){
    // Turnos todavía no está incorporado al shell productivo: no se ofrece un permiso que no pueda usarse.
    const turnos=document.querySelector('.permission-card[data-module="turnos"]');
    if(turnos){
      const select=turnos.querySelector('.permission-level');
      if(select)select.value='none';
      turnos.querySelectorAll('[data-permission-module]').forEach(box=>{box.checked=false});
      turnos.hidden=true;
    }
    document.querySelectorAll('[data-dashboard-module="turnos"]').forEach(el=>{el.hidden=true;el.style.display='none'});
  }

  // Corrige el preset de consulta para que no habilite por accidente acciones como
  // carga de resultados, estadísticas sensibles o configuración.
  document.addEventListener('change',event=>{
    const select=event.target.closest?.('.permission-level');
    if(!select||select.value!=='read')return;
    queueMicrotask(()=>applyReadPreset(select.closest('.permission-card')));
  });

  document.addEventListener('click',event=>{
    const button=event.target.closest?.('[data-global-preset="read"]');
    if(!button)return;
    queueMicrotask(()=>document.querySelectorAll('.permission-card:not([hidden])').forEach(applyReadPreset));
  });

  // Si se usa Acceso total global, el módulo futuro no recibe permisos invisibles.
  document.addEventListener('click',event=>{
    if(!event.target.closest?.('[data-global-preset]'))return;
    queueMicrotask(disableUnavailableModules);
  });

  if(typeof openModal==='function'){
    const previous=openModal;
    openModal=function(userId=null){
      previous(userId);
      queueMicrotask(disableUnavailableModules);
    };
  }

  // Cierre por Escape consistente en modales de usuarios.
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    const overlay=document.getElementById('user-modal-overlay');
    if(overlay?.classList.contains('show')&&typeof closeModal==='function')closeModal();
  });

  disableUnavailableModules();
})();
