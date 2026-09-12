(() => {
  const FUNCTION_NAME = 'black-ai-chat';
  const TIMEOUT_MS = 15000;
  let busy = false;
  let history = [];

  function getClient(){
    try{
      if(window.parent && window.parent !== window && window.parent.BlackPortal?.getSupabase){
        return window.parent.BlackPortal.getSupabase();
      }
    }catch(_){}
    return window.BlackPortal?.getSupabase?.() || null;
  }

  function escapeHtml(value){
    return String(value || '').replace(/[&<>'"]/g, ch => ({
      '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
    })[ch]);
  }

  function append(role, text){
    const log = document.getElementById('ai-lab-log');
    if(!log) return null;
    document.getElementById('ai-lab-empty')?.remove();
    const el = document.createElement('div');
    el.className = `ai-lab-message ${role}`;
    el.innerHTML = escapeHtml(text).replace(/\n/g,'<br>');
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function thinking(){
    const log = document.getElementById('ai-lab-log');
    if(!log) return null;
    const el = document.createElement('div');
    el.className = 'ai-lab-message assistant';
    el.innerHTML = '<span class="ai-lab-thinking"><i></i><i></i><i></i></span>';
    log.appendChild(el);
    log.scrollTop = log.scrollHeight;
    return el;
  }

  function setBusy(value){
    busy = value;
    const button = document.getElementById('ai-lab-send');
    const input = document.getElementById('ai-lab-input');
    if(button){
      button.disabled = value;
      button.textContent = value ? 'Enviando…' : 'Enviar';
    }
    if(input) input.disabled = value;
  }

  function setRuntime(label, detail, ready=false){
    const badge = document.getElementById('ai-runtime-badge');
    const status = document.getElementById('openai-status');
    const detailEl = document.getElementById('openai-detail');
    const integration = document.getElementById('openai-integration-status');
    if(badge){ badge.textContent = label; badge.className = `ai-runtime-badge ${ready?'ready':'error'}`; }
    if(status){ status.textContent = ready ? 'Listo' : label; status.classList.toggle('muted', !ready); }
    if(detailEl) detailEl.textContent = detail;
    if(integration){ integration.textContent = ready ? 'Conectado' : 'Revisar'; integration.className = `connection ${ready?'ready':'off'}`; }
  }

  async function withTimeout(promise, ms=TIMEOUT_MS){
    let id;
    const timeout = new Promise((_, reject) => {
      id = setTimeout(() => reject(new Error('La Edge Function no respondió dentro de 15 segundos.')), ms);
    });
    try { return await Promise.race([promise, timeout]); }
    finally { clearTimeout(id); }
  }

  async function callFunction(body){
    const client = getClient();
    if(!client) throw new Error('No se pudo acceder a Supabase desde Black AI.');
    const { data: sessionData, error: sessionError } = await client.auth.getSession();
    if(sessionError) throw sessionError;
    if(!sessionData?.session) throw new Error('La sesión de Black OS no está disponible.');

    const result = await withTimeout(client.functions.invoke(FUNCTION_NAME,{ body }));
    if(result?.error){
      const context = result.error.context;
      let detail = '';
      try{
        if(context?.json) detail = (await context.json())?.error || '';
      }catch(_){}
      throw new Error(detail || result.error.message || 'La Edge Function devolvió un error.');
    }
    return result?.data;
  }

  async function checkHealth(){
    setRuntime('Verificando motor','Comprobando black-ai-chat y OPENAI_API_KEY');
    try{
      const data = await callFunction({action:'health'});
      if(!data?.ok) throw new Error(data?.error || 'La función no respondió correctamente.');
      if(!data?.configured) throw new Error('OPENAI_API_KEY no está configurada en Supabase Secrets.');
      setRuntime('Motor listo',`OpenAI disponible · ${data.model || 'modelo configurado'}`,true);
      return true;
    }catch(error){
      setRuntime('Motor no disponible',String(error?.message || error));
      return false;
    }
  }

  async function send(){
    if(busy) return;
    const input = document.getElementById('ai-lab-input');
    const message = input?.value.trim() || '';
    if(!message) return;

    // Feedback inmediato: el usuario ve que el click funcionó antes de hacer cualquier llamada de red.
    append('user', message);
    if(input) input.value = '';
    setBusy(true);
    const wait = thinking();

    try{
      const data = await callFunction({ action:'chat', message, history:history.slice(-8) });
      wait?.remove();
      if(!data?.ok || !data?.reply) throw new Error(data?.error || 'Black AI no devolvió una respuesta.');
      append('assistant', data.reply);
      history.push({role:'user',content:message},{role:'assistant',content:data.reply});
      history = history.slice(-10);
      setRuntime('Motor listo',`OpenAI disponible · ${data.model || 'modelo configurado'}`,true);
      const meta = document.getElementById('ai-lab-meta');
      if(meta){
        const usage=data.usage||{};
        const parts=[data.model, Number.isFinite(usage.input_tokens)?`${usage.input_tokens} entrada`:null, Number.isFinite(usage.output_tokens)?`${usage.output_tokens} salida`:null].filter(Boolean);
        meta.textContent=parts.length?parts.join(' · '):'Respuesta recibida';
      }
    }catch(error){
      wait?.remove();
      const text = String(error?.message || error || 'No se pudo generar la respuesta.');
      append('error', text);
      setRuntime('Motor no disponible', text);
      console.error('Black AI chat:', error);
    }finally{
      setBusy(false);
      input?.focus();
    }
  }

  function clear(){
    history=[];
    const log=document.getElementById('ai-lab-log');
    if(log) log.innerHTML='<div class="ai-lab-empty" id="ai-lab-empty">Escribí como si fueras un paciente. Black AI responderá usando el tono y las reglas configuradas en esta pantalla.</div>';
    const meta=document.getElementById('ai-lab-meta');
    if(meta) meta.textContent='Sin consultas todavía';
  }

  function boot(){
    const sendButton=document.getElementById('ai-lab-send');
    const clearButton=document.getElementById('ai-lab-clear');
    const input=document.getElementById('ai-lab-input');
    if(!sendButton || !input) return;

    // Capture para reemplazar de forma segura el listener anterior sin duplicar envíos.
    sendButton.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      send();
    }, true);
    clearButton?.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      clear();
    }, true);
    input.addEventListener('keydown', event => {
      if(event.key==='Enter' && !event.shiftKey){
        event.preventDefault();
        event.stopImmediatePropagation();
        send();
      }
    }, true);

    checkHealth();
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();
