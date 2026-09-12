const STORAGE_KEY='black_ai_v1_config';

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

function loadConfig(){
  try{return {...defaults,...JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}')}}catch(error){return {...defaults}}
}
function saveConfig(config){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(config));
  const state=document.getElementById('save-state');
  if(state){state.textContent='Guardado';setTimeout(()=>state.textContent='Configuración local',1000)}
}
let config=loadConfig();

const enabled=document.getElementById('ai-enabled');
const statusDot=document.getElementById('ai-status-dot');
const statusTitle=document.getElementById('ai-status-title');
const statusCopy=document.getElementById('ai-status-copy');

function renderStatus(){
  if(enabled) enabled.checked=!!config.enabled;
  statusDot?.classList.toggle('on',!!config.enabled);
  if(statusTitle) statusTitle.textContent=config.enabled?'IA activada':'IA desactivada';
  if(statusCopy) statusCopy.textContent=config.enabled
    ? (config.environment==='sandbox'?'Disponible solo bajo reglas de Sandbox.':'Disponible según el alcance configurado.')
    : 'No responde mensajes automáticamente.';
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

function update(patch){config={...config,...patch};saveConfig(config);renderAll()}

function mountCrmNav(){
  if(document.querySelector('.ai-crm-nav')) return;
  const nav=document.createElement('nav');
  nav.className='ai-crm-nav';
  nav.setAttribute('aria-label','Navegación CRM Black');
  nav.innerHTML=`
    <a href="crm-clientes.html">Inicio</a>
    <a href="crm-clientes.html">Clientes</a>
    <a href="crm-clientes.html">Campañas</a>
    <a href="seguimiento-presupuestos.html">Presupuestos</a>
    <a href="automatizaciones-postventa.html">Automatizaciones</a>
    <a href="black-ai.html" class="active" aria-current="page">IA</a>`;
  document.body.appendChild(nav);
  const eyebrow=document.querySelector('.eyebrow');
  if(eyebrow) eyebrow.textContent='CRM BLACK · INTELIGENCIA ARTIFICIAL';
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

document.querySelectorAll('.ai-tab').forEach(tab=>tab.addEventListener('click',()=>{
  document.querySelectorAll('.ai-tab').forEach(t=>t.classList.toggle('active',t===tab));
  document.querySelectorAll('.tab-panel').forEach(panel=>panel.classList.toggle('active',panel.id===`tab-${tab.dataset.tab}`));
}));

document.getElementById('reset-demo')?.addEventListener('click',()=>{
  if(!confirm('¿Restablecer la configuración de demostración de Black AI?'))return;
  config={...defaults};
  saveConfig(config);
  renderAll();
});

mountCrmNav();
renderAll();