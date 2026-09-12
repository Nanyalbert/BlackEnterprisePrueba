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
    if (document.getElementById(id)) {
      if (onload) onload();
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = false;
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
    document.documentElement.classList.add('crm-ops-preload');
    const preloadStyle = document.createElement('style');
    preloadStyle.id = 'blackos-crm-preload-style';
    preloadStyle.textContent = `
      html.crm-ops-preload body{background:#0e0e10!important;}
      html.crm-ops-preload .bottom-nav,
      html.crm-ops-preload .fab,
      html.crm-ops-preload .day-summary,
      html.crm-ops-preload #mainContent{visibility:hidden!important;}
    `;
    document.head.appendChild(preloadStyle);

    loadCss('blackos-crm-clientes-polish-css', 'assets/css/crm-clientes-polish.css?v=20260912a');
    loadCss('blackos-crm-clientes-ops-css', 'assets/css/crm-clientes-ops.css?v=20260912a');
    loadJs('blackos-crm-clientes-polish-js', 'assets/js/crm-clientes-polish.js?v=20260912a');

    const bootClientsLayer = () => {
      loadJs('blackos-crm-clientes-whatsapp-fix-js', 'assets/js/crm-clientes-whatsapp-fix.js?v=20260912a', () => {
        loadJs('blackos-crm-clientes-ops-js', 'assets/js/crm-clientes-ops.js?v=20260912a');
      });
    };

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootClientsLayer, { once:true });
    } else {
      bootClientsLayer();
    }
  }

  const isBlackAiModule = /(?:^|\/)black-ai\.html$/i.test(path);
  if (isBlackAiModule) {
    const bootBlackAiFix = () => {
      loadJs('blackos-black-ai-chat-fix-js', 'assets/js/black-ai-chat-fix.js?v=20260912c');
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootBlackAiFix, { once:true });
    } else {
      bootBlackAiFix();
    }
  }
})();
