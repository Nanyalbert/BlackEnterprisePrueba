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

  const isOphthalmologyModule = /(?:^|\/)crm-oftalmologos\.html$/i.test(window.location.pathname);
  if (isOphthalmologyModule) {
    [
      ["blackos-oft-branches-css", "assets/css/crm-oftalmologos-sucursales.css?v=20260907d"],
      ["blackos-oft-polish-css", "assets/css/crm-oftalmologos-polish.css?v=20260907d"]
    ].forEach(([id, href]) => {
      if (document.getElementById(id)) return;
      const link = document.createElement("link");
      link.id = id;
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
    });

    window.addEventListener("load", () => {
      if (document.getElementById("blackos-oft-branches-js")) return;

      const branchesScript = document.createElement("script");
      branchesScript.id = "blackos-oft-branches-js";
      branchesScript.src = "assets/js/crm-oftalmologos-sucursales.js?v=20260907d";

      branchesScript.onload = () => {
        if (document.getElementById("blackos-oft-supabase-sync-js")) return;
        const syncScript = document.createElement("script");
        syncScript.id = "blackos-oft-supabase-sync-js";
        syncScript.src = "assets/js/crm-oftalmologos-supabase-sync.js?v=20260907d";
        document.body.appendChild(syncScript);
      };

      document.body.appendChild(branchesScript);
    }, { once: true });
  }
})();
