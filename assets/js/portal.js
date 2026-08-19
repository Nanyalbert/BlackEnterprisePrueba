// Black Óptica — Portal principal


// =========================================================
// 01. ELEMENTOS BASE
// =========================================================

const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
const menuToggle = document.getElementById('menu-toggle');

const mainContent = document.querySelector('.content');

const topbarTitle =
  document.getElementById('topbar-title') ||
  document.querySelector('.topbar-title');

const DESKTOP_BREAKPOINT = 900;

const SIDEBAR_STORAGE_KEY =
  'blackportal_sidebar_collapsed';

const VIEW_STORAGE_KEY =
  'blackportal_active_view';


const TITLES = {
  inicio: 'Inicio',
  usuarios: 'Usuarios',
  'crm-clientes': 'CRM Black',
  'crm-oftalmologos': 'CRM Oftalmólogos'
};


const MODULE_VIEWS = [
  'crm-clientes',
  'crm-oftalmologos'
];


// =========================================================
// 02. HELPERS
// =========================================================

function isMobileLayout() {
  return window.innerWidth <= DESKTOP_BREAKPOINT;
}


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


// =========================================================
// 03. SIDEBAR
// =========================================================

function openMobileSidebar() {

  if (!sidebar) return;

  sidebar.classList.add('open');

  if (overlay) {
    overlay.classList.add('show');
  }

  if (menuToggle) {
    menuToggle.setAttribute(
      'aria-expanded',
      'true'
    );

    menuToggle.setAttribute(
      'aria-label',
      'Cerrar menú'
    );
  }
}


function closeMobileSidebar() {

  if (sidebar) {
    sidebar.classList.remove('open');
  }

  if (overlay) {
    overlay.classList.remove('show');
  }

  if (menuToggle) {
    menuToggle.setAttribute(
      'aria-expanded',
      'false'
    );

    menuToggle.setAttribute(
      'aria-label',
      'Abrir menú'
    );
  }
}


function setDesktopCollapsed(collapsed) {

  document.body.classList.toggle(
    'sidebar-collapsed',
    collapsed
  );

  try {

    localStorage.setItem(
      SIDEBAR_STORAGE_KEY,
      collapsed ? '1' : '0'
    );

  } catch (error) {

    console.warn(
      'No se pudo guardar el estado del sidebar:',
      error
    );
  }

  if (menuToggle) {

    menuToggle.setAttribute(
      'aria-expanded',
      collapsed ? 'false' : 'true'
    );

    menuToggle.setAttribute(
      'aria-label',
      collapsed
        ? 'Expandir menú lateral'
        : 'Contraer menú lateral'
    );
  }
}


function toggleSidebar() {

  if (isMobileLayout()) {

    const isOpen =
      sidebar &&
      sidebar.classList.contains('open');

    if (isOpen) {
      closeMobileSidebar();
    } else {
      openMobileSidebar();
    }

    return;
  }


  const collapsed =
    document.body.classList.contains(
      'sidebar-collapsed'
    );

  setDesktopCollapsed(!collapsed);
}


function restoreSidebarPreference() {

  if (isMobileLayout()) {

    closeMobileSidebar();

    return;
  }


  let collapsed = false;

  try {

    collapsed =
      localStorage.getItem(
        SIDEBAR_STORAGE_KEY
      ) === '1';

  } catch (error) {

    collapsed = false;
  }

  setDesktopCollapsed(collapsed);
}


if (menuToggle) {

  menuToggle.addEventListener(
    'click',
    toggleSidebar
  );
}


if (overlay) {

  overlay.addEventListener(
    'click',
    closeMobileSidebar
  );
}


// =========================================================
// 04. TOOLTIPS NATIVOS DEL SIDEBAR
// =========================================================

document
  .querySelectorAll('.sidebar .nav-item')
  .forEach(item => {

    const label =
      item.textContent
        .replace(/\s+/g, ' ')
        .trim();

    if (label && !item.title) {
      item.title = label;
    }

    if (label && !item.getAttribute('aria-label')) {
      item.setAttribute(
        'aria-label',
        label
      );
    }
  });


// =========================================================
// 05. NAVEGACIÓN
// =========================================================

const viewLinks =
  document.querySelectorAll(
    '.nav-item[data-view]'
  );

const appCards =
  document.querySelectorAll(
    '.app-card[data-view]'
  );


