// Black Óptica — Login

// =========================================================
// 01. SUPABASE
// =========================================================

let supabaseClient = null;

try {
  if (!window.BlackPortal || typeof window.BlackPortal.getSupabase !== 'function') {
    throw new Error('BlackPortal / Supabase config no está disponible.');
  }

  supabaseClient = window.BlackPortal.getSupabase();
} catch (err) {
  console.error('No se pudo inicializar Supabase:', err);
}


// =========================================================
// 02. ELEMENTOS DEL DOM
// =========================================================

const form = document.getElementById('login-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submit-btn');
const errorMsg = document.getElementById('error-msg');
const errorText = document.getElementById('error-text');
const togglePass = document.getElementById('toggle-pass');
const forgotLink = document.getElementById('forgot-link');


// =========================================================
// 03. HELPERS
// =========================================================

function showError(message) {
  errorText.textContent = message;
  errorMsg.classList.add('show');
}

function hideError() {
  errorMsg.classList.remove('show');

  // Restablecer estilo normal del mensaje de error
  errorMsg.style.color = '';
  errorMsg.style.borderColor = '';
  errorMsg.style.background = '';
}

function showSuccess(message) {
  errorText.textContent = message;
  errorMsg.classList.add('show');

  errorMsg.style.color = 'var(--text-1)';
  errorMsg.style.borderColor = 'var(--line-strong)';
  errorMsg.style.background = 'var(--bg-card)';
}

function setLoading(isLoading) {
  submitBtn.disabled = isLoading;
  submitBtn.classList.toggle('loading', isLoading);
}


// =========================================================
// 04. MOSTRAR / OCULTAR CONTRASEÑA
// =========================================================

if (togglePass) {
  togglePass.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';

    passwordInput.type = isPassword ? 'text' : 'password';

    togglePass.setAttribute(
      'aria-label',
      isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'
    );
  });
}


// =========================================================
// 05. VERIFICAR SESIÓN EXISTENTE
// =========================================================

async function checkExistingSession() {
  if (!supabaseClient) {
    return;
  }

  try {
    const {
      data: { session },
      error
    } = await supabaseClient.auth.getSession();

    if (error) {
      console.error('Error verificando sesión:', error);
      return;
    }

    if (session) {
      window.location.replace('menu.html');
    }
  } catch (err) {
    console.error('No se pudo verificar la sesión:', err);
  }
}

checkExistingSession();


// =========================================================
// 06. LOGIN
// =========================================================

if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    hideError();

    if (!supabaseClient) {
      showError(
        'No se pudo conectar con Supabase. Revisá la configuración del portal.'
      );
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
      showError('Completá usuario y contraseña.');
      return;
    }

    setLoading(true);

    try {
      const { data, error } =
        await supabaseClient.auth.signInWithPassword({
          email,
          password
        });

      if (error) {
        if (
          error.message &&
          error.message.toLowerCase().includes('invalid login credentials')
        ) {
          showError('Usuario o contraseña incorrectos.');
        } else if (
          error.message &&
          error.message.toLowerCase().includes('email not confirmed')
        ) {
          showError('El email todavía no fue confirmado.');
        } else {
          console.error('Error de login:', error);
          showError('No se pudo iniciar sesión. Intentá nuevamente.');
        }

        return;
      }

      if (!data?.session) {
        showError('No se pudo iniciar la sesión.');
        return;
      }

      window.location.replace('menu.html');

    } catch (err) {
      console.error('Error inesperado durante el login:', err);

      showError(
        'Ocurrió un error al iniciar sesión. Intentá nuevamente.'
      );

    } finally {
      setLoading(false);
    }
  });
}


// =========================================================
// 07. RECUPERAR CONTRASEÑA
// =========================================================

if (forgotLink) {
  forgotLink.addEventListener('click', async (e) => {
    e.preventDefault();

    hideError();

    if (!supabaseClient) {
      showError('No se pudo conectar con Supabase.');
      return;
    }

    const email = emailInput.value.trim();

    if (!email) {
      showError(
        'Ingresá tu email arriba y volvé a tocar "Olvidé mi contraseña".'
      );
      return;
    }

    try {
      const { error } =
        await supabaseClient.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}${window.location.pathname}`
        });

      if (error) {
        console.error('Error enviando recuperación:', error);

        showError(
          'No se pudo enviar el email de recuperación.'
        );

        return;
      }

      showSuccess(
        'Te enviamos un email para restablecer tu contraseña.'
      );

    } catch (err) {
      console.error(
        'Error inesperado recuperando contraseña:',
        err
      );

      showError(
        'No se pudo enviar el email de recuperación.'
      );
    }
  });
}
