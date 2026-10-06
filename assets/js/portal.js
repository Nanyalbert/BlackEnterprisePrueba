// Black Óptica — Portal principal

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuToggle = document.getElementById('menu-toggle');
const mainContent = document.querySelector('.content');
const topbar = document.querySelector('.topbar');
const topbarTitle = document.getElementById('topbar-title') || document.querySelector('.topbar-title');
const DESKTOP_BREAKPOINT = 900;
const SIDEBAR_STORAGE_KEY = 'blackportal_sidebar_collapsed';
const VIEW_STORAGE_KEY = 'blackportal_active_view';

const TITLES = {
  inicio: 'Inicio',
  usuarios: 'Usuarios',
  'crm-clientes': 'CRM Black',
  administracion: 'Administración',
  'crm-oftalmologos': 'CRM Oftalmólogos',
  recetas: 'Recetas',
  catalogo: 'Catálogo de cristales',
  marketing: 'Marketing',
  rrhh: 'RRHH'
};

const MODULE_VIEWS = [
  'crm-clientes',
  'administracion',
  'crm-oftalmologos',
  'recetas',
  'catalogo',
  'marketing',
  'rrhh'
];

function isMobileLayout() {
  return window.innerWidth <= DESKTOP_BREAKPOINT;
}

function initials(name) {
  return String(name || '').trim().split(/\s+/).filter(Boolean).map(word => word[0]).join('').slice(0, 2).toUpperCase();
}

function getAvailableModuleHeight() {
  const topbarHeight = topbar ? Math.round(topbar.getBoundingClientRect().height) : 64;
  return Math.max(320, window.innerHeight - topbarHeight);
}

function sizeActiveModule() {
  if (!mainContent || !mainContent.classList.contains('module-mode')) return;

  const activeModule = document.querySelector('.view.active');
  if (!activeModule || !MODULE_VIEWS.some(name => activeModule.id === `view-${name}`)) return;

  const height = getAvailableModuleHeight();
  mainContent.style.height = `${height}px`;
  mainContent.style.minHeight = `${height}px`;
  mainContent.style.overflow = 'hidden';

  activeModule.style.width = '100%';
  activeModule.style.height = `${height}px`;
  activeModule.style.minHeight = `${height}px`;
  activeModule.style.overflow = 'hidden';

  const wrap = activeModule.querySelector('.module-frame-wrap');
  const frame = activeModule.querySelector('.module-frame');

  if (wrap) {
    wrap.style.width = '100%';
    wrap.style.height = `${height}px`;
    wrap.style.minHeight = `${height}px`;
    wrap.style.overflow = 'hidden';
  }

  if (frame) {
    frame.style.display = 'block';
    frame.style.width = '100%';
    frame.style.height = `${height}px`;
    frame.style.minHeight = `${height}px`;
    frame.style.border = '0';
  }
}

function resetContentSizing() {
  if (!mainContent) return;
  mainContent.style.height = '';
  mainContent.style.minHeight = '';
  mainContent.style.overflow = '';
}

function openMobileSidebar() {
  if (!sidebar) return;
  sidebar.classList.add('open');
  if (overlay) overlay.classList.add('show');
  if (menuToggle) {
    menuToggle.setAttribute('aria-expanded', 'true');
    menuToggle.setAttribute('aria-label', 'Cerrar menú');
  }
}

function closeMobileSidebar() {
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
  if (menuToggle) {
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.setAttribute('aria-label', 'Abrir menú');
  }
}

