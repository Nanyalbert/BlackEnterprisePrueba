// ── SEGURIDAD: escape de HTML para todo dato de usuario (anti-XSS) ──
function esc(v){return String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}

// ── CONFIG / SESIÓN COMPARTIDA DEL PORTAL ──
let portalSupabase = null;
let portalSession = null;
let cfg=JSON.parse(localStorage.getItem('black_crm_cfg')||'{}');

// URL y publishable key se heredan del Portal Black; nunca se solicitan en este CRM.
function aplicarConfigPortal(){
  cfg.url = window.BlackPortal?.SUPABASE_URL || cfg.url || '';
  cfg.key = window.BlackPortal?.SUPABASE_ANON_KEY || cfg.key || '';
  cfg.area = cfg.area || '351';
}
aplicarConfigPortal();

function guardarConfig(){
  aplicarConfigPortal();
  cfg.area=document.getElementById('sb_area')?.value?.replace(/\D/g,'')||cfg.area||'351';
  cfg.evoUrl=document.getElementById('evo_url')?.value?.trim()||cfg.evoUrl||'';
  cfg.evoKey=document.getElementById('evo_key')?.value?.trim()||cfg.evoKey||'';
  cfg.evoInstance=document.getElementById('evo_instance')?.value?.trim()||cfg.evoInstance||'';
  localStorage.setItem('black_crm_cfg',JSON.stringify({area:cfg.area,evoUrl:cfg.evoUrl,evoKey:cfg.evoKey,evoInstance:cfg.evoInstance}));
}
function cargarConfig(){
  if(document.getElementById('sb_area'))document.getElementById('sb_area').value=cfg.area||'351';
  if(document.getElementById('evo_url'))document.getElementById('evo_url').value=cfg.evoUrl||'';
  if(document.getElementById('evo_key'))document.getElementById('evo_key').value=cfg.evoKey||'';
  if(document.getElementById('evo_instance'))document.getElementById('evo_instance').value=cfg.evoInstance||'';
}

async function iniciarSesionPortal(){
  try{
    portalSupabase = window.BlackPortal?.getSupabase?.();
    if(!portalSupabase) throw new Error('Supabase no disponible');
    const {data:{session},error}=await portalSupabase.auth.getSession();
    if(error) throw error;
    if(!session){
      if(window.top && window.top!==window) window.top.location.replace('index.html');
      else window.location.replace('index.html');
      return false;
    }
    portalSession=session;
    portalSupabase.auth.onAuthStateChange((_event,newSession)=>{
      portalSession=newSession;
      if(!newSession){
        if(window.top && window.top!==window) window.top.location.replace('index.html');
        else window.location.replace('index.html');
      }
    });
    aplicarConfigPortal();
    return true;
  }catch(err){
    console.error('No se pudo validar la sesión del Portal Black:',err);
    if(window.top && window.top!==window) window.top.location.replace('index.html');
    else window.location.replace('index.html');
    return false;
  }
}

// ── AJUSTES DEL NEGOCIO ──
let ajustes=JSON.parse(localStorage.getItem('black_crm_ajustes')||'null')||{
  etapas:[
    {id:'atencion',label:'Atención',color:'#6b6860'},
    {id:'atraccion',label:'Atracción',color:'#6c8fff'},
    {id:'averiguacion',label:'Averiguación',color:'#a07cf8'},
    {id:'accion',label:'Acción',color:'#2dd4a0'},
    {id:'apologia',label:'Apología',color:'#f0a030'},
  ],
  etiquetasSistema:['recetado','sol','contacto','alta gama','ya compró','bifocal','progresivos','control visual'],
  // Plantillas: cada etapa tiene array de {texto, delayValor, delayUnidad, trigger}
  secuencias:{
    atencion:[
      {texto:'Hola {{nombre}} 👋 Somos Óptica [nombre]. ¿Buscás lentes de sol, de vista, o querés un control visual?',delayValor:0,delayUnidad:'horas',trigger:'al_llegar'},
      {texto:'Hola {{nombre}}! ¿Pudiste ver lo que te enviamos? Estamos para ayudarte 😊',delayValor:48,delayUnidad:'horas',trigger:'sin_respuesta'},
    ],
    atraccion:[
      {texto:'Hola {{nombre}}, te seguimos desde Óptica [nombre]. ¿Alguna duda? 😊',delayValor:48,delayUnidad:'horas',trigger:'sin_respuesta'},
      {texto:'{{nombre}}, un saludo! Si querés comparar opciones, estamos acá 👓',delayValor:96,delayUnidad:'horas',trigger:'sin_respuesta'},
    ],
    averiguacion:[
      {texto:'Hola {{nombre}} 👓 ¿Cómo seguís con el presupuesto de {{producto}}{{monto}}? ¿Alguna duda?',delayValor:48,delayUnidad:'horas',trigger:'sin_respuesta'},
      {texto:'{{nombre}}, ¿pudiste evaluarlo? A veces hay opciones intermedias 😊',delayValor:96,delayUnidad:'horas',trigger:'sin_respuesta'},
      {texto:'Último mensaje {{nombre}} — si retomás el tema, nos encontrás acá. ¡Buen día!',delayValor:7,delayUnidad:'días',trigger:'sin_respuesta'},
    ],
    accion:[
      {texto:'¡Perfecto {{nombre}}! Tu pedido está en proceso 🙌 Te avisamos cuando esté listo.',delayValor:0,delayUnidad:'horas',trigger:'al_llegar'},
      {texto:'{{nombre}}, ¿cómo te están yendo los lentes? Si necesitás ajuste pasá sin turno 😊',delayValor:7,delayUnidad:'días',trigger:'al_llegar'},
    ],
    apologia:[
      {texto:'Hola {{nombre}}! ¿Podés dejarnos una reseña en Google? ⭐ [link] ¡Gracias!',delayValor:3,delayUnidad:'días',trigger:'al_llegar'},
      {texto:'{{nombre}}, hacemos limpieza de armazones sin cargo. ¡Cuando quieras pasate! 😊',delayValor:30,delayUnidad:'días',trigger:'al_llegar'},
    ],
  },
  // Fechas especiales: por etapa + generales
  fechasEspeciales:[
    {id:'navidad',emoji:'🎄',nombre:'Navidad',dia:'12-24',hora:'10:00',activo:true,destinatarios:'todos',
     mensajeGeneral:'¡Feliz Navidad {{nombre}}! 🎄 El equipo de Óptica [nombre] te desea una hermosa noche. ¡Gracias por ser parte de este año!',
     mensajesPorEtapa:{
       atencion:'¡Feliz Navidad {{nombre}}! 🎄 Aprovechá las fiestas para regalarte esos lentes que estabas mirando. Tenemos promos especiales esta semana.',
       atraccion:'¡Feliz Navidad {{nombre}}! 🎄 Si querés cerrar el año con lentes nuevos, esta semana tenemos condiciones especiales. ¿Te interesa?',
       averiguacion:'¡Feliz Navidad {{nombre}}! 🎄 Antes de que termine el año, ¿pudiste decidirte por el presupuesto que te pasamos?',
       accion:'¡Feliz Navidad {{nombre}}! 🎄 Esperamos que estés disfrutando tus lentes. ¡Gracias por elegirnos este año!',
       apologia:'¡Feliz Navidad {{nombre}}! 🎄 Fue un placer atenderte este año. ¡Que tengas unas hermosas fiestas!',
     }},
    {id:'anionuevo',emoji:'🎆',nombre:'Año Nuevo',dia:'12-31',hora:'09:00',activo:true,destinatarios:'todos',
     mensajeGeneral:'¡Feliz Año Nuevo {{nombre}}! 🎆 Que el 2025 sea increíble. ¡Gracias por confiar en nosotros!',
     mensajesPorEtapa:{}},
    {id:'diamigo',emoji:'🤝',nombre:'Día del Amigo',dia:'07-20',hora:'10:00',activo:true,destinatarios:'todos',
     mensajeGeneral:'¡Feliz Día del Amigo {{nombre}}! 🤝 Desde Óptica [nombre] te mandamos un abrazo. ¿Sabías que podés regalar lentes? Ideal para sorprender a alguien especial.',
     mensajesPorEtapa:{
       atencion:'¡Feliz Día del Amigo {{nombre}}! 🤝 ¿Qué mejor regalo que unos lentes nuevos? Esta semana tenemos un 15% OFF para celebrar. ¡Consultanos!',
     }},
    {id:'vision',emoji:'👁️',nombre:'Día Mundial de la Visión',dia:'10-10',hora:'09:00',activo:true,destinatarios:'todos',
     mensajeGeneral:'Hoy es el Día Mundial de la Visión 👁️ {{nombre}}, recordá que el control visual anual es clave. ¿Hace cuánto no te revisás la graduación?',
     mensajesPorEtapa:{
       atencion:'Hoy es el Día Mundial de la Visión 👁️ {{nombre}}, ¿sabías que el 80% de los problemas visuales son prevenibles? Esta semana hacemos controles sin costo. ¡Reservá tu turno!',
       atraccion:'Hoy es el Día Mundial de la Visión 👁️ {{nombre}}, acordate que te podemos hacer un control visual sin cargo. ¡Aprovechá!',
     }},
    {id:'blackfriday',emoji:'⬛',nombre:'Black Friday',dia:'11-29',hora:'08:00',activo:false,destinatarios:'todos',
     mensajeGeneral:'⬛ BLACK FRIDAY en Óptica [nombre] {{nombre}}! Hasta 30% OFF en armazones y lentes de sol. Solo por hoy. ¡No te lo pierdas!',
     mensajesPorEtapa:{
       atencion:'⬛ BLACK FRIDAY {{nombre}}! Es el momento perfecto para esos lentes que estabas mirando. 30% OFF solo hoy. ¿Te mandamos opciones?',
       averiguacion:'⬛ BLACK FRIDAY {{nombre}}! El presupuesto que te pasamos tiene 20% adicional solo por hoy. ¿Aprovechamos?',
     }},
    {id:'diadre',emoji:'👁️',nombre:'Día del Graduado',dia:'06-11',hora:'10:00',activo:false,destinatarios:'todos',
     mensajeGeneral:'¡Feliz Día del Graduado {{nombre}}! 🎓 En Óptica [nombre] tenemos armazones especiales para recién recibidos. ¡Consultanos!',
     mensajesPorEtapa:{}},
  ],
};
function guardarAjustes(){localStorage.setItem('black_crm_ajustes',JSON.stringify(ajustes));}

// Compatibilidad con versión anterior (plantillas simples → secuencias)
if(ajustes.plantillas && !ajustes.secuencias){
  ajustes.secuencias={};
  Object.entries(ajustes.plantillas).forEach(([etapa,msgs])=>{
    ajustes.secuencias[etapa]=msgs.map((texto,i)=>({texto,delayValor:i===0?0:48,delayUnidad:'horas',trigger:i===0?'al_llegar':'sin_respuesta'}));
  });
  delete ajustes.plantillas;
  guardarAjustes();
}

// ── SUPABASE ──
function sbH(){const token=portalSession?.access_token||cfg.key;return{'Content-Type':'application/json','apikey':cfg.key,'Authorization':'Bearer '+token};}
function sbU(p){return cfg.url+'/rest/v1/'+p;}
async function sbQ(path,opts={}){if(!cfg.url||!cfg.key)return null;try{const r=await fetch(sbU(path),{headers:sbH(),...opts});if(!r.ok)return null;const t=r.headers.get('content-type');return t?.includes('json')?r.json():null;}catch{return null;}}
let pollTimer=null,lastPoll=null;
function setSyncState(s){
  const dot=document.getElementById('syncDot');
  const lbl=document.getElementById('syncLabel');
  dot.className='sync-dot'+(s==='live'?' live':'');
  dot.title=s==='live'?'Conectado a Supabase':'Sin conexión — datos guardados localmente';
  if(lbl){lbl.textContent=s==='live'?'live':'local';lbl.style.color=s==='live'?'var(--green)':'var(--text3)';}
}
async function testConexion(){const el=document.getElementById('configResult');el.textContent='Verificando...';el.style.color='var(--amber)';const d=await sbQ('clientes?select=id&limit=1');if(d!==null){el.textContent='✅ Sesión activa y tabla clientes accesible';el.style.color='var(--green)';setSyncState('live');cargarDesdeSupabase();iniciarPolling();}else{el.textContent='❌ Sesión válida, pero no se pudo acceder a clientes. Revisá tabla/RLS.';el.style.color='var(--red)';}}
async function cargarDesdeSupabase(){const d=await sbQ('clientes?order=created_at.desc&limit=500');if(!d){setSyncState('off');return;}clientes=d.map(mapRow);nextId=clientes.length+1;lastPoll=new Date().toISOString();setSyncState('live');render();}
async function sincronizarNuevos(){const since=lastPoll||new Date(Date.now()-60000).toISOString();const d=await sbQ(`clientes?created_at=gt.${since}&order=created_at.asc`);if(!d||!d.length)return;lastPoll=new Date().toISOString();let n=0;d.forEach(row=>{if(!clientes.find(c=>c.id===row.id)){clientes.unshift(mapRow(row));n++;}});if(n){render();toast(`${n} lead${n>1?'s':''} nuevo${n>1?'s':''} 🔔`);}}
function iniciarPolling(){if(pollTimer)clearInterval(pollTimer);pollTimer=setInterval(sincronizarNuevos,30000);}
function mapRow(r){return{id:r.id,nombre:r.nombre||'',tel:r.tel||'',ig:r.ig||'',fuente:r.fuente||'whatsapp',etapa:r.etapa||'atencion',prio:r.prio||'media',producto:r.producto||'',monto:Number(r.monto)||0,nota:r.nota||'',etiquetas:r.etiquetas||[],secuencia:r.secuencia||{paso:0,enviados:[]},ultimaRespuesta:r.ultima_respuesta||null,lastContact:r.last_contact||r.created_at||new Date().toISOString(),created:r.created_at||new Date().toISOString(),optOut:!!r.opt_out};}

