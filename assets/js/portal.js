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
  'crm-oftalmologos': 'CRM Oftalmólogos'
};

const MODULE_VIEWS = [
  'crm-clientes',
  'administracion',
  'crm-oftalmologos'
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
    if(!adminFrame.src.endsWith(source)) adminFrame.src = source;
    showView('administracion');
    wrap.classList.add('open');
    proveedoresNav?.classList.toggle('active', source === 'proveedores.html');
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
    setAdminSource('proveedores.html','Administración / Proveedores');
  });

  const adminCard = document.getElementById('administracion-card');
  adminCard?.addEventListener('click', () => {
    adminFrame.src = 'administracion.html';
    proveedoresNav?.classList.remove('active');
    wrap.classList.add('open');
  });
}

initAdministrationSubmenu();

const APP_LABELS = {'crm-black':'CRM Black', administracion:'Administración', 'crm-oftalmologos':'CRM Oftalmólogos'};
let usersData = [
  {id:1,nombre:'Leandro',email:'leandro@blackoptica.ar',apps:['crm-black','administracion','crm-oftalmologos'],superAdmin:true,activo:true},
  {id:2,nombre:'Recepción Óptica',email:'recepcion@blackoptica.ar',apps:['administracion'],superAdmin:false,activo:true},
  {id:3,nombre:'Dr. Gómez',email:'gomez@ejemplo.com',apps:['crm-oftalmologos'],superAdmin:false,activo:true}
];
let nextUserId = 4;
let editingUserId = null;

function renderUsers() {
  const tbody = document.getElementById('users-tbody');
  const countEl = document.getElementById('users-count');
  if (!tbody || !countEl) return;
  countEl.textContent = usersData.length + (usersData.length === 1 ? ' usuario' : ' usuarios');
  if (!usersData.length) { tbody.innerHTML='<tr><td colspan="4"><div class="empty-state">Todavía no diste de alta ningún usuario.</div></td></tr>'; return; }
  tbody.innerHTML = usersData.map(user => {
    const badges = user.superAdmin ? '<span class="badge super">Acceso total</span>' : (user.apps.length ? user.apps.map(app=>`<span class="badge">${APP_LABELS[app]||app}</span>`).join('') : '<span class="badge">Sin accesos</span>');
    return `<tr data-id="${user.id}"><td><div class="user-cell"><div class="avatar">${initials(user.nombre)}</div><div><div class="user-cell-name">${user.nombre}</div><div class="user-cell-email">${user.email}</div></div></div></td><td>${badges}</td><td><span class="status-dot ${user.activo?'':'inactive'}">${user.activo?'Activo':'Inactivo'}</span></td><td><div class="row-actions"><button type="button" class="edit-user" title="Editar">✎</button><button type="button" class="danger delete-user" title="Eliminar">×</button></div></td></tr>`;
  }).join('');
  tbody.querySelectorAll('.edit-user').forEach(button => button.addEventListener('click',()=>openModal(Number(button.closest('tr').dataset.id))));
  tbody.querySelectorAll('.delete-user').forEach(button => button.addEventListener('click',()=>{
    const id=Number(button.closest('tr').dataset.id); const user=usersData.find(x=>x.id===id); if(!user) return;
    if(confirm(`¿Eliminar a ${user.nombre}? Va a perder el acceso al portal.`)){ usersData=usersData.filter(x=>x.id!==id); renderUsers(); }
  }));
}

const modalOverlay=document.getElementById('user-modal-overlay');
const modalTitle=document.getElementById('modal-title');
const modalPasswordField=document.getElementById('modal-password-field');
const userForm=document.getElementById('user-form');
const nameInput=document.getElementById('modal-name');
const emailInput=document.getElementById('modal-email');
const btnNewUser=document.getElementById('btn-new-user');
const modalClose=document.getElementById('modal-close');
const modalCancel=document.getElementById('modal-cancel');

function openModal(userId=null){
  if(!modalOverlay||!userForm||!modalTitle||!modalPasswordField||!nameInput||!emailInput)return;
  editingUserId=userId||null; userForm.reset();
  document.querySelectorAll('.permiso-item input').forEach(input=>input.checked=false);
  if(editingUserId){ const user=usersData.find(x=>x.id===editingUserId); if(!user)return; modalTitle.textContent='Editar usuario'; modalPasswordField.style.display='none'; nameInput.value=user.nombre; emailInput.value=user.email; document.querySelectorAll('.permiso-item input').forEach(input=>input.checked=user.apps.includes(input.value)); }
  else { modalTitle.textContent='Nuevo usuario'; modalPasswordField.style.display='flex'; }
  modalOverlay.classList.add('show'); setTimeout(()=>nameInput.focus(),50);
}
function closeModal(){ modalOverlay?.classList.remove('show'); editingUserId=null; }
btnNewUser?.addEventListener('click',()=>openModal());
modalClose?.addEventListener('click',closeModal);
modalCancel?.addEventListener('click',closeModal);
modalOverlay?.addEventListener('click',event=>{if(event.target===modalOverlay)closeModal();});
userForm?.addEventListener('submit',event=>{
  event.preventDefault(); const nombre=nameInput?.value.trim()||''; const email=emailInput?.value.trim()||''; if(!nombre||!email)return;
  const apps=Array.from(document.querySelectorAll('.permiso-item input:checked')).map(input=>input.value);
  if(editingUserId){ const user=usersData.find(x=>x.id===editingUserId); if(!user)return; user.nombre=nombre; user.email=email; user.apps=apps; }
  else usersData.push({id:nextUserId++,nombre,email,apps,superAdmin:false,activo:true});
  renderUsers(); closeModal();
});
renderUsers();

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
    const email=session.user.email||'';
    const rawName=session.user.user_metadata?.full_name||session.user.user_metadata?.name||email.split('@')[0].replace(/[._-]+/g,' ');
    const displayName=rawName.split(' ').filter(Boolean).map(part=>part.charAt(0).toUpperCase()+part.slice(1)).join(' ');
    const userName=document.getElementById('user-name'); const userAvatar=document.getElementById('user-avatar'); const greeting=document.getElementById('greeting');
    if(userName)userName.textContent=displayName||email; if(userAvatar)userAvatar.textContent=initials(displayName||email); if(greeting)greeting.textContent=displayName?`Bienvenido, ${displayName}`:'Bienvenido';
    let initialView='inicio'; try{const savedView=sessionStorage.getItem(VIEW_STORAGE_KEY);if(savedView&&document.getElementById('view-'+savedView))initialView=savedView;}catch(error){}
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
