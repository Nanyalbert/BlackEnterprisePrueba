// Black OS — Permisos granulares de usuarios
(() => {
  const BRANCHES = [
    {id:'all',label:'Todas las sucursales'},
    {id:'general-paz',label:'General Paz'},
    {id:'cerro-de-las-rosas',label:'Cerro de las Rosas'}
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
    recetas: {
      label:'Recetas', icon:'RX',
      permissions:[['view','Ver y cargar recetas'],['interpret','Interpretar con Black AI'],['copy','Copiar alternativas']]
    },
    marketing: {
      label:'Marketing',
      icon:'MKT',
      permissions:[
        ['view','Ver planificación y calendario'],
        ['create_edit','Crear y editar contenido'],
        ['production','Gestionar producción e historias'],
        ['ads','Planificar publicidad y presupuestos'],
        ['results','Cargar y analizar resultados'],
        ['import','Importar y actualizar ideas'],
        ['settings','Administrar categorías y colores']
      ]
    },
    rrhh: {
      label:'RRHH',
      icon:'RRHH',
      permissions:[
        ['view','Ver equipo y asistencia'],
        ['manage_employees','Crear y editar integrantes'],
        ['attendance','Ver fichadas'],
        ['reports','Ver reportes'],
        ['salary_reference','Ver remuneración de referencia'],
        ['settings','Administrar horarios y tolerancias']
      ]
    },
    catalogo: {
      label:'Catálogo de cristales',
      icon:'CAT',
      permissions:[
        ['view','Consultar catálogo'],
        ['edit','Crear y editar productos'],
        ['pricing','Modificar precios'],
        ['import','Importar catálogo y matrices']
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

  function canonicalBranchScope(value){
    if(['zona-norte','alto-palermo','cerro'].includes(value)) return 'cerro-de-las-rosas';
    return value;
  }

  function normalizeUser(user){
    if(!user) return user;
    user.permissions=user.permissions||{};
    (user.apps||[]).forEach(app=>{
      if(!user.permissions[app]) user.permissions[app]={level:'full',items:'*'};
    });
    user.branchScope=Array.isArray(user.branchScope)&&user.branchScope.length?[...new Set(user.branchScope.map(canonicalBranchScope))]:['all'];
    return user;
  }

  if(typeof usersData!=='undefined') usersData.forEach(normalizeUser);

  function injectStyles(){
    if(document.getElementById('permission-styles')) return;
    const style=document.createElement('style');
    style.id='permission-styles';
    style.textContent=`
      #user-modal-overlay{backdrop-filter:blur(6px)}
      #user-modal-overlay .modal{width:min(920px,95vw);max-width:920px;max-height:92dvh;overflow:auto;padding:0;border-radius:22px;box-shadow:0 32px 90px rgba(0,0,0,.55)}
      #user-modal-overlay .modal-header{position:sticky;top:0;z-index:8;margin:0;padding:21px 24px 17px;background:rgba(16,16,16,.96);backdrop-filter:blur(12px);border-bottom:1px solid #242424}
      #user-form{padding:20px 24px 24px}
      #user-form .modal-actions{position:sticky;bottom:-24px;z-index:7;margin:20px -24px -24px;padding:28px 24px 22px;background:linear-gradient(180deg,rgba(16,16,16,0),#101010 32%)}
      .permission-editor{display:grid;gap:12px;margin-top:6px}
      .permission-intro{display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:14px 15px;border:1px solid #272727;border-radius:14px;background:linear-gradient(180deg,#111,#0d0d0d)}
      .permission-intro strong{display:block;font-size:12px;color:#f0f0ec}
      .permission-intro p{margin:4px 0 0;max-width:470px;color:#70706b;font-size:10px;line-height:1.55}
      .permission-toolbar{display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end}
      .permission-preset{border:1px solid #2d2d2d;background:#121212;color:#aaa;border-radius:10px;padding:8px 10px;font-size:10px;font-weight:700;cursor:pointer;transition:.15s ease}
      .permission-preset:hover{background:#1b1b1b;color:#fff;border-color:#3b3b3b;transform:translateY(-1px)}
      .permission-preset[data-global-preset="full"]{background:#eaeae5;color:#080808;border-color:#eaeae5}
      .permission-preset[data-global-preset="none"]:hover{background:rgba(224,87,74,.09);color:#ef7468;border-color:rgba(224,87,74,.25)}
      .branch-scope{margin:0;border:1px solid #292929;border-radius:14px;padding:13px 14px;background:#101010}
      .branch-scope-title{font-size:9px;color:#6f6f69;text-transform:uppercase;letter-spacing:.11em;margin-bottom:9px;font-weight:800}
      .branch-options{display:flex;gap:8px;flex-wrap:wrap}
      .branch-option{position:relative;display:flex;align-items:center;gap:6px;border:1px solid #292929;border-radius:999px;padding:8px 11px;font-size:10px;font-weight:700;color:#999;cursor:pointer;transition:.15s ease}
      .branch-option input{position:absolute;opacity:0;pointer-events:none}
      .branch-option:hover{color:#ddd;border-color:#393939}
      .branch-option:has(input:checked){background:#ecece7;color:#080808;border-color:#ecece7}
      .permission-card{border:1px solid #242424;border-radius:15px;background:#0f0f0f;overflow:hidden;transition:border-color .16s ease,background .16s ease}
      .permission-card:hover{border-color:#303030}
      .permission-card.open{border-color:#353535;background:#111}
      .permission-card-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:center;padding:13px 14px;cursor:pointer}
      .permission-card-title{display:flex;align-items:center;gap:11px;min-width:0}
      .permission-card-icon{width:36px;height:36px;flex:0 0 auto;border-radius:11px;background:#1a1a1a;color:#a8a8a2;display:grid;place-items:center;font-size:9px;font-weight:900;letter-spacing:.04em;transition:.16s ease}
      .permission-card.open .permission-card-icon{background:#efefe9;color:#080808}
      .permission-card-title strong{font-size:12.5px;display:block;color:#ecece8}
      .permission-card-title small{font-size:9.5px;color:#686863;display:block;margin-top:3px;line-height:1.35}
      .permission-level{min-width:126px;background:#161616;color:#e8e8e3;border:1px solid #323232;border-radius:9px;padding:8px 10px;font-size:10px;font-weight:700;outline:none;cursor:pointer}
      .permission-level:focus{border-color:#555}
      .permission-card-body{display:none;padding:0 14px 14px;border-top:1px solid #202020}
      .permission-card.open .permission-card-body{display:block}
      .permission-items{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px;margin-top:12px}
      .permission-check{position:relative;display:flex;align-items:center;gap:9px;border:1px solid #242424;background:#121212;border-radius:10px;padding:9px 10px;font-size:10.5px;color:#92928d;cursor:pointer;transition:.14s ease}
      .permission-check:hover{background:#171717;color:#e0e0db;border-color:#323232}
      .permission-check:has(input:checked){background:#181818;color:#f0f0eb;border-color:#3a3a3a}
      .permission-check input{width:15px;height:15px;accent-color:#efefe9;cursor:pointer;flex:0 0 auto}
      .permission-summary-badge{display:inline-flex;align-items:center;border:1px solid #2c2c2c;border-radius:999px;padding:5px 8px;font-size:9px;color:#a5a59f;margin:2px 4px 2px 0;white-space:nowrap}
      .permission-summary-badge.full{background:#efefe9;color:#080808;border-color:#efefe9}
      .user-status-field{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:13px 14px;margin-bottom:16px;border:1px solid #272727;border-radius:13px;background:#101010}
      .user-status-field strong{display:block;font-size:12px}.user-status-field small{display:block;color:#6c6c67;font-size:10px;margin-top:3px;line-height:1.45}
      .black-toggle{position:relative;width:42px;height:24px;flex:0 0 auto}.black-toggle input{position:absolute;opacity:0}.black-toggle span{position:absolute;inset:0;border-radius:999px;background:#2a2a2a;cursor:pointer;transition:.16s}.black-toggle span:after{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;border-radius:50%;background:#777;transition:.16s}.black-toggle input:checked+span{background:#ededE8}.black-toggle input:checked+span:after{left:21px;background:#080808}
      #view-usuarios .table-wrap{overflow:auto}
      #view-usuarios table{min-width:820px}
      #view-usuarios tbody tr{transition:background .14s ease}
      @media(max-width:760px){#user-modal-overlay{padding:10px}#user-modal-overlay .modal{width:100%;max-height:96dvh;border-radius:18px}#user-form{padding:16px}.permission-intro{flex-direction:column}.permission-toolbar{justify-content:flex-start}.permission-items{grid-template-columns:1fr}.permission-card-head{grid-template-columns:1fr}.permission-level{width:100%}#user-form .modal-actions{margin:18px -16px -16px;padding:26px 16px 16px}}
    `;
    document.head.appendChild(style);
  }

  function permissionEditorHTML(user){
    const permissions=user?.permissions||{};
    return `<div class="permission-editor" id="permission-editor">
      <div class="permission-intro">
        <div><strong>Acceso visible para este usuario</strong><p>Todo lo que dejes sin acceso desaparece de su menú, dashboard y acciones internas. Supabase vuelve a validar los mismos permisos.</p></div>
        <div class="permission-toolbar">
          <button type="button" class="permission-preset" data-global-preset="read">Solo lectura</button>
          <button type="button" class="permission-preset" data-global-preset="operator">Operador</button>
          <button type="button" class="permission-preset" data-global-preset="full">Acceso total</button>
          <button type="button" class="permission-preset" data-global-preset="none">Quitar accesos</button>
        </div>
      </div>
      <div class="branch-scope">
        <div class="branch-scope-title">Sucursales visibles para este usuario</div>
        <div class="branch-options">${BRANCHES.map(b=>`<label class="branch-option"><input type="checkbox" data-branch-scope value="${b.id}" ${(user?.branchScope||['all']).includes(b.id)?'checked':''}><span>${b.label}</span></label>`).join('')}</div>
      </div>
      ${Object.entries(MODULES).map(([id,module])=>{
        const cfg=permissions[id]||{level:'none',items:[]};
        const selected=cfg.items==='*'?module.permissions.map(([key])=>key):(cfg.items||[]);
        return `<section class="permission-card ${cfg.level!=='none'?'open':''}" data-module="${id}">
          <div class="permission-card-head">
            <div class="permission-card-title"><span class="permission-card-icon">${module.icon}</span><div><strong>${module.label}</strong><small data-permission-summary>${cfg.level==='none'?'No aparecerá para este usuario':'Acceso configurado'}</small></div></div>
            <select class="permission-level" data-level-for="${id}" aria-label="Nivel de acceso a ${module.label}">
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
          </div>
        </section>`;
      }).join('')}
    </div>`;
  }

  function updateCardSummary(card){
    const select=card?.querySelector('.permission-level');
    const summary=card?.querySelector('[data-permission-summary]');
    if(!select||!summary) return;
    const checked=card.querySelectorAll('[data-permission-module]:checked').length;
    const labels={none:'No aparecerá para este usuario',read:'Acceso de consulta',operator:'Acceso operativo',full:'Acceso total',custom:`${checked} función${checked===1?'':'es'} habilitada${checked===1?'':'s'}`};
    summary.textContent=labels[select.value]||'Acceso configurado';
  }

  function applyPresetToCard(card,preset){
    const id=card.dataset.module,module=MODULES[id],select=card.querySelector('.permission-level');
    if(!module||!select) return;
    select.value=preset;
    card.classList.toggle('open',preset!=='none');
    const boxes=[...card.querySelectorAll('[data-permission-module]')];
    if(preset==='full') boxes.forEach(b=>b.checked=true);
    else if(preset==='none') boxes.forEach(b=>b.checked=false);
    else if(preset==='read') boxes.forEach(b=>b.checked=/^(view|summary|sales|cash|bank|social|suppliers|stats|results)$/.test(b.value));
    else if(preset==='operator') boxes.forEach(b=>b.checked=!['automation','export','profit_cost','upload','professionals','availability','branches','public_booking','manage','manage_employees','salary_reference','pricing','import','settings'].includes(b.value));
    updateCardSummary(card);
  }

  function bindPermissionEditor(){
    document.querySelectorAll('.permission-card-head').forEach(head=>head.addEventListener('click',event=>{
      if(event.target.closest('select')) return;
      const card=head.closest('.permission-card');
      const select=card?.querySelector('.permission-level');
      if(!card||!select||select.value==='none') return;
      card.classList.toggle('open');
    }));

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
        const checked=[...card.querySelectorAll('[data-permission-module]:checked')];
        if(!checked.length){
          select.value='none';
          card.classList.remove('open');
          updateCardSummary(card);
          return;
        }
        select.value='custom';
        card.classList.add('open');
        updateCardSummary(card);
      });
    });

    document.querySelectorAll('[data-global-preset]').forEach(btn=>btn.addEventListener('click',()=>{
      document.querySelectorAll('.permission-card').forEach(card=>applyPresetToCard(card,btn.dataset.globalPreset));
    }));

    document.querySelectorAll('[data-branch-scope]').forEach(box=>box.addEventListener('change',()=>{
      const all=document.querySelector('[data-branch-scope][value="all"]');
      const boxes=[...document.querySelectorAll('[data-branch-scope]')];
      if(box.value==='all'&&box.checked) boxes.forEach(other=>{if(other!==box)other.checked=false});
      if(box.value!=='all'&&box.checked&&all) all.checked=false;
      if(!boxes.some(other=>other.checked)&&all) all.checked=true;
    }));

    document.querySelectorAll('.permission-card').forEach(updateCardSummary);
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
    if(user.superAdmin) return '<span class="badge super">Administrador · acceso total</span>';
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
      const user=userId?normalizeUser(usersData.find(x=>String(x.id)===String(userId))):{permissions:{},branchScope:['all'],activo:true};
      const active=document.getElementById('modal-active'); if(active) active.checked=user?.activo!==false;
      const old=document.getElementById('permission-editor');if(old)old.remove();
      const field=document.getElementById('permissions-field')||document.querySelector('#user-form .modal-field:last-of-type');
      if(field){
        const legacy=field.querySelector('.permisos-list');if(legacy)legacy.style.display='none';
        field.insertAdjacentHTML('beforeend',permissionEditorHTML(user));
        bindPermissionEditor();
      }
    };
  }

  window.BlackUserPermissions={
    collect:collectPermissionConfig,
    modules:MODULES,
    branches:BRANCHES,
    normalizeUser
  };

  injectStyles();
  patchRenderUsers();
  patchModal();
  if(typeof renderUsers==='function') renderUsers();
})();