function proximaFechaEspecial(){
  const hoy=new Date();
  const año=hoy.getFullYear();
  let proxima=null,diasMin=999;
  ajustes.fechasEspeciales.filter(f=>f.activo).forEach(f=>{
    const [mes,dia]=f.dia.split('-').map(Number);
    let fecha=new Date(año,mes-1,dia);
    if(fecha<hoy) fecha=new Date(año+1,mes-1,dia);
    const dias=Math.round((fecha-hoy)/86400000);
    if(dias<diasMin){diasMin=dias;proxima={...f,dias,fechaStr:fecha.toLocaleDateString('es-AR',{day:'numeric',month:'long'})};}
  });
  return proxima;
}
let _ultimoAvisoSB=0;
function avisoFalloSB(st){const now=Date.now();if(now-_ultimoAvisoSB<10000)return;_ultimoAvisoSB=now;toast('⚠️ No se pudo guardar en Supabase'+(st?' ('+st+')':'')+' — el dato quedó solo en este dispositivo');}
async function guardarSB(c){if(!cfg.url||!cfg.key)return;const body={nombre:c.nombre,tel:c.tel,ig:c.ig,fuente:c.fuente,etapa:c.etapa,prio:c.prio,producto:c.producto,monto:c.monto,nota:c.nota,etiquetas:c.etiquetas,secuencia:c.secuencia,ultima_respuesta:c.ultimaRespuesta,last_contact:c.lastContact,opt_out:!!c.optOut};const isUUID=typeof c.id==='string'&&c.id.length>20;try{if(isUUID){const r=await fetch(sbU(`clientes?id=eq.${c.id}`),{method:'PATCH',headers:sbH(),body:JSON.stringify(body)});if(!r.ok)avisoFalloSB(r.status);}else{const r=await fetch(sbU('clientes'),{method:'POST',headers:{...sbH(),'Prefer':'return=representation'},body:JSON.stringify(body)});if(r.ok){const d=await r.json();if(d[0])c.id=d[0].id;}else avisoFalloSB(r.status);}}catch(e){avisoFalloSB();}}
async function eliminarSB(id){if(!cfg.url||!cfg.key)return;await sbQ(`clientes?id=eq.${id}`,{method:'DELETE'});}

// ── DATOS ──
function dAgo(d){const dt=new Date();dt.setDate(dt.getDate()-d);return dt.toISOString();}
function daysDiff(iso){const d=Math.floor((Date.now()-new Date(iso))/86400000);if(d===0)return'hoy';if(d===1)return'ayer';return d+'d';}
function horasDesde(iso){if(!iso)return 9999;return(Date.now()-new Date(iso))/3600000;}
function normalizarTel(tel){
  if(!tel) return '';
  // 1. Quitar todo excepto dígitos y el + inicial
  let t = tel.trim();
  const tienePlus = t.startsWith('+');
  t = t.replace(/\D/g,'');
  if(!t) return '';

  // 2. Si ya tiene código de país 54 adelante
  if(t.startsWith('54')){
    const resto = t.slice(2);
    // Asegurar que tenga el 9 del celular (ej: 543514445555 → 5493514445555)
    if(resto.length === 10 && !resto.startsWith('9')) return '549' + resto;
    if(resto.length === 11 && resto.startsWith('9')) return '54' + resto;
    return '54' + resto;
  }

  // 3. Quitar 0 inicial (formato argentino viejo: 0351...)
  if(t.startsWith('0')) t = t.slice(1);

  // 4. Quitar 15 de celular (formato viejo: 11-15-1234-5678)
  // Si empieza con código de área + 15
  if(t.length === 11 && t.slice(2,4)==='15') t = t.slice(0,2) + t.slice(4);
  if(t.length === 12 && t.slice(3,5)==='15') t = t.slice(0,3) + t.slice(5);

  // 5. Normalizar según longitud
  if(t.length >= 6 && t.length <= 8){             // número local sin característica → usar la configurada (default Córdoba 351)
    const area=(cfg.area||'351').replace(/\D/g,'');
    return '549' + area + t;
  }
  if(t.length === 10) return '549' + t;           // código área + número (sin 9)
  if(t.length === 11 && t.startsWith('9')) return '54' + t; // ya tiene el 9
  if(t.length === 11) return '549' + t.slice(1); // código área con 0 residual
  if(t.length === 12) return '54' + t;           // completo sin +

  // Fallback: agregar 54 y devolver
  return '54' + t;
}

function normalizarTelMostrar(tel){
  // Versión legible para mostrar en pantalla: +54 9 351 444 5555
  const n = normalizarTel(tel);
  if(!n) return tel||'';
  if(n.length === 13 && n.startsWith('549')){
    return '+54 9 ' + n.slice(3,6) + ' ' + n.slice(6,9) + ' ' + n.slice(9);
  }
  if(n.length === 12 && n.startsWith('54')){
    return '+54 ' + n.slice(2,5) + ' ' + n.slice(5,8) + ' ' + n.slice(8);
  }
  return '+' + n;
}
function estaLocked(c){return horasDesde(c.ultimaRespuesta)<3;}

// Log de mensajes enviados (en memoria + localStorage)
let logEnvios=JSON.parse(localStorage.getItem('black_crm_log')||'[]');
function registrarLog(clienteId,nombre,tipo,mensaje){
  const entry={id:Date.now(),clienteId:String(clienteId),nombre,tipo,mensaje:mensaje.slice(0,80),fecha:new Date().toISOString()};
  logEnvios.unshift(entry);if(logEnvios.length>500)logEnvios=logEnvios.slice(0,500);
  localStorage.setItem('black_crm_log',JSON.stringify(logEnvios));
}

let clientes=[
  {id:1,nombre:'Fernanda Molina',tel:'+5493514445555',ig:'@fermolinaok',fuente:'instagram',etapa:'averiguacion',prio:'alta',producto:'Bifocales + armazón',monto:85000,nota:'Presupuesto vence mañana',etiquetas:['bifocal','recetado'],secuencia:{paso:1,enviados:[dAgo(2)]},ultimaRespuesta:null,lastContact:dAgo(2),created:dAgo(5),optOut:false},
  {id:2,nombre:'Sebastián Díaz',tel:'+5493510001111',ig:'@seba_d',fuente:'whatsapp',etapa:'atraccion',prio:'alta',producto:'Armazón recetado',monto:0,nota:'Sin respuesta 3 días',etiquetas:['recetado','alta gama'],secuencia:{paso:1,enviados:[dAgo(3)]},ultimaRespuesta:null,lastContact:dAgo(3),created:dAgo(4),optOut:false},
  {id:3,nombre:'Pablo García',tel:'+5493516667777',ig:'',fuente:'local',etapa:'averiguacion',prio:'alta',producto:'Lentes de contacto',monto:42000,nota:'Espera el sueldo',etiquetas:['contacto'],secuencia:{paso:0,enviados:[]},ultimaRespuesta:dAgo(1),lastContact:dAgo(2),created:dAgo(3),optOut:false},
  {id:4,nombre:'Diego Ruiz',tel:'+5493511234567',ig:'@diegoruiz',fuente:'instagram',etapa:'atencion',prio:'media',producto:'Lentes de sol',monto:0,nota:'Llegó por Instagram DM',etiquetas:['sol'],secuencia:{paso:0,enviados:[]},ultimaRespuesta:dAgo(0),lastContact:dAgo(0),created:dAgo(0),optOut:false},
  {id:5,nombre:'Camila Vega',tel:'+5493512223333',ig:'',fuente:'whatsapp',etapa:'atraccion',prio:'media',producto:'Lentes progresivos',monto:0,nota:'Interesada',etiquetas:['progresivos','recetado'],secuencia:{paso:1,enviados:[dAgo(1)]},ultimaRespuesta:dAgo(0),lastContact:dAgo(1),created:dAgo(1),optOut:false},
  {id:6,nombre:'Jorge Méndez',tel:'+5493511112222',ig:'',fuente:'local',etapa:'accion',prio:'baja',producto:'Bifocales Zeiss',monto:125000,nota:'Entregado hoy',etiquetas:['alta gama','ya compró'],secuencia:{paso:0,enviados:[]},ultimaRespuesta:dAgo(0),lastContact:dAgo(0),created:dAgo(7),optOut:false},
  {id:7,nombre:'Marcela Ríos',tel:'+5493515556666',ig:'@marcerios',fuente:'instagram',etapa:'apologia',prio:'baja',producto:'Lentes de sol',monto:52000,nota:'Reseña 5 estrellas',etiquetas:['sol','ya compró'],secuencia:{paso:0,enviados:[]},ultimaRespuesta:dAgo(5),lastContact:dAgo(5),created:dAgo(30),optOut:false},
];
let nextId=9,currentId=null;
// ── PERSISTENCIA LOCAL: los clientes ahora sobreviven al refresh sin Supabase ──
(function(){try{const g=JSON.parse(localStorage.getItem('black_crm_clientes')||'null');if(Array.isArray(g)&&g.length){clientes=g;nextId=clientes.reduce((m,c)=>typeof c.id==='number'&&c.id>=m?c.id+1:m,1);}}catch(e){}})();
function guardarLocal(){try{localStorage.setItem('black_crm_clientes',JSON.stringify(clientes.slice(0,500)));}catch(e){}}

// ── URGENCIA ──
function getUrgencia(c){const dias=Math.floor((Date.now()-new Date(c.lastContact))/86400000);if(['accion','apologia'].includes(c.etapa))return'ok';if(c.etapa==='averiguacion'&&c.monto>0&&dias>=2)return'ahora';if(dias>=3)return'ahora';if(dias>=1&&!c.ultimaRespuesta)return'hoy';return'ok';}
function urgenciaLabel(u){if(u==='ahora')return{text:'contactar ahora',cls:'u-ahora'};if(u==='hoy')return{text:'contactar hoy',cls:'u-hoy'};return{text:'al día',cls:'u-ok'};}

// ── COLORES ETIQUETAS ──
const PALETA=[{bg:'rgba(108,143,255,0.1)',b:'rgba(108,143,255,0.3)',t:'#6c8fff'},{bg:'rgba(45,212,160,0.09)',b:'rgba(45,212,160,0.3)',t:'#2dd4a0'},{bg:'rgba(240,160,48,0.1)',b:'rgba(240,160,48,0.3)',t:'#f0a030'},{bg:'rgba(160,124,248,0.1)',b:'rgba(160,124,248,0.3)',t:'#a07cf8'},{bg:'rgba(56,212,224,0.1)',b:'rgba(56,212,224,0.3)',t:'#38d4e0'},{bg:'rgba(240,80,96,0.1)',b:'rgba(240,80,96,0.3)',t:'#f05060'},{bg:'rgba(234,88,12,0.1)',b:'rgba(234,88,12,0.3)',t:'#f06030'}];
function colEtiq(t){let h=0;for(let c of t)h=(h*31+c.charCodeAt(0))%PALETA.length;return PALETA[Math.abs(h)];}
function etiqChipHtml(t){const c=colEtiq(t);return`<span class="etiqueta-chip" style="background:${c.bg};border-color:${c.b};color:${c.t}">${esc(t)}</span>`;}

// ── MENSAJES ──
function interpolar(tpl,c){return tpl.replace(/\{\{nombre\}\}/g,c.nombre).replace(/\{\{producto\}\}/g,c.producto||'los lentes').replace(/\{\{monto\}\}/g,c.monto?` ($${Number(c.monto).toLocaleString('es-AR')})`:'' );}
function getMsgPaso(c,paso){const g=ajustes.secuencias[c.etapa];if(!g)return'';const item=g[Math.min(paso,g.length-1)]||g[0];return interpolar(item?.texto||item||'',c);}
function getTotalPasos(c){return(ajustes.secuencias[c.etapa]||[]).length||1;}
function getDelayTexto(item){if(!item||item.delayValor===0)return'al llegar a esta etapa';return`${item.delayValor} ${item.delayUnidad} después`;}
function getEstadoSeq(c){const total=getTotalPasos(c),paso=c.secuencia?.paso||0,dias=Math.floor((Date.now()-new Date(c.lastContact))/86400000);if(dias>=7&&!c.ultimaRespuesta&&paso>0)return'frio';if(paso>=total)return['accion','apologia'].includes(c.etapa)?'completa':'frio';if(paso===0)return'pendiente';return'en_curso';}
function getSugerencia(c){const dias=Math.floor((Date.now()-new Date(c.lastContact))/86400000),paso=c.secuencia?.paso||0;const seq=ajustes.secuencias[c.etapa];const next=seq?.[paso];if(next){const h=next.delayUnidad==='días'?next.delayValor*24:next.delayValor;if(h===0)return'enviar inmediatamente al llegar a esta etapa';return`${next.delayValor} ${next.delayUnidad} — configurado en Ajustes`;}if(!c.ultimaRespuesta&&dias>=5)return'72hs — no respondió, espaciá más';return'48hs';}

// ── STATS ──
function updateStats(){const hoy=new Date();hoy.setHours(0,0,0,0);document.getElementById('dsContactar').textContent=clientes.filter(c=>['ahora','hoy'].includes(getUrgencia(c))).length;document.getElementById('dsRespondieron').textContent=clientes.filter(c=>c.ultimaRespuesta&&new Date(c.ultimaRespuesta)>=hoy).length;document.getElementById('dsNuevos').textContent=clientes.filter(c=>new Date(c.created)>=hoy).length;document.getElementById('dsTotal').textContent=clientes.length;}

