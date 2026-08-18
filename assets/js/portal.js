// Black Óptica — Portal principal

// Sidebar mobile toggle — funciona siempre, sin depender de Supabase
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('overlay');
  const menuToggle = document.getElementById('menu-toggle');

  function openSidebar(){
    sidebar.classList.add('open');
    overlay.classList.add('show');
  }
  function closeSidebar(){
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }
  menuToggle.addEventListener('click', openSidebar);
  overlay.addEventListener('click', closeSidebar);

  // Cerrar el sidebar al tocar un link (mobile), para que no quede abierto tapando la app
  document.querySelectorAll('.nav-item:not(#logout-btn)').forEach(item => {
    item.addEventListener('click', closeSidebar);
  });

  // ---------------------------------------------------------
  // NAVEGACIÓN ENTRE VISTAS (Inicio / Usuarios)
  // ---------------------------------------------------------
  const viewLinks = document.querySelectorAll('.nav-item[data-view]');
  const topbarTitle = document.querySelector('.topbar-title');

  function showView(viewName){
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById('view-' + viewName);
    if (target) target.classList.add('active');

    viewLinks.forEach(l => l.classList.toggle('active', l.dataset.view === viewName));

    const titles = { inicio: 'Inicio', usuarios: 'Usuarios', 'crm-oftalmologos': 'CRM Oftalmólogos' };
    if (topbarTitle) topbarTitle.textContent = titles[viewName] || 'Inicio';
  }

  viewLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      showView(link.dataset.view);
    });
  });

  // ---------------------------------------------------------
  // GESTIÓN DE USUARIOS (datos de ejemplo en memoria)
  // Cuando conectes Supabase, reemplazá este array por
  // una consulta a tu tabla "usuarios" + "usuario_app_permisos".
  // ---------------------------------------------------------
  const APP_LABELS = {
    'crm-black': 'CRM Black',
    'administracion': 'Administración',
    'crm-oftalmologos': 'CRM Oftalmólogos'
  };

  let usersData = [
    { id: 1, nombre: 'Leandro', email: 'leandro@blackoptica.ar', apps: ['crm-black','administracion','crm-oftalmologos'], superAdmin: true, activo: true },
    { id: 2, nombre: 'Recepción Óptica', email: 'recepcion@blackoptica.ar', apps: ['administracion'], superAdmin: false, activo: true },
    { id: 3, nombre: 'Dr. Gómez', email: 'gomez@ejemplo.com', apps: ['crm-oftalmologos'], superAdmin: false, activo: true }
  ];
  let nextUserId = 4;
  let editingUserId = null;

  function initials(name){
    return name.trim().split(/\s+/).map(w => w[0]).join('').slice(0,2).toUpperCase();
  }

  function renderUsers(){
    const tbody = document.getElementById('users-tbody');
    const countEl = document.getElementById('users-count');
    countEl.textContent = usersData.length + (usersData.length === 1 ? ' usuario' : ' usuarios');

    if (usersData.length === 0){
      tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state">Todavía no diste de alta ningún usuario.</div></td></tr>';
      return;
    }

    tbody.innerHTML = usersData.map(u => {
      const badges = u.superAdmin
        ? '<span class="badge super">Acceso total</span>'
        : (u.apps.length
            ? u.apps.map(a => `<span class="badge">${APP_LABELS[a] || a}</span>`).join('')
            : '<span class="badge">Sin accesos</span>');

      return `
        <tr data-id="${u.id}">
          <td>
            <div class="user-cell">
              <div class="avatar">${initials(u.nombre)}</div>
              <div>
                <div class="user-cell-name">${u.nombre}</div>
                <div class="user-cell-email">${u.email}</div>
              </div>
            </div>
          </td>
          <td>${badges}</td>
          <td><span class="status-dot ${u.activo ? '' : 'inactive'}">${u.activo ? 'Activo' : 'Inactivo'}</span></td>
          <td>
            <div class="row-actions">
              <button type="button" class="edit-user" aria-label="Editar" title="Editar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"/></svg>
              </button>
              <button type="button" class="danger delete-user" aria-label="Eliminar" title="Eliminar">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
              </button>
            </div>
          </td>
        </tr>`;
    }).join('');

    tbody.querySelectorAll('.edit-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.closest('tr').dataset.id);
        openModal(id);
      });
    });
    tbody.querySelectorAll('.delete-user').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = Number(btn.closest('tr').dataset.id);
        const user = usersData.find(u => u.id === id);
        if (user && confirm(`¿Eliminar a ${user.nombre}? Va a perder el acceso al portal.`)){
          usersData = usersData.filter(u => u.id !== id);
          renderUsers();
        }
      });
    });
  }

  // ---------------------------------------------------------
  // MODAL: alta y edición
  // ---------------------------------------------------------
  const modalOverlay = document.getElementById('user-modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalPasswordField = document.getElementById('modal-password-field');
  const userForm = document.getElementById('user-form');
  const nameInput = document.getElementById('modal-name');
  const emailInput2 = document.getElementById('modal-email');
  const passwordInput2 = document.getElementById('modal-password');

  function openModal(userId){
    editingUserId = userId || null;
    userForm.reset();
    document.querySelectorAll('.permiso-item input').forEach(c => c.checked = false);

    if (editingUserId){
      const user = usersData.find(u => u.id === editingUserId);
      modalTitle.textContent = 'Editar usuario';
      modalPasswordField.style.display = 'none';
      nameInput.value = user.nombre;
      emailInput2.value = user.email;
      document.querySelectorAll('.permiso-item input').forEach(c => {
        c.checked = user.apps.includes(c.value);
      });
    } else {
      modalTitle.textContent = 'Nuevo usuario';
      modalPasswordField.style.display = 'flex';
    }

    modalOverlay.classList.add('show');
    nameInput.focus();
  }

  function closeModal(){
    modalOverlay.classList.remove('show');
    editingUserId = null;
  }

  document.getElementById('btn-new-user').addEventListener('click', () => openModal(null));
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  userForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const nombre = nameInput.value.trim();
    const email = emailInput2.value.trim();
    const apps = Array.from(document.querySelectorAll('.permiso-item input:checked')).map(c => c.value);

    if (!nombre || !email){
      return;
    }

    if (editingUserId){
      const user = usersData.find(u => u.id === editingUserId);
      user.nombre = nombre;
      user.email = email;
      user.apps = apps;
    } else {
      usersData.push({
        id: nextUserId++,
        nombre,
        email,
        apps,
        superAdmin: false,
        activo: true
      });
      // Nota: acá es donde, al conectar Supabase, además de guardar en la
      // tabla usuarios/permisos, invitarías al usuario por email con
      // supabaseClient.auth.admin.inviteUserByEmail() desde un backend
      // (esa función necesita la service_role key, nunca en el frontend).
    }

    renderUsers();
    closeModal();
  });

  renderUsers();

  // ---------------------------------------------------------
  // NOTIFICACIONES
  // ---------------------------------------------------------
  const notifBtn = document.getElementById('notif-btn');
  const notifPanel = document.getElementById('notif-panel');
  const notifDot = document.getElementById('notif-dot');
  const notifMarkRead = document.getElementById('notif-mark-read');

  function toggleNotifPanel(){
    const isOpen = notifPanel.classList.toggle('show');
    notifBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  }
  function closeNotifPanel(){
    notifPanel.classList.remove('show');
    notifBtn.setAttribute('aria-expanded', 'false');
  }

  notifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleNotifPanel();
  });

  // Cerrar al hacer click afuera del panel
  document.addEventListener('click', (e) => {
    if (!notifPanel.contains(e.target) && e.target !== notifBtn){
      closeNotifPanel();
    }
  });

  // Cerrar con la tecla Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNotifPanel();
  });

  notifMarkRead.addEventListener('click', () => {
    document.querySelectorAll('.notif-item.unread').forEach(item => {
      item.classList.remove('unread');
    });
    if (notifDot) notifDot.style.display = 'none';
  });