function showView(viewName) {

  const target =
    document.getElementById(
      'view-' + viewName
    );


  if (!target) {

    console.warn(
      'No existe la vista:',
      viewName
    );

    return;
  }


  document
    .querySelectorAll('.view')
    .forEach(view => {
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
      TITLES[viewName] ||
      'Inicio';
  }


  if (mainContent) {

    mainContent.classList.toggle(
      'module-mode',
      MODULE_VIEWS.includes(viewName)
    );
  }


  try {

    sessionStorage.setItem(
      VIEW_STORAGE_KEY,
      viewName
    );

  } catch (error) {

    console.warn(
      'No se pudo guardar la vista activa:',
      error
    );
  }


  if (isMobileLayout()) {

    closeMobileSidebar();
  }
}


viewLinks.forEach(link => {

  link.addEventListener(
    'click',
    event => {

      event.preventDefault();

      const viewName =
        link.dataset.view;

      if (!viewName) return;

      showView(viewName);
    }
  );
});


appCards.forEach(card => {

  card.addEventListener(
    'click',
    event => {

      event.preventDefault();

      const viewName =
        card.dataset.view;

      if (!viewName) return;

      showView(viewName);
    }
  );
});


// =========================================================
// 06. GESTIÓN DE USUARIOS
//
// Sigue siendo interfaz local.
// Todavía NO crea usuarios reales en Supabase Auth.
// =========================================================

const APP_LABELS = {
  'crm-black': 'CRM Black',
  administracion: 'Administración',
  'crm-oftalmologos': 'CRM Oftalmólogos'
};


let usersData = [
  {
    id:1,
    nombre:'Leandro',
    email:'leandro@blackoptica.ar',
    apps:[
      'crm-black',
      'administracion',
      'crm-oftalmologos'
    ],
    superAdmin:true,
    activo:true
  },
  {
    id:2,
    nombre:'Recepción Óptica',
    email:'recepcion@blackoptica.ar',
    apps:[
      'administracion'
    ],
    superAdmin:false,
    activo:true
  },
  {
    id:3,
    nombre:'Dr. Gómez',
    email:'gomez@ejemplo.com',
    apps:[
      'crm-oftalmologos'
    ],
    superAdmin:false,
    activo:true
  }
];


let nextUserId = 4;
let editingUserId = null;


function renderUsers() {

  const tbody =
    document.getElementById(
      'users-tbody'
    );

  const countEl =
    document.getElementById(
      'users-count'
    );


  if (!tbody || !countEl) return;


  countEl.textContent =
    usersData.length +
    (
      usersData.length === 1
        ? ' usuario'
        : ' usuarios'
    );


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


  tbody.innerHTML =
    usersData
      .map(user => {

        const badges =
          user.superAdmin
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
                  title="Editar"
                  aria-label="Editar"
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
                  title="Eliminar"
                  aria-label="Eliminar"
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
      })
      .join('');


  tbody
    .querySelectorAll(
      '.edit-user'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const row =
            button.closest('tr');

          if (!row) return;

          openModal(
            Number(
              row.dataset.id
            )
          );
        }
      );
    });


  tbody
    .querySelectorAll(
      '.delete-user'
    )
    .forEach(button => {

      button.addEventListener(
        'click',
        () => {

          const row =
            button.closest('tr');

          if (!row) return;

          const id =
            Number(
              row.dataset.id
            );

          const user =
            usersData.find(
              item =>
                item.id === id
            );

          if (!user) return;


          const confirmed =
            confirm(
              `¿Eliminar a ${user.nombre}? Va a perder el acceso al portal.`
            );


          if (!confirmed) return;


          usersData =
            usersData.filter(
              item =>
                item.id !== id
            );


          renderUsers();
        }
      );
    });
}


// =========================================================
// 07. MODAL USUARIOS
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

const emailInput =
  document.getElementById(
    'modal-email'
  );

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


function openModal(userId = null) {

  if (
    !modalOverlay ||
    !userForm ||
    !modalTitle ||
    !modalPasswordField ||
    !nameInput ||
    !emailInput
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


    emailInput.value =
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


  setTimeout(
    () => nameInput.focus(),
    50
  );
}


function closeModal() {

  if (modalOverlay) {

    modalOverlay.classList.remove(
      'show'
    );
  }


  editingUserId = null;
}


if (btnNewUser) {

  btnNewUser.addEventListener(
    'click',
    () => openModal()
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
        emailInput
          ? emailInput.value.trim()
          : '';


      const apps =
        Array
          .from(
            document.querySelectorAll(
              '.permiso-item input:checked'
            )
          )
          .map(
            input =>
              input.value
          );


      if (!nombre || !email) {

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


        user.nombre = nombre;
        user.email = email;
        user.apps = apps;

      } else {

        usersData.push({
          id:nextUserId++,
          nombre,
          email,
          apps,
          superAdmin:false,
          activo:true
        });
      }


      renderUsers();

      closeModal();
    }
  );
}


renderUsers();


// =========================================================
// 08. NOTIFICACIONES
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

  if (!notifPanel) return;


  notifPanel.classList.remove(
    'show'
  );


  if (notifBtn) {

    notifBtn.setAttribute(
      'aria-expanded',
      'false'
    );
  }
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
// 09. ESCAPE
// =========================================================

document.addEventListener(
  'keydown',
  event => {

    if (event.key !== 'Escape') {

      return;
    }


    closeNotifPanel();

    closeModal();


    if (isMobileLayout()) {

      closeMobileSidebar();
    }
  }
);


// =========================================================
// 10. SUPABASE
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


// =========================================================
// 11. INICIO DEL PORTAL
// =========================================================

async function bootPortal() {

  restoreSidebarPreference();


  if (!supabaseClient) {

    window.location.replace(
      'index.html'
    );

    return;
  }


  try {

    const {
      data:{
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
            part.charAt(0).toUpperCase() +
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
        displayName ||
        email;
    }


    if (userAvatar) {

      userAvatar.textContent =
        initials(
          displayName ||
          email
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
          VIEW_STORAGE_KEY
        );


      if (
        savedView &&
        document.getElementById(
          'view-' + savedView
        )
      ) {

        initialView =
          savedView;
      }

    } catch (error) {

      console.warn(
        'No se pudo recuperar la vista activa:',
        error
      );
    }


    showView(initialView);

  } catch (error) {

    console.error(
      'Error iniciando Portal Black:',
      error
    );


    window.location.replace(
      'index.html'
    );
  }
}


bootPortal();


// =========================================================
// 12. LOGOUT
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
          VIEW_STORAGE_KEY
        );

      } catch (error) {

        console.warn(
          'No se pudo limpiar la vista activa:',
          error
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


// =========================================================
// 13. CAMBIO DE TAMAÑO
// =========================================================

let lastMobileState =
  isMobileLayout();


window.addEventListener(
  'resize',
  () => {

    const mobileNow =
      isMobileLayout();


    if (
      mobileNow ===
      lastMobileState
    ) {

      return;
    }


    lastMobileState =
      mobileNow;


    if (mobileNow) {

      closeMobileSidebar();

    } else {

      closeMobileSidebar();

      restoreSidebarPreference();
    }
  }
);