// ── VISTAS ──
let vistaActual='hoy';
function setView(v,btn){vistaActual=v;document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');render();}
function renderBoard(){render();}

// ── STATS CLICKEABLES ──
function statClick(tipo){
  const hoy=new Date();hoy.setHours(0,0,0,0);
  // Navegar a vista Todos con filtro visual
  const navBtn=document.getElementById('nav-todos');
  document.querySelectorAll('.nav-btn').forEach(b=>b.classList.remove('active'));
  navBtn.classList.add('active');
  vistaActual='todos';
  // Aplicar filtro temporal según stat
  let lista=[];
  let titulo='';
  if(tipo==='contactar'){
    lista=clientes.filter(c=>['ahora','hoy'].includes(getUrgencia(c)));
    titulo='Para contactar hoy';
  } else if(tipo==='respondieron'){
    lista=clientes.filter(c=>c.ultimaRespuesta&&new Date(c.ultimaRespuesta)>=hoy);
    titulo='Respondieron hoy';
  } else if(tipo==='nuevos'){
    lista=clientes.filter(c=>new Date(c.created)>=hoy);
    titulo='Nuevos hoy';
  } else {
    lista=clientes;
    titulo='Todos los clientes';
  }
  updateStats();
  const el=document.getElementById('mainContent');
  const sorted=[...lista].sort((a,b)=>{const o={ahora:0,hoy:1,ok:2};return(o[getUrgencia(a)]||2)-(o[getUrgencia(b)]||2);});
  el.innerHTML=renderFiltros()+
    '<div class="section-header"><span class="section-label">'+titulo+'</span><span class="section-count">'+sorted.length+'</span>'+(tipo!=='todos'?'<button onclick="render()" style="margin-left:auto;font-size:11px;color:var(--accent);background:transparent;border:none;cursor:pointer;font-family:Geist,sans-serif;">✕ ver todos</button>':'')+'</div>'+
    '<div class="work-list">'+sorted.map(c=>wItem(c)).join('')+'</div>';
  bindWorkItems();
}
function render(){guardarLocal();updateStats();const el=document.getElementById('mainContent');if(vistaActual==='hoy')el.innerHTML=renderHoy();else if(vistaActual==='todos')el.innerHTML=renderTodos();else if(vistaActual==='tablero')el.innerHTML=renderTablero();else if(vistaActual==='resumen')el.innerHTML=renderResumen();else if(vistaActual==='ajustes')el.innerHTML=renderAjustes();else if(vistaActual==='campanas')el.innerHTML=renderCampañaHTML();bindWorkItems();}

function renderHoy(){
  const urg=clientes.filter(c=>getUrgencia(c)==='ahora').sort((a,b)=>new Date(a.lastContact)-new Date(b.lastContact));
  const man=clientes.filter(c=>getUrgencia(c)==='hoy');
  const ok=clientes.filter(c=>getUrgencia(c)==='ok'&&!['apologia'].includes(c.etapa));
  const fieles=clientes.filter(c=>c.etapa==='apologia');
  let h='';
  if(urg.length)h+=`<div class="section-header"><span class="section-label">Contactar ahora</span><span class="section-count">${urg.length}</span></div><div class="work-list">${urg.map(c=>wItem(c)).join('')}</div>`;
  if(man.length)h+=`<div class="section-header"><span class="section-label">Seguimiento hoy</span><span class="section-count">${man.length}</span></div><div class="work-list">${man.map(c=>wItem(c)).join('')}</div>`;
  if(ok.length)h+=`<div class="section-header"><span class="section-label">Al día</span><span class="section-count">${ok.length}</span></div><div class="work-list">${ok.map(c=>wItem(c,'mini')).join('')}</div>`;
  if(fieles.length)h+=`<div class="section-header"><span class="section-label">⭐ Clientes fieles</span><span class="section-count">${fieles.length}</span></div><div class="work-list">${fieles.map(c=>wItem(c,'mini')).join('')}</div>`;
  if(!urg.length&&!man.length&&!ok.length&&!fieles.length){
    if(clientes.length===0){
      h=`<div class="empty" style="padding:40px 24px">
        <div class="empty-icon">👁️</div>
        <div style="font-size:18px;font-weight:600;color:var(--text);margin-bottom:8px">Bienvenido a BLACK CRM</div>
        <div style="font-size:14px;color:var(--text2);line-height:1.7;margin-bottom:20px">Todavía no tenés clientes cargados.<br>Presioná el <strong>+</strong> para agregar el primero,<br>o conectá Supabase en ⚙️ para sincronizar.</div>
        <button class="btn btn-primary" onclick="openAddModal()" style="display:inline-flex;width:auto;padding:12px 24px">+ Agregar primer cliente</button>
      </div>`;
    } else {
      h=`<div class="empty"><div class="empty-icon">🎉</div><div class="empty-text" style="font-size:15px;font-weight:500;color:var(--text)">Todo al día</div><div style="font-size:13px;color:var(--text3);margin-top:4px">Sin pendientes para hoy</div></div>`;
    }
  }
  return h;
}
// ── FILTROS ──
let filtros={etapa:'',fuente:'',etiqueta:''};
function renderFiltros(){
  const etapas=[{id:'',label:'Todas las etapas'},...ajustes.etapas];
  const fuentes=[{id:'',label:'Todas las fuentes'},{id:'whatsapp',label:'WhatsApp'},{id:'instagram',label:'Instagram'},{id:'local',label:'Local'},{id:'formulario',label:'Formulario'},{id:'referido',label:'Referido'}];
  const etiquetasUnicas=['', ...[...new Set(clientes.flatMap(c=>c.etiquetas||[]))]];
  return`<div style="display:flex;gap:6px;padding:8px 16px 4px;flex-wrap:wrap;">
    <select onchange="filtros.etapa=this.value;renderBoard()" style="flex:1;min-width:110px;background:var(--surface);border:1px solid var(--border2);border-radius:20px;padding:6px 12px;font-size:12px;color:var(--text);font-family:Geist,sans-serif;outline:none;">
      ${etapas.map(e=>`<option value="${e.id}" ${filtros.etapa===e.id?'selected':''}>${esc(e.label)}</option>`).join('')}
    </select>
    <select onchange="filtros.fuente=this.value;renderBoard()" style="flex:1;min-width:110px;background:var(--surface);border:1px solid var(--border2);border-radius:20px;padding:6px 12px;font-size:12px;color:var(--text);font-family:Geist,sans-serif;outline:none;">
      ${fuentes.map(f=>`<option value="${f.id}" ${filtros.fuente===f.id?'selected':''}>${f.label}</option>`).join('')}
    </select>
    <select onchange="filtros.etiqueta=this.value;renderBoard()" style="flex:1;min-width:110px;background:var(--surface);border:1px solid var(--border2);border-radius:20px;padding:6px 12px;font-size:12px;color:var(--text);font-family:Geist,sans-serif;outline:none;">
      ${etiquetasUnicas.map(t=>`<option value="${esc(t)}" ${filtros.etiqueta===t?'selected':''}>${esc(t)||'Todas las etiquetas'}</option>`).join('')}
    </select>
  </div>`;
}
function aplicarFiltros(lista){
  return lista.filter(c=>{
    if(filtros.etapa && c.etapa!==filtros.etapa) return false;
    if(filtros.fuente && c.fuente!==filtros.fuente) return false;
    if(filtros.etiqueta && !(c.etiquetas||[]).includes(filtros.etiqueta)) return false;
    return true;
  });
}

function renderTodos(){
  const sorted=aplicarFiltros([...clientes]).sort((a,b)=>{const o={ahora:0,hoy:1,ok:2};return(o[getUrgencia(a)]||2)-(o[getUrgencia(b)]||2);});
  const hayFiltros=filtros.etapa||filtros.fuente||filtros.etiqueta;
  return`${renderFiltros()}<div class="section-header"><span class="section-label">Todos</span><span class="section-count">${sorted.length}${hayFiltros?` de ${clientes.length}`:''}</span>${hayFiltros?`<button onclick="filtros={etapa:'',fuente:'',etiqueta:''};renderBoard()" style="margin-left:auto;font-size:11px;color:var(--accent);background:transparent;border:none;cursor:pointer;font-family:Geist,sans-serif;">✕ limpiar</button>`:''}</div><div class="work-list">${sorted.map(c=>wItem(c)).join('')||'<div class="empty" style="padding:20px"><div class="empty-text">Sin resultados para estos filtros</div></div>'}</div>`;
}

function wItem(c,mode='full'){
  const u=getUrgencia(c),ul=urgenciaLabel(u),uc=u==='ahora'?'urgente':u==='hoy'?'manana':'';
  const icons={whatsapp:'💬',instagram:'📸',local:'🏪',formulario:'🌐',referido:'🤝'};
  const eLabel=ajustes.etapas.find(e=>e.id===c.etapa)?.label||c.etapa;
  const etqs=(c.etiquetas||[]).slice(0,3).map(t=>etiqChipHtml(t)).join('');
  const monto=c.monto>0?`<span style="font-size:11px;font-weight:600;color:var(--green);font-family:Geist Mono,monospace">$${Number(c.monto).toLocaleString('es-AR')}</span>`:'';
  const qa=mode==='full'?`<div class="quick-actions"><button class="qa-btn wa" onclick="event.stopPropagation();enviarWA('${c.id}')">📱 Enviar WA</button><button class="qa-btn listo" onclick="event.stopPropagation();marcarRespondio('${c.id}')">✅ Respondió</button><button class="qa-btn norsp" onclick="event.stopPropagation();marcarNoResponde('${c.id}')" title="Avanza al siguiente mensaje de la secuencia">⏭ No resp.</button></div>`:'';
  const seqEstado=getEstadoSeq(c);
  const seqBadge=seqEstado==='frio'?'<span class="etiqueta-chip" style="background:var(--red-bg);border-color:rgba(240,80,96,0.3);color:var(--red)">sin más mensajes</span>':seqEstado==='completa'?'<span class="etiqueta-chip" style="background:var(--green-bg);border-color:rgba(45,212,160,0.3);color:var(--green)">secuencia completa</span>':'';
  const optBadge=c.optOut?'<span class="etiqueta-chip" style="background:var(--red-bg);border-color:rgba(240,80,96,0.3);color:var(--red)">⛔ no contactar</span>':'';
  return`<div class="work-item ${uc}" data-id="${c.id}"><div class="item-row1"><div class="item-nombre">${icons[c.fuente]||'👤'} ${esc(c.nombre)}</div><span class="urgencia-chip ${ul.cls}">${ul.text}</span></div><div class="item-row2"><span class="item-sub">${esc(c.producto)||'Sin producto'}</span>${c.monto>0?`<span class="item-dot">·</span>${monto}`:''}<span class="item-dot">·</span><span class="item-sub">${daysDiff(c.lastContact)}</span></div><div class="item-row3"><span class="etapa-chip">${esc(eLabel)}</span>${etqs}${seqBadge}${optBadge}</div>${qa}</div>`;
}
function bindWorkItems(){
  document.querySelectorAll('.work-item,.k-card').forEach(el=>{
    el.addEventListener('click',function(){const id=this.dataset.id;if(id)openDetail(id);});
  });
}

// ── TABLERO KANBAN ──
function renderTablero(){
  const cols=ajustes.etapas.map(e=>{
    const items=clientes.filter(c=>c.etapa===e.id);
    const cards=items.map(c=>{
      const u=getUrgencia(c);
      const urgColor=u==='ahora'?'var(--red)':u==='hoy'?'var(--amber)':'var(--border)';
      const monto=c.monto>0?`<span style="font-size:10px;color:var(--green);font-family:Geist Mono,monospace">$${Number(c.monto).toLocaleString('es-AR')}</span>`:'';
      const etqs=(c.etiquetas||[]).slice(0,2).map(t=>etiqChipHtml(t)).join('');
      return`<div class="k-card" data-id="${c.id}" style="border-left:2px solid ${urgColor}">
        <div class="k-card-name">${esc(c.nombre)}</div>
        <div class="k-card-sub" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;margin-top:3px;">
          <span style="font-size:11px;color:var(--text2)">${esc(c.producto)||'Sin producto'}</span>
          ${monto}
        </div>
        <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;">${etqs}</div>
      </div>`;
    }).join('');
    return`<div class="k-col">
      <div class="k-col-head">
        <div class="k-col-dot" style="background:${e.color}"></div>
        <span class="k-col-title">${e.label}</span>
        <span class="k-col-count">${items.length}</span>
      </div>
      <div class="k-col-body">
        ${cards}
        <div class="k-add" onclick="openAddModal('${e.id}')">+ Agregar</div>
      </div>
    </div>`;
  }).join('');
  return`<div class="kanban-wrap"><div class="kanban-board">${cols}</div></div>`;
}

function renderResumen(){
  const semana=new Date();semana.setDate(semana.getDate()-7);
  const leads7=clientes.filter(c=>new Date(c.created)>=semana).length;
  const accion=clientes.filter(c=>['accion','apologia'].includes(c.etapa)).length;
  const monto=clientes.filter(c=>c.etapa==='averiguacion'&&c.monto>0).reduce((s,c)=>s+c.monto,0);
  const conv=clientes.length?Math.round((accion/clientes.length)*100):0;
  const prox=proximaFechaEspecial();
  const proxHtml=prox?`<div style="background:var(--surface);border:1px solid rgba(108,143,255,0.25);border-radius:var(--r);padding:14px;margin-bottom:10px;box-shadow:var(--sh);display:flex;align-items:center;gap:12px;">
    <span style="font-size:24px">${prox.emoji}</span>
    <div style="flex:1">
      <div style="font-size:13px;font-weight:600;color:var(--text)">${prox.nombre}</div>
      <div style="font-size:11px;color:var(--text2)">${prox.fechaStr} · en ${prox.dias} días · ${clientes.filter(c=>!c.optOut).length} clientes recibirán mensaje</div>
    </div>
    <span style="font-size:10px;font-weight:600;padding:3px 9px;border-radius:20px;background:var(--accent-bg);color:var(--accent)">próxima</span>
  </div>`:'';
  const logHtml=logEnvios.slice(0,5).map(e=>`<div style="display:flex;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px;"><span style="color:var(--text3);font-family:Geist Mono,monospace;font-size:10px;flex-shrink:0">${new Date(e.fecha).toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'})}</span><div style="flex:1;color:var(--text2)">${esc(e.nombre)} — ${esc(e.mensaje)}...</div></div>`).join('')||'<div style="font-size:12px;color:var(--text3);padding:8px 0">Sin mensajes registrados aún</div>';
  return`<div class="resumen-wrap">
    ${proxHtml}
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3);margin-bottom:12px">Últimos 7 días</div>
    <div class="resumen-grid">
      <div class="resumen-card"><div class="resumen-num" style="color:var(--accent)">${leads7}</div><div class="resumen-label">Leads nuevos</div></div>
      <div class="resumen-card"><div class="resumen-num" style="color:var(--green)">${accion}</div><div class="resumen-label">Compraron</div></div>
      <div class="resumen-card"><div class="resumen-num" style="color:var(--amber)">${conv}%</div><div class="resumen-label">Conversión</div></div>
      <div class="resumen-card"><div class="resumen-num" style="color:var(--purple);font-size:22px">$${(monto/1000).toFixed(0)}k</div><div class="resumen-label">En averiguación</div></div>
    </div>
    <div style="margin-top:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3);margin-bottom:10px">Por etapa</div>
      ${ajustes.etapas.map(e=>{const n=clientes.filter(c=>c.etapa===e.id).length;const pct=clientes.length?Math.round((n/clientes.length)*100):0;return`<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:4px"><span>${esc(e.label)}</span><span style="font-weight:500;font-family:Geist Mono,monospace">${n}</span></div><div style="height:5px;background:var(--surface2);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${e.color};border-radius:3px;transition:width 0.4s"></div></div></div>`;}).join('')}
    </div>
    <div style="margin-top:16px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3);margin-bottom:10px">Últimos mensajes enviados</div>
      ${logHtml}
    </div>
    <button class="btn" style="width:100%;justify-content:center;margin-top:12px" onclick="exportarCSV()">⬇ Exportar Excel</button>
  </div>`;
}

// ── AJUSTES ──
let ajustesTab='etapas';
function renderAjustes(){
  return`<div class="ajustes-wrap"><div class="ajustes-tabs"><button class="ajustes-tab ${ajustesTab==='etapas'?'active':''}" onclick="setAjustesTab('etapas',this)">Etapas</button><button class="ajustes-tab ${ajustesTab==='etiquetas'?'active':''}" onclick="setAjustesTab('etiquetas',this)">Etiquetas</button><button class="ajustes-tab ${ajustesTab==='plantillas'?'active':''}" onclick="setAjustesTab('plantillas',this)">Secuencias</button><button class="ajustes-tab ${ajustesTab==='fechas'?'active':''}" onclick="setAjustesTab('fechas',this)">📅 Fechas</button></div><div id="ajustes-content">${renderAjustesTab()}</div></div>`;
}
function setAjustesTab(tab,btn){ajustesTab=tab;document.querySelectorAll('.ajustes-tab').forEach(b=>b.classList.remove('active'));btn.classList.add('active');document.getElementById('ajustes-content').innerHTML=renderAjustesTab();}
function renderAjustesTab(){if(ajustesTab==='etapas')return renderAjEtapas();if(ajustesTab==='etiquetas')return renderAjEtiquetas();if(ajustesTab==='plantillas')return renderAjPlantillas();return renderAjFechas();}

// ── ETAPAS ──
const COLORES_ETAPA=['#6b6860','#6c8fff','#a07cf8','#2dd4a0','#f0a030','#f05060','#38d4e0','#ff9f5a'];
function renderAjEtapas(){
  const rows=ajustes.etapas.map((e,i)=>`<div class="etapa-edit-row">
    <span class="etapa-handle">⠿</span>
    <div class="etapa-color-dot" style="background:${e.color}"></div>
    <input class="etapa-edit-input" value="${esc(e.label)}" onchange="renombrarEtapa(${i},this.value)" placeholder="Nombre de etapa">
    <span class="etapa-count-badge">${clientes.filter(c=>c.etapa===e.id).length} leads</span>
    ${ajustes.etapas.length>2?`<button onclick="eliminarEtapa(${i})" style="background:transparent;border:none;color:var(--text3);cursor:pointer;font-size:14px;padding:2px 4px;" title="Eliminar etapa">✕</button>`:''}
  </div>`).join('');
  return`<div class="ajustes-section">
    <div class="ajustes-section-title">Etapas del embudo</div>
    ${rows}
    <button onclick="agregarEtapa()" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:10px;border:1px dashed var(--border2);border-radius:10px;background:transparent;color:var(--text3);cursor:pointer;font-size:13px;font-family:Geist,sans-serif;width:100%;transition:all 0.15s;" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--text3)'">+ Agregar etapa</button>
    <div style="font-size:11px;color:var(--text3);text-align:center;padding:4px 0">Tocá el nombre para editarlo. Al eliminar una etapa los clientes quedan sin etapa asignada.</div>
  </div>`;
}
function renombrarEtapa(idx,val){if(!val.trim())return;ajustes.etapas[idx].label=val.trim();guardarAjustes();toast('Etapa renombrada ✓');}
function agregarEtapa(){const id='etapa_'+Date.now();const color=COLORES_ETAPA[ajustes.etapas.length%COLORES_ETAPA.length];ajustes.etapas.push({id,label:'Nueva etapa',color});ajustes.secuencias[id]=[];guardarAjustes();document.getElementById('ajustes-content').innerHTML=renderAjustesTab();toast('Etapa agregada ✓');}
function eliminarEtapa(idx){const e=ajustes.etapas[idx];if(clientes.filter(c=>c.etapa===e.id).length>0){if(!confirm(`Hay ${clientes.filter(c=>c.etapa===e.id).length} clientes en "${e.label}". ¿Eliminás igual? Los clientes quedarán sin etapa.`))return;}ajustes.etapas.splice(idx,1);guardarAjustes();document.getElementById('ajustes-content').innerHTML=renderAjustesTab();render();toast('Etapa eliminada');}

// ── ETIQUETAS ──
function renderAjEtiquetas(){
  const chips=ajustes.etiquetasSistema.map((t,i)=>{const c=colEtiq(t);return`<span class="etiq-mgr" style="background:${c.bg};border-color:${c.b};color:${c.t}">${esc(t)}<span class="etiq-rm-btn" onclick="elimEtiqSistema(${i})">✕</span></span>`;}).join('');
  return`<div class="ajustes-section"><div class="ajustes-section-title">Etiquetas del sistema</div><div class="etiquetas-manager">${chips}</div><div class="etiq-new-row"><input class="etiq-new-input" id="nuevaEtiqInput" placeholder="Nueva etiqueta..." maxlength="24" onkeydown="if(event.key==='Enter'){event.preventDefault();agregarEtiqSistema();}"><button class="etiq-add-btn" onclick="agregarEtiqSistema()">Agregar</button></div><div style="font-size:11px;color:var(--text3);margin-top:8px;line-height:1.5">Al eliminar una etiqueta no desaparece de los clientes que ya la tienen.</div></div>`;
}
function elimEtiqSistema(idx){ajustes.etiquetasSistema.splice(idx,1);guardarAjustes();document.getElementById('ajustes-content').innerHTML=renderAjustesTab();}
function agregarEtiqSistema(){const input=document.getElementById('nuevaEtiqInput');const val=input.value.trim().toLowerCase();if(!val)return;if(!ajustes.etiquetasSistema.includes(val))ajustes.etiquetasSistema.push(val);input.value='';guardarAjustes();document.getElementById('ajustes-content').innerHTML=renderAjustesTab();toast('Etiqueta agregada ✓');}

// ── SECUENCIAS CON TIEMPOS ──
let _plantillaEtapa=null;
function renderAjPlantillas(){
  const etapaId=_plantillaEtapa||ajustes.etapas[0]?.id;
  const etapaTabs=ajustes.etapas.map(e=>`<button class="ajustes-tab ${e.id===etapaId?'active':''}" onclick="setPlantillaEtapa('${e.id}')" style="font-size:11px;padding:6px 8px">${esc(e.label)}</button>`).join('');
  const seq=ajustes.secuencias[etapaId]||[];
  const eObj=ajustes.etapas.find(e=>e.id===etapaId);
  const triggerLabel={al_llegar:'al llegar a esta etapa',sin_respuesta:'si no respondió al mensaje anterior'};
  const cards=seq.map((item,i)=>`
    <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--r);padding:14px;box-shadow:var(--sh);margin-bottom:8px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
        <div style="display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;">
          <div style="width:8px;height:8px;border-radius:50%;background:${eObj?.color||'#6c8fff'}"></div>
          Mensaje ${i+1}
        </div>
        ${seq.length>1?`<button onclick="eliminarMensaje('${etapaId}',${i})" style="font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid rgba(240,80,96,0.2);background:transparent;color:var(--red);cursor:pointer;font-family:Geist,sans-serif;">✕ eliminar</button>`:''}
      </div>
      <textarea style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:10px 12px;font-size:13px;color:var(--text);font-family:Geist,sans-serif;outline:none;resize:vertical;min-height:72px;line-height:1.6;transition:border-color 0.15s;" id="seq-texto-${etapaId}-${i}" onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'">${esc(item.texto)}</textarea>
      <div style="font-size:11px;color:var(--text3);margin:5px 0 10px;">Variables: <span style="background:var(--surface3);padding:1px 6px;border-radius:4px;font-family:Geist Mono,monospace;color:var(--accent);">{{nombre}}</span><span style="background:var(--surface3);padding:1px 6px;border-radius:4px;font-family:Geist Mono,monospace;color:var(--accent);margin-left:4px;">{{producto}}</span><span style="background:var(--surface3);padding:1px 6px;border-radius:4px;font-family:Geist Mono,monospace;color:var(--accent);margin-left:4px;">{{monto}}</span></div>
      <div style="background:var(--surface2);border-radius:var(--rsm);padding:10px 12px;border:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:14px;">⏱</span>
        <span style="font-size:12px;color:var(--text2);">Enviar</span>
        <input type="number" min="0" value="${item.delayValor}" id="seq-delay-${etapaId}-${i}" style="width:60px;background:var(--surface3);border:1px solid var(--border2);border-radius:6px;padding:5px 8px;font-size:13px;color:var(--text);font-family:Geist Mono,monospace;outline:none;text-align:center;">
        <select id="seq-unidad-${etapaId}-${i}" style="background:var(--surface3);border:1px solid var(--border2);border-radius:6px;padding:5px 8px;font-size:12px;color:var(--text);font-family:Geist,sans-serif;outline:none;">
          <option value="horas" ${item.delayUnidad==='horas'?'selected':''}>horas</option>
          <option value="días" ${item.delayUnidad==='días'?'selected':''}>días</option>
          <option value="semanas" ${item.delayUnidad==='semanas'?'selected':''}>semanas</option>
        </select>
        <select id="seq-trigger-${etapaId}-${i}" style="background:var(--surface3);border:1px solid var(--border2);border-radius:6px;padding:5px 8px;font-size:12px;color:var(--text);font-family:Geist,sans-serif;outline:none;flex:1;min-width:180px;">
          <option value="al_llegar" ${item.trigger==='al_llegar'?'selected':''}>al llegar a esta etapa</option>
          <option value="sin_respuesta" ${item.trigger==='sin_respuesta'?'selected':''}>si no respondió al mensaje anterior</option>
        </select>
      </div>
      <button onclick="guardarMensaje('${etapaId}',${i})" style="margin-top:8px;padding:7px 14px;background:var(--accent-bg);border:1px solid rgba(108,143,255,0.3);border-radius:var(--rsm);font-size:12px;font-weight:600;color:var(--accent);cursor:pointer;font-family:Geist,sans-serif;">✓ Guardar mensaje</button>
    </div>`).join('');

  return`<div class="ajustes-section">
    <div class="ajustes-section-title">Secuencia de mensajes</div>
    <div class="ajustes-tabs" style="margin-bottom:12px">${etapaTabs}</div>
    ${cards}
    <button onclick="agregarMensaje('${etapaId}')" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border:1px dashed var(--border2);border-radius:10px;background:transparent;color:var(--text3);cursor:pointer;font-size:13px;font-family:Geist,sans-serif;width:100%;transition:all 0.15s;" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--text3)'">+ Agregar mensaje a la secuencia</button>
    <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:8px;line-height:1.5">Cuando conectes n8n, estos tiempos se usan para disparar cada mensaje automáticamente.</div>
  </div>`;
}
function setPlantillaEtapa(id){_plantillaEtapa=id;document.getElementById('ajustes-content').innerHTML=renderAjustesTab();}
function guardarMensaje(etapa,idx){
  const texto=document.getElementById(`seq-texto-${etapa}-${idx}`)?.value?.trim();
  const delayValor=Number(document.getElementById(`seq-delay-${etapa}-${idx}`)?.value)||0;
  const delayUnidad=document.getElementById(`seq-unidad-${etapa}-${idx}`)?.value||'horas';
  const trigger=document.getElementById(`seq-trigger-${etapa}-${idx}`)?.value||'sin_respuesta';
  if(!texto)return;
  if(!ajustes.secuencias[etapa])ajustes.secuencias[etapa]=[];
  ajustes.secuencias[etapa][idx]={texto,delayValor,delayUnidad,trigger};
  guardarAjustes();toast('Mensaje guardado ✓');
}
function agregarMensaje(etapa){
  if(!ajustes.secuencias[etapa])ajustes.secuencias[etapa]=[];
  ajustes.secuencias[etapa].push({texto:'Hola {{nombre}}, ¿cómo estás?',delayValor:48,delayUnidad:'horas',trigger:'sin_respuesta'});
  guardarAjustes();document.getElementById('ajustes-content').innerHTML=renderAjustesTab();
}
function eliminarMensaje(etapa,idx){
  ajustes.secuencias[etapa].splice(idx,1);
  guardarAjustes();document.getElementById('ajustes-content').innerHTML=renderAjustesTab();
}

// ── FECHAS ESPECIALES ──
let _fechaEtapaDetalle=null;
function renderAjFechas(){
  const list=ajustes.fechasEspeciales.map((f,i)=>`
    <div style="background:var(--surface);border:1px solid ${f.activo?'rgba(108,143,255,0.2)':'var(--border)'};border-radius:var(--r);padding:14px;margin-bottom:8px;box-shadow:var(--sh);">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <span style="font-size:22px;">${f.emoji}</span>
        <div style="flex:1;">
          <input value="${esc(f.nombre)}" onchange="actualizarFecha(${i},'nombre',this.value)" style="background:transparent;border:none;outline:none;font-size:14px;font-weight:600;color:var(--text);font-family:Geist,sans-serif;width:100%;">
          <div style="font-size:11px;color:var(--text3);font-family:Geist Mono,monospace;margin-top:2px;">${f.dia} · ${f.hora}</div>
        </div>
        <label style="display:flex;align-items:center;gap:6px;cursor:pointer;flex-shrink:0;">
          <div onclick="toggleFecha(${i})" style="width:36px;height:20px;border-radius:10px;background:${f.activo?'var(--accent)':'var(--surface3)'};position:relative;transition:background 0.2s;border:1px solid ${f.activo?'var(--accent)':'var(--border2)'};">
            <div style="width:14px;height:14px;border-radius:50%;background:#fff;position:absolute;top:2px;left:${f.activo?'18px':'2px'};transition:left 0.2s;"></div>
          </div>
          <span style="font-size:11px;color:${f.activo?'var(--accent)':'var(--text3)'};">${f.activo?'activo':'inactivo'}</span>
        </label>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap;">
        <div style="display:flex;align-items:center;gap:6px;flex:1;min-width:140px;">
          <span style="font-size:11px;color:var(--text2);">Fecha:</span>
          <input type="text" value="${f.dia}" onchange="actualizarFecha(${i},'dia',this.value)" placeholder="MM-DD" style="width:70px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;color:var(--text);font-family:Geist Mono,monospace;outline:none;text-align:center;">
          <span style="font-size:11px;color:var(--text2);">Hora:</span>
          <input type="time" value="${f.hora}" onchange="actualizarFecha(${i},'hora',this.value)" style="background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:5px 8px;font-size:12px;color:var(--text);font-family:Geist Mono,monospace;outline:none;">
        </div>
      </div>

      <div style="margin-bottom:8px;">
        <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text3);margin-bottom:5px;">🌐 Mensaje general (todos los clientes)</div>
        <textarea onchange="actualizarFecha(${i},'mensajeGeneral',this.value)" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:9px 11px;font-size:12px;color:var(--text);font-family:Geist,sans-serif;outline:none;resize:vertical;min-height:60px;line-height:1.5;">${esc(f.mensajeGeneral)}</textarea>
      </div>

      <div>
        <button onclick="toggleFechaDetalle(${i})" style="font-size:11px;color:var(--accent);background:transparent;border:none;cursor:pointer;font-family:Geist,sans-serif;display:flex;align-items:center;gap:4px;padding:0;margin-bottom:6px;">
          ${Object.keys(f.mensajesPorEtapa||{}).length>0?'✓':'+'} Mensajes específicos por etapa (${Object.keys(f.mensajesPorEtapa||{}).length} configurados)
        </button>
        <div id="fecha-etapas-${i}" style="display:none;flex-direction:column;gap:6px;">
          ${ajustes.etapas.map(e=>`
            <div style="background:var(--surface2);border-radius:var(--rsm);padding:10px 12px;">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <div style="width:7px;height:7px;border-radius:50%;background:${e.color}"></div>
                <span style="font-size:12px;font-weight:500;color:var(--text)">${esc(e.label)}</span>
                <span style="font-size:10px;color:var(--text3);margin-left:auto">${f.mensajesPorEtapa?.[e.id]?'personalizado':'usa mensaje general'}</span>
              </div>
              <textarea placeholder="Dejar vacío para usar el mensaje general..." onchange="actualizarMsgFechaEtapa(${i},'${e.id}',this.value)" style="width:100%;background:var(--surface);border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:12px;color:var(--text);font-family:Geist,sans-serif;outline:none;resize:vertical;min-height:54px;line-height:1.5;">${esc(f.mensajesPorEtapa?.[e.id])||''}</textarea>
            </div>`).join('')}
        </div>
      </div>

      <div style="display:flex;gap:6px;margin-top:10px;">
        <button onclick="guardarFecha(${i})" style="flex:1;padding:8px;background:var(--accent-bg);border:1px solid rgba(108,143,255,0.3);border-radius:var(--rsm);font-size:12px;font-weight:600;color:var(--accent);cursor:pointer;font-family:Geist,sans-serif;">✓ Guardar fecha</button>
        <button onclick="eliminarFecha(${i})" style="padding:8px 12px;background:transparent;border:1px solid rgba(240,80,96,0.2);border-radius:var(--rsm);font-size:12px;color:var(--red);cursor:pointer;font-family:Geist,sans-serif;">✕</button>
      </div>
    </div>`).join('');

  return`<div class="ajustes-section">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">
      <div class="ajustes-section-title">Fechas especiales</div>
    </div>
    <div style="font-size:12px;color:var(--text2);margin-bottom:12px;line-height:1.6;background:var(--surface2);border-radius:var(--rsm);padding:10px 12px;">
      Cada fecha tiene un <b style="color:var(--text)">mensaje general</b> que va a todos, más la posibilidad de configurar un mensaje específico por etapa. Si una etapa no tiene mensaje propio, recibe el general.
    </div>
    ${list}
    <button onclick="agregarFecha()" style="display:flex;align-items:center;justify-content:center;gap:6px;padding:11px;border:1px dashed var(--border2);border-radius:10px;background:transparent;color:var(--text3);cursor:pointer;font-size:13px;font-family:Geist,sans-serif;width:100%;transition:all 0.15s;" onmouseover="this.style.borderColor='var(--accent)';this.style.color='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)';this.style.color='var(--text3)'">+ Agregar fecha especial</button>
    <div style="font-size:11px;color:var(--text3);text-align:center;margin-top:8px;line-height:1.5">Cuando conectes n8n, estas fechas disparan los mensajes automáticamente a todos los clientes.</div>
  </div>`;
}

function toggleFechaDetalle(i){const el=document.getElementById(`fecha-etapas-${i}`);el.style.display=el.style.display==='none'?'flex':'none';}
function toggleFecha(i){ajustes.fechasEspeciales[i].activo=!ajustes.fechasEspeciales[i].activo;guardarAjustes();document.getElementById('ajustes-content').innerHTML=renderAjustesTab();}
function actualizarFecha(i,campo,valor){ajustes.fechasEspeciales[i][campo]=valor;guardarAjustes();}
function actualizarMsgFechaEtapa(i,etapaId,valor){if(!ajustes.fechasEspeciales[i].mensajesPorEtapa)ajustes.fechasEspeciales[i].mensajesPorEtapa={};if(valor.trim())ajustes.fechasEspeciales[i].mensajesPorEtapa[etapaId]=valor.trim();else delete ajustes.fechasEspeciales[i].mensajesPorEtapa[etapaId];guardarAjustes();}
function guardarFecha(i){guardarAjustes();toast('Fecha guardada ✓');}
function eliminarFecha(i){if(!confirm('¿Eliminar esta fecha especial?'))return;ajustes.fechasEspeciales.splice(i,1);guardarAjustes();document.getElementById('ajustes-content').innerHTML=renderAjustesTab();}
function agregarFecha(){
  ajustes.fechasEspeciales.push({id:'fecha_'+Date.now(),emoji:'🎉',nombre:'Nueva fecha especial',dia:'01-01',hora:'10:00',activo:false,destinatarios:'todos',mensajeGeneral:'Hola {{nombre}}! 🎉 [Tu mensaje aquí]',mensajesPorEtapa:{}});
  guardarAjustes();document.getElementById('ajustes-content').innerHTML=renderAjustesTab();
}

// ── DETALLE ──
function openDetail(id){
  currentId=String(id);
  const c=clientes.find(x=>String(x.id)===String(id));
  if(!c) return;
  document.getElementById('d_nombre').textContent=c.nombre;
  document.getElementById('d_sub').textContent=`${c.producto||'Sin producto'}${c.monto?' · $'+Number(c.monto).toLocaleString('es-AR'):''}`;
  // Opt-out toggle
  const optEl=document.getElementById('d_optout');
  if(optEl){optEl.checked=!!c.optOut;optEl.onchange=async()=>{c.optOut=optEl.checked;await guardarSB(c);render();toast(c.optOut?`${c.nombre} — automáticos desactivados`:`${c.nombre} — automáticos activados`);};}

  document.getElementById('d_etapas_list').innerHTML=ajustes.etapas.map(e=>`<div class="etapa-list-item ${e.id===c.etapa?'active':''}" onclick="moverEtapa('${e.id}')"><div class="etapa-list-dot" style="background:${e.color}"></div>${esc(e.label)}</div>`).join('');
  renderEtiqDetalle(c);
  const lb=document.getElementById('d_lockbanner'),h=horasDesde(c.ultimaRespuesta);
  if(estaLocked(c)){const mins=Math.round(h*60);lb.innerHTML=`<div class="lock-banner">🔒 Escribió hace ${mins<60?mins+'min':Math.round(h)+'hs'}. Automáticos pausados ${Math.ceil(3-h)}hs más.</div>`;}
  else if(c.ultimaRespuesta){lb.innerHTML=`<div class="lock-banner" style="background:var(--surface2);border-color:var(--border);color:var(--text2)">💬 Última respuesta hace ${h<24?Math.round(h)+'hs':Math.round(h/24)+'d'}.</div>`;}
  else lb.innerHTML='';
  renderSeqDetalle(c);
  const fL={whatsapp:'WhatsApp',instagram:'Instagram',local:'Local físico',formulario:'Formulario',referido:'Referido'};
  const telMostrar=c.tel?(esc(c.tel)+" <small style=\"font-family:monospace;color:var(--text3)\">("+esc(normalizarTel(c.tel))+")</small>"):"—";
  document.getElementById('d_info').innerHTML=`<div class="info-row"><span class="ik">WhatsApp</span><span class="iv" style="font-size:12px">${telMostrar}</span></div><div class="info-row"><span class="ik">Instagram</span><span class="iv">${esc(c.ig)||'—'}</span></div><div class="info-row"><span class="ik">Canal de entrada</span><span class="iv">${fL[c.fuente]||c.fuente}</span></div><div class="info-row"><span class="ik">Nota del equipo</span><span class="iv" style="max-width:200px;text-align:right;color:var(--text2);font-weight:400;font-size:12px">${esc(c.nota)||'—'}</span></div>`;
  document.getElementById('d_historial').innerHTML=`<div class="h-item"><div class="h-dot" style="background:var(--green)"></div><div><div class="h-text">Alta · ${fL[c.fuente]||c.fuente}</div><div class="h-time">${new Date(c.created).toLocaleString('es-AR')}</div></div></div><div class="h-item"><div class="h-dot" style="background:var(--accent)"></div><div><div class="h-text">Último contacto nuestro</div><div class="h-time">${new Date(c.lastContact).toLocaleString('es-AR')}</div></div></div>${c.ultimaRespuesta?`<div class="h-item"><div class="h-dot" style="background:var(--green)"></div><div><div class="h-text">✅ Última respuesta del cliente</div><div class="h-time">${new Date(c.ultimaRespuesta).toLocaleString('es-AR')}</div></div></div>`:''} ${c.monto?`<div class="h-item"><div class="h-dot" style="background:var(--purple)"></div><div><div class="h-text">Presupuesto $${Number(c.monto).toLocaleString('es-AR')}</div><div class="h-time">registrado</div></div></div>`:''}`;
  document.getElementById('detailModal').classList.add('open');
}

function renderEtiqDetalle(c){
  const el=document.getElementById('d_etiquetas');if(!el)return;
  el.innerHTML=(c.etiquetas||[]).map((t,i)=>{const col=colEtiq(t);return`<span class="etiq-d" style="background:${col.bg};border-color:${col.b};color:${col.t}">${esc(t)}<span class="etiq-d-rm" onclick="quitarEtiqueta(${i})">✕</span></span>`;}).join('')||'<span style="font-size:12px;color:var(--text3)">Sin etiquetas</span>';
}

function renderSeqDetalle(c){
  const wrap=document.getElementById('d_secuencia'),label=document.getElementById('d_seq_label');if(!wrap)return;
  const total=getTotalPasos(c),paso=c.secuencia?.paso||0,estado=getEstadoSeq(c),sug=getSugerencia(c);
  if(label){let b='';if(estado==='frio')b='<span class="seq-status ss-frio" style="margin-left:8px">frío</span>';else if(estado==='completa')b='<span class="seq-status ss-sent" style="margin-left:8px">completa</span>';else b=`<span class="seq-status ss-next" style="margin-left:8px">paso ${paso+1}/${total}</span>`;label.innerHTML='Mensajes'+b;}
  let html='';
  for(let i=0;i<total;i++){
    const msg=getMsgPaso(c,i),enviado=i<paso,esCurrent=i===paso,esFut=i>paso;
    let st='';if(enviado)st='<span class="seq-status ss-sent">✓ enviado</span>';else if(esCurrent&&estado!=='frio')st='<span class="seq-status ss-next">→ siguiente</span>';else if(estado==='frio'&&esCurrent)st='<span class="seq-status ss-frio">pausado</span>';else st='<span class="seq-status ss-pending">pendiente</span>';
    const sugH=esCurrent&&estado!=='frio'?`<div class="seq-suggestion">⏱ Sugerido: ${sug}</div>`:'';
    const btns=esCurrent&&estado!=='frio'?`<div class="seq-actions"><button class="seq-btn seq-btn-wa" onclick="enviarWAcon(${i})">📱 WhatsApp</button><button class="seq-btn seq-btn-copy" onclick="copiarMsg(${i})">Copiar</button></div>`:'';
    html+=`<div class="seq-item" style="opacity:${esFut?0.5:1}"><div class="seq-header"><span class="seq-num">Mensaje ${i+1}</span>${st}</div><div class="seq-msg${enviado?' dim':''}">${esc(msg)}</div>${sugH}${btns}</div>`;
  }
  if(paso>0)html+=`<div style="text-align:right;margin-top:4px"><button class="btn" style="font-size:11px;padding:5px 12px;color:var(--text3)" onclick="resetSeq()">↺ Reiniciar</button></div>`;
  wrap.innerHTML=html;
}

// ── ACCIONES ──
async function moverEtapa(etapa){
  const c=clientes.find(x=>String(x.id)===String(currentId));
  if(!c)return;
  const etapaAnterior=c.etapa;
  c.etapa=etapa;
  c.secuencia={paso:0,enviados:[]};
  c.lastContact=new Date().toISOString();
  // Actualizar UI de etapas en detalle
  document.querySelectorAll('.etapa-list-item').forEach(el=>{
    const dotEl=el.querySelector('.etapa-list-dot');
    const onclickAttr=el.getAttribute('onclick')||'';
    const isActive=onclickAttr.includes("'"+etapa+"'");
    el.classList.toggle('active',isActive);
  });
  // Actualizar sub del header
  const subEl=document.getElementById('d_sub');
  if(subEl) subEl.textContent=(c.producto||'Sin producto')+(c.monto?' · $'+Number(c.monto).toLocaleString('es-AR'):'');
  renderSeqDetalle(c);
  await guardarSB(c);
  render();
  const label=ajustes.etapas.find(e=>e.id===etapa)?.label||etapa;
  toast('Movido a '+label+' ✓');
}

async function enviarWA(id){
  const c=clientes.find(x=>String(x.id)===String(id));
  if(!c){return;}
  if(c.optOut){toast('⛔ '+c.nombre+' tiene los automáticos desactivados');return;}
  if(!c.tel){toast('Sin número de WhatsApp');return;}
  const paso=c.secuencia?.paso||0;
  const telLimpio=normalizarTel(c.tel);
  const msgTexto=getMsgPaso(c,paso);
  window.open('https://wa.me/'+telLimpio+'?text='+encodeURIComponent(msgTexto),'_blank');
  if(!c.secuencia)c.secuencia={paso:0,enviados:[]};
  c.secuencia.enviados.push(new Date().toISOString());
  c.secuencia.paso=paso+1;
  c.lastContact=new Date().toISOString();
  registrarLog(c.id,c.nombre,'rapido',msgTexto);
  await guardarSB(c);render();
  toast('Mensaje '+( paso+1)+' enviado a '+c.nombre);
}

async function enviarWAdetalle(){
  const c=clientes.find(x=>String(x.id)===String(currentId));
  if(!c){return;}
  if(c.optOut){toast('⛔ Automáticos desactivados para este cliente');return;}
  if(!c.tel){toast('Sin número de WhatsApp');return;}
  if(estaLocked(c)&&!confirm('Escribió hace menos de 3hs. ¿Enviás igual?'))return;
  await enviarWAcon(c.secuencia?.paso||0);
}

async function enviarWAcon(paso){
  const c=clientes.find(x=>String(x.id)===String(currentId));
  if(!c){toast('Cliente no encontrado');return;}
  if(c.optOut){toast('⛔ Cliente marcado como no contactar automáticamente');return;}
  if(!c.tel){toast('Sin número de WhatsApp');return;}
  if(estaLocked(c)&&!confirm('Escribió hace menos de 3hs. ¿Enviás igual?'))return;
  const telLimpio=normalizarTel(c.tel);
  const msgTexto=getMsgPaso(c,paso);
  const msg=encodeURIComponent(msgTexto);
  window.open(`https://wa.me/${telLimpio}?text=${msg}`,'_blank');
  if(!c.secuencia)c.secuencia={paso:0,enviados:[]};
  c.secuencia.enviados.push(new Date().toISOString());
  c.secuencia.paso=Math.max(c.secuencia.paso,paso+1);
  c.lastContact=new Date().toISOString();
  registrarLog(c.id,c.nombre,'manual',msgTexto);
  await guardarSB(c);renderSeqDetalle(c);render();
  toast(`Mensaje ${paso+1} enviado`);
}

