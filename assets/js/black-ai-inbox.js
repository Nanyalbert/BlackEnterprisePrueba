(()=>{
  const state={client:null,items:[],loading:false};
  const $=id=>document.getElementById(id);
  function esc(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
  function resolveClient(){try{if(window.parent&&window.parent!==window&&window.parent.BlackPortal?.getSupabase)return window.parent.BlackPortal.getSupabase();}catch(_){ }return window.BlackPortal?.getSupabase?.()||null}
  function fmt(ts){if(!ts)return '';try{return new Date(ts).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'})}catch{return ts}}
  function typeLabel(item){const t=item.message_type||'unknown';return ({text:'Texto',image:'Imagen',audio:'Audio',video:'Video',document:'Documento'}[t]||t)}
  function summary(item){if(item.text_content)return item.text_content;if(item.caption)return item.caption;if(item.message_type==='image')return 'Imagen recibida';if(item.message_type==='audio')return 'Audio recibido';if(item.message_type==='document')return 'Documento recibido';return 'Mensaje recibido'}
  function render(){
    const host=$('tab-auditoria');if(!host)return;
    host.innerHTML=`<div class="section-intro"><div><h2>Actividad</h2><p>Mensajes entrantes detectados por Black AI. Esta etapa es solo observación: no responde automáticamente.</p></div><button class="btn-secondary" id="inbox-refresh" type="button">Actualizar</button></div>
      <div class="inbox-toolbar"><span>${state.items.length} eventos recientes</span><strong>Modo lectura · sin respuestas automáticas</strong></div>
      <div class="inbox-list">${state.items.length?state.items.map(item=>`<article class="inbox-item">
        <div class="inbox-top"><div><strong>${esc(item.push_name||item.phone||'Sin nombre')}</strong><span>${esc(item.phone||'Sin número')} · ${esc(fmt(item.received_at))}</span></div><span class="inbox-type">${esc(typeLabel(item))}</span></div>
        <p>${esc(summary(item))}</p>
        <div class="inbox-meta"><span>Evento: ${esc(item.event_name||'-')}</span><span>Instancia: ${esc(item.instance_name||'-')}</span><span>Estado IA: ${esc(item.ai_status||'unprocessed')}</span>${item.referral?'<span class="has-referral">Con metadata de campaña</span>':''}</div>
      </article>`).join(''):`<div class="inbox-empty">Todavía no recibimos mensajes de Evolution API.</div>`}</div>`;
    $('inbox-refresh')?.addEventListener('click',load);
  }
  async function load(){
    if(state.loading)return;state.loading=true;
    try{
      if(!state.client)state.client=resolveClient();
      if(!state.client)throw new Error('Supabase no disponible');
      const {data,error}=await state.client.from('black_ai_inbox').select('id,event_name,instance_name,message_id,phone,push_name,from_me,is_group,message_type,media_type,text_content,caption,has_media,referral,ai_status,received_at').order('received_at',{ascending:false}).limit(100);
      if(error)throw error;
      state.items=(data||[]).filter(x=>!x.from_me&&!x.is_group);
      render();
    }catch(error){
      const host=$('tab-auditoria');if(host)host.innerHTML=`<div class="section-intro"><div><h2>Actividad</h2><p>No se pudo leer la bandeja de entrada.</p></div></div><div class="notice wide"><strong>Error:</strong> ${esc(error?.message||error)}. Ejecutá <code>sql/14_black_ai_inbox.sql</code> si todavía no lo hiciste.</div>`;
    }finally{state.loading=false}
  }
  const start=()=>load();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();