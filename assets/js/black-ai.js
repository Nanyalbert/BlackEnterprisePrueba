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

async function initSupabaseSettings(){
  const status=document.getElementById('supabase-status');
  const detail=document.getElementById('supabase-detail');
  const integration=document.getElementById('supabase-integration-status');
  try{
    portalSupabase=window.BlackPortal?.getSupabase?.();
    if(!portalSupabase)throw new Error('Supabase no disponible');
    const {data:{session},error:sessionError}=await portalSupabase.auth.getSession();
    if(sessionError)throw sessionError;
    if(!session)throw new Error('Sesión no disponible');
    portalSession=session;

    const {data,error}=await portalSupabase
      .from('black_ai_settings')
      .select('config,updated_at')
      .eq('id',SETTINGS_ID)
      .maybeSingle();
    if(error)throw error;

    if(data?.config && Object.keys(data.config).length){
      config=normalizeConfig(data.config);
      saveLocalConfig();
      renderAll();
    }else{
      await syncConfigToSupabase(true);
    }

    remoteReady=true;
    setSaveState('Sincronizado con Supabase');
    if(status){status.textContent='Sincronizado';status.classList.remove('muted')}
    if(detail)detail.textContent='Configuración compartida entre dispositivos';
    if(integration){integration.textContent='Conectado';integration.className='connection ready'}
  }catch(error){
    remoteReady=false;
    setSaveState('Guardado en este dispositivo');
    if(status){status.textContent='Solo local';status.classList.add('muted')}
    if(detail)detail.textContent='Ejecutá la migración 10 para habilitar sincronización';
    if(integration){integration.textContent='Tabla pendiente';integration.className='connection pending'}
    console.warn('Black AI: configuración Supabase no disponible.',error);
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
    return true;
  }catch(error){
    remoteReady=false;
    setSaveState('Guardado local · Supabase no disponible');
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
initSupabaseSettings();