function copiarMsg(paso){const c=clientes.find(x=>String(x.id)===String(currentId));if(!c)return;navigator.clipboard.writeText(getMsgPaso(c,paso)).then(()=>toast('Mensaje '+( paso+1)+' copiado al portapapeles 📋'));}
async function registrarRespuesta(){
  const c=clientes.find(x=>String(x.id)===String(currentId));
  if(!c)return;
  c.ultimaRespuesta=new Date().toISOString();
  c.lastContact=new Date().toISOString();
  // Actualizar lock banner sin reabrir modal
  const lb=document.getElementById('d_lockbanner');
  if(lb)lb.innerHTML='<div class="lock-banner">🔒 Escribió hace 0min. Automáticos pausados 3hs.</div>';
  await guardarSB(c);
  render();
  toast('✅ Respuesta de '+c.nombre+' registrada — automáticos pausados 3hs');
}
async function registrarEnvio(){
  const c=clientes.find(x=>String(x.id)===String(currentId));
  if(!c)return;
  c.lastContact=new Date().toISOString();
  if(!c.secuencia)c.secuencia={paso:0,enviados:[]};
  c.secuencia.paso=Math.min(c.secuencia.paso+1,getTotalPasos(c));
  registrarLog(c.id,c.nombre,'manual','[envío manual desde teléfono]');
  await guardarSB(c);
  renderSeqDetalle(c);
  render();
  toast('📤 Envío registrado — secuencia avanzada');
}
async function marcarRespondio(id){const c=clientes.find(x=>String(x.id)===String(id));if(!c)return;c.ultimaRespuesta=new Date().toISOString();c.lastContact=new Date().toISOString();await guardarSB(c);render();toast(`${c.nombre} — registrado ✅`);}
async function marcarNoResponde(id){
  const c=clientes.find(x=>String(x.id)===String(id));
  if(!c)return;
  if(!c.secuencia)c.secuencia={paso:0,enviados:[]};
  const total=getTotalPasos(c);
  if(c.secuencia.paso>=total){toast(c.nombre+' — ya no quedan más mensajes en la secuencia');return;}
  c.secuencia.paso=Math.min(c.secuencia.paso+1,total);
  c.lastContact=new Date().toISOString();
  await guardarSB(c);render();
  const restantes=total-c.secuencia.paso;
  toast(c.nombre+(restantes>0?' — avanzado · quedan '+restantes+' mensaje'+(restantes>1?'s':''):' — secuencia completada'));
}
async function resetSeq(){if(!confirm('¿Reiniciar la secuencia? Esto vuelve al primer mensaje.'))return;const c=clientes.find(x=>String(x.id)===String(currentId));if(!c)return;c.secuencia={paso:0,enviados:[]};await guardarSB(c);renderSeqDetalle(c);render();toast('Secuencia reiniciada ↺');}
function duplicarCliente(){
  const c=clientes.find(x=>String(x.id)===String(currentId));
  if(!c)return;
  closeModal('detailModal');
  const sel=document.getElementById('f_etapa');
  sel.innerHTML=ajustes.etapas.map(e=>`<option value="${e.id}">${e.label}</option>`).join('');
  sel.value='atencion';
  document.getElementById('f_nombre').value=c.nombre+' (copia)';
  document.getElementById('f_tel').value=c.tel||'';
  document.getElementById('f_ig').value=c.ig||'';
  document.getElementById('f_producto').value=c.producto||'';
  document.getElementById('f_monto').value=c.monto||'';
  document.getElementById('f_nota').value=c.nota||'';
  document.getElementById('f_fuente').value=c.fuente||'whatsapp';
  const titulo=document.querySelector('#addModal [style*="font-size:18px"]');
  if(titulo)titulo.textContent='Duplicar cliente';
  const btn=document.querySelector('#addModal .btn-primary');
  if(btn){btn.textContent='Guardar nuevo cliente';btn.onclick=()=>{guardarCliente();const t=document.querySelector('#addModal [style*="font-size:18px"]');if(t)t.textContent='Nuevo cliente';const b=document.querySelector('#addModal .btn-primary');if(b){b.textContent='Guardar cliente';b.onclick=guardarCliente;}};}
  document.getElementById('addModal').classList.add('open');
}

