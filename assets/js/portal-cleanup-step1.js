// Black OS — pulido final del shell y administración de usuarios
(() => {
  const $=(s,root=document)=>root.querySelector(s);
  const $$=(s,root=document)=>[...root.querySelectorAll(s)];

  // No mostrar notificaciones ficticias hasta conectar eventos reales.
  const notifList=$('#notif-list');
  if(notifList) notifList.innerHTML='<div class="portal-empty-notifications"><strong>Sin notificaciones</strong><span>Las alertas reales aparecerán acá cuando estén conectadas a eventos del sistema.</span></div>';
  const notifDot=$('#notif-dot'); if(notifDot) notifDot.style.display='none';
  const markRead=$('#notif-mark-read'); if(markRead) markRead.hidden=true;
  const notifFooter=$('.notif-footer'); if(notifFooter) notifFooter.hidden=true;
  const portalStatus=$('.dashboard-status span:last-child'); if(portalStatus) portalStatus.textContent='Portal activo';

  const style=document.createElement('style');
  style.id='portal-polish-styles';
  style.textContent=`
    .portal-toast-stack{position:fixed;right:22px;bottom:22px;z-index:600;display:grid;gap:8px;width:min(380px,calc(100vw - 28px));pointer-events:none}
    .portal-toast{display:flex;align-items:flex-start;gap:10px;padding:12px 14px;background:#151515;border:1px solid #313131;border-radius:13px;box-shadow:0 18px 50px rgba(0,0,0,.42);color:#ecece8;opacity:0;transform:translateY(8px);animation:portalToastIn .18s ease forwards;pointer-events:auto;transition:.18s ease}
    .portal-toast.error{border-color:rgba(224,87,74,.28)}.portal-toast.success{border-color:rgba(121,190,139,.25)}
    .portal-toast-dot{width:8px;height:8px;border-radius:50%;background:#d5c18d;margin-top:5px;flex:0 0 auto}.portal-toast.error .portal-toast-dot{background:#ef7468}.portal-toast.success .portal-toast-dot{background:#83d19a}
    .portal-toast strong{display:block;font-size:11.5px}.portal-toast span{display:block;color:#8b8b85;font-size:10.5px;line-height:1.5;margin-top:2px}
    @keyframes portalToastIn{to{opacity:1;transform:translateY(0)}}
    .users-toolbar{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:14px}
    .users-search{position:relative;flex:1;min-width:220px;max-width:430px}.users-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);width:15px;height:15px;fill:none;stroke:#70706b;stroke-width:1.7}.users-search input{width:100%;height:40px;padding:0 13px 0 36px;background:#101010;border:1px solid #282828;border-radius:11px;color:#eee;outline:none;font:inherit;font-size:12px}.users-search input:focus{border-color:#444}
    .users-stat{display:inline-flex;align-items:center;gap:6px;height:32px;padding:0 10px;border:1px solid #292929;border-radius:999px;background:#101010;color:#898983;font-size:10px;font-weight:700}.users-stat strong{color:#e9e9e5;font-size:11px}.users-stat.inactive strong{color:#9a9a94}
    .portal-confirm-overlay{position:fixed;inset:0;z-index:700;display:grid;place-items:center;padding:18px;background:rgba(0,0,0,.72);backdrop-filter:blur(6px)}
    .portal-confirm{width:min(430px,100%);padding:22px;background:#111;border:1px solid #2d2d2d;border-radius:18px;box-shadow:0 30px 90px rgba(0,0,0,.55)}.portal-confirm-kicker{font-size:9px;letter-spacing:.12em;color:#777;text-transform:uppercase;font-weight:800}.portal-confirm h3{margin:7px 0;font-size:18px}.portal-confirm p{margin:0;color:#83837e;font-size:11.5px;line-height:1.6}.portal-confirm-actions{display:flex;gap:8px;margin-top:20px}.portal-confirm-actions button{flex:1}.portal-danger{background:#ef7468!important;color:#0b0b0b!important}.portal-danger:hover{background:#fa8174!important}
    #view-usuarios .content-header{margin-bottom:20px}#view-usuarios .section-heading{margin-bottom:10px}#view-usuarios .table-wrap{box-shadow:0 14px 40px rgba(0,0,0,.12)}#view-usuarios tbody tr[data-user-hidden="1"]{display:none}
    @media(max-width:620px){.portal-toast-stack{right:14px;bottom:14px}.users-toolbar{align-items:stretch}.users-search{max-width:none;min-width:100%}.portal-confirm-actions{flex-direction:column-reverse}}
  `;
  document.head.appendChild(style);

  const toastStack=document.createElement('div');
  toastStack.className='portal-toast-stack';
  document.body.appendChild(toastStack);
  function portalToast(message,type='info'){
    const node=document.createElement('div');
    node.className='portal-toast '+type;
    const title=type==='error'?'No se pudo completar':type==='success'?'Listo':'Black OS';
    node.innerHTML=`<span class="portal-toast-dot"></span><div><strong>${title}</strong><span></span></div>`;
    node.querySelector('span:last-child').textContent=String(message||'');
    toastStack.appendChild(node);
    setTimeout(()=>{node.style.opacity='0';node.style.transform='translateY(6px)';setTimeout(()=>node.remove(),180)},4200);
  }
  window.BlackPortal=window.BlackPortal||{};
  window.BlackPortal.toast=portalToast;
  window.alert=(message)=>{
    const text=String(message||'');
    const success=/creado|guardado|actualizado|eliminado|correctamente|listo|éxito/i.test(text);
    portalToast(text,success?'success':'error');
  };

  function ensureUsersToolbar(){
    const view=$('#view-usuarios');
    const table=view?.querySelector('.table-wrap');
    if(!view||!table||$('#users-search')) return;
    const toolbar=document.createElement('div');
    toolbar.className='users-toolbar';
    toolbar.innerHTML='<label class="users-search" aria-label="Buscar usuarios"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.4-3.4"/></svg><input id="users-search" type="search" autocomplete="off" placeholder="Buscar por nombre o email"></label><span class="users-stat"><strong id="users-active-count">0</strong> activos</span><span class="users-stat inactive"><strong id="users-inactive-count">0</strong> inactivos</span>';
    table.before(toolbar);
    $('#users-search',toolbar)?.addEventListener('input',applyUserFilter);
  }
  function applyUserFilter(){
    const term=String($('#users-search')?.value||'').trim().toLowerCase();
    $$('#users-tbody tr[data-id]').forEach(row=>{row.dataset.userHidden=term&&!String(row.textContent||'').toLowerCase().includes(term)?'1':'0'});
  }
  function updateUserStats(){
    try{
      const active=Array.isArray(window.usersData||null)?usersData.filter(u=>u.activo!==false).length:(typeof usersData!=='undefined'&&Array.isArray(usersData)?usersData.filter(u=>u.activo!==false).length:0);
      const inactive=typeof usersData!=='undefined'&&Array.isArray(usersData)?usersData.filter(u=>u.activo===false).length:0;
      const a=$('#users-active-count'),i=$('#users-inactive-count');if(a)a.textContent=String(active);if(i)i.textContent=String(inactive);applyUserFilter();
    }catch(_){ }
  }
  ensureUsersToolbar();
  if(typeof renderUsers==='function'){
    const previousRenderUsers=renderUsers;
    renderUsers=function(){previousRenderUsers();ensureUsersToolbar();updateUserStats()};
    renderUsers();
  }

  if(typeof openModal==='function'){
    const previousOpenModal=openModal;
    openModal=function(userId=null){previousOpenModal(userId);const password=$('#modal-password');if(password){password.type='password';if(!userId)password.placeholder='Mínimo 10 caracteres'};setTimeout(loadAccessFinalizer,0)};
  }
  if(typeof closeModal==='function'){
    const previousCloseModal=closeModal;
    closeModal=function(){const password=$('#modal-password');if(password){password.value='';password.type='password'}previousCloseModal()};
  }

  function confirmDeleteUser(user){
    return new Promise(resolve=>{
      const overlay=document.createElement('div');overlay.className='portal-confirm-overlay';
      overlay.innerHTML='<div class="portal-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-user-title"><span class="portal-confirm-kicker">Seguridad</span><h3 id="delete-user-title">Eliminar usuario</h3><p>Vas a eliminar el acceso de <strong></strong>. Esta acción también limpia sus permisos, sucursales y rol asociados.</p><div class="portal-confirm-actions"><button type="button" class="btn btn-ghost" data-cancel>Cancelar</button><button type="button" class="btn portal-danger" data-confirm>Eliminar usuario</button></div></div>';
      $('strong',overlay).textContent=user?.nombre||user?.email||'este usuario';
      const done=value=>{overlay.remove();resolve(value)};
      $('[data-cancel]',overlay).addEventListener('click',()=>done(false));$('[data-confirm]',overlay).addEventListener('click',()=>done(true));overlay.addEventListener('click',e=>{if(e.target===overlay)done(false)});document.body.appendChild(overlay);$('[data-cancel]',overlay).focus();
    });
  }
  document.addEventListener('click',async event=>{
    const button=event.target.closest?.('.delete-user:not([disabled])');if(!button)return;
    event.preventDefault();event.stopImmediatePropagation();
    const id=button.closest('tr')?.dataset.id;const user=typeof usersData!=='undefined'&&Array.isArray(usersData)?usersData.find(x=>String(x.id)===String(id)):null;if(!user)return;
    if(!(await confirmDeleteUser(user)))return;
    button.disabled=true;
    try{await callUserAdmin('delete',{id:user.id});const index=usersData.findIndex(x=>String(x.id)===String(id));if(index>=0)usersData.splice(index,1);renderUsers();if(typeof loadUserAudit==='function')loadUserAudit();portalToast('Usuario eliminado correctamente.','success')}
    catch(error){button.disabled=false;portalToast(error?.message||String(error),'error')}
  },true);

  document.getElementById('user-form')?.addEventListener('submit',()=>setTimeout(()=>{updateUserStats();if(typeof loadUserAudit==='function')loadUserAudit()},700));

  // Compatibilidad del acceso "solo Proveedores": evita cargar Administración por listeners heredados.
  window.setAdminSource=function(source,title='Administración'){
    const frame=$('#administracion-frame');if(!frame)return;
    frame.src=source;
    if(typeof showView==='function')showView('administracion');
    const topbarTitle=$('#topbar-title')||$('.topbar-title');if(topbarTitle)topbarTitle.textContent=title;
    const supplier=$('#proveedores-nav');if(supplier)supplier.classList.toggle('active',String(source).includes('proveedores.html'));
    $('#administracion-nav')?.closest('.admin-nav-wrap')?.classList.add('open');
  };
  function syncSupplierOnlyUi(){
    const nav=$('#administracion-nav'),card=$('#administracion-card');if(!nav||!card)return;
    const only=nav.dataset.supplierOnly==='1';
    const h=card.querySelector('h3'),p=card.querySelector('p');
    if(h)h.textContent=only?'Proveedores':'Administración';
    if(p)p.textContent=only?'Consulta y gestión de proveedores asignada a tu usuario.':'Ventas, caja, bancos, rentabilidad y gestión operativa.';
  }
  const adminNav=$('#administracion-nav');
  if(adminNav){new MutationObserver(syncSupplierOnlyUi).observe(adminNav,{attributes:true,attributeFilter:['data-supplier-only']});syncSupplierOnlyUi()}
  document.addEventListener('click',event=>{
    const card=event.target.closest?.('#administracion-card');const nav=$('#administracion-nav');
    if(!card||nav?.dataset.supplierOnly!=='1')return;
    event.preventDefault();event.stopImmediatePropagation();window.setAdminSource('proveedores.html?v=20261007-access-1','Proveedores');
  },true);

  let accessFinalizerLoaded=false;
  function loadAccessFinalizer(){
    if(accessFinalizerLoaded)return;
    accessFinalizerLoaded=true;
    const script=document.createElement('script');
    script.src='assets/js/access-finalizer.js?v=20261007-1';
    script.defer=true;
    document.head.appendChild(script);
  }
  loadAccessFinalizer();
})();
