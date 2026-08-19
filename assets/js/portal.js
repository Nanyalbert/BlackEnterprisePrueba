// Black Óptica — Portal principal

// =========================================================
// 01. ELEMENTOS BASE
// =========================================================

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuToggle = document.getElementById('menu-toggle');
const topbarTitle =
  document.getElementById('topbar-title') ||
  document.querySelector('.topbar-title');

const TITLES = {
  inicio: 'Inicio',
  usuarios: 'Usuarios',
  'crm-clientes': 'CRM Black',
  'crm-oftalmologos': 'CRM Oftalmólogos'
};


// =========================================================
// 02. SIDEBAR MOBILE
// =========================================================

function openSidebar() {
  if (sidebar) sidebar.classList.add('open');
  if (overlay) overlay.classList.add('show');
}

function closeSidebar() {
  if (sidebar) sidebar.classList.remove('open');
  if (overlay) overlay.classList.remove('show');
}

if (menuToggle) {
  menuToggle.addEventListener('click', openSidebar);
}

if (overlay) {
  overlay.addEventListener('click', closeSidebar);
}


// =========================================================
// 03. NAVEGACIÓN ENTRE VISTAS
// =========================================================

const viewLinks = document.querySelectorAll('.nav-item[data-view]');
const appCards = document.querySelectorAll('.app-card[data-view]');

function showView(viewName) {
  const target = document.getElementById('view-' + viewName);

  if (!target) {
    console.warn('No existe la vista:', viewName);
    return;
  }

  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });

  target.classList.add('active');

  viewLinks.forEach(link => {
    link.classList.toggle(
      'active',
      link.dataset.view === viewName
    );
  });

  if (topbarTitle) {
    topbarTitle.textContent =
      TITLES[viewName] || 'Inicio';
  }

  try {
    sessionStorage.setItem(
      'blackportal_active_view',
      viewName
    );
  } catch (err) {
    console.warn(
      'No se pudo guardar la vista activa:',
      err
    );
  }

  closeSidebar();
}

viewLinks.forEach(link => {
  link.addEventListener('click', event => {
    event.preventDefault();

    const viewName = link.dataset.view;

    if (!viewName) return;

    showView(viewName);
  });
});

appCards.forEach(card => {
  card.addEventListener('click', event => {
    event.preventDefault();

    const viewName = card.dataset.view;

    if (!viewName) return;

    showView(viewName);
  });
});


// =========================================================
// 04. GESTIÓN DE USUARIOS
// Datos locales de interfaz.
// IMPORTANTE:
// Esto todavía NO crea usuarios reales en Supabase Auth.
// =========================================================

const APP_LABELS = {
  'crm-black': 'CRM Black',
  administracion: 'Administración',
  'crm-oftalmologos': 'CRM Oftalmólogos'
};

let usersData = [
  {
    id: 1,
    nombre: 'Leandro',
    email: 'leandro@blackoptica.ar',
    apps: [
      'crm-black',
      'administracion',
      'crm-oftalmologos'
    ],
    superAdmin: true,
    activo: true
  },
  {
    id: 2,
    nombre: 'Recepción Óptica',
    email: 'recepcion@blackoptica.ar',
    apps: ['administracion'],
    superAdmin: false,
    activo: true
  },
  {
    id: 3,
    nombre: 'Dr. Gómez',
    email: 'gomez@ejemplo.com',
    apps: ['crm-oftalmologos'],
    superAdmin: false,
    activo: true
  }
];

let nextUserId = 4;
let editingUserId = null;