async function eliminarCliente(){
  const c=clientes.find(x=>String(x.id)===String(currentId));
  if(!c)return;
  if(!confirm('¿Eliminar a '+c.nombre+'? Esta acción no se puede deshacer.'))return;
  await eliminarSB(currentId);
  clientes=clientes.filter(x=>String(x.id)!==String(currentId));
  closeModal('detailModal');
  render();
  toast(c.nombre+' eliminado');
}

async function guardarNotaRapida(){
  const input=document.getElementById('notaRapida');
  const val=input.value.trim();
  if(!val)return;
  const c=clientes.find(x=>String(x.id)===String(currentId));
  if(!c)return;
  // Reemplaza la nota con el nuevo valor
  c.nota=val;
  input.value='';
  // Actualizar la info mostrada
  const fL={whatsapp:'WhatsApp',instagram:'Instagram',local:'Local físico',formulario:'Formulario',referido:'Referido'};
  const telMostrar=c.tel?(esc(c.tel)+' <small style="font-family:monospace;color:var(--text3)">('+esc(normalizarTel(c.tel))+')</small>'):'—';
  document.getElementById('d_info').innerHTML=`<div class="info-row"><span class="ik">WhatsApp</span><span class="iv" style="font-size:12px">${telMostrar}</span></div><div class="info-row"><span class="ik">Instagram</span><span class="iv">${esc(c.ig)||'—'}</span></div><div class="info-row"><span class="ik">Canal de entrada</span><span class="iv">${fL[c.fuente]||c.fuente}</span></div><div class="info-row"><span class="ik">Nota del equipo</span><span class="iv" style="max-width:200px;text-align:right;color:var(--text2);font-weight:400;font-size:12px">${esc(c.nota)||'—'}</span></div>`;
  await guardarSB(c);
  render();
  toast('Nota guardada ✓');
}

