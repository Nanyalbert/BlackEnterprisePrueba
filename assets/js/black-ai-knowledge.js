(()=>{
  const CATEGORY_LABELS={
    price_product:'Precios y productos',
    promotion:'Beneficios y promociones',
    commercial:'Información comercial',
    policy:'Atención y políticas'
  };
  const state={items:[],filter:'all',editingId:null,client:null,session:null};

  function el(id){return document.getElementById(id)}
  function esc(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function today(){return new Date().toISOString().slice(0,10)}
  function resolveClient(){
    try{
      if(window.parent&&window.parent!==window&&window.parent.BlackPortal?.getSupabase) return window.parent.BlackPortal.getSupabase();
    }catch(_){ }
    return window.BlackPortal?.getSupabase?.()||null;
  }
  function isExpired(item){return item.valid_until&&item.valid_until<today()}
  function isNotStarted(item){return item.valid_from&&item.valid_from>today()}
  function usable(item){return item.is_active&&!isExpired(item)&&!isNotStarted(item)}

  async function load(){
    const host=el('tab-conocimiento');
    if(!host)return;
    if(!state.client)state.client=resolveClient();
    if(!state.client){renderError('Supabase no está disponible en esta sesión.');return}
    const {data:{session}}=await state.client.auth.getSession();
    state.session=session;
    const {data,error}=await state.client.from('black_ai_knowledge')
      .select('id,category,title,content,data,is_active,priority,valid_from,valid_until,created_at,updated_at')
      .order('priority',{ascending:true}).order('updated_at',{ascending:false});
    if(error){renderError(error.message);return}
    state.items=data||[];
    render();
  }

  function render(){
    const host=el('tab-conocimiento');
    if(!host)return;
    const activeCount=state.items.filter(usable).length;
    const filtered=state.filter==='all'?state.items:state.items.filter(x=>x.category===state.filter);
    host.innerHTML=`
      <div class="section-intro">
        <div><h2>Conocimiento</h2><p>Información comercial aprobada que Black AI puede utilizar para responder.</p></div>
        <button class="btn-primary" type="button" id="knowledge-add">Agregar información</button>
      </div>
      <div class="knowledge-manager">
        <div class="knowledge-toolbar">
          <div class="knowledge-toolbar-left">
            <button class="knowledge-filter ${state.filter==='all'?'active':''}" data-filter="all">Todo</button>
            ${Object.entries(CATEGORY_LABELS).map(([k,v])=>`<button class="knowledge-filter ${state.filter===k?'active':''}" data-filter="${k}">${v}</button>`).join('')}
          </div>
          <div class="knowledge-stats">${activeCount} fuentes activas y vigentes · ${state.items.length} totales</div>
        </div>
        <div class="knowledge-list">
          ${filtered.length?filtered.map(renderItem).join(''):`<div class="knowledge-empty">Todavía no hay información cargada en esta categoría.</div>`}
        </div>
        <div class="notice wide"><strong>Regla central:</strong> Black AI solo puede usar fuentes activas y dentro de su período de vigencia. Si falta un dato comercial, debe pedir confirmación o derivar la consulta.</div>
      </div>`;
    bind();
  }

  function renderItem(item){
    const expired=isExpired(item),notStarted=isNotStarted(item),active=usable(item);
    const validity=expired?'Vencido':notStarted?'Aún no vigente':active?'Activo':'Inactivo';
    const cls=expired?'expired':active?'active':'';
    const dates=[item.valid_from?`Desde ${item.valid_from}`:'',item.valid_until?`Hasta ${item.valid_until}`:''].filter(Boolean).join(' · ');
    return `<article class="knowledge-entry ${item.is_active?'':'inactive'}">
      <div>
        <span class="card-kicker">${esc(CATEGORY_LABELS[item.category]||item.category)}</span>
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.content||'Sin descripción')}</p>
        <div class="knowledge-entry-meta">
          <span class="knowledge-chip ${cls}">${validity}</span>
          ${dates?`<span class="knowledge-chip">${esc(dates)}</span>`:''}
          <span class="knowledge-chip">Prioridad ${Number(item.priority||100)}</span>
        </div>
      </div>
      <div class="knowledge-actions">
        <button data-edit="${item.id}">Editar</button>
        <button data-toggle="${item.id}">${item.is_active?'Desactivar':'Activar'}</button>
        <button class="knowledge-danger" data-delete="${item.id}">Eliminar</button>
      </div>
    </article>`;
  }

  function bind(){
    el('knowledge-add')?.addEventListener('click',()=>openModal());
    document.querySelectorAll('.knowledge-filter').forEach(btn=>btn.addEventListener('click',()=>{state.filter=btn.dataset.filter;render()}));
    document.querySelectorAll('[data-edit]').forEach(btn=>btn.addEventListener('click',()=>openModal(state.items.find(x=>x.id===btn.dataset.edit))));
    document.querySelectorAll('[data-toggle]').forEach(btn=>btn.addEventListener('click',()=>toggle(btn.dataset.toggle)));
    document.querySelectorAll('[data-delete]').forEach(btn=>btn.addEventListener('click',()=>remove(btn.dataset.delete)));
  }

  function openModal(item=null){
    state.editingId=item?.id||null;
    const wrap=document.createElement('div');
    wrap.className='knowledge-modal-backdrop';wrap.id='knowledge-modal-backdrop';
    wrap.innerHTML=`<div class="knowledge-modal" role="dialog" aria-modal="true">
      <h3>${item?'Editar información':'Agregar información'}</h3>
      <p>Cargá únicamente información que Black AI pueda comunicar a pacientes.</p>
      <form class="knowledge-form" id="knowledge-form">
        <div class="knowledge-form-grid">
          <label>Categoría<select id="knowledge-category">${Object.entries(CATEGORY_LABELS).map(([k,v])=>`<option value="${k}" ${item?.category===k?'selected':''}>${v}</option>`).join('')}</select></label>
          <label>Título<input id="knowledge-title" maxlength="120" required value="${esc(item?.title||'')}"></label>
        </div>
        <label>Información<textarea id="knowledge-content" required placeholder="Ej: Anteojo completo desde $... Incluye armazón seleccionado + lentes orgánicos blancos.">${esc(item?.content||'')}</textarea></label>
        <div class="knowledge-form-grid">
          <label>Vigente desde<input type="date" id="knowledge-from" value="${item?.valid_from||''}"></label>
          <label>Vigente hasta<input type="date" id="knowledge-until" value="${item?.valid_until||''}"></label>
        </div>
        <div class="knowledge-form-grid">
          <label>Prioridad<input type="number" id="knowledge-priority" min="1" max="999" value="${Number(item?.priority||100)}"></label>
          <label>Estado<select id="knowledge-active"><option value="true" ${item?.is_active!==false?'selected':''}>Activo</option><option value="false" ${item?.is_active===false?'selected':''}>Inactivo</option></select></label>
        </div>
        <div class="knowledge-status-line">Prioridad menor = se muestra antes cuando varias fuentes son relevantes.</div>
        <div class="knowledge-form-actions"><button type="button" class="btn-secondary" id="knowledge-cancel">Cancelar</button><button class="btn-primary" type="submit">Guardar</button></div>
      </form>
    </div>`;
    document.body.appendChild(wrap);
    el('knowledge-cancel')?.addEventListener('click',()=>wrap.remove());
    wrap.addEventListener('click',e=>{if(e.target===wrap)wrap.remove()});
    el('knowledge-form')?.addEventListener('submit',save);
  }

  async function save(event){
    event.preventDefault();
    const payload={
      category:el('knowledge-category').value,
      title:el('knowledge-title').value.trim(),
      content:el('knowledge-content').value.trim(),
      is_active:el('knowledge-active').value==='true',
      priority:Number(el('knowledge-priority').value||100),
      valid_from:el('knowledge-from').value||null,
      valid_until:el('knowledge-until').value||null,
      updated_at:new Date().toISOString(),
      updated_by:state.session?.user?.id||null
    };
    if(!payload.title||!payload.content)return;
    let result;
    if(state.editingId){result=await state.client.from('black_ai_knowledge').update(payload).eq('id',state.editingId)}
    else{result=await state.client.from('black_ai_knowledge').insert({...payload,created_by:state.session?.user?.id||null})}
    if(result.error){alert(`No se pudo guardar: ${result.error.message}`);return}
    el('knowledge-modal-backdrop')?.remove();
    await load();
  }

  async function toggle(id){
    const item=state.items.find(x=>x.id===id);if(!item)return;
    const {error}=await state.client.from('black_ai_knowledge').update({is_active:!item.is_active,updated_at:new Date().toISOString(),updated_by:state.session?.user?.id||null}).eq('id',id);
    if(error){alert(error.message);return}await load();
  }
  async function remove(id){
    if(!confirm('¿Eliminar esta información de Black AI?'))return;
    const {error}=await state.client.from('black_ai_knowledge').delete().eq('id',id);
    if(error){alert(error.message);return}await load();
  }
  function renderError(message){
    const host=el('tab-conocimiento');if(!host)return;
    host.innerHTML=`<div class="section-intro"><div><h2>Conocimiento</h2><p>No se pudo abrir la base de conocimiento.</p></div></div><div class="notice wide"><strong>Error:</strong> ${esc(message)}. Si todavía no ejecutaste la migración <code>sql/12_black_ai_knowledge.sql</code>, hacelo en Supabase SQL Editor.</div>`;
  }

  const start=()=>load();
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