function initials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function renderUsers() {
  const tbody =
    document.getElementById('users-tbody');

  const countEl =
    document.getElementById('users-count');

  if (!tbody || !countEl) return;

  countEl.textContent =
    usersData.length +
    (usersData.length === 1
      ? ' usuario'
      : ' usuarios');

  if (usersData.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4">
          <div class="empty-state">
            Todavía no diste de alta ningún usuario.
          </div>
        </td>
      </tr>
    `;

    return;
  }

  tbody.innerHTML = usersData.map(user => {

    const badges = user.superAdmin
      ? `
        <span class="badge super">
          Acceso total
        </span>
      `
      : (
          user.apps.length
            ? user.apps
                .map(app => `
                  <span class="badge">
                    ${APP_LABELS[app] || app}
                  </span>
                `)
                .join('')
            : `
              <span class="badge">
                Sin accesos
              </span>
            `
        );

    return `
      <tr data-id="${user.id}">

        <td>
          <div class="user-cell">

            <div class="avatar">
              ${initials(user.nombre)}
            </div>

            <div>
              <div class="user-cell-name">
                ${user.nombre}
              </div>

              <div class="user-cell-email">
                ${user.email}
              </div>
            </div>

          </div>
        </td>

        <td>
          ${badges}
        </td>

        <td>
          <span
            class="status-dot ${
              user.activo
                ? ''
                : 'inactive'
            }"
          >
            ${
              user.activo
                ? 'Activo'
                : 'Inactivo'
            }
          </span>
        </td>

        <td>

          <div class="row-actions">

            <button
              type="button"
              class="edit-user"
              aria-label="Editar"
              title="Editar"
            >

              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <path
                  d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                />
                <path
                  d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z"
                />
              </svg>

            </button>

            <button
              type="button"
              class="danger delete-user"
              aria-label="Eliminar"
              title="Eliminar"
            >

              <svg
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >

                <polyline
                  points="3 6 5 6 21 6"
                />

                <path
                  d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"
                />

                <path d="M10 11v6" />
                <path d="M14 11v6" />

                <path
                  d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
                />

              </svg>

            </button>

          </div>

        </td>

      </tr>
    `;
  }).join('');

  tbody
    .querySelectorAll('.edit-user')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const row =
            button.closest('tr');

          if (!row) return;

          openModal(
            Number(row.dataset.id)
          );
        }
      );
    });

  tbody
    .querySelectorAll('.delete-user')
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const row =
            button.closest('tr');

          if (!row) return;

          const id =
            Number(row.dataset.id);

          const user =
            usersData.find(
              item =>
                item.id === id
            );

          if (
            user &&
            confirm(
              `¿Eliminar a ${user.nombre}? Va a perder el acceso al portal.`
            )
          ) {

            usersData =
              usersData.filter(
                item =>
                  item.id !== id
              );

            renderUsers();
          }
        }
      );
    });
}


// =========================================================
// 05. MODAL DE USUARIOS
// =========================================================

const modalOverlay =
  document.getElementById(
    'user-modal-overlay'
  );

const modalTitle =
  document.getElementById(
    'modal-title'
  );

const modalPasswordField =
  document.getElementById(
    'modal-password-field'
  );

const userForm =
  document.getElementById(
    'user-form'
  );

const nameInput =
  document.getElementById(
    'modal-name'
  );

const emailInput2 =
  document.getElementById(
    'modal-email'
  );

function openModal(userId) {

  if (
    !modalOverlay ||
    !userForm ||
    !modalTitle ||
    !modalPasswordField ||
    !nameInput ||
    !emailInput2
  ) {
    return;
  }

  editingUserId =
    userId || null;

  userForm.reset();

  document
    .querySelectorAll(
      '.permiso-item input'
    )
    .forEach(input => {
      input.checked = false;
    });

  if (editingUserId) {

    const user =
      usersData.find(
        item =>
          item.id ===
          editingUserId
      );

    if (!user) return;

    modalTitle.textContent =
      'Editar usuario';

    modalPasswordField.style.display =
      'none';

    nameInput.value =
      user.nombre;

    emailInput2.value =
      user.email;

    document
      .querySelectorAll(
        '.permiso-item input'
      )
      .forEach(input => {

        input.checked =
          user.apps.includes(
            input.value
          );
      });

  } else {

    modalTitle.textContent =
      'Nuevo usuario';

    modalPasswordField.style.display =
      'flex';
  }

  modalOverlay.classList.add(
    'show'
  );

  nameInput.focus();
}

function closeModal() {

  if (modalOverlay) {
    modalOverlay.classList.remove(
      'show'
    );
  }

  editingUserId = null;
}

const btnNewUser =
  document.getElementById(
    'btn-new-user'
  );

const modalClose =
  document.getElementById(
    'modal-close'
  );

const modalCancel =
  document.getElementById(
    'modal-cancel'
  );

if (btnNewUser) {

  btnNewUser.addEventListener(
    'click',
    () => openModal(null)
  );
}

if (modalClose) {

  modalClose.addEventListener(
    'click',
    closeModal
  );
}

if (modalCancel) {

  modalCancel.addEventListener(
    'click',
    closeModal
  );
}

if (modalOverlay) {

  modalOverlay.addEventListener(
    'click',
    event => {

      if (
        event.target ===
        modalOverlay
      ) {
        closeModal();
      }
    }
  );
}

if (userForm) {

  userForm.addEventListener(
    'submit',
    event => {

      event.preventDefault();

      const nombre =
        nameInput
          ? nameInput.value.trim()
          : '';

      const email =
        emailInput2
          ? emailInput2.value.trim()
          : '';

      const apps =
        Array.from(
          document.querySelectorAll(
            '.permiso-item input:checked'
          )
        ).map(
          input =>
            input.value
        );

      if (
        !nombre ||
        !email
      ) {
        return;
      }

      if (editingUserId) {

        const user =
          usersData.find(
            item =>
              item.id ===
              editingUserId
          );

        if (!user) return;

        user.nombre =
          nombre;

        user.email =
          email;

        user.apps =
          apps;

      } else {

        usersData.push({
          id: nextUserId++,
          nombre,
          email,
          apps,
          superAdmin: false,
          activo: true
        });
      }

      renderUsers();

      closeModal();
    }
  );
}

renderUsers();


// =========================================================
// 06. NOTIFICACIONES
// =========================================================

const notifBtn =
  document.getElementById(
    'notif-btn'
  );

const notifPanel =
  document.getElementById(
    'notif-panel'
  );

const notifDot =
  document.getElementById(
    'notif-dot'
  );

const notifMarkRead =
  document.getElementById(
    'notif-mark-read'
  );

function toggleNotifPanel() {

  if (
    !notifPanel ||
    !notifBtn
  ) {
    return;
  }

  const isOpen =
    notifPanel.classList.toggle(
      'show'
    );

  notifBtn.setAttribute(
    'aria-expanded',
    isOpen
      ? 'true'
      : 'false'
  );
}

function closeNotifPanel() {

  if (
    !notifPanel ||
    !notifBtn
  ) {
    return;
  }

  notifPanel.classList.remove(
    'show'
  );

  notifBtn.setAttribute(
    'aria-expanded',
    'false'
  );
}

if (notifBtn) {

  notifBtn.addEventListener(
    'click',
    event => {

      event.stopPropagation();

      toggleNotifPanel();
    }
  );
}

document.addEventListener(
  'click',
  event => {

    if (
      !notifPanel ||
      !notifBtn
    ) {
      return;
    }

    if (
      !notifPanel.contains(
        event.target
      ) &&
      !notifBtn.contains(
        event.target
      )
    ) {

      closeNotifPanel();
    }
  }
);

document.addEventListener(
  'keydown',
  event => {

    if (
      event.key ===
      'Escape'
    ) {

      closeNotifPanel();

      closeSidebar();
    }
  }
);

if (notifMarkRead) {

  notifMarkRead.addEventListener(
    'click',
    () => {

      document
        .querySelectorAll(
          '.notif-item.unread'
        )
        .forEach(item => {

          item.classList.remove(
            'unread'
          );
        });

      if (notifDot) {

        notifDot.style.display =
          'none';
      }
    }
  );
}


// =========================================================
// 07. SUPABASE / SESIÓN
// =========================================================

let supabaseClient = null;

try {

  if (
    !window.BlackPortal ||
    typeof window.BlackPortal.getSupabase !==
      'function'
  ) {

    throw new Error(
      'BlackPortal / Supabase config no está disponible.'
    );
  }

  supabaseClient =
    window.BlackPortal.getSupabase();

} catch (error) {

  console.error(
    'No se pudo inicializar Supabase en el portal:',
    error
  );
}

async function bootPortal() {

  if (!supabaseClient) {

    window.location.replace(
      'index.html'
    );

    return;
  }

  try {

    const {
      data: {
        session
      },
      error
    } =
      await supabaseClient.auth.getSession();

    if (error) {

      console.error(
        'Error verificando la sesión:',
        error
      );

      window.location.replace(
        'index.html'
      );

      return;
    }

    if (!session) {

      window.location.replace(
        'index.html'
      );

      return;
    }

    const email =
      session.user.email || '';

    const rawName =
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      email
        .split('@')[0]
        .replace(
          /[._-]+/g,
          ' '
        );

    const displayName =
      rawName
        .split(' ')
        .filter(Boolean)
        .map(
          part =>
            part
              .charAt(0)
              .toUpperCase() +
            part.slice(1)
        )
        .join(' ');

    const userName =
      document.getElementById(
        'user-name'
      );

    const userAvatar =
      document.getElementById(
        'user-avatar'
      );

    const greeting =
      document.getElementById(
        'greeting'
      );

    if (userName) {

      userName.textContent =
        displayName || email;
    }

    if (userAvatar) {

      userAvatar.textContent =
        initials(
          displayName || email
        );
    }

    if (greeting) {

      greeting.textContent =
        displayName
          ? `Bienvenido, ${displayName}`
          : 'Bienvenido';
    }

    let initialView =
      'inicio';

    try {

      const savedView =
        sessionStorage.getItem(
          'blackportal_active_view'
        );

      if (
        savedView &&
        document.getElementById(
          'view-' +
          savedView
        )
      ) {

        initialView =
          savedView;
      }

    } catch (err) {

      console.warn(
        'No se pudo recuperar la vista activa:',
        err
      );
    }

    showView(
      initialView
    );

  } catch (error) {

    console.error(
      'Error iniciando el Portal Black:',
      error
    );

    window.location.replace(
      'index.html'
    );
  }
}

bootPortal();


// =========================================================
// 08. CERRAR SESIÓN
// =========================================================

const logoutBtn =
  document.getElementById(
    'logout-btn'
  );

if (logoutBtn) {

  logoutBtn.addEventListener(
    'click',
    async event => {

      event.preventDefault();

      try {

        sessionStorage.removeItem(
          'blackportal_active_view'
        );

      } catch (err) {

        console.warn(
          'No se pudo limpiar la vista activa:',
          err
        );
      }

      if (supabaseClient) {

        try {

          await supabaseClient.auth.signOut();

        } catch (error) {

          console.error(
            'Error cerrando sesión:',
            error
          );
        }
      }

      window.location.replace(
        'index.html'
      );
    }
  );
}
