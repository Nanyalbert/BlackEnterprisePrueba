(()=>{
  const VERSION='20260913-1';
  const state={client:null,items:[],search:'',caseFilter:'all',modeFilter:'all',treatmentFilter:'all',activeFilter:'active',loaded:false};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const money=v=>Number(v||0).toLocaleString('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0});
  const label=v=>({monofocal:'Monofocal',bifocal:'Bifocal',occupational:'Ocupacional',multifocal:'Multifocal',stock:'Stock',range_extended:'R.E',laboratory:'Laboratorio',antireflective:'Antirreflejo',blue_filter:'Filtro Blue',super_blue:'Super Blue',photochromic:'Fotocromático',photochromic_blue:'Fotocromático Blue',black_blue_4k:'Black Blue 4K',none:'Sin tratamiento'}[v]||v||'—');
  function resolveClient(){try{if(window.parent&&window.parent!==window&&window.parent.BlackPortal?.getSupabase)return window.parent.BlackPortal.getSupabase()}catch(_){ }return window.BlackPortal?.getSupabase?.()||null}
  function loadAsset(tag,attrs){if(document.querySelector(`[data-catalog-${tag}]`))return;const el=document.createElement(tag==='css'?'link':'script');if(tag==='css'){el.rel='stylesheet';el.href=`assets/css/black-ai-catalog.css?v=${VERSION}`}else{el.src=`assets/js/black-ai-catalog-import.js?v=20260913-2`}el.dataset[`catalog${tag[0].toUpperCase()+tag.slice(1)}`]='1';document[tag==='css'?'head':'body'].appendChild(el)}

  function ensureShell(){
    if(!document.querySelector('link[data-catalog-css]')){const link=document.createElement('link');link.rel='stylesheet';link.href=`assets/css/black-ai-catalog.css?v=${VERSION}`;link.dataset.catalogCss='1';document.head.appendChild(link)}
    const nav=document.querySelector('.ai-tabs');
    if(nav&&!nav.querySelector('[data-tab="catalogo"]')){
      const knowledge=nav.querySelector('[data-tab="conocimiento"]');
      const btn=document.createElement('button');btn.className='ai-tab';btn.dataset.tab='catalogo';btn.type='button';btn.textContent='Catálogo';knowledge?.after(btn);
      btn.addEventListener('click',()=>activate());
    }
    if(!document.getElementById('tab-catalogo')){
      const panel=document.createElement('section');panel.className='tab-panel';panel.id='tab-catalogo';
      panel.innerHTML='<div class="catalog-loading">Cargando catálogo…</div>';
      document.getElementById('tab-conocimiento')?.after(panel);
    }
  }

  function activate(){
    document.querySelectorAll('.ai-tab').forEach(t=>t.classList.toggle('active',t.dataset.tab==='catalogo'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id==='tab-catalogo'));
    if(!state.loaded)load();else render();
  }

  async function load(){
    const panel=document.getElementById('tab-catalogo');if(!panel)return;
    panel.innerHTML='<div class="catalog-loading">Leyendo productos desde Supabase…</div>';
    state.client=resolveClient();if(!state.client){panel.innerHTML='<div class="catalog-error">Supabase no está disponible.</div>';return}
    const {data,error}=await state.client.from('black_ai_products').select('id,name,base_price,optical_case,supply_mode,material,treatment,design,is_active,imported_at,updated_at,sphere_min,sphere_max,cylinder_min,cylinder_max,cylinder_abs_max,addition_min,addition_max,metadata').order('name',{ascending:true});
    if(error){panel.innerHTML=`<div class="catalog-error">${esc(error.message)}</div>`;return}
    state.items=data||[];state.loaded=true;render();
  }

  function filtered(){
    const q=state.search.trim().toLowerCase();
    return state.items.filter(x=>{
      if(state.activeFilter==='active'&&!x.is_active)return false;
      if(state.activeFilter==='inactive'&&x.is_active)return false;
      if(state.caseFilter!=='all'&&x.optical_case!==state.caseFilter)return false;
      if(state.modeFilter!=='all'&&x.supply_mode!==state.modeFilter)return false;
      if(state.treatmentFilter!=='all'&&x.treatment!==state.treatmentFilter)return false;
      if(q&&!`${x.name||''} ${x.material||''} ${x.treatment||''} ${x.design||''}`.toLowerCase().includes(q))return false;
      return true;
    });
  }
  const unique=key=>[...new Set(state.items.map(x=>x[key]).filter(Boolean))].sort();
  const lastUpdate=()=>state.items.map(x=>x.imported_at||x.updated_at).filter(Boolean).sort().at(-1)||null;
  const technicalReady=x=>[x.sphere_min,x.sphere_max,x.cylinder_min,x.cylinder_max,x.cylinder_abs_max,x.addition_min,x.addition_max].some(v=>v!==null&&v!==undefined);

  function render(){
    const panel=document.getElementById('tab-catalogo');if(!panel)return;
    const rows=filtered(),active=state.items.filter(x=>x.is_active).length,technical=state.items.filter(technicalReady).length,last=lastUpdate();
    panel.innerHTML=`
      <div class="section-intro catalog-intro"><div><h2>Catálogo</h2><p>Productos y precios que Black AI puede consultar en tiempo real desde Supabase.</p></div><button class="btn-primary" id="catalog-import" type="button">Actualizar catálogo</button></div>
      <div class="catalog-stats"><div><span>Productos</span><strong>${state.items.length}</strong></div><div><span>Activos</span><strong>${active}</strong></div><div><span>Con ficha técnica</span><strong>${technical}</strong></div><div><span>Última actualización</span><strong>${last?new Date(last).toLocaleDateString('es-AR'):'—'}</strong></div></div>
      <div class="catalog-toolbar">
        <input id="catalog-search" value="${esc(state.search)}" placeholder="Buscar producto, material, tratamiento o diseño…">
        <select id="catalog-case"><option value="all">Todos los casos</option>${unique('optical_case').map(v=>`<option value="${esc(v)}" ${state.caseFilter===v?'selected':''}>${esc(label(v))}</option>`).join('')}</select>
        <select id="catalog-mode"><option value="all">Todas las modalidades</option>${unique('supply_mode').map(v=>`<option value="${esc(v)}" ${state.modeFilter===v?'selected':''}>${esc(label(v))}</option>`).join('')}</select>
        <select id="catalog-treatment"><option value="all">Todos los tratamientos</option>${unique('treatment').map(v=>`<option value="${esc(v)}" ${state.treatmentFilter===v?'selected':''}>${esc(label(v))}</option>`).join('')}</select>
        <select id="catalog-active"><option value="active" ${state.activeFilter==='active'?'selected':''}>Activos</option><option value="all" ${state.activeFilter==='all'?'selected':''}>Todos</option><option value="inactive" ${state.activeFilter==='inactive'?'selected':''}>Inactivos</option></select>
      </div>
      <div class="catalog-result-line"><strong>${rows.length}</strong> productos visibles</div>
      <div class="catalog-table-wrap"><table class="catalog-table"><thead><tr><th>Producto</th><th>Precio</th><th>Caso</th><th>Modalidad</th><th>Material</th><th>Tratamiento</th><th>Diseño</th><th>Estado técnico</th></tr></thead><tbody>${rows.map(rowHtml).join('')}</tbody></table>${rows.length?'':'<div class="catalog-empty">No hay productos que coincidan con los filtros.</div>'}</div>`;
    bind();
  }

  function rowHtml(x){
    const tech=technicalReady(x);
    return `<tr data-product="${x.id}"><td><div class="catalog-product"><strong>${esc(x.name)}</strong><small>${x.is_active?'Activo':'Inactivo'}</small></div></td><td class="catalog-price">${money(x.base_price)}</td><td>${esc(label(x.optical_case))}</td><td>${esc(label(x.supply_mode))}</td><td>${esc(x.material||'—')}</td><td>${esc(label(x.treatment))}</td><td>${esc(x.design||'—')}</td><td><span class="catalog-tech ${tech?'ready':'pending'}">${tech?'Configurado':'Pendiente'}</span></td></tr>`;
  }

  function bind(){
    const search=document.getElementById('catalog-search');search?.addEventListener('input',e=>{state.search=e.target.value;render()});
    document.getElementById('catalog-case')?.addEventListener('change',e=>{state.caseFilter=e.target.value;render()});
    document.getElementById('catalog-mode')?.addEventListener('change',e=>{state.modeFilter=e.target.value;render()});
    document.getElementById('catalog-treatment')?.addEventListener('change',e=>{state.treatmentFilter=e.target.value;render()});
    document.getElementById('catalog-active')?.addEventListener('change',e=>{state.activeFilter=e.target.value;render()});
    document.getElementById('catalog-import')?.addEventListener('click',async()=>{
      if(!window.BlackAiCatalogImport){await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='assets/js/black-ai-catalog-import.js?v=20260913-2';s.onload=resolve;s.onerror=reject;document.body.appendChild(s)})}
      window.BlackAiCatalogImport?.open();
    });
    document.querySelectorAll('[data-product]').forEach(tr=>tr.addEventListener('click',()=>openDetail(state.items.find(x=>x.id===tr.dataset.product))));
  }

  function openDetail(x){if(!x)return;const tech=technicalReady(x),wrap=document.createElement('div');wrap.className='catalog-detail-backdrop';wrap.innerHTML=`<div class="catalog-detail"><button class="catalog-detail-close">×</button><span class="card-kicker">PRODUCTO</span><h3>${esc(x.name)}</h3><div class="catalog-detail-grid"><div><span>Precio</span><strong>${money(x.base_price)}</strong></div><div><span>Caso</span><strong>${esc(label(x.optical_case))}</strong></div><div><span>Modalidad</span><strong>${esc(label(x.supply_mode))}</strong></div><div><span>Material</span><strong>${esc(x.material||'—')}</strong></div><div><span>Tratamiento</span><strong>${esc(label(x.treatment))}</strong></div><div><span>Diseño</span><strong>${esc(x.design||'—')}</strong></div></div><div class="catalog-detail-section"><h4>Información técnica</h4>${tech?`<div class="catalog-range-grid"><span>Esfera: ${esc(x.sphere_min??'—')} a ${esc(x.sphere_max??'—')}</span><span>Cilindro: ${esc(x.cylinder_min??'—')} a ${esc(x.cylinder_max??x.cylinder_abs_max??'—')}</span><span>Adición: ${esc(x.addition_min??'—')} a ${esc(x.addition_max??'—')}</span></div>`:'<p>Este producto todavía no tiene rangos ópticos cargados. El precio comercial ya está disponible, pero no debe usarse como candidato automático hasta completar la ficha técnica.</p>'}</div></div>`;document.body.appendChild(wrap);const close=()=>wrap.remove();wrap.querySelector('.catalog-detail-close').onclick=close;wrap.onclick=e=>{if(e.target===wrap)close()}}

  ensureShell();
  window.BlackAiCatalog={activate,reload:async()=>{state.loaded=false;await load()}};
})();