const STORAGE_KEY='black_ai_v1_config';
const SETTINGS_ID='global';

const defaults={
  enabled:false,
  environment:'sandbox',
  replyMode:'assisted',
  scope:'single',
  testNumber:'',
  testNumberList:'',
  tone:'friendly',
  length:'short',
  emoji:'moderate'
};

let config=loadLocalConfig();
let portalSupabase=null;
let portalSession=null;
let remoteReady=false;
let saveTimer=null;
let openAiReady=false;
let aiLabBusy=false;
let aiLabHistory=[];

const enabled=document.getElementById('ai-enabled');
const statusDot=document.getElementById('ai-status-dot');
const statusTitle=document.getElementById('ai-status-title');
const statusCopy=document.getElementById('ai-status-copy');

function loadLocalConfig(){
  try{return {...defaults,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch{return {...defaults}}
}

function saveLocalConfig(){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(config));
}

function setSaveState(text){
  const state=document.getElementById('save-state');
  if(state)state.textContent=text;
}

function setSupabaseUi(statusText,detailText,integrationText,integrationClass='pending'){
  const status=document.getElementById('supabase-status');
  const detail=document.getElementById('supabase-detail');
  const integration=document.getElementById('supabase-integration-status');
  if(status){status.textContent=statusText;status.classList.toggle('muted',statusText!=='Sincronizado')}
  if(detail)detail.textContent=detailText;
  if(integration){integration.textContent=integrationText;integration.className=`connection ${integrationClass}`}
}

function setOpenAiUi(statusText,detailText,integrationText,integrationClass='pending'){
  const status=document.getElementById('openai-status');
  const detail=document.getElementById('openai-detail');
  const integration=document.getElementById('openai-integration-status');
  const badge=document.getElementById('ai-runtime-badge');
  if(status){status.textContent=statusText;status.classList.toggle('muted',statusText!=='Listo')}
  if(detail)detail.textContent=detailText;
  if(integration){integration.textContent=integrationText;integration.className=`connection ${integrationClass}`}
  if(badge){
    badge.textContent=statusText==='Listo'?'Motor listo':statusText;
    badge.className=`ai-runtime-badge ${statusText==='Listo'?'ready':integrationClass==='off'?'error':''}`;
  }
}

function humanSupabaseError(error){
  const message=String(error?.message||error?.error_description||error||'Error desconocido');
  const code=String(error?.code||'');
  if(/session/i.test(message))return 'No se encontró una sesión activa de Black OS.';
  if(/permission|row-level|rls|42501/i.test(`${message} ${code}`))return 'Supabase bloqueó la operación por permisos RLS.';
  if(/does not exist|schema cache|PGRST205|42P01/i.test(`${message} ${code}`))return 'La tabla black_ai_settings no está disponible para la API.';
  if(/failed to fetch|network|load failed/i.test(message))return 'No se pudo comunicar con Supabase desde el navegador.';
  return `${code?`${code} · `:''}${message}`;
}

function resolveSupabaseClient(){
  try{
    if(window.parent&&window.parent!==window&&window.parent.BlackPortal?.getSupabase){
      return window.parent.BlackPortal.getSupabase();
    }
  }catch(error){}
  return window.BlackPortal?.getSupabase?.()||null;
}

function normalizeConfig(value){
  const c={...defaults,...(value||{})};
  c.enabled=!!c.enabled;
  if(!['sandbox','production'].includes(c.environment))c.environment='sandbox';
  if(!['assisted','automatic','manual'].includes(c.replyMode))c.replyMode='assisted';
  if(!['single','list','all'].includes(c.scope))c.scope='single';
  return c;
}

function renderStatus(){
  if(enabled) enabled.checked=!!config.enabled;
  statusDot?.classList.toggle('on',!!config.enabled);
  if(statusTitle) statusTitle.textContent=config.enabled?'Asistente activado':'Asistente desactivado';
  if(statusCopy) statusCopy.textContent=config.enabled
    ? (config.environment==='sandbox'?'Activo únicamente dentro del entorno de pruebas.':'Disponible según el alcance y las reglas configuradas.')
    : 'No interviene en ninguna conversación.';
}

function renderEnvironment(){
  document.querySelectorAll('#environment-selector .segment').forEach(btn=>btn.classList.toggle('active',btn.dataset.value===config.environment));
}
function renderReplyMode(){
  document.querySelectorAll('input[name="reply-mode"]').forEach(input=>input.checked=input.value===config.replyMode);
}
function renderScope(){
  document.querySelectorAll('input[name="scope"]').forEach(input=>{
    input.checked=input.value===config.scope;
    input.closest('.scope-option')?.classList.toggle('active',input.checked);
  });
  document.getElementById('single-number-box')?.classList.toggle('hidden',config.scope!=='single');
  document.getElementById('list-number-box')?.classList.toggle('hidden',config.scope!=='list');
}
function renderFields(){
  const n=document.getElementById('test-number'); if(n)n.value=config.testNumber||'';
  const l=document.getElementById('test-number-list'); if(l)l.value=config.testNumberList||'';
  const tone=document.getElementById('tone'); if(tone)tone.value=config.tone;
  const len=document.getElementById('length'); if(len)len.value=config.length;
  const emoji=document.getElementById('emoji'); if(emoji)emoji.value=config.emoji;
}
function renderAll(){renderStatus();renderEnvironment();renderReplyMode();renderScope();renderFields()}

function update(patch){
  config=normalizeConfig({...config,...patch});
  saveLocalConfig();
  renderAll();
  setSaveState(remoteReady?'Guardando en Supabase…':'Guardado en este dispositivo');
  clearTimeout(saveTimer);
  saveTimer=setTimeout(syncConfigToSupabase,350);
}

async function waitForSession(client,attempts=4){
  for(let i=0;i<attempts;i++){
    const {data:{session},error}=await client.auth.getSession();
    if(error)throw error;
    if(session)return session;
    if(i<attempts-1)await new Promise(resolve=>setTimeout(resolve,250));
  }
  return null;
}

async function initSupabaseSettings(){
  try{
    setSupabaseUi('Verificando','Validando sesión y tabla de configuración','Verificando','pending');
    portalSupabase=resolveSupabaseClient();
    if(!portalSupabase)throw new Error('Supabase no disponible');

    portalSession=await waitForSession(portalSupabase);
    if(!portalSession)throw new Error('Sesión no disponible');

    const {data,error}=await portalSupabase
      .from('black_ai_settings')
      .select('config,updated_at')
      .eq('id',SETTINGS_ID)
      .maybeSingle();
    if(error)throw error;

    if(data?.config&&Object.keys(data.config).length){
      config=normalizeConfig(data.config);
      saveLocalConfig();
      renderAll();
    }else{
      const saved=await syncConfigToSupabase(true);
      if(!saved)throw new Error('No se pudo guardar la configuración inicial');
    }

    remoteReady=true;
    setSaveState('Sincronizado con Supabase');
    setSupabaseUi('Sincronizado','Configuración compartida entre dispositivos','Conectado','ready');
    return true;
  }catch(error){
    remoteReady=false;
    const reason=humanSupabaseError(error);
    setSaveState(`Guardado local · ${reason}`);
    setSupabaseUi('Solo local',reason,'Revisar','pending');
    console.warn('Black AI: configuración Supabase no disponible.',error);
    return false;
  }
}

async function syncConfigToSupabase(force=false){
  saveLocalConfig();
  if(!portalSupabase||!portalSession){
    if(!force)setSaveState('Guardado en este dispositivo');
    return false;
  }
  try{
    const payload={
      id:SETTINGS_ID,
      config,
      updated_at:new Date().toISOString(),
      updated_by:portalSession.user?.id||null
    };
    const {error}=await portalSupabase.from('black_ai_settings').upsert(payload,{onConflict:'id'});
    if(error)throw error;
    remoteReady=true;
    setSaveState('Sincronizado con Supabase');
    setSupabaseUi('Sincronizado','Configuración compartida entre dispositivos','Conectado','ready');
    return true;
  }catch(error){
    remoteReady=false;
    const reason=humanSupabaseError(error);
    setSaveState(`Guardado local · ${reason}`);
    setSupabaseUi('Solo local',reason,'Revisar','pending');
    console.warn('Black AI: no se pudo sincronizar configuración.',error);
    return false;
  }
}

function readCrmEvolutionConfig(){
  try{
    const raw=localStorage.getItem('black_crm_cfg');
    if(!raw)return null;
    const cfg=JSON.parse(raw);
    const ready=!!(cfg?.evoUrl&&cfg?.evoKey&&cfg?.evoInstance);
    return {ready,instance:cfg?.evoInstance||'',url:cfg?.evoUrl||''};
  }catch{return null}
}

function renderEvolutionStatus(){
  const state=readCrmEvolutionConfig();
  const status=document.getElementById('evolution-status');
  const detail=document.getElementById('evolution-detail');
  const integration=document.getElementById('evolution-integration-status');
  if(!state?.ready){
    if(status){status.textContent='No configurado';status.classList.add('muted')}
    if(detail)detail.textContent='Completá la conexión desde CRM Black';
    if(integration){integration.textContent='No configurada';integration.className='connection off'}
    return;
  }
  if(status){status.textContent='Configurado';status.classList.remove('muted')}
  if(detail)detail.textContent=state.instance?`Instancia: ${state.instance}`:'Evolution API disponible';
  if(integration){integration.textContent='Configurada';integration.className='connection ready'}
}

async function checkOpenAiRuntime(){
  if(!portalSupabase||!portalSession){
    openAiReady=false;
    setOpenAiUi('Sin conexión','Primero debe estar disponible la sesión de Supabase','Revisar','off');
    return false;
  }
  try{
    setOpenAiUi('Verificando','Comprobando Edge Function y clave de OpenAI','Verificando','pending');
    const {data,error}=await portalSupabase.functions.invoke('black-ai-chat',{body:{action:'health'}});
    if(error)throw error;
    if(!data?.ok)throw new Error(data?.error||'La función no respondió correctamente');
    if(!data?.configured){
      openAiReady=false;
      setOpenAiUi('Falta clave','OPENAI_API_KEY no está configurada en Edge Function Secrets','Sin clave','off');
      return false;
    }
    openAiReady=true;
    setOpenAiUi('Listo',`OpenAI disponible · ${data.model||'modelo configurado'}`,'Conectado','ready');
    return true;
  }catch(error){
    openAiReady=false;
    const message=String(error?.context?.body?.error||error?.message||error||'Error al verificar el motor');
    setOpenAiUi('No disponible',message,'Revisar','off');
    console.warn('Black AI: Edge Function no disponible.',error);
    return false;
  }
}

function normalizePhone(value){
  return String(value||'').replace(/\D/g,'');
}

function authorizedNumbers(){
  if(config.scope==='single')return [normalizePhone(config.testNumber)].filter(Boolean);
  if(config.scope==='list')return String(config.testNumberList||'').split(/[\n,;]/).map(normalizePhone).filter(Boolean);
  return [];
}

function evaluateAccess(rawNumber){
  const phone=normalizePhone(rawNumber);
  if(!phone)return {ok:false,title:'Número inválido',detail:'Ingresá un número válido para hacer la prueba.'};
  if(!config.enabled)return {ok:false,title:'Black AI está desactivado',detail:'La configuración bloquea cualquier intervención.'};
  if(config.replyMode==='manual')return {ok:false,title:'Modo solo manual',detail:'Black AI no genera respuestas mientras este modo esté activo.'};
  if(config.scope==='all')return {ok:true,title:'Conversación habilitada',detail:`El número ${phone} supera el filtro de alcance. Todavía no se enviará ningún mensaje real.`};
  const allowed=authorizedNumbers();
  if(!allowed.length)return {ok:false,title:'Falta configurar el alcance',detail:'No hay ningún número autorizado cargado.'};
  if(!allowed.includes(phone))return {ok:false,title:'Número fuera del alcance',detail:'Black AI ignoraría esta conversación con la configuración actual.'};
  return {ok:true,title:'Conversación habilitada',detail:`El número ${phone} está autorizado. Todavía no se enviará ningún mensaje real.`};
}

function runSimulator(){
  const input=document.getElementById('simulator-number');
  const box=document.getElementById('simulator-result');
  if(!box)return;
  const result=evaluateAccess(input?.value||'');
  box.className=`simulator-result ${result.ok?'allowed':'blocked'}`;
  box.innerHTML=`<strong>${result.title}</strong><span>${result.detail}</span>`;
}

function escapeHtml(value){
  return String(value||'').replace(/[&<>'"]/g,char=>({
    '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'
  })[char]);
}