async function agregarEtiqueta(){const input=document.getElementById('etiqInput');const val=input.value.trim().toLowerCase();if(!val)return;const c=clientes.find(x=>String(x.id)===String(currentId));if(!c)return;if(!c.etiquetas)c.etiquetas=[];if(!c.etiquetas.includes(val))c.etiquetas.push(val);input.value='';renderEtiqDetalle(c);renderSeqDetalle(c);await guardarSB(c);render();}
async function quitarEtiqueta(idx){const c=clientes.find(x=>String(x.id)===String(currentId));if(!c||!c.etiquetas)return;c.etiquetas.splice(idx,1);renderEtiqDetalle(c);renderSeqDetalle(c);await guardarSB(c);render();}

// ── NUEVO CLIENTE ──
function editarCliente(){
  const c=clientes.find(x=>String(x.id)===String(currentId));
  if(!c)return;
  // Cerrar detalle y abrir formulario pre-llenado
  closeModal('detailModal');
  const sel=document.getElementById('f_etapa');
  sel.innerHTML=ajustes.etapas.map(e=>`<option value="${e.id}">${e.label}</option>`).join('');
  sel.value=c.etapa;
  document.getElementById('f_nombre').value=c.nombre||'';
  document.getElementById('f_tel').value=c.tel||'';
  document.getElementById('f_ig').value=c.ig||'';
  document.getElementById('f_producto').value=c.producto||'';
  document.getElementById('f_monto').value=c.monto||'';
  document.getElementById('f_nota').value=c.nota||'';
  document.getElementById('f_fuente').value=c.fuente||'whatsapp';
  // Cambiar el título y el botón del modal
  const titulo=document.querySelector('#addModal [style*="font-size:18px"]');
  if(titulo)titulo.textContent='Editar cliente';
  const btn=document.querySelector('#addModal .btn-primary');
  if(btn){btn.textContent='Guardar cambios';btn.onclick=()=>guardarEdicion(currentId);}
  document.getElementById('addModal').classList.add('open');
}

async function guardarEdicion(id){
  const nombre=document.getElementById('f_nombre').value.trim();
  if(!nombre){toast('El nombre es obligatorio');return;}
  const c=clientes.find(x=>String(x.id)===String(id));
  if(!c)return;
  c.nombre=nombre;
  c.tel=document.getElementById('f_tel').value.trim();
  c.ig=document.getElementById('f_ig').value.trim();
  c.fuente=document.getElementById('f_fuente').value;
  c.etapa=document.getElementById('f_etapa').value;
  c.producto=document.getElementById('f_producto').value.trim();
  c.monto=Number(document.getElementById('f_monto').value)||0;
  c.nota=document.getElementById('f_nota').value.trim();
  await guardarSB(c);
  closeModal('addModal');
  // Resetear el modal para próxima vez
  const titulo=document.querySelector('#addModal [style*="font-size:18px"]');
  if(titulo)titulo.textContent='Nuevo cliente';
  const btn=document.querySelector('#addModal .btn-primary');
  if(btn){btn.textContent='Guardar cliente';btn.onclick=guardarCliente;}
  render();
  toast(c.nombre+' actualizado ✓');
}

function openAddModal(etapa='atencion'){
  const sel=document.getElementById('f_etapa');
  sel.innerHTML=ajustes.etapas.map(e=>`<option value="${e.id}">${e.label}</option>`).join('');
  sel.value=etapa;
  ['f_nombre','f_tel','f_ig','f_producto','f_nota'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  const montoEl=document.getElementById('f_monto');if(montoEl)montoEl.value='';
  const fuenteEl=document.getElementById('f_fuente');if(fuenteEl)fuenteEl.value='whatsapp';
  document.getElementById('addModal').classList.add('open');
  setTimeout(()=>document.getElementById('f_nombre')?.focus(),300);
}
async function guardarCliente(){const nombre=document.getElementById('f_nombre').value.trim();if(!nombre){toast('El nombre es obligatorio');return;}const telRaw=document.getElementById('f_tel').value.trim();const c={id:nextId++,nombre,tel:telRaw,ig:document.getElementById('f_ig').value.trim(),fuente:document.getElementById('f_fuente').value,etapa:document.getElementById('f_etapa').value,prio:'media',producto:document.getElementById('f_producto').value.trim(),monto:Number(document.getElementById('f_monto').value)||0,nota:document.getElementById('f_nota').value.trim(),etiquetas:[],secuencia:{paso:0,enviados:[]},ultimaRespuesta:null,lastContact:new Date().toISOString(),created:new Date().toISOString()};clientes.unshift(c);await guardarSB(c);closeModal('addModal');render();toast(`${c.nombre} agregado ✅`);}

// ── BÚSQUEDA ──
function openSearch(){document.getElementById('searchInput').value='';document.getElementById('searchResults').innerHTML='';document.getElementById('searchModal').classList.add('open');setTimeout(()=>document.getElementById('searchInput').focus(),300);}
function renderSearch(){
  const q=document.getElementById('searchInput').value.trim().toLowerCase();
  const el=document.getElementById('searchResults');
  if(!q){el.innerHTML='';return;}
  const eL=id=>ajustes.etapas.find(e=>e.id===id)?.label||id;
  const res=clientes.filter(c=>
    c.nombre.toLowerCase().includes(q)||
    (c.producto||'').toLowerCase().includes(q)||
    (c.nota||'').toLowerCase().includes(q)||
    (c.tel||'').includes(q)||
    eL(c.etapa).toLowerCase().includes(q)||
    (c.etiquetas||[]).some(t=>t.includes(q))
  ).slice(0,10);
  if(!res.length){el.innerHTML=`<div class="empty" style="padding:20px"><div class="empty-text">Sin resultados para "${q}"</div></div>`;return;}
  el.innerHTML=`<div style="display:flex;flex-direction:column">${res.map(c=>`
    <div style="display:flex;align-items:center;gap:10px;padding:11px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="closeModal('searchModal');openDetail('${c.id}')">
      <div style="flex:1">
        <div style="font-size:15px;font-weight:500">${esc(c.nombre)}${c.optOut?' <span style="font-size:10px;color:var(--red)">⛔</span>':''}</div>
        <div style="font-size:12px;color:var(--text2)">${esc(c.producto)||'Sin producto'} · ${esc(eL(c.etapa))}</div>
      </div>
      <span class="urgencia-chip ${urgenciaLabel(getUrgencia(c)).cls}">${urgenciaLabel(getUrgencia(c)).text}</span>
    </div>`).join('')}</div>`;
}

// ── CONFIG ──
function openConfig(){cargarConfig();document.getElementById('configModal').classList.add('open');}
function cfgTab(tab,btn){['conexion','pasos','datos'].forEach(t=>{document.getElementById('cfg-'+t).style.display=t===tab?'':'none';document.getElementById('cfg-tab-'+t).classList.toggle('active',t===tab);});}
function copiarSQL(){navigator.clipboard.writeText("create table if not exists public.clientes (\n  id uuid default gen_random_uuid() primary key,\n  nombre text not null,\n  tel text,\n  ig text,\n  fuente text default 'whatsapp',\n  etapa text default 'atencion',\n  prio text default 'media',\n  producto text,\n  monto numeric default 0,\n  nota text,\n  etiquetas jsonb default '[]'::jsonb,\n  secuencia jsonb default '{\"paso\":0,\"enviados\":[]}'::jsonb,\n  ultima_respuesta timestamptz,\n  last_contact timestamptz default now(),\n  created_at timestamptz default now(),\n  opt_out boolean default false\n);\n\nalter table public.clientes enable row level security;\n\ndrop policy if exists \"clientes_authenticated_all\" on public.clientes;\ncreate policy \"clientes_authenticated_all\"\non public.clientes\nfor all\nto authenticated\nusing (true)\nwith check (true);").then(()=>toast('SQL seguro copiado — pegalo en Supabase'));}

// ── EXPORTAR ──
function exportarCSV(){const h=['Nombre','Teléfono','Instagram','Fuente','Etapa','Producto','Presupuesto','Etiquetas','Nota','Última Respuesta','Último Contacto','Alta'];const rows=clientes.map(c=>[c.nombre,c.tel||'',c.ig||'',c.fuente,c.etapa,c.producto||'',c.monto||0,(c.etiquetas||[]).join(' / '),(c.nota||'').replace(/,/g,' '),c.ultimaRespuesta?new Date(c.ultimaRespuesta).toLocaleString('es-AR'):'',new Date(c.lastContact).toLocaleString('es-AR'),new Date(c.created).toLocaleString('es-AR')]);const csv='\uFEFF'+[h,...rows].map(r=>r.map(v=>`"${v}"`).join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));a.download=`black-crm-${new Date().toISOString().slice(0,10)}.csv`;a.click();}

// ── TOAST ──
function toast(msg){document.querySelectorAll('.toast').forEach(t=>t.remove());const t=document.createElement('div');t.className='toast';t.textContent=msg;document.body.appendChild(t);setTimeout(()=>{t.style.opacity='0';t.style.transition='opacity 0.3s';setTimeout(()=>t.remove(),300);},2500);}

// ── MODALS ──
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.modal-overlay').forEach(el=>{el.addEventListener('click',function(e){if(e.target===this)this.classList.remove('open');});});

// ── IMPORTACIÓN ──
let importData = []; // filas crudas del archivo
let importHeaders = []; // encabezados detectados
let importMapeo = {}; // { campo_crm: indice_columna }

const CAMPOS_CRM = {
  nombre:    ['nombre','name','cliente','contact','contacto','apellido','razón social','razon social'],
  tel:       ['tel','telefono','teléfono','phone','celular','whatsapp','móvil','movil','número','numero'],
  ig:        ['ig','instagram','@','usuario','handle','red social'],
  producto:  ['producto','product','interés','interes','item','artículo','articulo','consulta'],
  monto:     ['monto','precio','price','presupuesto','budget','valor','amount','$'],
  nota:      ['nota','note','notas','observación','observacion','comentario','comment','descripción'],
  fuente:    ['fuente','source','canal','channel','origen'],
};

function openImport(){
  resetImport();
  // Poblar select de etapas
  const sel = document.getElementById('importEtapa');
  if(sel) sel.innerHTML = ajustes.etapas.map(e=>`<option value="${e.id}">${e.label}</option>`).join('');
  document.getElementById('importModal').classList.add('open');
}

function resetImport(){
  importData=[]; importHeaders=[]; importMapeo={};
  document.getElementById('importPreview').style.display='none';
  document.getElementById('importDropzone').style.display='';
  document.getElementById('importFileInput').value='';
  document.getElementById('importStatus').textContent='';
}

