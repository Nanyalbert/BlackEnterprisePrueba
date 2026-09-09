// Black Óptica — configuración compartida de Supabase
(() => {
  const SUPABASE_URL = "https://tjetppyqyzgxfhpuyoet.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_YCXt4mKeFDDso1N4wjtHxw_GK53l9gq";

  window.BlackPortal = window.BlackPortal || {};
  window.BlackPortal.SUPABASE_URL = SUPABASE_URL;
  window.BlackPortal.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  window.BlackPortal.getSupabase = function () {
    if (!window.supabase) throw new Error("La librería de Supabase no está disponible.");
    if (!window.BlackPortal.supabaseClient) {
      window.BlackPortal.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    }
    return window.BlackPortal.supabaseClient;
  };

  const path = window.location.pathname;

  const loadCss = (id, href) => {
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  };

  const loadJs = (id, src, onload) => {
    if (document.getElementById(id)) return;
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    if (onload) script.onload = onload;
    (document.body || document.head || document.documentElement).appendChild(script);
  };

  const isOphthalmologyModule = /(?:^|\/)crm-oftalmologos\.html$/i.test(path);
  if (isOphthalmologyModule) {
    loadCss('blackos-oft-branches-css', 'assets/css/crm-oftalmologos-sucursales.css?v=20260907e');
    loadCss('blackos-oft-polish-css', 'assets/css/crm-oftalmologos-polish.css?v=20260907e');
    window.addEventListener('load', () => {
      loadJs('blackos-oft-branches-js', 'assets/js/crm-oftalmologos-sucursales.js?v=20260907e', () => {
        loadJs('blackos-oft-supabase-sync-js', 'assets/js/crm-oftalmologos-supabase-sync.js?v=20260907e');
      });
    }, { once:true });
  }

  const isClientsModule = /(?:^|\/)crm-clientes\.html$/i.test(path);
  if (isClientsModule) {
    loadCss('blackos-crm-clientes-polish-css', 'assets/css/crm-clientes-polish.css?v=20260909b');
    loadCss('blackos-crm-clientes-ops-css', 'assets/css/crm-clientes-ops.css?v=20260909b');
    loadJs('blackos-crm-clientes-polish-js', 'assets/js/crm-clientes-polish.js?v=20260909b');
    window.addEventListener('load', () => {
      loadJs('blackos-crm-clientes-ops-js', 'assets/js/crm-clientes-ops.js?v=20260909b');
    }, { once:true });
  }
})();