function setDesktopCollapsed(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  try { localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0'); } catch (error) {}
  if (menuToggle) {
    menuToggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
    menuToggle.setAttribute('aria-label', collapsed ? 'Expandir menú lateral' : 'Contraer menú lateral');
  }
  requestAnimationFrame(sizeActiveModule);
}

function toggleSidebar() {
  if (isMobileLayout()) {
    if (sidebar?.classList.contains('open')) closeMobileSidebar(); else openMobileSidebar();
    return;
  }
  setDesktopCollapsed(!document.body.classList.contains('sidebar-collapsed'));
}

function restoreSidebarPreference() {
  if (isMobileLayout()) { closeMobileSidebar(); return; }
  let collapsed = false;
  try { collapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1'; } catch (error) {}
  setDesktopCollapsed(collapsed);
}

menuToggle?.addEventListener('click', toggleSidebar);
overlay?.addEventListener('click', closeMobileSidebar);

document.querySelectorAll('.sidebar .nav-item').forEach(item => {
  const label = item.textContent.replace(/\s+/g, ' ').trim();
  if (label && !item.title) item.title = label;
  if (label && !item.getAttribute('aria-label')) item.setAttribute('aria-label', label);
});

const viewLinks = document.querySelectorAll('.nav-item[data-view]');
const appCards = document.querySelectorAll('.app-card[data-view]');

function showView(viewName) {
  if(typeof userCanOpen==='function' && !userCanOpen(viewName)){
    viewName='inicio';
    try{sessionStorage.removeItem(VIEW_STORAGE_KEY)}catch(error){}
  }
  const target = document.getElementById('view-' + viewName);
  if (!target) return;

  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
    if (MODULE_VIEWS.some(name => view.id === `view-${name}`)) {
      view.style.height = '';
      view.style.minHeight = '';
      const wrap = view.querySelector('.module-frame-wrap');
      const frame = view.querySelector('.module-frame');
      if (wrap) { wrap.style.height = ''; wrap.style.minHeight = ''; }
      if (frame) { frame.style.height = ''; frame.style.minHeight = ''; }
    }
  });

  target.classList.add('active');
  viewLinks.forEach(link => link.classList.toggle('active', link.dataset.view === viewName));
  if (topbarTitle) topbarTitle.textContent = TITLES[viewName] || 'Inicio';

  const isModule = MODULE_VIEWS.includes(viewName);
  if (mainContent) mainContent.classList.toggle('module-mode', isModule);

  if (isModule) {
    requestAnimationFrame(() => {
      sizeActiveModule();
      setTimeout(sizeActiveModule, 60);
    });
  } else {
    resetContentSizing();
  }

  try { sessionStorage.setItem(VIEW_STORAGE_KEY, viewName); } catch (error) {}
  if (isMobileLayout()) closeMobileSidebar();
}

viewLinks.forEach(link => link.addEventListener('click', event => {
  event.preventDefault();
  if (link.dataset.view) showView(link.dataset.view);
}));
appCards.forEach(card => card.addEventListener('click', event => {
  event.preventDefault();
  if (card.dataset.view) showView(card.dataset.view);
}));

// Submenú de Administración
function initAdministrationSubmenu(){
  const adminNav = document.getElementById('administracion-nav');
  const adminFrame = document.getElementById('administracion-frame');
  if(!adminNav || !adminFrame || document.getElementById('administracion-submenu')) return;

  const style = document.createElement('style');
  style.textContent = `
    .admin-nav-wrap{display:block}
    .admin-nav-parent{position:relative;padding-right:38px!important}
    .admin-nav-chevron{position:absolute;right:14px;top:50%;transform:translateY(-50%);width:16px;height:16px;display:grid;place-items:center;color:#73736f;transition:transform .18s ease;font-size:14px;pointer-events:none}
    .admin-nav-wrap.open .admin-nav-chevron{transform:translateY(-50%) rotate(90deg)}
    .admin-submenu{display:grid;grid-template-rows:0fr;transition:grid-template-rows .2s ease,opacity .18s ease;opacity:0}
    .admin-nav-wrap.open .admin-submenu{grid-template-rows:1fr;opacity:1}
    .admin-submenu-inner{overflow:hidden;padding-left:35px}
    .admin-subitem{display:flex;align-items:center;gap:9px;min-height:38px;padding:7px 12px;margin:3px 8px 3px 0;border-radius:10px;color:#777;text-decoration:none;font-size:12px;font-weight:500;transition:.15s}
    .admin-subitem:hover{background:#151515;color:#d7d7d2}
    .admin-subitem.active{background:#1a1a1a;color:#f5f5f3}
    .admin-subitem-dot{width:5px;height:5px;border-radius:50%;background:currentColor;opacity:.75;flex:0 0 auto}
    body.sidebar-collapsed .admin-submenu{display:none!important}
    body.sidebar-collapsed .admin-nav-chevron{display:none}
    @media(max-width:900px){.admin-submenu-inner{padding-left:35px}}
  `;
  document.head.appendChild(style);

  const wrap = document.createElement('div');
  wrap.className = 'admin-nav-wrap';
  adminNav.parentNode.insertBefore(wrap, adminNav);
  wrap.appendChild(adminNav);
  adminNav.classList.add('admin-nav-parent');
  adminNav.insertAdjacentHTML('beforeend','<span class="admin-nav-chevron">›</span>');

  const submenu = document.createElement('div');
  submenu.id = 'administracion-submenu';
  submenu.className = 'admin-submenu';
  submenu.innerHTML = `<div class="admin-submenu-inner"><a href="#" class="admin-subitem" id="proveedores-nav"><span class="admin-subitem-dot"></span><span>Proveedores</span></a></div>`;
  wrap.appendChild(submenu);

  const proveedoresNav = document.getElementById('proveedores-nav');

  const setAdminSource = (source, title) => {
    const cleanSource=source.split('?')[0];
    if(!adminFrame.src.includes('/'+cleanSource)) adminFrame.src = source;
    showView('administracion');
    wrap.classList.add('open');
    proveedoresNav?.classList.toggle('active', cleanSource === 'proveedores.html');
    if(topbarTitle) topbarTitle.textContent = title;
  };

  adminNav.addEventListener('click', () => {
    const wasOpen = wrap.classList.contains('open');
    setAdminSource('administracion.html','Administración');
    wrap.classList.toggle('open', !wasOpen);
  });

  proveedoresNav?.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    setAdminSource('proveedores.html?v=20261005-suppliers-1','Administración / Proveedores');
  });

  const adminCard = document.getElementById('administracion-card');
  adminCard?.addEventListener('click', () => {
    adminFrame.src = 'administracion.html';
    proveedoresNav?.classList.remove('active');
    wrap.classList.add('open');
  });
}

