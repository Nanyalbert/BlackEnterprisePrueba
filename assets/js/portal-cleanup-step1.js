// Black OS — pulido del shell y administración de usuarios
(() => {
  // Notificaciones demo: no mostramos eventos ficticios hasta conectar una fuente real.
  const notifList = document.getElementById('notif-list');
  if (notifList) {
    notifList.innerHTML = `
      <div class="portal-empty-notifications">
        <strong>Sin notificaciones</strong>
        <span>Las alertas reales aparecerán acá cuando estén conectadas a eventos del sistema.</span>
      </div>`;
  }
  const notifDot = document.getElementById('notif-dot');
  if (notifDot) notifDot.style.display = 'none';
  const markRead = document.getElementById('notif-mark-read');
  if (markRead) markRead.hidden = true;
  const notifFooter = document.querySelector('.notif-footer');
  if (notifFooter) notifFooter.hidden = true;
  const portalStatus = document.querySelector('.dashboard-status span:last-child');
  if (portalStatus) portalStatus.textContent = 'Portal activo';

  // Toasts del portal: reemplaza alerts nativos por feedback consistente con Black OS.
  const style=document.createElement('style');
  style.id='portal-polish-styles';
  style.textContent=`
    .portal-toast-stack{position:fixed;right:22px;bottom:22px;z-index:600;display:grid;gap:8px;width:min(380px,calc(100vw - 28px));pointer-events:none}
    .portal-toast{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:#151515;border:1px solid #313131;border-radius:13px;box-shadow:0 18px 50px rgba(0,0,0,.42);color:#ecece8;opacity:0;transform:translateY(8px);animation:portalToastIn .18s ease forwards;pointer-events:auto}
    .portal-toast.error{border-color:rgba(224,87,74,.28)}
    .portal-toast-dot{width:8px;height:8px;border-radius:50%;background:#d5c18d;margin-top:5px;flex:0 0 auto}.portal-toast.error .portal-toast-dot{background:#ef7468}
    .portal-toast strong{display:block;font-size:11.5px}.portal-toast span{display:block;color:#8b8b85;font-size:10.5px;line-height:1.5;margin-top:2px}
    @keyframes portalToastIn{to{opacity:1;transform:translateY(0)}}
    .users-toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:14px}
    .users-search{position:relative;flex:1;min-width:220px;max-width:430px}.users-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:15px;height:15px;fill:none;stroke:#70706b;stroke-width:1.7}.users-search input{width:100%;height:40px;padding:0 13px 0 36px;background:#101010;border:1px solid #282828;border-radius:11px;color:#eee;outline:none;font:inherit;font-size:12px}.users-search input:focus{border-color:#444}
    .users-stat{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border:1px solid #292929;border-radius:999px;background:#101010;color:#898983;font-size:10px;font-weight:700}.users-stat strong{color:#e9e9e5;font-size:11px}.users-stat.inactive strong{color:#9a9a94}
    .portal-confirm-overlay{position:fixed;inset:0;z-index:700;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px)}
    .portal-confirm{width:min(430px,100%);padding:22px;background:#111;border:1px solid #2d2d2d;border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.55)}.portal-confirm-kicker{font-size:9px;letter-spacing:.12em;color:#777;text-transform:uppercase;font-weight:800}.portal-confirm h3{margin:7px 0 7px;font-size:18px}.portal-confirm p{margin:0;color:#83837e;font-size:11.5px;line-height:1.6}.portal-confirm-actions{display:flex;gap:8px;margin-top:20px}.portal-confirm-actions button{flex:1}.portal-danger{background:#ef7468!important;color:#0b0b0b!important}.portal-danger:hover{background:#fa8174!important}
    #view-usuarios .content-header{margin-bottom:20px}#view-usuarios .section-heading{margin-bottom:10px}
    #view-usuarios .table-wrap{box-shadow:0 14px 40px rgba(0,0,0,.12)}
    #view-usuarios tbody tr[data-user-hidden="1"]{display:none}
    @media(max-width:620px){.portal-toast-stack{right:14px;bottom:14px}.users-toolbar{align-items:stretch}.users-search{max-width:none;min-width:100%}.portal-confirm-actions{flex-direction:column-reverse}}
  `;
  document.head.appendChild(style);

  const toastStack=document.createElement('div');
  toastStack.className='portal-toast-stack';
  document.body.appendChild(toastStack);
  function portalToast(message,type='info'){
    const node=document.createElement('div');
    node.className='portal-toast '+type;
    node.innerHTML=`<span class="portal-toast-dot"></span><div><strong>${type==='error'?'No se pudo completar':'Black OS'}</strong><span></span></div>`;
    node.querySelector('span:last-child').textContent=String(message||'');
    toastStack.appendChild(node);
    setTimeout(()=>{node.style.opacity='0';node.style.transform='translateY(6px)';setTimeout(()=>node.remove(),180)},4200);
  }
  window.BlackPortal=window.BlackPortal||{};
  window.BlackPortal.toast=portalToast;
  window.alert=(message)=>portalToast(message,'error');

  function ensureUsersToolbar(){
    const view=document.getElementById('view-usuarios');
    const table=view?.querySelector('.table-wrap');
    if(!view||!table||document.getElementById('users-search')) return;
    const toolbar=document.createElement('div');
    toolbar.className='users-toolbar';
    toolbar.innerHTML=`
      <label class="users-search" aria-label="Buscar usuarios">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/></svg>
        <input id="users-search" type="search" autocomplete="off" placeholder="Buscar por nombre o email">
      </label>
      <span class="users-stat"><strong id="users-active-count">0</strong> activos</span>
      <span class="users-stat inactive"><strong id="users-inactive-count">0</strong> inactivos</span>`;
    table.before(toolbar);
    toolbar.querySelector('#users-search')?.addEventListener('input',applyUserFilter);
  }

  function applyUserFilter(){
    const term=String(document.getElementById('users-search')?.value||'').trim().toLowerCase();
    document.querySelectorAll('#users-tbody tr[data-id]').forEach(row=>{
      const text=(row.textContent||'').toLowerCase();
      row.dataset.userHidden=term&&!text.includes(term)?'1':'0';
    });
  }

  function updateUserStats(){
    try{
      const active=(typeof usersData!=='undefined'&&Array.isArray(usersData))?usersData.filter(u=>u.activo!==false).length:0;
      const inactive=(typeof usersData!=='undefined'&&Array.isArray(usersData))?usersData.filter(u=>u.activo===false).length:0;
      const a=document.getElementById('users-active-count'),i=document.getElementById('users-inactive-count');
      if(a)a.textContent=String(active);if(i)i.textContent=String(inactive);
      applyUserFilter();
    }catch(error){}
  }

  ensureUsersToolbar();
  if(typeof renderUsers==='function'){
    const previousRenderUsers=renderUsers;
    renderUsers=function(){
      previousRenderUsers();
      ensureUsersToolbar();
      updateUserStats();
    };
    renderUsers();
  }

  // Refina el modal después de que permisos.js haya terminado de extenderlo.
  if(typeof openModal==='function'){
    const previousOpenModal=openModal;
    openModal=function(userId=null){
      previousOpenModal(userId);
      const password=document.getElementById('modal-password');
      if(password){
        password.type='password';
        if(!userId) password.placeholder='Mínimo 10 caracteres';
      }
    };
  }
  if(typeof closeModal==='function'){
    const previousCloseModal=closeModal;
    closeModal=function(){
      const password=document.getElementById('modal-password');
      if(password){password.value='';password.type='password'}
      previousCloseModal();
    };
  }

  // Confirmación visual para eliminar usuarios, evitando el confirm() nativo del navegador.
  function confirmDeleteUser(user){
    return new Promise(resolve=>{
      const overlay=document.createElement('div');
      overlay.className='portal-confirm-overlay';
      overlay.innerHTML=`<div class="portal-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-user-title">
        <span class="portal-confirm-kicker">Seguridad</span>
        <h3 id="delete-user-title">Eliminar usuario</h3>
        <p>Vas a eliminar el acceso de <strong></strong>. Esta acción también limpia sus permisos, sucursales y rol asociados.</p>
        <div class="portal-confirm-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancelar</button><button type="button" class="btn portal-danger" data-confirm>Eliminar usuario</button></div>
      </div>`;
      overlay.querySelector('strong').textContent=user?.nombre||user?.email||'este usuario';
      const done=value=>{overlay.remove();resolve(value)};
      overlay.querySelector('[data-cancel]').addEventListener('click',()=>done(false));
      overlay.querySelector('[data-confirm]').addEventListener('click',()=>done(true));
      overlay.addEventListener('click',event=>{if(event.target===overlay)done(false)});
      document.body.appendChild(overlay);
      overlay.querySelector('[data-cancel]').focus();
    });
  }

  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('.delete-user:not([disabled])');
    if(!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const id=button.closest('tr')?.dataset.id;
    const user=(typeof usersData!=='undefined'&&Array.isArray(usersData))?usersData.find(x=>String(x.id)===String(id)):null;
    if(!user) return;
    if(!(await confirmDeleteUser(user))) return;
    button.disabled=true;
    try{
      await callUserAdmin('delete',{id:user.id});
      const index=usersData.findIndex(x=>String(x.id)===String(id));
      if(index>=0) usersData.splice(index,1);
      renderUsers();
      if(typeof loadUserAudit==='function') loadUserAudit();
      portalToast('Usuario eliminado correctamente.');
    }catch(error){
      button.disabled=false;
      portalToast(error?.message||String(error),'error');
    }
  },true);

  // Al guardar, refresca métricas y auditoría sin obligar a recargar la sección.
  document.getElementById('user-form')?.addEventListener('submit',()=>{
    setTimeout(()=>{
      updateUserStats();
      if(typeof loadUserAudit==='function') loadUserAudit();
    },700);
  });
})();
