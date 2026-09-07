// Black Óptica — configuración compartida de Supabase
(() => {
  const SUPABASE_URL = "https://tjetppyqyzgxfhpuyoet.supabase.co";
  const SUPABASE_ANON_KEY = "sb_publishable_YCXt4mKeFDDso1N4wjtHxw_GK53l9gq";

  window.BlackPortal = window.BlackPortal || {};
  window.BlackPortal.SUPABASE_URL = SUPABASE_URL;
  window.BlackPortal.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;

  window.BlackPortal.getSupabase = function () {
    if (!window.supabase) {
      throw new Error("La librería de Supabase no está disponible.");
    }
    if (!window.BlackPortal.supabaseClient) {
      window.BlackPortal.supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY
      );
    }
    return window.BlackPortal.supabaseClient;
  };

  // Capa incremental exclusiva del CRM Oftalmólogos.
  // Se carga después del módulo original para no alterar el resto de Black OS.
  const isOphthalmologyModule = /(?:^|\/)crm-oftalmologos\.html$/i.test(window.location.pathname);
  if (isOphthalmologyModule) {
    const styleId = "blackos-oft-branches-css";
    if (!document.getElementById(styleId)) {
      const link = document.createElement("link");
      link.id = styleId;
      link.rel = "stylesheet";
      link.href = "assets/css/crm-oftalmologos-sucursales.css";
      document.head.appendChild(link);
    }

    window.addEventListener("load", () => {
      if (document.getElementById("blackos-oft-branches-js")) return;
      const script = document.createElement("script");
      script.id = "blackos-oft-branches-js";
      script.src = "assets/js/crm-oftalmologos-sucursales.js";
      document.body.appendChild(script);
    }, { once: true });
  }
})();