initAdministrationSubmenu();

const APP_LABELS = {
  'crm-black':'CRM Black',
  administracion:'Administración',
  'crm-oftalmologos':'CRM Oftalmólogos',
  recetas:'Recetas',
  marketing:'Marketing',
  rrhh:'RRHH',
  catalogo:'Catálogo de cristales',
  turnos:'Turnos'
};
let usersData = [];
let editingUserId = null;
let usersLoading = false;

function currentSessionUser(){
  return window.BlackPortal?.currentSession?.user || null;
}
function isPortalOwner(user=currentSessionUser()){
  const email=String(user?.email||'').toLowerCase();
  return user?.app_metadata?.black_os_super_admin===true || email==='leandro@blackoptica.ar' || email==='nanyalbert@gmail.com';
}
function userAppsFromMeta(user=currentSessionUser()){
  if(isPortalOwner(user)) return Object.keys(APP_LABELS);
  const meta=user?.app_metadata||{};
  const hasExplicitConfig=Object.prototype.hasOwnProperty.call(meta,'black_os_apps') || Object.prototype.hasOwnProperty.call(meta,'black_os_permissions');
  // Compatibilidad: las cuentas creadas antes del sistema granular no tenían metadata.
  // Para no bloquear Black OS durante la migración, conservan acceso legado hasta que se les guarden permisos explícitos.
  if(!hasExplicitConfig) return Object.keys(APP_LABELS);
  return Array.isArray(meta.black_os_apps)?meta.black_os_apps:[];
}
function userPermissionConfig(moduleId,user=currentSessionUser()){
  if(isPortalOwner(user)) return {level:'full',items:'*'};
  return user?.app_metadata?.black_os_permissions?.[moduleId]||null;
}
function userHasPermission(moduleId,permission,user=currentSessionUser()){
  if(isPortalOwner(user)) return true;
  const cfg=userPermissionConfig(moduleId,user);
  if(!cfg||cfg.level==='none') return false;
  if(!permission) return true;
  if(cfg.level==='full'||cfg.items==='*') return true;
  return Array.isArray(cfg.items)&&cfg.items.includes(permission);
}
function userCanOpen(viewName,user=currentSessionUser()){
  if(viewName==='inicio') return true;
  if(viewName==='usuarios') return isPortalOwner(user);
  const map={
    'crm-clientes':'crm-black',
    administracion:'administracion',
    'crm-oftalmologos':'crm-oftalmologos',
    recetas:'recetas',
    catalogo:'catalogo',
    marketing:'marketing',
    rrhh:'rrhh'
  };
  const app=map[viewName];
  return !app || userAppsFromMeta(user).includes(app);
}
function applyPortalAccess(user=currentSessionUser()){
  const selectors={
    'crm-clientes':['#crm-clientes-nav','#crm-clientes-card'],
    administracion:['#administracion-nav','#administracion-card'],
    'crm-oftalmologos':['#crm-oftalmologos-nav','#crm-oftalmologos-card'],
    recetas:['#recetas-nav','#recetas-card'],
    catalogo:['#catalogo-nav'],
    marketing:['#marketing-nav','#marketing-card'],
    rrhh:['#rrhh-nav'],
    usuarios:['.nav-item[data-view="usuarios"]']
  };
  Object.entries(selectors).forEach(([view,items])=>{
    const allowed=userCanOpen(view,user);
    items.forEach(sel=>document.querySelectorAll(sel).forEach(el=>{
      el.hidden=!allowed;
      el.setAttribute('aria-hidden',allowed?'false':'true');
    }));
  });

  const supplierNav=document.getElementById('proveedores-nav');
  if(supplierNav){
    const allowed=userHasPermission('administracion','suppliers',user);
    supplierNav.hidden=!allowed;
    supplierNav.setAttribute('aria-hidden',allowed?'false':'true');
  }

  document.querySelectorAll('.nav-label').forEach(label=>{
    let next=label.nextElementSibling,hasVisible=false;
    while(next && !next.classList?.contains('nav-label')){
      if((next.matches?.('.nav-item')||next.querySelector?.('.nav-item')) && !next.hidden){
        const nav=next.matches?.('.nav-item')?next:next.querySelector('.nav-item');
        if(nav && !nav.hidden){hasVisible=true;break}
      }
      next=next.nextElementSibling;
    }
    label.hidden=!hasVisible;
  });
}
async function callUserAdmin(action,payload={}){
  if(!supabaseClient) throw new Error('Supabase no está disponible.');
  const {data,error}=await supabaseClient.functions.invoke('black-os-user-admin',{
    body:{action,...payload}
  });
  if(error){
    const detail=data?.error||error.message||'No se pudo administrar usuarios.';
    throw new Error(detail);
  }
  if(!data?.ok) throw new Error(data?.error||'No se pudo administrar usuarios.');
  return data;
}
async function loadUsers(){
  if(!isPortalOwner()) return;
  usersLoading=true;
  const tbody=document.getElementById('users-tbody');
  if(tbody) tbody.innerHTML='<tr><td colspan="4"><div class="empty-state">Cargando usuarios…</div></td></tr>';
  try{
    const data=await callUserAdmin('list');
    usersData=data.users||[];
    renderUsers();
  }catch(error){
    console.error('No se pudieron cargar usuarios:',error);
    if(tbody) tbody.innerHTML=`<tr><td colspan="4"><div class="empty-state"><strong>No se pudo conectar el administrador de usuarios.</strong><br><span>${String(error.message||error)}</span><br><small>Verificá que la Edge Function <code>black-os-user-admin</code> esté desplegada en Supabase.</small></div></td></tr>`;
  }finally{usersLoading=false}
}

