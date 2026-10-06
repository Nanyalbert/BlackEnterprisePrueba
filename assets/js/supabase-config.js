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

  window.BlackPortal.isSuperAdmin = function(user){
    const email=String(user?.email||'').toLowerCase();
    return email==='leandro@blackoptica.ar' || user?.app_metadata?.black_os_super_admin===true;
  };
  window.BlackPortal.canAccessModule = function(user,moduleId){
    if(!user) return false;
    if(window.BlackPortal.isSuperAdmin(user)) return true;
    if(user?.app_metadata?.black_os_active===false) return false;
    const meta=user?.app_metadata||{};
    const hasExplicitConfig=Object.prototype.hasOwnProperty.call(meta,'black_os_apps') || Object.prototype.hasOwnProperty.call(meta,'black_os_permissions');
    // Usuarios históricos: hasta que tengan permisos explícitos, mantienen el acceso que ya tenían.
    if(!hasExplicitConfig) return true;
    const apps=Array.isArray(meta.black_os_apps)?meta.black_os_apps:[];
    return apps.includes(moduleId);
  };

  const path = window.location.pathname;

  const moduleForPath = (() => {
    if(/(?:^|\/)crm-clientes\.html$/i.test(path)) return 'crm-black';
    if(/(?:^|\/)(?:administracion|proveedores)\.html$/i.test(path)) return 'administracion';
    if(/(?:^|\/)crm-oftalmologos\.html$/i.test(path)) return 'crm-oftalmologos';
    if(/(?:^|\/)marketing\.html$/i.test(path)) return 'marketing';
    if(/(?:^|\/)black-ai\.html$/i.test(path)) return 'catalogo';
    if(/(?:^|\/)recetas(?:\/|$)/i.test(path)) return 'recetas';
    return null;
  })();

  const enforceModuleAccess = async () => {
    if(!moduleForPath) return;
    try{
      const client=window.BlackPortal.getSupabase();
      const {data:{session}}=await client.auth.getSession();
      if(!session){
        if(window.top===window) window.location.replace('index.html');
        return;
      }
      const user=session.user;
      if(window.BlackPortal.canAccessModule(user,moduleForPath)) return;
      if(window.top===window){
        window.location.replace('menu.html?denied='+encodeURIComponent(moduleForPath));
        return;
      }
      document.body.innerHTML='<main style="min-height:100vh;display:grid;place-items:center;background:#080808;color:#eee;font-family:system-ui;padding:24px"><div style="max-width:460px;text-align:center"><h2 style="margin:0 0 8px">Acceso restringido</h2><p style="color:#888;line-height:1.5">Tu usuario no tiene permiso para abrir este módulo.</p></div></main>';
      window.parent?.postMessage({type:'blackos:access-denied',module:moduleForPath},'*');
    }catch(error){console.error('Black OS access guard',error)}
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',enforceModuleAccess,{once:true});
  else enforceModuleAccess();


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
    loadCss('blackos-black-ai-knowledge-css', 'assets/css/black-ai-knowledge.css?v=20260912a');
    loadCss('blackos-black-ai-inbox-css', 'assets/css/black-ai-inbox.css?v=20260912a');
    loadCss('blackos-black-ai-catalog-css', 'assets/css/black-ai-catalog.css?v=20260929a');
    loadCss('blackos-black-ai-followups-css', 'assets/css/black-ai-followups.css?v=20260913-1');
    const bootBlackAi = () => {
      loadJs('blackos-black-ai-chat-fix-js', 'assets/js/black-ai-chat-fix.js?v=20260912c');
      loadJs('blackos-black-ai-knowledge-js', 'assets/js/black-ai-knowledge.js?v=20260912a');
      loadJs('blackos-black-ai-catalog-js', 'assets/js/black-ai-catalog.js?v=20260929a');
      loadJs('blackos-black-ai-followups-js', 'assets/js/black-ai-followups.js?v=20260913-1');
      loadJs('blackos-black-ai-inbox-js', 'assets/js/black-ai-inbox.js?v=20260912a');
    };
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bootBlackAi, { once:true });
    } else {
      bootBlackAi();
    }
  }
})();