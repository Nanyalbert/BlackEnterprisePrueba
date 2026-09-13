(()=>{
  const state={client:null,items:[],loading:false};
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function resolveClient(){try{if(window.parent&&window.parent!==window&&window.parent.BlackPortal?.getSupabase)return window.parent.BlackPortal.getSupabase();}catch(_){ }return window.BlackPortal?.getSupabase?.()||null}
  function fmt(ts){if(!ts)return '';try{return new Date(ts).toLocaleString('es-AR',{dateStyle:'short',timeStyle:'short'})}catch{return ts}}
  function typeLabel(item){return ({text:'Texto',image:'Imagen',audio:'Audio',video:'Video',document:'Documento'}[item.message_type]||item.message_type||'Mensaje')}
  function statusLabel(v){return ({processed:'Procesado',classified:'Clasificado',needs_review:'Revisar',error:'Error',unprocessed:'Sin procesar'}[v]||v||'Sin procesar')}
  function classificationLabel(v){return ({conversation:'Conversación',prescription:'Receta',frame:'Armazón',receipt:'Comprobante',promotion:'Promoción',other:'Otro',unclear:'No claro'}[v]||v||'Sin clasificar')}
  function summary(item){if(item.text_content)return item.text_content;if(item.caption)return item.caption;if(item.message_type==='image')return 'Imagen recibida';if(item.message_type==='audio')return 'Audio recibido';if(item.message_type==='document')return 'Documento recibido';return 'Mensaje recibido'}
  function rxLine(label,eye){if(!eye)return '';return `<div class="rx-row"><strong>${label}</strong><span>Esf ${esc(eye.sphere??'—')}</span><span>Cil ${esc(eye.cylinder??'—')}</span><span>Eje ${esc(eye.axis??'—')}</span></div>`}
  function prescriptionCard(item){const p=item.ai_analysis?.prescription;if(!p)return '';const add=item.ai_analysis?.prescription?.explicit_addition;const conf=item.ai_analysis?.confidence;return `<div class="ai-panel rx-panel"><div class="ai-panel-title"><span>Receta interpretada</span>${conf!=null?`<em>${Math.round(Number(conf)*100)}% confianza</em>`:''}</div>${p.distance?`<div class="rx-block"><b>Lejos</b>${rxLine('OD',p.distance.od)}${rxLine('OI',p.distance.oi)}</div>`:''}${p.near?`<div class="rx-block"><b>Cerca</b>${rxLine('OD',p.near.od)}${rxLine('OI',p.near.oi)}</div>`:''}${add?`<div class="rx-add">Adición: ${esc(add)}</div>`:''}${p.pd?`<div class="rx-add">DP: ${esc(p.pd)}</div>`:''}${Array.isArray(p.uncertain_fields)&&p.uncertain_fields.length?`<div class="rx-warning">Revisar: ${esc(p.uncertain_fields.join(', '))}</div>`:''}</div>`}
  function responseCard(item){const reply=item.metadata?.reply_preview;if(!reply)return '';return `<div class="ai-panel reply-panel"><div class="ai-panel-title"><span>Respuesta de Black AI</span></div><p>${esc(reply)}</p></div>`}
  function analysisCard(item){if(item.ai_classification==='prescription')return prescriptionCard(item);const a=item.ai_analysis;if(!a)return '';const conf=a.confidence!=null?`${Math.round(Number(a.confidence)*100)}%`:'';return `<div class="ai-panel"><div class="ai-panel-title"><span>Análisis IA</span>${conf?`<em>${conf} confianza</em>`:''}</div><div class="ai-analysis-line"><span>${esc(classificationLabel(item.ai_classification))}</span>${a.summary?`<p>${esc(a.summary)}</p>`:''}</div></div>`}
  function render(){
    const host=$('tab-auditoria');if(!host)return;
    const processed=state.items.filter(x=>['processed','classified'].includes(x.ai_status)).length;
    const review=state.items.filter(x=>x.ai_status==='needs_review'||x.ai_status==='error').length;
    host.innerHTML=`<div class="section-intro"><div><h2>Actividad</h2><p>Mensajes recibidos por WhatsApp, respuesta de Black AI y análisis realizado.</p></div><button class="btn-secondary" id="inbox-refresh" type="button">Actualizar</button></div>
      <div class="inbox-stats"><div><span>Eventos</span><strong>${state.items.length}</strong></div><div><span>Procesados</span><strong>${processed}</strong></div><div><span>Para revisar</span><strong>${review}</strong></div></div>
      <div class="inbox-list">${state.items.length?state.items.map(item=>`<article class="inbox-item">
        <div class="inbox-top"><div><strong>${esc(item.push_name||item.phone||'Sin nombre')}</strong><span>${esc(item.phone||'Sin número')} · ${esc(fmt(item.received_at))}</span></div><div class="inbox-badges"><span class="inbox-type">${esc(typeLabel(item))}</span><span class="inbox-status status-${esc(item.ai_status||'unprocessed')}">${esc(statusLabel(item.ai_status))}</span></div></div>
        <div class="message-block"><span class="message-label">Paciente</span><p>${esc(summary(item))}</p></div>
        ${responseCard(item)}${analysisCard(item)}
        <div class="inbox-meta"><span>${esc(classificationLabel(item.ai_classification))}</span><span>Evento: ${esc(item.event_name||'-')}</span><span>Instancia: ${esc(item.instance_name||'-')}</span>${item.referral?'<span class="has-referral">Campaña detectada</span>':''}</div>
      </article>`).join(''):`<div class="inbox-empty">Todavía no hay actividad registrada.</div>`}</div>`;
    $('inbox-refresh')?.addEventListener('click',load);
  }
  async function load(){
    if(state.loading)return;state.loading=true;
    try{
      if(!state.client)state.client=resolveClient();
      if(!state.client)throw new Error('Supabase no disponible');
      const {data,error}=await state.client.from('black_ai_inbox').select('id,event_name,instance_name,message_id,phone,push_name,from_me,is_group,message_type,media_type,text_content,caption,has_media,referral,metadata,ai_status,ai_classification,ai_analysis,received_at').order('received_at',{ascending:false}).limit(100);
      if(error)throw error;
      state.items=(data||[]).filter(x=>!x.from_me&&!x.is_group);
      render();
    }catch(error){
      const host=$('tab-auditoria');if(host)host.innerHTML=`<div class="section-intro"><div><h2>Actividad</h2><p>No se pudo leer la actividad de Black AI.</p></div></div><div class="notice wide"><strong>Error:</strong> ${esc(error?.message||error)}</div>`;
    }finally{state.loading=false}
  }
  const start=()=>load();if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();