function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  const countEl = document.getElementById('users-count');
  if (!tbody || !countEl) return;
  countEl.textContent = usersData.length + (usersData.length === 1 ? ' usuario' : ' usuarios');
  if (!usersData.length) { tbody.innerHTML='<tr><td colspan="4"><div class="empty-state">Todavía no hay usuarios cargados.</div></td></tr>'; return; }
  tbody.innerHTML = usersData.map(user => {
    const badges = user.superAdmin ? '<span class="badge super">Acceso total</span>' : (user.apps?.length ? user.apps.map(app=>`<span class="badge">${APP_LABELS[app]||app}</span>`).join('') : '<span class="badge">Sin accesos</span>');
    const locked=user.superAdmin?'disabled aria-disabled="true"':'';
    return `<tr data-id="${user.id}"><td><div class="user-cell"><div class="avatar">${initials(user.nombre)}</div><div><div class="user-cell-name">${user.nombre}</div><div class="user-cell-email">${user.email}</div></div></div></td><td>${badges}</td><td><span class="status-dot ${user.activo?'':'inactive'}">${user.activo?'Activo':'Inactivo'}</span></td><td><div class="row-actions"><button type="button" class="edit-user" title="Editar usuario" aria-label="Editar usuario" ${locked}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button><button type="button" class="danger delete-user" title="Eliminar usuario" aria-label="Eliminar usuario" ${locked}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M8 11v7M12 11v7M16 11v7M6 7l1 14h10l1-14"/></svg></button></div></td></tr>`;
  }).join('');
  tbody.querySelectorAll('.edit-user:not([disabled])').forEach(button => button.addEventListener('click',()=>openModal(button.closest('tr').dataset.id)));
  tbody.querySelectorAll('.delete-user:not([disabled])').forEach(button => button.addEventListener('click',async()=>{
    const id=button.closest('tr').dataset.id; const user=usersData.find(x=>String(x.id)===String(id)); if(!user) return;
    if(!confirm(`¿Eliminar a ${user.nombre}? Va a perder el acceso al portal.`)) return;
    button.disabled=true;
    try{
      await callUserAdmin('delete',{id:user.id});
      usersData=usersData.filter(x=>String(x.id)!==String(id));
      renderUsers();
    }catch(error){alert(error.message||String(error));button.disabled=false}
  }));
}