function procesarArchivo(input){
  const file = input.files[0];
  if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try {
      let rows = [];
      if(file.name.endsWith('.csv')){
        // Parsear CSV
        const text = e.target.result;
        const lines = text.split('\n').filter(l=>l.trim());
        rows = lines.map(line=>{
          // Manejar campos con comas dentro de comillas
          const result=[];
          let cur='', inQ=false;
          for(let c of line){
            if(c==='"') inQ=!inQ;
            else if(c===',' && !inQ){result.push(cur.trim());cur='';}
            else cur+=c;
          }
          result.push(cur.trim());
          return result;
        });
      } else {
        // Parsear Excel con SheetJS
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, {type:'array'});
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, {header:1, defval:''});
      }
      
      if(rows.length < 2){ toast('El archivo está vacío o solo tiene encabezados'); return; }
      
      importHeaders = rows[0].map(h=>String(h||'').trim());
      importData = rows.slice(1).filter(r=>r.some(c=>c!=='')).slice(0,5000);
      
      // Auto-mapeo inteligente
      importMapeo = {};
      importHeaders.forEach((h,i)=>{
        const hLow = h.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'');
        for(const [campo, aliases] of Object.entries(CAMPOS_CRM)){
          if(importMapeo[campo]!==undefined) continue;
          if(aliases.some(a=>hLow.includes(a))) importMapeo[campo]=i;
        }
      });
      
      mostrarPreviewImport();
    } catch(err){
      toast('Error al leer el archivo: '+err.message);
      console.error(err);
    }
  };
  if(file.name.endsWith('.csv')) reader.readAsText(file,'UTF-8');
  else reader.readAsArrayBuffer(file);
}