const supabaseClient = window.BlackPortal.getSupabase();

  // Verificar sesión activa; si no hay, volver al login
  (async () => {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) {
      window.location.href = "index.html";
      return;
    }
    const email = session.user.email || "";
    const nameFromEmail = email.split('@')[0].split('.')[0];
    const displayName = nameFromEmail.charAt(0).toUpperCase() + nameFromEmail.slice(1);
    const initials = displayName.slice(0, 2).toUpperCase();

    document.getElementById('user-name').textContent = displayName;
    document.getElementById('user-avatar').textContent = initials;

    const greetingEl = document.getElementById('greeting');
    if (greetingEl) greetingEl.textContent = 'Bienvenido, ' + displayName;
  })();

  // Cerrar sesión
  document.getElementById('logout-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (supabaseClient) {
      await supabaseClient.auth.signOut();
    }
    window.location.href = "index.html";
  });

// Las tarjetas de módulos pueden abrir vistas internas igual que el menú lateral.
  document.querySelectorAll('.app-card[data-view]').forEach(card => {
    card.addEventListener('click', (e) => {
      e.preventDefault();
      const target = card.dataset.view;
      if (!target) return;

      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
      const targetView = document.getElementById(`view-${target}`);
      if (targetView) targetView.classList.add('active');

      document.querySelectorAll('.nav-item[data-view]').forEach(n => {
        n.classList.toggle('active', n.dataset.view === target);
      });

      const titles = {
        inicio: 'Inicio',
        usuarios: 'Usuarios',
        'crm-oftalmologos': 'CRM Oftalmólogos'
      };
      const titleEl = document.getElementById('topbar-title');
      if (titleEl && titles[target]) titleEl.textContent = titles[target];

      if (window.innerWidth <= 860) {
        sidebar.classList.remove('open');
        overlay.classList.remove('show');
      }
    });
  });