const modalOverlay=document.getElementById('user-modal-overlay');
const modalTitle=document.getElementById('modal-title');
const modalPasswordField=document.getElementById('modal-password-field');
const userForm=document.getElementById('user-form');
const nameInput=document.getElementById('modal-name');
const emailInput=document.getElementById('modal-email');
const passwordInput=document.getElementById('modal-password');
const activeInput=document.getElementById('modal-active');
const btnNewUser=document.getElementById('btn-new-user');
const modalClose=document.getElementById('modal-close');
const modalCancel=document.getElementById('modal-cancel');

function openModal(userId=null){
  if(!modalOverlay||!userForm||!modalTitle||!modalPasswordField||!nameInput||!emailInput)return;
  editingUserId=userId||null; userForm.reset();
  document.querySelectorAll('.permiso-item input').forEach(input=>input.checked=false);
  if(editingUserId){
    const user=usersData.find(x=>String(x.id)===String(editingUserId)); if(!user)return;
    modalTitle.textContent='Editar usuario';
    modalPasswordField.style.display='flex';
    const passLabel=modalPasswordField.querySelector('label'); if(passLabel)passLabel.textContent='Nueva contraseña (opcional)';
    if(passwordInput){passwordInput.required=false;passwordInput.placeholder='Dejar vacío para mantener la actual';}
    nameInput.value=user.nombre||''; emailInput.value=user.email||'';
    if(activeInput) activeInput.checked=user.activo!==false;
    document.querySelectorAll('.permiso-item input').forEach(input=>input.checked=(user.apps||[]).includes(input.value));
  } else {
    modalTitle.textContent='Nuevo usuario';
    modalPasswordField.style.display='flex';
    const passLabel=modalPasswordField.querySelector('label'); if(passLabel)passLabel.textContent='Contraseña temporal';
    if(passwordInput){passwordInput.required=true;passwordInput.placeholder='Mínimo 8 caracteres';}
    if(activeInput) activeInput.checked=true;
  }
  modalOverlay.classList.add('show'); setTimeout(()=>nameInput.focus(),50);
}
function closeModal(){ modalOverlay?.classList.remove('show'); editingUserId=null; }
btnNewUser?.addEventListener('click',()=>openModal());
modalClose?.addEventListener('click',closeModal);
modalCancel?.addEventListener('click',closeModal);
modalOverlay?.addEventListener('click',event=>{if(event.target===modalOverlay)closeModal();});

userForm?.addEventListener('submit',async event=>{
  event.preventDefault();
  if(usersLoading) return;
  const nombre=nameInput?.value.trim()||'';
  const email=emailInput?.value.trim().toLowerCase()||'';
  const password=passwordInput?.value||'';
  if(!nombre||!email) return;
  if(!editingUserId && password.length<8){alert('La contraseña temporal debe tener al menos 8 caracteres.');return;}
  const config=window.BlackUserPermissions?.collect?.()||{
    permissions:{},
    branchScope:['all']
  };
  const submit=userForm.querySelector('button[type="submit"]');
  if(submit){submit.disabled=true;submit.textContent='Guardando…';}
  try{
    const action=editingUserId?'update':'create';
    const data=await callUserAdmin(action,{
      id:editingUserId||undefined,nombre,email,password:password||undefined,
      permissions:config.permissions,branchScope:config.branchScope,activo:activeInput?.checked!==false
    });
    const savedUser=data.user;
    const i=usersData.findIndex(x=>String(x.id)===String(savedUser.id));
    if(i>=0)usersData[i]=savedUser;else usersData.push(savedUser);
    renderUsers();closeModal();
  }catch(error){
    console.error(error);alert(error.message||String(error));
  }finally{
    if(submit){submit.disabled=false;submit.textContent='Guardar';}
  }
});


