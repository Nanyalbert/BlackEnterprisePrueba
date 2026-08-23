// Black OS — Permisos granulares de usuarios
(() => {
  const STORAGE_KEY = 'blackos_user_permissions_v1';
  const BRANCHES = [
    {id:'all',label:'Todas las sucursales'},
    {id:'general-paz',label:'General Paz'},
    {id:'zona-norte',label:'Zona Norte'}
  ];

  const MODULES = {
    'crm-black': {
      label:'CRM Black',
      icon:'CRM',
      permissions:[
        ['view','Ver clientes y oportunidades'],
        ['create_edit','Crear y editar clientes'],
        ['followup','Seguimientos'],
        ['automation','Automatizaciones'],
        ['export','Exportar información']
      ]
    },
    administracion: {
      label:'Administración',
      icon:'ADM',
      permissions:[
        ['summary','Ver resumen'],
        ['sales','Ver ventas'],
        ['profit_cost','Ver utilidad y costos'],
        ['cash','Ver caja / cobranzas'],
        ['bank','Ver bancos'],
        ['social','Ver obra social y mutuales'],
        ['suppliers','Ver proveedores'],
        ['upload','Cargar información']
      ]
    },
    'crm-oftalmologos': {
      label:'CRM Oftalmólogos',
      icon:'OFT',
      permissions:[
        ['view','Ver profesionales y derivaciones'],
        ['manage','Crear y editar profesionales'],
        ['referrals','Gestionar derivaciones'],
        ['stats','Ver estadísticas']
      ]
    },
    turnos: {
      label:'Turnos',
      icon:'TUR',
      permissions:[
        ['view','Ver agenda'],
        ['create','Crear turnos'],
        ['edit','Editar / reprogramar'],
        ['status','Confirmar y cambiar estados'],
        ['cancel','Cancelar turnos'],
        ['professionals','Administrar profesionales'],
        ['availability','Modificar disponibilidad'],
        ['branches','Administrar sucursales'],
        ['public_booking','Configurar reserva pública']
      ]
    }
  };

  const PRESETS = {
    none: [],
    read: ['view','summary','sales','cash','bank','social','suppliers','stats'],
    operator: ['view','summary','sales','cash','bank','social','suppliers','create_edit','followup','create','edit','status','cancel','referrals'],
    full: '*'
  };

  function loadSaved(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY))||{}}catch(e){return {}}
  }
  function saveSaved(data){
    try{localStorage.setItem(STORAGE_KEY,JSON.stringify(data))}catch(e){}
  }

  const saved = loadSaved();

  function normalizeUser(user){
    if(!user) return user;
    const savedUser=saved[user.email];
    if(savedUser){
      user.permissions=savedUser.permissions||{};
      user.branchScope=savedUser.branchScope||['all'];
      user.apps=Object.entries(user.permissions).filter(([,cfg])=>cfg?.level&&cfg.level!=='none').map(([id])=>id);
    } else {
      user.permissions=user.permissions||{};
      (user.apps||[]).forEach(app=>{
        if(!user.permissions[app]) user.permissions[app]={level:'full',items:'*'};
      });
      user.branchScope=user.branchScope||['all'];
    }
    return user;
  }

  if(typeof usersData!=='undefined') usersData.forEach(normalizeUser);

  function injectStyles(){
    if(document.getElementById('permission-styles')) return;
    const style=document.createElement('style');
    style.id='permission-styles';
    style.textContent=`
      #user-modal-overlay .modal{width:min(880px,94vw);max-height:90vh;overflow:auto}
      .permission-editor{display:grid;gap:12px;margin-top:6px}
      .permission-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:2px}
      .permission-preset{border:1px solid #2d2d2d;background:#111;color:#aaa;border-radius:10px;padding:8px 10px;font-size:11px;cursor:pointer}
      .permission-preset:hover{background:#171717;color:#fff}
      .permission-card{border:1px solid #242424;border-radius:14px;background:#0f0f0f;overflow:hidden}
      .permission-card-head{display:grid;grid-template-columns:1fr auto;gap:12px;align-items:center;padding:13px 14px;cursor:pointer}
      .permission-card-title{display:flex;align-items:center;gap:10px}
      .permission-card-icon{width:34px;height:34px;border-radius:10px;background:#f1f1ed;color:#000;display:grid;place-items:center;font-size:9px;font-weight:800;letter-spacing:.05em}
      .permission-card-title strong{font-size:13px;display:block}
      .permission-card-title small{font-size:10px;color:#666;display:block;margin-top:2px}
      .permission-level{background:#161616;color:#e8e8e3;border:1px solid #323232;border-radius:9px;padding:8px 10px;font-size:11px;outline:none}
      .permission-card-body{display:none;padding:0 14px 14px;border-top:1px solid #202020}
      .permission-card.open .permission-card-body{display:block}
      .permission-items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:12px}
      .permission-check{display:flex;align-items:center;gap:8px;border:1px solid #242424;background:#121212;border-radius:10px;padding:9px 10px;font-size:11px;color:#aaa;cursor:pointer}
      .permission-check:hover{background:#171717;color:#fff}
      .permission-check input{accent-color:#f1f1ed}
      .branch-scope{margin-top:12px;border-top:1px dashed #292929;padding-top:12px}
      .branch-scope-title{font-size:10px;color:#666;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
      .branch-options{display:flex;gap:8px;flex-wrap:wrap}
      .branch-option{display:flex;align-items:center;gap:6px;border:1px solid #292929;border-radius:999px;padding:7px 10px;font-size:10px;color:#999}
      .permission-summary-badge{display:inline-flex;align-items:center;border:1px solid #2c2c2c;border-radius:999px;padding:4px 7px;font-size:9px;color:#aaa;margin:2px 4px 2px 0}
      .permission-summary-badge.full{background:#f1f1ed;color:#000;border-color:#f1f1ed}
      @media(max-width:680px){.permission-items{grid-template-columns:1fr}.permission-card-head{grid-template-columns:1fr}.permission-level{width:100%}}
    `;
    document.head.appendChild(style);
  }

  function permissionEditorHTML(user){
    const permissions=user?.permissions||{};
    return `<div class="permission-editor" id="permission-editor">
      <div class="permission-toolbar">
        <button type="button" class="permission-preset" data-global-preset="read">Solo lectura</button>
        <button type="button" class="permission-preset" data-global-preset="operator">Operador</button>
        <button type="button" class="permission-preset" data-global-preset="full">Acceso total</button>
        <button type="button" class="permission-preset" data-global-preset="none">Quitar accesos</button>
      </div>
      ${Object.entries(MODULES).map(([id,module])=>{
        const cfg=permissions[id]||{level:'none',items:[]};
        const selected=cfg.items==='*'?module.permissions.map(([key])=>key):(cfg.items||[]);
        return `<section class="permission-card ${cfg.level!=='none'?'open':''}" data-module="${id}">
          <div class="permission-card-head">
            <div class="permission-card-title"><span class="permission-card-icon">${module.icon}</span><div><strong>${module.label}</strong><small>${cfg.level==='none'?'Sin acceso':'Acceso configurado'}</small></div></div>
            <select class="permission-level" data-level-for="${id}">
              <option value="none" ${cfg.level==='none'?'selected':''}>Sin acceso</option>
              <option value="read" ${cfg.level==='read'?'selected':''}>Solo lectura</option>
              <option value="operator" ${cfg.level==='operator'?'selected':''}>Operador</option>
              <option value="full" ${cfg.level==='full'?'selected':''}>Acceso total</option>
              <option value="custom" ${cfg.level==='custom'?'selected':''}>Personalizado</option>
            </select>
          </div>
          <div class="permission-card-body">
            <div class="permission-items">
              ${module.permissions.map(([key,label])=>`<label class="permission-check"><input type="checkbox" data-permission-module="${id}" value="${key}" ${selected.includes(key)?'checked':''}><span>${label}</span></label>`).join('')}
            </div>
            <div class="branch-scope">
              <div class="branch-scope-title">Alcance de sucursales</div>
              <div class="branch-options">${BRANCHES.map(b=>`<label class="branch-option"><input type="checkbox" data-branch-scope value="${b.id}" ${(user?.branchScope||['all']).includes(b.id)?'checked':''}><span>${b.label}</span></label>`).join('')}</div>
            </div>
          </div>
        </section>`;
      }).join('')}
    </div>`;
  }

  function applyPresetToCard(card,preset){
    const id=card.dataset.module,module=MODULES[id],select=card.querySelector('.permission-level');
    select.value=preset;
    card.classList.toggle('open',preset!=='none');
    const boxes=[...card.querySelectorAll('[data-permission-module]')];
    if(preset==='full') boxes.forEach(b=>b.checked=true);
    else if(preset==='none') boxes.forEach(b=>b.checked=false);
    else if(preset==='read') boxes.forEach(b=>b.checked=/view|summary|sales|cash|bank|social|suppliers|stats/.test(b.value));
    else if(preset==='operator') boxes.forEach(b=>b.checked=!['automation','export','profit_cost','upload','professionals','availability','branches','public_booking','manage'].includes(b.value));
    if(!module) return;
  }

  function bindPermissionEditor(){
    document.querySelectorAll('.permission-level').forEach(select=>{
      select.addEventListener('change',()=>{
        const card=select.closest('.permission-card');
        applyPresetToCard(card,select.value);
        if(select.value==='custom') card.classList.add('open');
      });
    });
    document.querySelectorAll('[data-permission-module]').forEach(box=>{
      box.addEventListener('change',()=>{
        const card=box.closest('.permission-card'),select=card.querySelector('.permission-level');
        if(select.value!=='none') select.value='custom';
      });
    });
    document.querySelectorAll('[data-global-preset]').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('.permission-card').forEach(card=>applyPresetToCard(card,btn.dataset.globalPreset));
    }));
    document.querySelectorAll('[data-branch-scope]').forEach(box=>box.addEventListener('change',()=>{
      if(box.value==='all'&&box.checked) document.querySelectorAll('[data-branch-scope]').forEach(other=>{if(other!==box)other.checked=false});
      if(box.value!=='all'&&box.checked){const all=document.querySelector('[data-branch-scope][value="all"]');if(all)all.checked=false}
    }));
  }

  function collectPermissionConfig(){
    const permissions={};
    document.querySelectorAll('.permission-card').forEach(card=>{
      const id=card.dataset.module,level=card.querySelector('.permission-level')?.value||'none';
      const items=[...card.querySelectorAll('[data-permission-module]:checked')].map(x=>x.value);
      permissions[id]={level,items:level==='full'?'*':items};
    });
    const branchScope=[...document.querySelectorAll('[data-branch-scope]:checked')].map(x=>x.value);
    return {permissions,branchScope:branchScope.length?branchScope:['all']};
  }

  function renderAccessBadges(user){
    if(user.superAdmin) return '<span class="badge super">Acceso total</span>';
    const perms=user.permissions||{};
    const active=Object.entries(perms).filter(([,cfg])=>cfg?.level&&cfg.level!=='none');
    if(!active.length) return '<span class="badge">Sin accesos</span>';
    return active.map(([id,cfg])=>`<span class="permission-summary-badge ${cfg.level==='full'?'full':''}">${MODULES[id]?.label||id} · ${cfg.level==='full'?'Total':cfg.level==='read'?'Lectura':cfg.level==='operator'?'Operador':'Personalizado'}</span>`).join('');
  }

  function patchRenderUsers(){
    if(typeof renderUsers!=='function') return;
    const original=renderUsers;
    renderUsers=function(){
      original();
      const tbody=document.getElementById('users-tbody');
      if(!tbody) return;
      tbody.querySelectorAll('tr[data-id]').forEach(row=>{
        const user=usersData.find(x=>String(x.id)===row.dataset.id);if(!user)return;
        const accessCell=row.children[1];if(accessCell)accessCell.innerHTML=renderAccessBadges(user);
      });
    };
  }

  function patchModal(){
    if(typeof openModal!=='function') return;
    const original=openModal;
    openModal=function(userId=null){
      original(userId);
      const user=userId?usersData.find(x=>x.id===userId):{permissions:{},branchScope:['all']};
      const old=document.getElementById('permission-editor');if(old)old.remove();
      const field=document.querySelector('#user-form .modal-field:last-of-type');
      if(field){
        const legacy=field.querySelector('.permisos-list');if(legacy)legacy.style.display='none';
        field.insertAdjacentHTML('beforeend',permissionEditorHTML(user));
        bindPermissionEditor();
      }
    };
  }

  function bindSave(){
    const form=document.getElementById('user-form');if(!form)return;
    form.addEventListener('submit',()=>{
      const email=document.getElementById('modal-email')?.value.trim();
      if(!email||!document.getElementById('permission-editor')) return;
      const config=collectPermissionConfig();
      setTimeout(()=>{
        const user=usersData.find(x=>x.email===email);if(!user)return;
        user.permissions=config.permissions;user.branchScope=config.branchScope;
        user.apps=Object.entries(config.permissions).filter(([,cfg])=>cfg.level!=='none').map(([id])=>id);
        saved[email]={permissions:user.permissions,branchScope:user.branchScope};
        saveSaved(saved);
        renderUsers();
      },0);
    });
  }

  injectStyles();
  patchRenderUsers();
  patchModal();
  bindSave();
  if(typeof renderUsers==='function') renderUsers();
})();