function appendLabMessage(role,content){
  const log=document.getElementById('ai-lab-log');
  if(!log)return;
  document.getElementById('ai-lab-empty')?.remove();
  const item=document.createElement('div');
  item.className=`ai-lab-message ${role}`;
  item.innerHTML=escapeHtml(content).replace(/\n/g,'<br>');
  log.appendChild(item);
  log.scrollTop=log.scrollHeight;
  return item;
}

function appendThinking(){
  const log=document.getElementById('ai-lab-log');
  if(!log)return null;
  document.getElementById('ai-lab-empty')?.remove();
  const item=document.createElement('div');
  item.className='ai-lab-message assistant';
  item.innerHTML='<span class="ai-lab-thinking"><i></i><i></i><i></i></span>';
  log.appendChild(item);
  log.scrollTop=log.scrollHeight;
  return item;
}

function setLabBusy(busy){
  aiLabBusy=busy;
  const send=document.getElementById('ai-lab-send');
  const input=document.getElementById('ai-lab-input');
  if(send){send.disabled=busy;send.textContent=busy?'Pensando…':'Enviar'}
  if(input)input.disabled=busy;
}

function updateLabMeta(data){
  const meta=document.getElementById('ai-lab-meta');
  if(!meta)return;
  const usage=data?.usage;
  const inputTokens=usage?.input_tokens;
  const outputTokens=usage?.output_tokens;
  const parts=[];
  if(data?.model)parts.push(data.model);
  if(Number.isFinite(inputTokens))parts.push(`${inputTokens} entrada`);
  if(Number.isFinite(outputTokens))parts.push(`${outputTokens} salida`);
  meta.textContent=parts.length?parts.join(' · '):'Respuesta recibida';
}

