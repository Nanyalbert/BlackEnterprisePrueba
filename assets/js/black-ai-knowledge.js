(()=>{
  const CATEGORY_LABELS={price_product:'Precios y productos',promotion:'Beneficios y promociones',commercial:'Información comercial',policy:'Atención y políticas'};
  const state={items:[],filter:'all',editingId:null,client:null,session:null};
  const el=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>new Date().toISOString().slice(0,10);
  function resolveClient(){try{if(window.parent&&window.parent!==window&&window.parent.BlackPortal?.getSupabase)return window.parent.BlackPortal.getSupabase()}catch(_){ }return window.BlackPortal?.getSupabase?.()||null}
  const usable=i=>i.is_active&&(!i.valid_from||i.valid_from<=today())&&(!i.valid_until||i.valid_until>=today());

  function loadCatalogModule(){
    if(window.BlackAiCatalog)return;
    const s=document.createElement('script');
    s.src='assets/js/black-ai-catalog.js?v=20260913-1';
    s.dataset.blackAiCatalog='1';
    document.body.appendChild(s);
  }

  async function load(){
    const host=el('tab-conocimiento');if(!host)return;
    state.client=state.client||resolveClient();if(!state.client){renderError('Supabase no está disponible en esta sesión.');return}
    const {data:{session}}=await state.client.auth.getSession();state.session=session;
    const {data,error}=await state.client.from('black_ai_knowledge').select('id,category,title,content,data,is_active,priority,valid_from,valid_until,created_at,updated_at').order('priority',{ascending:true}).order('updated_at',{ascending:false});
    if(error){renderError(error.message);return}state.items=data||[];render();
  }

  function render(){
    const host=el('tab-conocimiento');if(!host)return;
    const filtered=state.filter==='all'?state.items:state.items.filter(x=>x.category===state.filter);
    host.innerHTML=`<div class="section-intro"><div><h2>Conocimiento</h2><p>Información comercial aprobada que Black AI puede utilizar para responder.</p></div><button class="btn-primary" id="knowledge-add" type="button">Agregar información</button></div>
    <div class="knowledge-manager"><div class="knowledge-toolbar"><div class="knowledge-toolbar-left"><button class="knowledge-filter ${state.filter==='all'?'active':''}" data-filter="all">Todo</button>${Object.entries(CATEGORY_LABELS).map(([k,v])=>`<button class="knowledge-filter ${state.filter===k?'active':''}" data-filter="${k}">${v}</button>`).join('')}</div><div class="knowledge-stats">${state.items.filter(usable).length} fuentes activas y vigentes · ${state.items.length} totales</div></div><div class="knowledge-list">${filtered.length?filtered.map(renderItem).join(''):'<div class="knowledge-empty">Todavía no hay información cargada en esta categoría.</div>'}</div><div class="notice wide"><strong>Regla central:</strong> Conocimiento explica productos, beneficios, promociones y políticas. Los precios y artículos vigentes se administran desde Catálogo.</div></div>`;
    bind();
  }

  function renderItem(i){
    const active=usable(i),validity=i.valid_until&&i.valid_until<today()?'Vencido':active?'Activo':'Inactivo';
    return `<article class="knowledge-entry ${i.is_active?'':'inactive'}"><div><span class="card-kicker">${esc(CATEGORY_LABELS[i.category]||i.category)}</span><h3>${esc(i.title)}</h3><p>${esc(i.content||'Sin descripción')}</p><div class="knowledge-entry-meta"><span class="knowledge-chip ${active?'active':''}">${validity}</span><span class="knowledge-chip">Prioridad ${Number(i.priority||100)}</span></div></div><div class="knowledge-actions"><button data-edit="${i.id}">Editar</button><button data-toggle="${i.id}">${i.is_active?'Desactivar':'Activar'}</button><button class="knowledge-danger" data-delete="${i.id}">Eliminar</button></div></article>`;
  }

  function bind(){
    el('knowledge-add')?.addEventListener('click',()=>openModal());
    document.querySelectorAll('.knowledge-filter').forEach(b=>b.onclick=()=>{state.filter=b.dataset.filter;render()});
    document.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openModal(state.items.find(x=>x.id===b.dataset.edit)));
    document.querySelectorAll('[data-toggle]').forEach(b=>b.onclick=()=>toggle(b.dataset.toggle));
    document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>remove(b.dataset.delete));
  }

  function openModal(item=null){
    state.editingId=item?.id||null;
    const wrap=document.createElement('div');wrap.className='knowledge-modal-backdrop';wrap.id='knowledge-modal-backdrop';
    wrap.innerHTML=`<div class="knowledge-modal" role="dialog" aria-modal="true"><h3>${item?'Editar información':'Agregar información'}</h3><p>Cargá únicamente información que Black AI pueda comunicar a pacientes.</p><form class="knowledge-form" id="knowledge-form"><div class="knowledge-form-grid"><label>Categoría<select id="knowledge-category">${Object.entries(CATEGORY_LABELS).map(([k,v])=>`<option value="${k}" ${item?.category===k?'selected':''}>${v}</option>`).join('')}</select></label><label>Título<input id="knowledge-title" maxlength="120" required value="${esc(item?.title||'')}"></label></div><label>Información<textarea id="knowledge-content" required>${esc(item?.content||'')}</textarea></label><div class="knowledge-form-grid"><label>Vigente desde<input type="date" id="knowledge-from" value="${item?.valid_from||''}"></label><label>Vigente hasta<input type="date" id="knowledge-until" value="${item?.valid_until||''}"></label></div><div class="knowledge-form-grid"><label>Prioridad<input type="number" id="knowledge-priority" min="1" max="999" value="${Number(item?.priority||100)}"></label><label>Estado<select id="knowledge-active"><option value="true" ${item?.is_active!==false?'selected':''}>Activo</option><option value="false" ${item?.is_active===false?'selected':''}>Inactivo</option></select></label></div><div class="knowledge-form-actions"><button type="button" class="btn-secondary" id="knowledge-cancel">Cancelar</button><button class="btn-primary" type="submit">Guardar</button></div></form></div>`;
    document.body.appendChild(wrap);el('knowledge-cancel').onclick=()=>wrap.remove();wrap.onclick=e=>{if(e.target===wrap)wrap.remove()};el('knowledge-form').onsubmit=save;
  }

  async function save(e){
    e.preventDefault();const payload={category:el('knowledge-category').value,title:el('knowledge-title').value.trim(),content:el('knowledge-content').value.trim(),is_active:el('knowledge-active').value==='true',priority:Number(el('knowledge-priority').value||100),valid_from:el('knowledge-from').value||null,valid_until:el('knowledge-until').value||null,updated_at:new Date().toISOString(),updated_by:state.session?.user?.id||null};
    let r=state.editingId?await state.client.from('black_ai_knowledge').update(payload).eq('id',state.editingId):await state.client.from('black_ai_knowledge').insert({...payload,created_by:state.session?.user?.id||null});
    if(r.error){alert(r.error.message);return}el('knowledge-modal-backdrop')?.remove();await load();
  }
  async function toggle(id){const i=state.items.find(x=>x.id===id);if(!i)return;const {error}=await state.client.from('black_ai_knowledge').update({is_active:!i.is_active,updated_at:new Date().toISOString()}).eq('id',id);if(error){alert(error.message);return}await load()}
  async function remove(id){if(!confirm('¿Eliminar esta información de Black AI?'))return;const {error}=await state.client.from('black_ai_knowledge').delete().eq('id',id);if(error){alert(error.message);return}await load()}
  function renderError(m){const h=el('tab-conocimiento');if(h)h.innerHTML=`<div class="notice wide"><strong>Error:</strong> ${esc(m)}</div>`}

  loadCatalogModule();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',load,{once:true});else load();
})();