const notifBtn=document.getElementById('notif-btn');
const notifPanel=document.getElementById('notif-panel');
const notifDot=document.getElementById('notif-dot');
const notifMarkRead=document.getElementById('notif-mark-read');
function closeNotifPanel(){notifPanel?.classList.remove('show');notifBtn?.setAttribute('aria-expanded','false');}
notifBtn?.addEventListener('click',event=>{event.stopPropagation();const open=notifPanel?.classList.toggle('show');notifBtn.setAttribute('aria-expanded',open?'true':'false');});
document.addEventListener('click',event=>{if(notifPanel&&notifBtn&&!notifPanel.contains(event.target)&&!notifBtn.contains(event.target))closeNotifPanel();});
notifMarkRead?.addEventListener('click',()=>{document.querySelectorAll('.notif-item.unread').forEach(item=>item.classList.remove('unread'));if(notifDot)notifDot.style.display='none';});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeNotifPanel();closeModal();if(isMobileLayout())closeMobileSidebar();}});

let supabaseClient=null;
try { if(!window.BlackPortal||typeof window.BlackPortal.getSupabase!=='function')throw new Error('BlackPortal / Supabase config no está disponible.'); supabaseClient=window.BlackPortal.getSupabase(); } catch(error){console.error(error);}

async function bootPortal(){
  restoreSidebarPreference();
  if(!supabaseClient){window.location.replace('index.html');return;}
  try{
    const {data:{session},error}=await supabaseClient.auth.getSession(); if(error||!session){window.location.replace('index.html');return;}
    window.BlackPortal=window.BlackPortal||{};window.BlackPortal.currentSession=session;
    const meta=session.user.app_metadata||{};
    if(meta.black_os_active===false){await supabaseClient.auth.signOut();window.location.replace('index.html?disabled=1');return;}
    applyPortalAccess(session.user);
    if(isPortalOwner(session.user)) loadUsers();
    const email=session.user.email||'';
    const rawName=session.user.user_metadata?.full_name||session.user.user_metadata?.name||email.split('@')[0].replace(/[._-]+/g,' ');
    const displayName=rawName.split(' ').filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ');
    const userName=document.getElementById('user-name'); const userAvatar=document.getElementById('user-avatar'); const greeting=document.getElementById('greeting'); const userRole=document.querySelector('.user-chip-role');
    if(userName)userName.textContent=displayName||email; if(userAvatar)userAvatar.textContent=initials(displayName||email); if(greeting)greeting.textContent=displayName?`Bienvenido, ${displayName}`:'Bienvenido';
    if(userRole) userRole.textContent=isPortalOwner(session.user)?'Administrador':'Usuario';
    let initialView='inicio'; try{const savedView=sessionStorage.getItem(VIEW_STORAGE_KEY);if(savedView&&document.getElementById('view-'+savedView))initialView=savedView;}catch(error){}
    const params=new URLSearchParams(window.location.search);
    const requestedView=params.get('view');
    if(requestedView&&document.getElementById('view-'+requestedView))initialView=requestedView;
    if(!userCanOpen(initialView,session.user))initialView='inicio';
    if(initialView==='catalogo'&&params.has('catalogo')){
      const frame=document.getElementById('catalogo-frame');
      if(frame)frame.src=`black-ai.html?catalogo=${encodeURIComponent(params.get('catalogo')||'')}`;
    }
    showView(initialView);
  }catch(error){console.error(error);window.location.replace('index.html');}
}
bootPortal();

const logoutBtn=document.getElementById('logout-btn');
logoutBtn?.addEventListener('click',async event=>{event.preventDefault();try{sessionStorage.removeItem(VIEW_STORAGE_KEY);}catch(error){}if(supabaseClient){try{await supabaseClient.auth.signOut();}catch(error){}}window.location.replace('index.html');});

let resizeTimer = null;
window.addEventListener('resize',()=>{
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (mainContent?.classList.contains('module-mode')) sizeActiveModule();
    const mobileNow=isMobileLayout();
    if(mobileNow) closeMobileSidebar();
    else restoreSidebarPreference();
  }, 80);
});
