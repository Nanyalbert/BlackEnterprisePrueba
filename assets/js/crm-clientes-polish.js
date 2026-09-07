// Black OS — CRM Black — iconografía SVG y mejoras ligeras de UI
(() => {
  const svg = (name, cls='crm-svg') => {
    const icons = {
      back:'<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
      search:'<circle cx="11" cy="11" r="7"/><path d="m20 20-3.6-3.6"/>',
      settings:'<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1a1.7 1.7 0 0 0-1.4-1.65 1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.75 8.2a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.8 4.75a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.39.23.72.57.95.97.23.4.35.85.35 1.31v.32h.1v4h-.1c-.46 0-.91.12-1.3.4Z"/>',
      today:'<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/>',
      users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      board:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>',
      more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
      campaign:'<path d="m3 11 15-5v12L3 13z"/><path d="M11.6 15.5 13 21H8l-1.2-6.7"/>',
      bolt:'<path d="m13 2-8 12h7l-1 8 8-12h-7z"/>',
      chart:'<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>',
      edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
      phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.3 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z"/>',
      check:'<path d="m5 12 4 4L19 6"/>',
      send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${icons[name]||icons.more}</svg>`;
  };

  function replaceTopbar(){
    const back=document.querySelector('.portal-back-btn');
    if(back) back.innerHTML=svg('back');
    const btns=[...document.querySelectorAll('.topbar-btn')].filter(b=>b!==back);
    if(btns[0]) btns[0].innerHTML=svg('search');
    if(btns[1]) btns[1].innerHTML=svg('settings');
  }

  function replaceSummary(){
    const stats=[
      ['dsContactar','phone','Contactar hoy'],
      ['dsRespondieron','check','Respondieron'],
      ['dsNuevos','plus','Nuevos hoy'],
      ['dsTotal','users','Total leads']
    ];
    stats.forEach(([id,icon,label])=>{
      const num=document.getElementById(id); const lab=num?.parentElement?.querySelector('.day-stat-label');
      if(lab) lab.innerHTML=`${svg(icon)}<span>${label}</span>`;
    });
  }

  function replaceBottomNav(){
    const map={
      'nav-hoy':'today',
      'nav-todos':'users',
      'nav-tablero':'board'
    };
    Object.entries(map).forEach(([id,icon])=>{
      const b=document.getElementById(id); const el=b?.querySelector('.nav-btn-icon'); if(el) el.innerHTML=svg(icon);
    });
    const summary=document.querySelector('.bottom-nav details summary .nav-btn-icon');
    if(summary) summary.innerHTML=svg('more');

    const menu=document.querySelector('.bottom-nav details>div');
    if(menu){
      const items=[...menu.children];
      const defs=[['campaign','Campañas'],['bolt','Automatizaciones y postventa'],['chart','Resumen'],['edit','Ajustes']];
      items.forEach((el,i)=>{if(defs[i]) el.innerHTML=`<span class="crm-menu-row">${svg(defs[i][0])}<span>${defs[i][1]}</span></span>`;});
    }
  }

  function replaceStaticModalIcons(){
    document.querySelectorAll('button').forEach(btn=>{
      const t=btn.textContent.trim();
      if(t.includes('Abrir WhatsApp')) btn.innerHTML=`${svg('phone')}<span>Abrir WhatsApp</span>`;
      else if(t.includes('El cliente escribió')) btn.innerHTML=`${svg('check')}<span><span style="display:block;font-size:12px;font-weight:600">El cliente escribió</span><span class="la-btn-sub">Pausa automáticos 3hs</span></span>`;
      else if(t.includes('Registré un envío')) btn.innerHTML=`${svg('send')}<span><span style="display:block;font-size:12px;font-weight:600">Registré un envío</span><span class="la-btn-sub">Lo mandé desde el teléfono</span></span>`;
      else if(t.includes('Editar datos')) btn.innerHTML=`${svg('edit')}<span>Editar datos</span>`;
      else if(t.includes('Duplicar')) btn.innerHTML=`${svg('copy')}<span>Duplicar</span>`;
    });
    const searchWrap=document.getElementById('searchInput')?.previousElementSibling;
    if(searchWrap) { searchWrap.classList.add('crm-search-icon'); searchWrap.innerHTML=svg('search'); }
  }

  function decorateFab(){const fab=document.querySelector('.fab');if(fab) fab.innerHTML=svg('plus','crm-svg lg');}

  function replaceDynamicQuickActions(root=document){
    root.querySelectorAll?.('.qa-btn').forEach(btn=>{
      const t=btn.textContent.trim().toLowerCase();
      if(btn.dataset.svgDone==='1') return;
      if(t.includes('whatsapp')||t.includes('wa')) btn.innerHTML=`${svg('phone','crm-svg sm')}<span>${btn.textContent.trim().replace(/^\S+\s*/,'')||'WhatsApp'}</span>`;
      else if(t.includes('listo')||t.includes('respond')) btn.innerHTML=`${svg('check','crm-svg sm')}<span>${btn.textContent.trim().replace(/^\S+\s*/,'')||'Listo'}</span>`;
      else if(t.includes('no resp')||t.includes('sin resp')) btn.innerHTML=`${svg('more','crm-svg sm')}<span>${btn.textContent.trim().replace(/^\S+\s*/,'')||'Sin respuesta'}</span>`;
      btn.dataset.svgDone='1';
    });
  }

  function boot(){replaceTopbar();replaceSummary();replaceBottomNav();replaceStaticModalIcons();decorateFab();replaceDynamicQuickActions();}
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true}); else boot();

  const host=document.getElementById('mainContent');
  if(host){new MutationObserver(m=>{for(const x of m){for(const n of x.addedNodes){if(n instanceof Element) replaceDynamicQuickActions(n);}}}).observe(host,{childList:true,subtree:true});}
})();