async function sendLabMessage(){
  if(aiLabBusy)return;
  const input=document.getElementById('ai-lab-input');
  const message=input?.value.trim()||'';
  if(!message)return;

  if(!openAiReady){
    const ok=await checkOpenAiRuntime();
    if(!ok){appendLabMessage('error','El motor de IA todavía no está disponible. Revisá la tarjeta “Motor de IA”.');return;}
  }

  appendLabMessage('user',message);
  if(input)input.value='';
  setLabBusy(true);
  const thinking=appendThinking();

  try{
    const history=aiLabHistory.slice(-8);
    const {data,error}=await portalSupabase.functions.invoke('black-ai-chat',{
      body:{action:'chat',message,history}
    });
    thinking?.remove();
    if(error)throw error;
    if(!data?.ok||!data?.reply)throw new Error(data?.error||'Black AI no devolvió una respuesta');

    appendLabMessage('assistant',data.reply);
    aiLabHistory.push({role:'user',content:message},{role:'assistant',content:data.reply});
    aiLabHistory=aiLabHistory.slice(-10);
    updateLabMeta(data);
  }catch(error){
    thinking?.remove();
    const messageText=String(error?.context?.body?.error||error?.message||error||'No se pudo generar la respuesta');
    appendLabMessage('error',messageText);
    console.warn('Black AI: error en laboratorio.',error);
  }finally{
    setLabBusy(false);
    input?.focus();
  }
}