function mostrarPreviewImport(){
  document.getElementById('importDropzone').style.display='none';
  document.getElementById('importPreview').style.display='';
  
  // Mostrar mapeo detectado
  const mapeoEl = document.getElementById('importMapeo');
  const iconos = {nombre:'👤',tel:'📱',ig:'📸',producto:'🛍',monto:'💰',nota:'📝',fuente:'📍'};
  const labels = {nombre:'Nombre',tel:'Teléfono',ig:'Instagram',producto:'Producto',monto:'Monto',nota:'Nota',fuente:'Fuente'};
  
  mapeoEl.innerHTML = Object.entries(CAMPOS_CRM).map(([campo])=>{
    const idx = importMapeo[campo];
    const header = idx!==undefined ? importHeaders[idx] : null;
    const hayDato = header!==null;
    return`<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:${hayDato?'var(--surface2)':'var(--surface)'};border:1px solid ${hayDato?'var(--border2)':'var(--border)'};border-radius:var(--rsm);">
      <span style="font-size:14px">${iconos[campo]||'·'}</span>
      <span style="font-size:13px;font-weight:500;color:var(--text);flex:1">${labels[campo]}</span>
      ${hayDato
        ? `<span style="font-size:11px;background:var(--green-bg);color:var(--green);padding:2px 9px;border-radius:10px;border:1px solid rgba(45,212,160,0.3)">columna: "${esc(header)}"</span>`
        : `<select onchange="importMapeo['${campo}']=this.value===''?undefined:Number(this.value)" style="font-size:11px;background:var(--surface3);border:1px solid var(--border2);border-radius:6px;padding:4px 8px;color:var(--text2);font-family:Geist,sans-serif;outline:none;">
            <option value="">— no importar —</option>
            ${importHeaders.map((h,i)=>`<option value="${i}">${esc(h)||'Columna '+(i+1)}</option>`).join('')}
          </select>`
      }
    </div>`;
  }).join('');
  
  // Preview tabla
  const tableEl = document.getElementById('importTable');
  const preview = importData.slice(0,3);
  const cols = Object.entries(importMapeo).filter(([,v])=>v!==undefined);
  tableEl.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:12px;">
    <thead><tr>
      ${cols.map(([campo])=>`<th style="padding:7px 10px;text-align:left;background:var(--surface2);color:var(--text2);font-weight:600;border-bottom:1px solid var(--border)">${campo}</th>`).join('')}
      ${importMapeo.tel!==undefined?'<th style="padding:7px 10px;text-align:left;background:var(--surface2);color:var(--green);font-weight:600;border-bottom:1px solid var(--border)">📱 tel. normalizado</th>':''}
    </tr></thead>
    <tbody>${preview.map(row=>`<tr>
      ${cols.map(([campo,idx])=>`<td style="padding:7px 10px;border-bottom:1px solid var(--border);color:var(--text)">${esc(row[idx])||'—'}</td>`).join('')}
      ${importMapeo.tel!==undefined?`<td style="padding:7px 10px;border-bottom:1px solid var(--border);color:var(--green);font-family:Geist Mono,monospace;font-size:11px">${esc(normalizarTelMostrar(String(row[importMapeo.tel]||'')))}</td>`:''}
    </tr>`).join('')}</tbody>
  </table>`;
  
  document.getElementById('importStatus').textContent = `${importData.length} clientes detectados para importar`;
}

async function ejecutarImportacion(){
  if(!importData.length){ toast('No hay datos para importar'); return; }
  if(importMapeo.nombre===undefined){ toast('Necesitás mapear al menos la columna Nombre'); return; }
  
  const etapa = document.getElementById('importEtapa')?.value || 'atencion';
  const statusEl = document.getElementById('importStatus');
  const btn = document.querySelector('#importModal .btn-primary');
  btn.textContent='Importando...'; btn.disabled=true;
  
  let importados=0, errores=0;
  const nuevos = [];
  
  for(const row of importData){
    const nombre = String(row[importMapeo.nombre]||'').trim();
    if(!nombre){ errores++; continue; }
    
    const c = {
      id: nextId++,
      nombre,
      tel: importMapeo.tel!==undefined ? normalizarTel(String(row[importMapeo.tel]||'').trim()) : '',
      ig:  importMapeo.ig!==undefined  ? String(row[importMapeo.ig]||'').trim()  : '',
      fuente: importMapeo.fuente!==undefined ? String(row[importMapeo.fuente]||'').trim() : 'importado',
      etapa,
      prio:'media',
      producto: importMapeo.producto!==undefined ? String(row[importMapeo.producto]||'').trim() : '',
      monto: importMapeo.monto!==undefined ? Number(String(row[importMapeo.monto]||'').replace(/[^0-9.]/g,''))||0 : 0,
      nota: importMapeo.nota!==undefined ? String(row[importMapeo.nota]||'').trim() : '',
      _telRaw: importMapeo.tel!==undefined ? String(row[importMapeo.tel]||'').trim() : '',
      etiquetas:[], secuencia:{paso:0,enviados:[]},
      ultimaRespuesta:null, optOut:false,
      lastContact:new Date().toISOString(),
      created:new Date().toISOString(),
    };
    nuevos.push(c);
    importados++;
    statusEl.textContent = `Importando... ${importados} de ${importData.length}`;
  }
  
  // Agregar al array local
  clientes.unshift(...nuevos);
  
  // Guardar en Supabase si está conectado
  if(cfg.url && cfg.key){
    let guardados=0;
    for(const c of nuevos){
      await guardarSB(c);
      guardados++;
      if(guardados % 10 === 0) statusEl.textContent = `Sincronizando con Supabase... ${guardados}/${nuevos.length}`;
    }
  }
  
  btn.textContent='⬆ Importar clientes'; btn.disabled=false;
  closeModal('importModal');
  render();
  toast(`✅ ${importados} clientes importados`+(errores?` · ⚠️ ${errores} filas sin nombre descartadas`:''));
}


// ═══════════════════════════════════════════════════════════════
// ── MÓDULO CAMPAÑAS ── envío masivo de WhatsApp desde Excel
//    Modo asistido (wa.me, hoy) + gancho Evolution API (automático)
// ═══════════════════════════════════════════════════════════════
let campaña = JSON.parse(localStorage.getItem('black_crm_campaña')||'null'); // {contactos:[], mensajeModo, mensajeMolde, creada}
function guardarCampaña(){ try{ localStorage.setItem('black_crm_campaña', JSON.stringify(campaña)); }catch(e){} }

// Interpola un molde contra un contacto de campaña (soporta {{saludo}} además de los del CRM)
function interpolarCampaña(tpl, ct){
  const c = { nombre: ct.saludo || ct.nombre || '', producto: ct.producto||'', monto: ct.monto||0 };
  return interpolar(tpl, c).replace(/\{\{saludo\}\}/g, ct.saludo||ct.nombre||'');
}
function mensajeDe(ct){
  if(!campaña) return '';
  if(campaña.mensajeModo==='individual') return ct.mensajePropio || '';
  const base = (campaña.mensajeModo==='editable' && ct.mensajePropio!=null) ? ct.mensajePropio : campaña.mensajeMolde;
  return interpolarCampaña(base||'', ct);
}

// ── Paso 1: procesar el Excel/CSV de campaña (reusa el parser del importador) ──
function procesarArchivoCampaña(input){
  const file = input.files[0]; if(!file) return;
  const reader = new FileReader();
  reader.onload = function(e){
    try{
      let rows=[];
      if(file.name.endsWith('.csv')){
        const lines = e.target.result.split('\n').filter(l=>l.trim());
        rows = lines.map(line=>{ const r=[]; let cur='',q=false; for(const ch of line){ if(ch==='"')q=!q; else if(ch===','&&!q){r.push(cur.trim());cur='';} else cur+=ch;} r.push(cur.trim()); return r; });
      } else {
        const wb = XLSX.read(new Uint8Array(e.target.result),{type:'array'});
        rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{header:1,defval:''});
      }
      if(rows.length<2){ toast('El archivo está vacío o solo tiene encabezados'); return; }
      const headers = rows[0].map(h=>String(h||'').trim());
      const datos = rows.slice(1).filter(r=>r.some(c=>c!=='')).slice(0,5000);
      // auto-mapeo (mismos alias del importador + saludo)
      const ALIAS = {...CAMPOS_CRM, saludo:['saludo','apodo','sobrenombre','nick','trato','como llamar']};
      const map={};
      headers.forEach((h,i)=>{ const hl=h.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''); for(const [campo,al] of Object.entries(ALIAS)){ if(map[campo]!==undefined)continue; if(al.some(a=>hl.includes(a)))map[campo]=i; } });
      if(map.nombre===undefined){ toast('No encontré una columna de Nombre en el archivo'); return; }
      if(map.tel===undefined){ toast('No encontré una columna de Teléfono — es obligatoria para deduplicar y enviar'); return; }
      // construir contactos + deduplicar por teléfono normalizado contra la base
      const existentesTel = new Set(clientes.map(c=>normalizarTel(c.tel)).filter(Boolean));
      const vistos = new Set();
      const contactos=[];
      let sinTel=0, dupArchivo=0;
      for(const row of datos){
        const nombre=String(row[map.nombre]||'').trim(); if(!nombre) continue;
        const telNorm=normalizarTel(String(row[map.tel]||'').trim());
        if(!telNorm){ sinTel++; continue; }
        if(vistos.has(telNorm)){ dupArchivo++; continue; } // duplicado dentro del mismo Excel
        vistos.add(telNorm);
        const g=(campo)=> map[campo]!==undefined ? String(row[map[campo]]||'').trim() : '';
        contactos.push({
          nombre, saludo:g('saludo'), tel:telNorm, telRaw:String(row[map.tel]||'').trim(),
          ig:g('ig'), producto:g('producto'),
          monto: map.monto!==undefined ? Number(String(row[map.monto]||'').replace(/[^0-9.]/g,''))||0 : 0,
          nota:g('nota'), fuente:g('fuente')||'campaña',
          yaExiste: existentesTel.has(telNorm),  // ← dedup contra la base: se saltea la carga pero entra a la campaña
          enviado:false, cargado:false, mensajePropio:null,
        });
      }
      campaña = { contactos, mensajeModo:'molde', mensajeMolde:'Hola {{saludo}} 👋 Te escribimos de Black Óptica.', creada:new Date().toISOString(), sinTel, dupArchivo };
      guardarCampaña();
      _campañaVista='mensaje';
      render();
    }catch(err){ toast('Error al leer el archivo: '+err.message); console.error(err); }
  };
  if(file.name.endsWith('.csv')) reader.readAsText(file,'UTF-8'); else reader.readAsArrayBuffer(file);
}

// ── Envío a UN contacto: asistido (wa.me) o automático (Evolution) ──
async function enviarCampañaUno(idx, forzar){
  const ct = campaña.contactos[idx]; if(!ct) return;
  if(ct.enviado && !forzar) return;
  const msg = mensajeDe(ct);
  if(!msg.trim()){ toast('Ese contacto no tiene mensaje'); return; }
  // Enviar por Evolution si está configurado y conectado; si no, asistido
  let evolutionOk=false;
  if(cfg.evoUrl && cfg.evoKey && cfg.evoInstance){
    evolutionOk = await evolutionSendText(ct.tel, msg);
  }
  if(!evolutionOk){
    window.open('https://wa.me/'+ct.tel+'?text='+encodeURIComponent(msg),'_blank');
  }
  ct.enviado=true;
  registrarLog(ct.tel, ct.saludo||ct.nombre, evolutionOk?'campaña-auto':'campaña', msg);
  // cargar a la base solo si es nuevo y aún no se cargó
  if(!ct.yaExiste && !ct.cargado){ await cargarContactoCampaña(ct); ct.cargado=true; }
  guardarCampaña(); renderCampaña();
}

// ── El botón mágico: enviar a TODOS (automático real vía Evolution, o asistido secuencial) ──
async function enviarCampañaTodos(){
  if(!campaña) return;
  const pend = campaña.contactos.filter(c=>!c.enviado);
  if(!pend.length){ toast('No quedan contactos pendientes'); return; }
  const auto = !!(cfg.evoUrl && cfg.evoKey && cfg.evoInstance);
  if(auto){
    if(!confirm(`Se enviará automáticamente a ${pend.length} contactos por WhatsApp (Evolution API). ¿Confirmás?`)) return;
    const btn=document.getElementById('btnEnviarTodos'); if(btn){btn.disabled=true;}
    let ok=0, fail=0;
    for(let i=0;i<campaña.contactos.length;i++){
      const ct=campaña.contactos[i]; if(ct.enviado) continue;
      const sent = await evolutionSendText(ct.tel, mensajeDe(ct));
      if(sent){ ct.enviado=true; ok++; registrarLog(ct.tel, ct.saludo||ct.nombre,'campaña-auto',mensajeDe(ct)); if(!ct.yaExiste&&!ct.cargado){await cargarContactoCampaña(ct);ct.cargado=true;} }
      else fail++;
      const st=document.getElementById('campañaProgreso'); if(st) st.textContent=`Enviando... ${ok+fail}/${pend.length}`;
      guardarCampaña();
      await new Promise(r=>setTimeout(r, 1200)); // ritmo humano: 1 msg/1.2s para no gatillar anti-spam
    }
    if(btn){btn.disabled=false;}
    renderCampaña();
    toast(`✅ Campaña enviada: ${ok} ok${fail?` · ⚠️ ${fail} fallaron`:''}`);
  } else {
    // Asistido: abrir el primero pendiente; el usuario va avanzando con "Enviado, siguiente"
    toast('Modo asistido: abrí cada uno y tocá "Enviado". Conectá Evolution en ⚙️ para envío automático.');
    const idx=campaña.contactos.findIndex(c=>!c.enviado);
    if(idx>=0) enviarCampañaUno(idx);
  }
}

// ── Cargar un contacto de campaña como cliente del CRM ──
async function cargarContactoCampaña(ct){
  const c={ id:nextId++, nombre:ct.nombre, tel:ct.telRaw||ct.tel, ig:ct.ig||'', fuente:ct.fuente||'campaña',
    etapa:(ajustes.etapas[0]?.id)||'atencion', prio:'media', producto:ct.producto||'', monto:ct.monto||0,
    nota:ct.nota||'', etiquetas:['campaña'], secuencia:{paso:0,enviados:[]}, ultimaRespuesta:null, optOut:false,
    lastContact:new Date().toISOString(), created:new Date().toISOString() };
  clientes.unshift(c); await guardarSB(c);
}

// ── GANCHO EVOLUTION API ── (se activa solo cuando cargás URL+Key+Instancia en ⚙️)
async function evolutionSendText(telNorm, texto){
  try{
    const url = cfg.evoUrl.replace(/\/$/,'') + '/message/sendText/' + encodeURIComponent(cfg.evoInstance);
    const r = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json','apikey':cfg.evoKey},
      body: JSON.stringify({ number: telNorm, text: texto }) });
    return r.ok;
  }catch(e){ return false; }
}
async function testEvolution(){
  const el=document.getElementById('evoResult'); if(!el) return;
  if(!cfg.evoUrl||!cfg.evoKey||!cfg.evoInstance){ el.textContent='Completá URL, API Key e Instancia'; el.style.color='var(--amber)'; return; }
  el.textContent='Probando...'; el.style.color='var(--amber)';
  try{
    const url = cfg.evoUrl.replace(/\/$/,'') + '/instance/connectionState/' + encodeURIComponent(cfg.evoInstance);
    const r = await fetch(url,{headers:{'apikey':cfg.evoKey}});
    const d = await r.json().catch(()=>null);
    const state = d?.instance?.state || d?.state;
    if(r.ok && state==='open'){ el.textContent='✅ Conectado — WhatsApp vinculado'; el.style.color='var(--green)'; }
    else if(r.ok){ el.textContent='⚠️ Responde pero WhatsApp no está vinculado (estado: '+(state||'desconocido')+') — re-escaneá el QR'; el.style.color='var(--amber)'; }
    else { el.textContent='❌ Error '+r.status+' — revisá URL/Key/Instancia'; el.style.color='var(--red)'; }
  }catch(e){ el.textContent='❌ No responde — ¿Railway está activo?'; el.style.color='var(--red)'; }
}

// ── VISTA CAMPAÑA ──
let _campañaVista='inicio'; // inicio | mensaje | enviar
function renderCampaña(){ const el=document.getElementById('mainContent'); if(el && vistaActual==='campanas') el.innerHTML=renderCampañaHTML(); }
function renderCampañaHTML(){
  if(!campaña) return campañaInicioHTML();
  if(_campañaVista==='mensaje') return campañaMensajeHTML();
  if(_campañaVista==='enviar') return campañaEnviarHTML();
  return campañaInicioHTML();
}
function campañaInicioHTML(){
  const evoOn = !!(cfg.evoUrl && cfg.evoKey && cfg.evoInstance);
  return `<div style="padding:16px">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3);margin-bottom:10px">Campaña de WhatsApp</div>
    <div style="background:${evoOn?'var(--green-bg)':'var(--surface2)'};border:1px solid ${evoOn?'rgba(45,212,160,0.25)':'var(--border)'};border-radius:var(--rsm);padding:10px 12px;font-size:12px;color:${evoOn?'var(--green)':'var(--text2)'};line-height:1.6;margin-bottom:14px">
      ${evoOn?'⚡ <b>Envío automático activo</b> (Evolution API) — un botón y salen todos.':'📱 <b>Modo asistido</b>: abrís cada chat y tocás enviar. Conectá Evolution API en ⚙️ para el envío automático de una.'}
    </div>
    <div onclick="document.getElementById('campañaFile').click()" style="border:2px dashed var(--border2);border-radius:var(--r);padding:32px 20px;text-align:center;cursor:pointer;transition:all 0.2s" onmouseover="this.style.borderColor='var(--accent)';this.style.background='var(--accent-bg)'" onmouseout="this.style.borderColor='var(--border2)';this.style.background='transparent'">
      <div style="font-size:32px;margin-bottom:8px">📂</div>
      <div style="font-size:14px;font-weight:500;margin-bottom:4px">Subí el Excel o CSV de contactos</div>
      <div style="font-size:12px;color:var(--text3)">Se deduplican por teléfono contra tu base · máx. 5000</div>
      <input type="file" id="campañaFile" accept=".csv,.xlsx,.xls" style="display:none" onchange="procesarArchivoCampaña(this)">
    </div>
    <div style="font-size:11px;color:var(--text3);line-height:1.6;margin-top:14px;background:var(--surface2);border-radius:var(--rsm);padding:10px 12px">
      <b style="color:var(--text2)">Columnas:</b> Nombre y Teléfono son obligatorias. Opcionales: <b>Saludo/Apodo</b> (cómo dirigirte, ej. "Fer"), Producto, Instagram, Presupuesto, Nota, Fuente. El sistema las detecta solas por el nombre del encabezado.
    </div>
  </div>`;
}
function campañaMensajeHTML(){
  const cs=campaña.contactos, nuevos=cs.filter(c=>!c.yaExiste).length, existen=cs.length-nuevos;
  const modo=campaña.mensajeModo;
  const preview = cs[0] ? esc(mensajeDe(cs[0])) : '';
  const avisos = (campaña.sinTel||campaña.dupArchivo) ? `<div style="font-size:11px;color:var(--amber);margin-top:6px">${campaña.sinTel?`⚠️ ${campaña.sinTel} sin teléfono válido (descartados). `:''}${campaña.dupArchivo?`⚠️ ${campaña.dupArchivo} repetidos en el archivo (descartados).`:''}</div>`:'';
  return `<div style="padding:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3)">Mensaje de la campaña</div>
      <button onclick="cancelarCampaña()" style="margin-left:auto;font-size:11px;color:var(--red);background:transparent;border:none;cursor:pointer;font-family:Geist,sans-serif">✕ descartar</button>
    </div>
    <div style="display:flex;gap:8px;margin-bottom:14px">
      <div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;font-family:Geist Mono,monospace;color:var(--green)">${nuevos}</div><div style="font-size:11px;color:var(--text2)">nuevos (se cargan)</div></div>
      <div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;font-family:Geist Mono,monospace;color:var(--text2)">${existen}</div><div style="font-size:11px;color:var(--text2)">ya en tu base</div></div>
      <div style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:10px;text-align:center"><div style="font-size:22px;font-weight:700;font-family:Geist Mono,monospace;color:var(--accent)">${cs.length}</div><div style="font-size:11px;color:var(--text2)">reciben WhatsApp</div></div>
    </div>${avisos}
    <div style="font-size:12px;color:var(--text2);margin:14px 0 6px">¿Cómo armás el mensaje?</div>
    <div class="ajustes-tabs" style="margin-bottom:12px">
      <button class="ajustes-tab ${modo==='molde'?'active':''}" onclick="setModoMsg('molde')">Uno para todos</button>
      <button class="ajustes-tab ${modo==='editable'?'active':''}" onclick="setModoMsg('editable')">Molde editable</button>
      <button class="ajustes-tab ${modo==='individual'?'active':''}" onclick="setModoMsg('individual')">Uno por uno</button>
    </div>
    ${modo!=='individual' ? `
      <textarea id="campañaMolde" onchange="campaña.mensajeMolde=this.value;guardarCampaña();renderCampaña()" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:var(--rsm);padding:11px 13px;font-size:14px;color:var(--text);font-family:Geist,sans-serif;outline:none;resize:vertical;min-height:90px;line-height:1.6">${esc(campaña.mensajeMolde)}</textarea>
      <div style="font-size:11px;color:var(--text3);margin-top:6px">Variables: <span style="background:var(--surface3);padding:1px 6px;border-radius:4px;font-family:Geist Mono,monospace;color:var(--accent)">{{saludo}}</span> <span style="background:var(--surface3);padding:1px 6px;border-radius:4px;font-family:Geist Mono,monospace;color:var(--accent)">{{nombre}}</span> <span style="background:var(--surface3);padding:1px 6px;border-radius:4px;font-family:Geist Mono,monospace;color:var(--accent)">{{producto}}</span> <span style="background:var(--surface3);padding:1px 6px;border-radius:4px;font-family:Geist Mono,monospace;color:var(--accent)">{{monto}}</span></div>
      <div style="margin-top:12px;background:var(--surface);border:1px solid var(--border);border-radius:var(--rsm);padding:11px 13px">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text3);margin-bottom:6px">Vista previa — ${esc(cs[0]?.saludo||cs[0]?.nombre||'primer contacto')}</div>
        <div style="font-size:13px;color:var(--text2);line-height:1.55;white-space:pre-wrap">${preview}</div>
      </div>
      ${modo==='editable'?`<div style="font-size:11px;color:var(--text3);margin-top:8px">En el siguiente paso vas a poder editar el mensaje de cada contacto uno por uno.</div>`:''}
    ` : `<div style="font-size:12px;color:var(--text2);background:var(--surface2);border-radius:var(--rsm);padding:10px 12px;line-height:1.6">Vas a escribir el mensaje de cada contacto en el siguiente paso, uno por uno.</div>`}
    <button class="btn btn-primary" style="margin-top:16px" onclick="_campañaVista='enviar';renderCampaña()">Continuar al envío →</button>
    <button class="btn" style="width:100%;justify-content:center;margin-top:8px" onclick="_campañaVista='inicio';campaña=null;guardarCampaña();renderCampaña()">← Elegir otro archivo</button>
  </div>`;
}
function campañaEnviarHTML(){
  const cs=campaña.contactos, enviados=cs.filter(c=>c.enviado).length, pend=cs.length-enviados;
  const evoOn=!!(cfg.evoUrl&&cfg.evoKey&&cfg.evoInstance);
  const filas=cs.map((ct,i)=>{
    const msg=mensajeDe(ct);
    return `<div style="background:var(--surface);border:1px solid ${ct.enviado?'rgba(45,212,160,0.2)':'var(--border)'};border-radius:var(--rsm);padding:11px 12px;margin-bottom:6px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:${msg?'6px':'0'}">
        <div style="flex:1;min-width:0"><div style="font-size:14px;font-weight:500">${esc(ct.saludo||ct.nombre)} ${ct.yaExiste?'<span style=\"font-size:10px;color:var(--text3)\">(ya en base)</span>':'<span style=\"font-size:10px;color:var(--green)\">(nuevo)</span>'}</div><div style="font-size:11px;color:var(--text3);font-family:Geist Mono,monospace">${esc(normalizarTelMostrar(ct.tel))}</div></div>
        ${ct.enviado?'<span style="font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:var(--green-bg);color:var(--green)">✓ enviado</span>':`<button onclick="enviarCampañaUno(${i})" style="font-size:12px;font-weight:600;padding:7px 14px;border-radius:var(--rsm);border:1px solid rgba(37,211,102,0.3);background:rgba(37,211,102,0.1);color:var(--green);cursor:pointer;font-family:Geist,sans-serif;white-space:nowrap">📱 Enviar</button>`}
      </div>
      ${campaña.mensajeModo==='individual'||campaña.mensajeModo==='editable' ? `<textarea placeholder="Mensaje para ${esc(ct.saludo||ct.nombre)}..." onchange="setMsgPropio(${i},this.value)" style="width:100%;background:var(--surface2);border:1px solid var(--border);border-radius:6px;padding:7px 9px;font-size:12px;color:var(--text);font-family:Geist,sans-serif;outline:none;resize:vertical;min-height:44px;line-height:1.5">${esc(ct.mensajePropio!=null?ct.mensajePropio:(campaña.mensajeModo==='editable'?msg:''))}</textarea>` : (msg?`<div style="font-size:12px;color:var(--text3);line-height:1.5;border-left:2px solid var(--border2);padding-left:8px">${esc(msg)}</div>`:'')}
    </div>`;
  }).join('');
  return `<div style="padding:16px">
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:var(--text3)">Envío</div>
      <button onclick="_campañaVista='mensaje';renderCampaña()" style="margin-left:auto;font-size:11px;color:var(--accent);background:transparent;border:none;cursor:pointer;font-family:Geist,sans-serif">← editar mensaje</button>
    </div>
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
      <div style="flex:1;height:6px;background:var(--surface2);border-radius:3px;overflow:hidden"><div style="height:100%;width:${cs.length?Math.round(enviados/cs.length*100):0}%;background:var(--green);transition:width 0.3s"></div></div>
      <div id="campañaProgreso" style="font-size:12px;color:var(--text2);font-family:Geist Mono,monospace;white-space:nowrap">${enviados}/${cs.length}</div>
    </div>
    <button id="btnEnviarTodos" class="btn btn-primary" style="background:${evoOn?'var(--green)':'var(--accent)'};border-color:${evoOn?'var(--green)':'var(--accent)'}" onclick="enviarCampañaTodos()">${evoOn?`⚡ Enviar automático a los ${pend} pendientes`:`📱 Empezar envío asistido (${pend} pendientes)`}</button>
    ${!evoOn?'<div style="font-size:11px;color:var(--text3);text-align:center;margin-top:6px;line-height:1.5">En modo asistido abrís cada chat y tocás enviar. Para el botón que manda a todos solo, conectá Evolution API en ⚙️.</div>':''}
    <div style="margin-top:16px">${filas}</div>
    <button class="btn" style="width:100%;justify-content:center;margin-top:8px" onclick="finalizarCampaña()">Finalizar campaña</button>
  </div>`;
}
function setModoMsg(m){ campaña.mensajeModo=m; guardarCampaña(); renderCampaña(); }
function setMsgPropio(i,v){ campaña.contactos[i].mensajePropio=v; guardarCampaña(); }
function cancelarCampaña(){ if(!confirm('¿Descartar esta campaña? Se pierde la lista cargada.'))return; campaña=null; guardarCampaña(); _campañaVista='inicio'; renderCampaña(); }
function finalizarCampaña(){ const e=campaña.contactos.filter(c=>c.enviado).length; if(!confirm(`Enviaste ${e} de ${campaña.contactos.length}. ¿Finalizar y limpiar la campaña?`))return; campaña=null; guardarCampaña(); _campañaVista='inicio'; renderCampaña(); toast('Campaña finalizada ✓'); }


// ── INIT ──
(async function bootCRMClientes(){
  document.body.classList.toggle('is-embedded', window.self !== window.top);
  const autorizado=await iniciarSesionPortal();
  if(!autorizado)return;
  render();
  cargarDesdeSupabase().then(()=>iniciarPolling());
})();
