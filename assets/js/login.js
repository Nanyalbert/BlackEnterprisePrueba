// Black Óptica — Login

// ---------------------------------------------------------
  // CONFIGURACIÓN DE SUPABASE
  // Reemplazá estos dos valores por los de tu proyecto:
  // Settings → API → Project URL / anon public key
  // ---------------------------------------------------------
  let supabaseClient = null;
  try {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    console.warn('Supabase todavía no está configurado (reemplazá las claves en index.html).', err);
  }

  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = document.getElementById('submit-btn');
  const errorMsg = document.getElementById('error-msg');
  const errorText = document.getElementById('error-text');
  const togglePass = document.getElementById('toggle-pass');
  const forgotLink = document.getElementById('forgot-link');

  // Mostrar / ocultar contraseña
  togglePass.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    togglePass.setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
  });

  function showError(message){
    errorText.textContent = message;
    errorMsg.classList.add('show');
  }
  function hideError(){
    errorMsg.classList.remove('show');
  }
  function setLoading(isLoading){
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle('loading', isLoading);
  }

  // Si ya hay sesión activa, saltar directo al menú
  (async () => {
    if (!supabaseClient) return;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
      window.location.href = "menu.html";
    }
  })();

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();

    if (!supabaseClient){
      showError('El portal todavía no está conectado a Supabase. Completá las claves en el código.');
      return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password){
      showError('Completá usuario y contraseña.');
      return;
    }

    setLoading(true);

    const { data, error } = await supabaseClient.auth.signInWithPassword({
      email: email,
      password: password
    });

    setLoading(false);

    if (error){
      if (error.message.includes('Invalid login credentials')){
        showError('Usuario o contraseña incorrectos.');
      } else {
        showError('No se pudo iniciar sesión. Intentá de nuevo.');
      }
      return;
    }

    // Login correcto → redirigir al menú de accesos
    window.location.href = "menu.html";
  });

  forgotLink.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!supabaseClient){
      showError('El portal todavía no está conectado a Supabase.');
      return;
    }
    const email = emailInput.value.trim();
    if (!email){
      showError('Ingresá tu email arriba y volvé a tocar "Olvidé mi contraseña".');
      return;
    }
    const { error } = await supabaseClient.auth.resetPasswordForEmail(email);
    if (error){
      showError('No se pudo enviar el email de recuperación.');
    } else {
      showError('Te enviamos un email para restablecer tu contraseña.');
      errorMsg.style.color = 'var(--text-1)';
      errorMsg.style.borderColor = 'var(--line-strong)';
      errorMsg.style.background = 'var(--bg-card)';
    }
  });