function clearLab(){
  aiLabHistory=[];
  const log=document.getElementById('ai-lab-log');
  if(log)log.innerHTML='<div class="ai-lab-empty" id="ai-lab-empty">Escribí como si fueras un paciente. Black AI responderá usando el tono y las reglas configuradas en esta pantalla.</div>';
  const meta=document.getElementById('ai-lab-meta');
  if(meta)meta.textContent='Sin consultas todavía';
}

function ensureCrmNav(){
  if(document.querySelector('.ai-crm-nav'))return;
  const nav=document.createElement('nav');
  nav.className='ai-crm-nav';
  nav.setAttribute('aria-label','Navegación CRM Black');
  nav.innerHTML=`
    <a href="crm-clientes.html">Inicio</a>
    <a href="crm-clientes.html#clientes">Clientes</a>
    <a href="crm-clientes.html#campanas">Campañas</a>
    <a href="seguimiento-presupuestos.html">Presupuestos</a>
    <a href="automatizaciones-postventa.html">Automatizaciones</a>
    <a class="active" href="black-ai.html">IA</a>`;
  document.body.appendChild(nav);
}

enabled?.addEventListener('change',()=>update({enabled:enabled.checked}));
document.querySelectorAll('#environment-selector .segment').forEach(btn=>btn.addEventListener('click',()=>update({environment:btn.dataset.value})));
document.querySelectorAll('input[name="reply-mode"]').forEach(input=>input.addEventListener('change',()=>update({replyMode:input.value})));
document.querySelectorAll('input[name="scope"]').forEach(input=>input.addEventListener('change',()=>update({scope:input.value})));
document.getElementById('save-number')?.addEventListener('click',()=>update({testNumber:document.getElementById('test-number')?.value.trim()||''}));
document.getElementById('test-number-list')?.addEventListener('change',event=>update({testNumberList:event.target.value}));
document.getElementById('tone')?.addEventListener('change',event=>update({tone:event.target.value}));
document.getElementById('length')?.addEventListener('change',event=>update({length:event.target.value}));
document.getElementById('emoji')?.addEventListener('change',event=>update({emoji:event.target.value}));
document.getElementById('simulate-access')?.addEventListener('click',runSimulator);
document.getElementById('simulator-number')?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();runSimulator();}});
document.getElementById('ai-lab-send')?.addEventListener('click',sendLabMessage);
document.getElementById('ai-lab-clear')?.addEventListener('click',clearLab);
document.getElementById('ai-lab-input')?.addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendLabMessage();}
});

document.querySelectorAll('.ai-tab').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.ai-tab').forEach(t=>t.classList.toggle('active',t===tab));
  document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.id===`tab-${tab.dataset.tab}`));
}));

document.getElementById('reset-demo')?.addEventListener('click',async()=>{
  if(!confirm('¿Restablecer la configuración de Black AI?'))return;
  config={...defaults};
  saveLocalConfig();
  renderAll();
  await syncConfigToSupabase();
});

renderAll();
renderEvolutionStatus();
ensureCrmNav();
initSupabaseSettings().then(ok=>{if(ok)checkOpenAiRuntime();});
