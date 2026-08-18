// Black Óptica — CRM Oftalmólogos

const portalSupabase = window.BlackPortal.getSupabase();

async function ensurePortalSession(){
  try{
    const { data: { session } } = await portalSupabase.auth.getSession();
    if(!session){
      window.location.replace("index.html");
      return null;
    }

    const email = session.user.email || "";
    const rawName =
      session.user.user_metadata?.full_name ||
      session.user.user_metadata?.name ||
      email.split("@")[0].replace(/[._-]+/g," ");

    const displayName = rawName
      .split(" ")
      .filter(Boolean)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

    if(displayName){
      localStorage.setItem("blackoptica_username", displayName);
    }
    localStorage.setItem("blackoptica_onboarding", "done");
    window.__blackPortalSession = session;
    return session;
  }catch(err){
    console.error("No se pudo validar la sesión del Portal Black:", err);
    window.location.replace("index.html");
    return null;
  }
}

function adaptEmbeddedPortal(){
  if(window.self !== window.top){
    const back = document.querySelector(".portal-back-btn");
    if(back) back.style.display = "none";
  }
}

// ══════════════════════════════════════════════════════
// CONSTANTS & INITIAL DATA
// ══════════════════════════════════════════════════════
const DIAS = ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"];
const TIPOS = ["Indistinto","Ulterior / Control","Indistinto con prácticas","Práctica"];
const INSTITUCIONES = ["OSCCPTAC","Reina Fabiola","Salvador","Lista Oftalmologia"];

const INITIAL_DOCTORS = [
  {id:"ibañez-agustina",nombre:"Ibañez, Agustina",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Lunes",tipo:"Indistinto",desde:"14:00",hasta:"17:00",duracion:15},{dia:"Lunes",tipo:"Ulterior / Control",desde:"17:00",hasta:"17:30",duracion:15},{dia:"Martes",tipo:"Indistinto",desde:"08:00",hasta:"12:00",duracion:15},{dia:"Martes",tipo:"Ulterior / Control",desde:"12:00",hasta:"12:30",duracion:15},{dia:"Jueves",tipo:"Indistinto",desde:"08:00",hasta:"12:00",duracion:15},{dia:"Jueves",tipo:"Ulterior / Control",desde:"12:00",hasta:"12:30",duracion:15}]}]},
  {id:"zurita-melina",nombre:"Zurita Padro, Melina Beatriz",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Miércoles",tipo:"Indistinto",desde:"09:00",hasta:"13:00",duracion:15},{dia:"Jueves",tipo:"Práctica",desde:"09:00",hasta:"13:00",duracion:10},{dia:"Viernes",tipo:"Indistinto",desde:"12:00",hasta:"17:15",duracion:15}]}]},
  {id:"osaba-matias",nombre:"Osaba, Matias",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Miércoles",tipo:"Indistinto",desde:"09:20",hasta:"13:20",duracion:15},{dia:"Miércoles",tipo:"Ulterior / Control",desde:"13:20",hasta:"14:20",duracion:15},{dia:"Sábado",tipo:"Indistinto",desde:"08:00",hasta:"11:00",duracion:15},{dia:"Sábado",tipo:"Indistinto",desde:"11:00",hasta:"12:00",duracion:15}]}]},
  {id:"gonzalez-eugenia",nombre:"González Castellanos, María Eugenia",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Lunes",tipo:"Indistinto",desde:"14:00",hasta:"18:30",duracion:15},{dia:"Martes",tipo:"Indistinto",desde:"13:45",hasta:"18:00",duracion:15}]}]},
  {id:"dalmagro-juan",nombre:"Dalmagro, Juan Antonio",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Martes",tipo:"Indistinto",desde:"08:20",hasta:"09:20",duracion:20},{dia:"Martes",tipo:"Ulterior / Control",desde:"09:20",hasta:"10:00",duracion:20},{dia:"Miércoles",tipo:"Indistinto",desde:"14:30",hasta:"17:10",duracion:20},{dia:"Miércoles",tipo:"Ulterior / Control",desde:"17:10",hasta:"18:10",duracion:20}]}]},
  {id:"gonzalez-ines",nombre:"González Castellanos, Maria Inés",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Lunes",tipo:"Indistinto con prácticas",desde:"16:00",hasta:"19:00",duracion:15},{dia:"Jueves",tipo:"Indistinto con prácticas",desde:"14:00",hasta:"18:00",duracion:15},{dia:"Viernes",tipo:"Indistinto",desde:"14:00",hasta:"18:00",duracion:15}]}]},
  {id:"holgado-camila",nombre:"Holgado Herrera, Maria Camila",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Miércoles",tipo:"Indistinto",desde:"12:00",hasta:"17:30",duracion:15},{dia:"Miércoles",tipo:"Ulterior / Control",desde:"17:30",hasta:"18:30",duracion:15}]}]},
  {id:"muñoz-agustina",nombre:"Muñoz, Agustina Gabriela",servicio:"DEMANDA DE OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Martes",tipo:"Indistinto",desde:"10:00",hasta:"13:00",duracion:30},{dia:"Miércoles",tipo:"Indistinto",desde:"14:00",hasta:"16:00",duracion:30},{dia:"Jueves",tipo:"Indistinto",desde:"14:00",hasta:"18:00",duracion:30}]}]},
  {id:"lopez-giordano-paula",nombre:"Lopez Giordano, Paula Beatriz",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Martes",tipo:"Indistinto",desde:"08:40",hasta:"12:20",duracion:20},{dia:"Martes",tipo:"Indistinto",desde:"14:00",hasta:"17:00",duracion:20},{dia:"Jueves",tipo:"Indistinto",desde:"08:40",hasta:"12:20",duracion:20},{dia:"Jueves",tipo:"Indistinto",desde:"14:00",hasta:"17:00",duracion:20}]}]},
  {id:"monti-jose",nombre:"Monti, Jose Rodolfo",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Lunes",tipo:"Indistinto",desde:"08:30",hasta:"11:30",duracion:20},{dia:"Lunes",tipo:"Ulterior / Control",desde:"11:30",hasta:"12:30",duracion:20},{dia:"Lunes",tipo:"Indistinto",desde:"13:30",hasta:"15:15",duracion:15},{dia:"Lunes",tipo:"Ulterior / Control",desde:"15:15",hasta:"16:15",duracion:15},{dia:"Martes",tipo:"Indistinto",desde:"08:30",hasta:"11:30",duracion:20},{dia:"Martes",tipo:"Ulterior / Control",desde:"11:30",hasta:"12:30",duracion:20},{dia:"Martes",tipo:"Indistinto",desde:"13:30",hasta:"15:15",duracion:15},{dia:"Martes",tipo:"Ulterior / Control",desde:"15:15",hasta:"16:15",duracion:15}]}]},
  {id:"maccio-juan",nombre:"Maccio, Juan Pablo",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Lunes",tipo:"Indistinto con prácticas",desde:"08:40",hasta:"12:00",duracion:20},{dia:"Martes",tipo:"Indistinto con prácticas",desde:"14:00",hasta:"17:00",duracion:20},{dia:"Martes",tipo:"Ulterior / Control",desde:"17:00",hasta:"18:00",duracion:20},{dia:"Jueves",tipo:"Indistinto con prácticas",desde:"09:40",hasta:"12:00",duracion:20},{dia:"Jueves",tipo:"Ulterior / Control",desde:"12:00",hasta:"12:40",duracion:20},{dia:"Jueves",tipo:"Indistinto con prácticas",desde:"14:00",hasta:"17:00",duracion:20},{dia:"Jueves",tipo:"Ulterior / Control",desde:"17:00",hasta:"18:00",duracion:20},{dia:"Viernes",tipo:"Indistinto con prácticas",desde:"08:40",hasta:"12:00",duracion:20}]}]},
  {id:"monetto-agostina",nombre:"Monetto, Agostina",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Miércoles",tipo:"Indistinto",desde:"13:15",hasta:"16:00",duracion:15}]}]},
  {id:"knoll-erna",nombre:"Knoll, Erna Gertrudis",servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Lunes",tipo:"Indistinto",desde:"08:00",hasta:"12:00",duracion:20},{dia:"Lunes",tipo:"Ulterior / Control",desde:"12:00",hasta:"13:00",duracion:20},{dia:"Miércoles",tipo:"Indistinto con prácticas",desde:"08:00",hasta:"11:40",duracion:20},{dia:"Miércoles",tipo:"Ulterior / Control",desde:"11:40",hasta:"12:40",duracion:20},{dia:"Viernes",tipo:"Indistinto",desde:"08:00",hasta:"11:20",duracion:20},{dia:"Viernes",tipo:"Ulterior / Control",desde:"11:20",hasta:"12:40",duracion:20}]}]},
  {id:"lopez-emilio",nombre:"Lopez, Emilio",servicio:"DEMANDA DE OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[{dia:"Martes",tipo:"Indistinto",desde:"14:00",hasta:"16:00",duracion:30},{dia:"Miércoles",tipo:"Indistinto",desde:"14:00",hasta:"16:00",duracion:30},{dia:"Viernes",tipo:"Indistinto",desde:"14:00",hasta:"18:00",duracion:30}]}]}
];

// ══════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════
let doctors = [];
let recetas = []; // [{fecha, paciente, medico, monto, institucion}]
let comisiones = {}; // {normName: pct}
let pagos = {};      // {"normName|desde|hasta": true}
let selectedDay = "";
let importedData = [];
let importMode = "add";
let pendingDeleteId = null;
let chartMode = "facturacion";
let wordOpt = "todos";
let csvImportMode = "add";
let parsedCsvData = [];
let lastDocList = []; // cache para acordeones

function loadState() {
  const savedDocs = localStorage.getItem("blackoptica_doctors");
  const raw = savedDocs ? JSON.parse(savedDocs) : JSON.parse(JSON.stringify(INITIAL_DOCTORS));
  doctors = raw.map(d => d.turnos && !d.instituciones ? {...d, instituciones:[{nombre:"Black Optica",turnos:d.turnos}]} : d);
  const savedRec = localStorage.getItem("blackoptica_recetas");
  recetas = savedRec ? JSON.parse(savedRec) : [];
  const savedCom = localStorage.getItem("blackoptica_comisiones");
  comisiones = savedCom ? JSON.parse(savedCom) : {};
  const savedPag = localStorage.getItem("blackoptica_pagos");
  pagos = savedPag ? JSON.parse(savedPag) : {};
}
function saveState() {
  localStorage.setItem("blackoptica_doctors", JSON.stringify(doctors));
  localStorage.setItem("blackoptica_recetas", JSON.stringify(recetas));
  localStorage.setItem("blackoptica_comisiones", JSON.stringify(comisiones));
  localStorage.setItem("blackoptica_pagos", JSON.stringify(pagos));
}
function getUserName() { return localStorage.getItem("blackoptica_username") || ""; }
function setUserName(n) { localStorage.setItem("blackoptica_username", n); }
function getComision(nombre) {
  const key = normName(nombre);
  return comisiones[key] !== undefined ? comisiones[key] : 20;
}
function setComision(nombre, pct) {
  comisiones[normName(nombre)] = pct;
  saveState();
}
// MEJORA: normaliza acentos → "Muñoz" y "MUNOZ" son el mismo médico
function normName(n) {
  return (n||"").toLowerCase().trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/\s+/g,' ');
}
function firmaReceta(r){ return `${r.fecha}|${normName(r.paciente)}|${normName(r.medico)}|${r.monto}`; }

// ══════════════════════════════════════════════════════
// BACKUP / RESTORE
// ══════════════════════════════════════════════════════
function openBackupModal(){ document.getElementById("modal-backup").classList.add("open"); }
function exportBackup(){
  const data = {
    version: 2,
    exportado: new Date().toISOString(),
    doctors, recetas, comisiones, pagos,
    username: getUserName()
  };
  const blob = new Blob([JSON.stringify(data,null,2)],{type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  const d = new Date();
  a.download = `blackoptica_respaldo_${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}.json`;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000);
  showToast("✓ Respaldo descargado");
}
function restoreBackup(e){
  const f = e.target.files[0];
  if(!f) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try{
      const data = JSON.parse(ev.target.result);
      if(!data.doctors || !Array.isArray(data.doctors)) throw new Error("Formato inválido");
      doctors = data.doctors;
      recetas = data.recetas || [];
      comisiones = data.comisiones || {};
      pagos = data.pagos || {};
      if(data.username) setUserName(data.username);
      saveState();
      updateNavUser(); renderHero(); renderDaySelector(); renderSchedule(); renderDoctorsList(); applyFilters(); renderBirthdays();
      closeModal("modal-backup");
      showToast(`✓ Respaldo restaurado: ${doctors.length} médicos, ${recetas.length} recetas`);
    }catch(err){
      showToast("⚠️ El archivo no es un respaldo válido");
    }
  };
  reader.readAsText(f);
  e.target.value = "";
}

// ══════════════════════════════════════════════════════
// ONBOARDING
// ══════════════════════════════════════════════════════
let currentObCard = 1;
function detectPlatform() {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  return "desktop";
}
function initOnboarding() {
  const p = detectPlatform();
  document.getElementById("ob-ios-steps").style.display = p==="ios"?"block":"none";
  document.getElementById("ob-android-steps").style.display = p==="android"?"block":"none";
  document.getElementById("ob-desktop-msg").style.display = p==="desktop"?"block":"none";
}
function goObCard(n) {
  document.getElementById(`ob-card-${currentObCard}`).classList.remove("active");
  currentObCard = n;
  document.getElementById(`ob-card-${n}`).classList.add("active");
  document.querySelectorAll(".ob-dot").forEach((d,i)=>d.classList.toggle("active",i<n));
}
document.getElementById("ob-btn-1").onclick = () => {
  const val = document.getElementById("ob-name-input").value.trim();
  if (!val) { document.getElementById("ob-name-input").focus(); return; }
  setUserName(val);
  document.getElementById("ob-ready-title").textContent = `¡Todo listo, ${val}!`;
  document.getElementById("ob-ready-sub").textContent = `Bienvenido/a a Black Óptica.`;
  goObCard(2);
};
document.getElementById("ob-name-input").addEventListener("keydown", e=>{ if(e.key==="Enter") document.getElementById("ob-btn-1").click(); });
document.getElementById("ob-btn-2").onclick = ()=>goObCard(3);
document.getElementById("ob-btn-3").onclick = ()=>goObCard(4);
document.getElementById("ob-btn-3-skip").onclick = ()=>goObCard(4);
document.getElementById("ob-btn-4").onclick = () => {
  localStorage.setItem("blackoptica_onboarding","done");
  const ob = document.getElementById("onboarding");
  ob.classList.add("hiding");
  setTimeout(()=>{ ob.style.display="none"; startApp(); },400);
};
function checkOnboarding() {
  if (localStorage.getItem("blackoptica_onboarding")==="done" && getUserName()) {
    document.getElementById("onboarding").style.display="none"; startApp();
  } else { initOnboarding(); const n=getUserName(); if(n) document.getElementById("ob-name-input").value=n; }
}

// ══════════════════════════════════════════════════════
// APP INIT
// ══════════════════════════════════════════════════════
function startApp() {
  loadState();
  document.getElementById("app").classList.add("visible");
  updateNavUser();
  selectedDay = DIAS[new Date().getDay()];
  renderDaySelector();
  renderSchedule();
  renderHero();
  renderBirthdays();
  const now = new Date();
  const y = now.getFullYear(), m = String(now.getMonth()+1).padStart(2,'0');
  document.getElementById("periodo-desde").value = `${y}-${m}-01`;
  const lastDay = new Date(y, now.getMonth()+1, 0).getDate();
  document.getElementById("periodo-hasta").value = `${y}-${m}-${String(lastDay).padStart(2,'0')}`;
}
function updateNavUser() {
  const name = getUserName();
  document.getElementById("nav-username").textContent = name||"Usuario";
  document.getElementById("nav-avatar").textContent = name?name[0].toUpperCase():"?";
}
function editUserName() {
  const cur = getUserName();
  const val = prompt("¿Cómo querés que te llamemos?", cur);
  if (val&&val.trim()) { setUserName(val.trim()); updateNavUser(); renderHero(); showToast("Nombre actualizado ✓"); }
}

// ══════════════════════════════════════════════════════
// HERO
// ══════════════════════════════════════════════════════
function renderHero() {
  const now = new Date(), h = now.getHours();
  const greeting = h<13?"Buenos días":h<20?"Buenas tardes":"Buenas noches";
  const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
  document.getElementById("hero-greeting").textContent = greeting+",";
  document.getElementById("hero-username").textContent = getUserName()||"¡Bienvenido!";
  document.getElementById("hero-date").textContent = `${DIAS[now.getDay()]}, ${now.getDate()} de ${meses[now.getMonth()]}`;
  const today = DIAS[now.getDay()];
  const docsToday = getDoctorsForDay(today);
  const totalBlocks = docsToday.reduce((a,d)=>a+d.turnosDelDia.length,0);
  const totalTurns = docsToday.reduce((a,d)=>a+d.turnosDelDia.reduce((b,t)=>b+calcTurns(t),0),0);
  document.getElementById("stat-docs").textContent = docsToday.length;
  document.getElementById("stat-shifts").textContent = totalBlocks;
  document.getElementById("stat-turns").textContent = totalTurns;
}

// ══════════════════════════════════════════════════════
// DAY SELECTOR & SCHEDULE
// ══════════════════════════════════════════════════════
function renderDaySelector() {
  const today = DIAS[new Date().getDay()];
  const ordered = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];
  document.getElementById("day-selector").innerHTML = ordered.map(d=>{
    const hasDocs = getDoctorsForDay(d).length>0;
    return `<button class="day-pill${d===selectedDay?" active":""}${d===today?" today-pill":""}${!hasDocs?" no-doctors":""}" onclick="selectDay('${d}')">${d}</button>`;
  }).join("");
}
function selectDay(d) { selectedDay=d; renderDaySelector(); renderSchedule(); }
function getDoctorsForDay(day) {
  return doctors.map(doc=>{
    const institucionesDelDia=(doc.instituciones||[]).map(inst=>({nombre:inst.nombre,turnos:inst.turnos.filter(t=>t.dia===day)})).filter(i=>i.turnos.length>0);
    const allTurnos=institucionesDelDia.flatMap(i=>i.turnos);
    return {...doc,institucionesDelDia,turnosDelDia:allTurnos};
  }).filter(d=>d.turnosDelDia.length>0).sort((a,b)=>Math.min(...a.turnosDelDia.map(t=>timeToMin(t.desde)))-Math.min(...b.turnosDelDia.map(t=>timeToMin(t.desde))));
}
function timeToMin(t){const[h,m]=t.split(":").map(Number);return h*60+m;}
function calcTurns(t){return Math.max(1,Math.floor((timeToMin(t.hasta)-timeToMin(t.desde))/t.duracion));}
function badgeClass(tipo){if(tipo==="Ulterior / Control")return"badge-ulterior";if(tipo==="Indistinto con prácticas")return"badge-practicas";if(tipo==="Práctica")return"badge-practica";return"badge-indistinto";}
function initials(n){const p=n.split(/[,\s]+/).filter(Boolean);return p.length>=2?(p[0][0]+p[1][0]).toUpperCase():n[0].toUpperCase();}
function renderSchedule() {
  const docsForDay = getDoctorsForDay(selectedDay);
  const today = DIAS[new Date().getDay()];
  document.getElementById("schedule-day-label").textContent = selectedDay===today?`Hoy · ${selectedDay}`:selectedDay;
  document.getElementById("schedule-count").textContent = `${docsForDay.length} profesional${docsForDay.length!==1?"es":""}`;
  if (!docsForDay.length) {
    document.getElementById("schedule-list").innerHTML=`<div class="empty-state"><div class="empty-icon"><svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="var(--arena)" stroke-width="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></div><div class="empty-title">Sin consultas programadas</div><div class="empty-sub">No hay oftalmólogos para el ${selectedDay}.</div></div>`;
    return;
  }
  document.getElementById("schedule-list").innerHTML = docsForDay.map((doc,idx)=>{
    const instHTML = doc.institucionesDelDia.map(inst=>`<div class="inst-block"><div class="inst-label"><svg width="11" height="11" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>${inst.nombre}</div><div class="turno-list">${inst.turnos.map(t=>`<div class="turno-row"><div class="turno-time"><svg width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>${t.desde}</div><div style="font-size:.78rem;color:var(--roble);font-weight:500">→</div><div class="turno-time">${t.hasta}</div><div class="turno-sep"></div><div class="turno-badges"><span class="badge ${badgeClass(t.tipo)}">${t.tipo}</span><span class="badge badge-duracion">${t.duracion}min · ~${calcTurns(t)}</span></div></div>`).join("")}</div></div>`).join("");
    const isDemanda=doc.servicio.includes("DEMANDA");
    return `<div class="doctor-card" style="animation-delay:${idx*60}ms"><div class="doctor-card-header"><div class="doctor-avatar">${initials(doc.nombre)}</div><div class="doctor-info"><div class="doctor-name">${doc.nombre}</div><span class="doctor-service${isDemanda?" demanda":""}">${doc.servicio}</span></div></div>${instHTML}</div>`;
  }).join("");
}

// MEJORA: compartir el cronograma del día por WhatsApp / portapapeles
function shareDaySchedule(){
  const docsForDay = getDoctorsForDay(selectedDay);
  if(!docsForDay.length){ showToast("Sin profesionales ese día"); return; }
  let txt = `👁 *Black Óptica — ${selectedDay}*\n\n`;
  docsForDay.forEach(doc=>{
    txt += `*${doc.nombre}*\n`;
    doc.institucionesDelDia.forEach(inst=>{
      inst.turnos.forEach(t=>{
        txt += `  ${t.desde} a ${t.hasta} · ${t.tipo} (${t.duracion}min)\n`;
      });
    });
    txt += `\n`;
  });
  if(navigator.share){
    navigator.share({text:txt}).catch(()=>{});
  } else {
    navigator.clipboard.writeText(txt).then(()=>showToast("✓ Cronograma copiado, pegalo en WhatsApp"));
  }
}


// ══════════════════════════════════════════════════════
// CRM: TELÉFONO / WHATSAPP / CUMPLEAÑOS / SEGUIMIENTO
// ══════════════════════════════════════════════════════
function phoneDigits(tel){
  let d=String(tel||"").replace(/\D/g,"");
  if(!d) return "";
  if(d.startsWith("00")) d=d.slice(2);
  if(!d.startsWith("54")){
    if(d.startsWith("0")) d=d.slice(1);          // 0351...
    if(d.length===10) d="549"+d;                  // 351xxxxxxx con característica
    else if(d.length===11&&d.startsWith("15")) d="549351"+d.slice(2); // 15xxxxxxx (asume Córdoba)
    else d="54"+d;
  } else if(d.startsWith("54")&&!d.startsWith("549")&&d.length===12){
    d="549"+d.slice(2);
  }
  return d;
}
function openWhatsApp(tel, msg){
  const d=phoneDigits(tel);
  if(!d){showToast("⚠️ Sin teléfono cargado");return;}
  const url="https://wa.me/"+d+(msg?"?text="+encodeURIComponent(msg):"");
  window.open(url,"_blank");
}
function callPhone(tel){
  const d=phoneDigits(tel);
  if(!d){showToast("⚠️ Sin teléfono cargado");return;}
  window.location.href="tel:+"+d;
}
function diasHastaCumple(cumple){ // cumple: "YYYY-MM-DD"
  if(!cumple) return null;
  const p=cumple.split("-");
  if(p.length!==3) return null;
  const hoy=new Date(); hoy.setHours(0,0,0,0);
  let next=new Date(hoy.getFullYear(),parseInt(p[1])-1,parseInt(p[2]));
  if(next<hoy) next=new Date(hoy.getFullYear()+1,parseInt(p[1])-1,parseInt(p[2]));
  return Math.round((next-hoy)/86400000);
}
function fmtCumple(cumple){
  if(!cumple) return "—";
  const p=cumple.split("-");
  const meses=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return parseInt(p[2])+" de "+meses[parseInt(p[1])-1];
}
function renderBirthdays(){
  const strip=document.getElementById("bday-strip");
  if(!strip) return;
  const proximos=doctors
    .map(d=>({d,dias:diasHastaCumple(d.cumple)}))
    .filter(x=>x.dias!==null&&x.dias<=14)
    .sort((a,b)=>a.dias-b.dias);
  if(!proximos.length){strip.innerHTML="";return;}
  strip.innerHTML=proximos.map(({d,dias},i)=>{
    const when=dias===0?"🎉 ¡Cumple hoy!":dias===1?"Cumple mañana":`Cumple en ${dias} días · ${fmtCumple(d.cumple)}`;
    const nombrePila=d.nombre.includes(",")?d.nombre.split(",")[1].trim().split(" ")[0]:d.nombre.split(" ")[0];
    const saludo=`¡Feliz cumpleaños, ${nombrePila}! 🎂 Que tengas un día hermoso. Un saludo grande de parte de todo el equipo de Black Óptica 🖤`;
    return `<div class="bday-card" style="animation-delay:${i*60}ms">
      <div class="bday-icon">🎂</div>
      <div class="bday-info"><div class="bday-name">${escHtml(d.nombre)}</div><div class="bday-when${dias===0?" hoy":""}">${when}</div></div>
      <button class="btn-wsp" ${d.telefono?"":"disabled"} onclick="openWhatsApp('${escAttr(d.telefono||"")}', '${escAttr(saludo)}')" title="Saludar por WhatsApp">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
      </button>
    </div>`;
  }).join("");
}
function openCrmModal(id){
  const d=doctors.find(x=>x.id===id);
  if(!d) return;
  const dias=diasHastaCumple(d.cumple);
  const segs=(d.seguimientos||[]).slice().reverse();
  document.getElementById("crm-body").innerHTML=`
    <div class="crm-header-card">
      <div class="doctor-avatar">${initials(d.nombre)}</div>
      <div style="flex:1;min-width:0">
        <div class="commission-name" style="font-size:1.05rem">${escHtml(d.nombre)}</div>
        <span class="doctor-service${d.servicio.includes("DEMANDA")?" demanda":""}" style="margin-top:4px">${d.servicio}</span>
      </div>
    </div>
    <div class="crm-contact-row">
      <button class="crm-contact-btn wsp" ${d.telefono?"":"disabled"} onclick="openWhatsApp('${escAttr(d.telefono||"")}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        WhatsApp
      </button>
      <button class="crm-contact-btn call" ${d.telefono?"":"disabled"} onclick="callPhone('${escAttr(d.telefono||"")}')">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
        Llamar
      </button>
    </div>
    <div class="crm-meta">
      <div class="crm-meta-box"><div class="crm-meta-label">Teléfono</div><div class="crm-meta-val">${d.telefono?escHtml(d.telefono):"—"}</div></div>
      <div class="crm-meta-box"><div class="crm-meta-label">Cumpleaños</div><div class="crm-meta-val">${fmtCumple(d.cumple)}${dias!==null&&dias<=30?` <span style="color:var(--cobre);font-size:.7rem">(${dias===0?"¡hoy!":"en "+dias+" días"})</span>`:""}</div></div>
    </div>
    <div class="crm-section-title">Notas</div>
    <textarea class="crm-notas" id="crm-notas" placeholder="Preferencias, acuerdos, datos útiles..." onchange="saveCrmNotas('${d.id}',this.value)">${escHtml(d.notas||"")}</textarea>
    <div class="crm-section-title">Seguimiento</div>
    <div class="seg-input-row">
      <input class="seg-input" id="seg-input" type="text" placeholder="ej: Le propuse sumar un día más..." onkeydown="if(event.key==='Enter')addSeguimiento('${d.id}')" />
      <button class="seg-add-btn" onclick="addSeguimiento('${d.id}')">+</button>
    </div>
    ${segs.length?`<div class="seg-timeline">${segs.map((s,i)=>`<div class="seg-item"><span class="seg-fecha">${escHtml(s.fecha)}</span><button class="seg-del" onclick="delSeguimiento('${d.id}',${(d.seguimientos||[]).length-1-i})">eliminar</button><div class="seg-texto">${escHtml(s.texto)}</div></div>`).join("")}</div>`:`<div class="seg-empty">Sin registros todavía. Anotá acá cada charla o gestión con el profesional.</div>`}
  `;
  document.getElementById("modal-crm").classList.add("open");
}
function saveCrmNotas(id,val){
  const d=doctors.find(x=>x.id===id);
  if(!d) return;
  d.notas=val;
  saveState();
  showToast("✓ Notas guardadas");
}
function addSeguimiento(id){
  const input=document.getElementById("seg-input");
  const texto=input.value.trim();
  if(!texto){input.focus();return;}
  const d=doctors.find(x=>x.id===id);
  if(!d) return;
  if(!d.seguimientos) d.seguimientos=[];
  const hoy=new Date();
  const fecha=`${String(hoy.getDate()).padStart(2,"0")}/${String(hoy.getMonth()+1).padStart(2,"0")}/${hoy.getFullYear()}`;
  d.seguimientos.push({fecha,texto});
  saveState();
  openCrmModal(id);
  showToast("✓ Seguimiento agregado");
}
function delSeguimiento(id,idx){
  const d=doctors.find(x=>x.id===id);
  if(!d||!d.seguimientos) return;
  d.seguimientos.splice(idx,1);
  saveState();
  openCrmModal(id);
}

// ══════════════════════════════════════════════════════
// NAVIGATION
// ══════════════════════════════════════════════════════
function showPage(page) {
  document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
  document.querySelectorAll(".bottom-nav-tab").forEach(t=>t.classList.remove("active"));
  document.getElementById(`page-${page}`).classList.add("active");
  document.getElementById(`bnav-${page}`).classList.add("active");
  document.getElementById("fab").classList.toggle("hidden", page!=="doctors");
  if(page==="doctors") renderDoctorsList();
  if(page==="comisiones") applyFilters();
}

// ══════════════════════════════════════════════════════
// DOCTORS LIST & MODAL
// ══════════════════════════════════════════════════════
function renderDoctorsList() {
  const query=normName(document.getElementById("search-input")?.value||"");
  const filtered=doctors.filter(d=>normName(d.nombre).includes(query));
  document.getElementById("doctors-count-label").textContent=`${filtered.length} profesionales en lista`;
  if(!filtered.length){document.getElementById("doctors-grid").innerHTML=`<div style="grid-column:1/-1"><div class="empty-state"><div class="empty-title">Sin resultados</div></div></div>`;return;}
  document.getElementById("doctors-grid").innerHTML=filtered.map((doc,idx)=>{
    const allT=(doc.instituciones||[]).flatMap(i=>i.turnos||[]);
    const dias=[...new Set(allT.map(t=>t.dia))];
    const instCount=(doc.instituciones||[]).length;
    const isDemanda=doc.servicio.includes("DEMANDA");
    const diasCumple=diasHastaCumple(doc.cumple);
    return `<div class="doc-mgmt-card" style="animation-delay:${idx*40}ms">
      <div style="display:flex;align-items:flex-start;justify-content:space-between">
        <div class="doc-mgmt-avatar" onclick="openCrmModal('${doc.id}')" style="cursor:pointer">${initials(doc.nombre)}</div>
        <button class="btn-wsp mini" ${doc.telefono?"":"disabled"} onclick="openWhatsApp('${escAttr(doc.telefono||"")}')" title="WhatsApp">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        </button>
      </div>
      <div class="doc-mgmt-name" onclick="openCrmModal('${doc.id}')" style="cursor:pointer">${doc.nombre}</div>
      <span class="doc-mgmt-service${isDemanda?" demanda":""}">${doc.servicio==="OFTALMOLOGIA-JR"?"OFT-JR":"DEMANDA"}</span>
      <div class="doc-mgmt-days"><svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/></svg>${dias.length} día${dias.length!==1?"s":""}/sem · ${instCount} inst.</div>
      ${doc.cumple?`<div class="doc-mgmt-bday">🎂 ${fmtCumple(doc.cumple)}${diasCumple!==null&&diasCumple<=14?` <strong style="color:var(--oro-oscuro)">· ${diasCumple===0?"¡hoy!":"en "+diasCumple+"d"}</strong>`:""}</div>`:""}
      <div class="doc-mgmt-actions" style="margin-top:8px">
        <button class="btn-edit" onclick="openCrmModal('${doc.id}')">👤 Ficha</button>
        <button class="btn-edit" onclick="openDoctorModal('${doc.id}')">✏️</button>
        <button class="btn-del" onclick="deleteDoctor('${doc.id}')">🗑</button>
      </div>
    </div>`;
  }).join("");
}
function openDoctorModal(id) {
  const doc=id?doctors.find(d=>d.id===id):null;
  document.getElementById("modal-doctor-title").textContent=doc?"Editar oftalmólogo":"Nuevo oftalmólogo";
  document.getElementById("edit-doctor-id").value=id||"";
  document.getElementById("input-nombre").value=doc?doc.nombre:"";
  document.getElementById("input-servicio").value=doc?doc.servicio:"OFTALMOLOGIA-JR";
  document.getElementById("input-telefono").value=doc?(doc.telefono||""):"";
  document.getElementById("input-cumple").value=doc?(doc.cumple||""):"";
  const container=document.getElementById("instituciones-container");
  container.innerHTML="";
  const insts=doc?(doc.instituciones||[]):[];
  if(!insts.length) addInstitucionBlock(); else insts.forEach(i=>addInstitucionBlock(i));
  document.getElementById("modal-doctor").classList.add("open");
}
function addInstitucionBlock(inst=null) {
  const container=document.getElementById("instituciones-container");
  const div=document.createElement("div");
  div.className="inst-block";
  div.style.cssText="border:1.5px solid var(--arena);border-radius:12px;padding:12px;margin-bottom:12px;background:var(--alabaster);";
  div.innerHTML=`<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px"><div class="form-label" style="margin:0;font-size:.78rem;font-weight:700;color:var(--cobre)">INSTITUCIÓN</div><button onclick="this.closest('.inst-block').remove()" style="background:none;border:none;cursor:pointer;color:var(--arena);font-size:1rem;padding:2px 4px">✕</button></div><input class="form-input inst-nombre" type="text" placeholder="Nombre de la institución" value="${inst?inst.nombre:""}" style="margin-bottom:10px" /><div class="turnos-de-inst"></div><button onclick="addTurnoToInst(this)" style="font-size:.75rem;color:var(--cobre);background:none;border:1px dashed var(--arena);border-radius:8px;padding:6px 10px;cursor:pointer;width:100%;margin-top:4px">+ Agregar horario</button>`;
  container.appendChild(div);
  const tc=div.querySelector(".turnos-de-inst");
  const turnos=inst?(inst.turnos||[]):[];
  if(!turnos.length) addTurnoToContainer(tc); else turnos.forEach(t=>addTurnoToContainer(tc,t));
}
function addTurnoToInst(btn){addTurnoToContainer(btn.previousElementSibling);}
function addTurnoToContainer(container,t=null){
  const div=document.createElement("div");div.className="turno-editor";
  div.innerHTML=`<button class="btn-remove-turno" onclick="this.parentElement.remove()">✕</button><div class="turno-editor-row"><div><div class="form-label" style="font-size:.7rem">Día</div><select class="form-select" style="font-size:.8rem;padding:8px 10px" name="dia">${DIAS.filter(d=>d!=="Domingo").map(d=>`<option value="${d}"${t&&t.dia===d?" selected":""}>${d}</option>`).join("")}</select></div><div><div class="form-label" style="font-size:.7rem">Tipo</div><select class="form-select" style="font-size:.8rem;padding:8px 10px" name="tipo">${TIPOS.map(tp=>`<option value="${tp}"${t&&t.tipo===tp?" selected":""}>${tp}</option>`).join("")}</select></div></div><div class="turno-editor-row-3"><div><div class="form-label" style="font-size:.7rem">Desde</div><input class="form-input" style="font-size:.85rem;padding:8px 10px" type="time" name="desde" value="${t?t.desde:"08:00"}" /></div><div><div class="form-label" style="font-size:.7rem">Hasta</div><input class="form-input" style="font-size:.85rem;padding:8px 10px" type="time" name="hasta" value="${t?t.hasta:"12:00"}" /></div><div><div class="form-label" style="font-size:.7rem">Min/turno</div><input class="form-input" style="font-size:.85rem;padding:8px 10px" type="number" name="duracion" min="5" max="120" value="${t?t.duracion:15}" /></div></div>`;
  container.appendChild(div);
}
function saveDoctor(){
  const nombre=document.getElementById("input-nombre").value.trim();
  const servicio=document.getElementById("input-servicio").value;
  const telefono=document.getElementById("input-telefono").value.trim();
  const cumple=document.getElementById("input-cumple").value;
  if(!nombre){showToast("⚠️ Ingresá el nombre");return;}
  const instBlocks=document.querySelectorAll("#instituciones-container .inst-block");
  const instituciones=Array.from(instBlocks).map(b=>({nombre:b.querySelector(".inst-nombre").value.trim()||"Sin nombre",turnos:Array.from(b.querySelectorAll(".turno-editor")).map(el=>({dia:el.querySelector("[name=dia]").value,tipo:el.querySelector("[name=tipo]").value,desde:el.querySelector("[name=desde]").value,hasta:el.querySelector("[name=hasta]").value,duracion:parseInt(el.querySelector("[name=duracion]").value)||15}))})).filter(i=>i.turnos.length>0);
  const editId=document.getElementById("edit-doctor-id").value;
  if(editId){const idx=doctors.findIndex(d=>d.id===editId);if(idx!==-1)doctors[idx]={...doctors[idx],nombre,servicio,instituciones,telefono,cumple};}
  else{const id=nombre.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-").slice(0,30)+"-"+Date.now().toString(36);doctors.push({id,nombre,servicio,instituciones,telefono,cumple});}
  saveState();closeModal("modal-doctor");renderDoctorsList();renderSchedule();renderHero();renderBirthdays();
  showToast(editId?"Profesional actualizado ✓":"Profesional agregado ✓");
}
function deleteDoctor(id){
  const doc=doctors.find(d=>d.id===id);if(!doc)return;
  pendingDeleteId=id;
  document.getElementById("confirm-title").textContent="¿Eliminás este profesional?";
  document.getElementById("confirm-msg").textContent=`Se eliminará a ${doc.nombre} y todos sus turnos.`;
  document.getElementById("confirm-ok-btn").onclick=confirmDelete;
  document.getElementById("confirm-dialog").classList.add("open");
}
function confirmDelete(){doctors=doctors.filter(d=>d.id!==pendingDeleteId);saveState();closeConfirm();renderDoctorsList();renderSchedule();renderHero();showToast("Eliminado");}
function closeConfirm(){document.getElementById("confirm-dialog").classList.remove("open");pendingDeleteId=null;}

// ══════════════════════════════════════════════════════
// UPLOAD HORARIOS (XLSX)
// ══════════════════════════════════════════════════════
function openUploadModal(){document.getElementById("upload-preview").style.display="none";document.getElementById("file-input").value="";document.getElementById("modal-upload").classList.add("open");}
function handleFileDrop(e){e.preventDefault();document.getElementById("upload-dropzone").classList.remove("dragover");const f=e.dataTransfer.files[0];if(f)processXlsxFile(f);}
function handleFileInput(e){const f=e.target.files[0];if(f)processXlsxFile(f);}
function processXlsxFile(file){
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{defval:""});
      const grouped={};
      rows.forEach(r=>{
        const nombre=(r["Profesional"]||"").toString().trim();
        const servicio=(r["Servicio"]||"OFTALMOLOGIA-JR").toString().trim();
        const institucion=(r["Institución"]||r["Institucion"]||"Black Optica").toString().trim();
        if(!nombre)return;
        if(!grouped[nombre])grouped[nombre]={nombre,servicio,instituciones:{}};
        if(!grouped[nombre].instituciones[institucion])grouped[nombre].instituciones[institucion]=[];
        const dia=(r["Día"]||r["Dia"]||"").toString().trim();
        const tipo=(r["Tipo de Turno"]||"Indistinto").toString().trim();
        const desde=formatTime(r["Desde"]);const hasta=formatTime(r["Hasta"]);
        const duracion=parseInt(r["Duración (min)"]||r["Duracion (min)"]||15);
        if(dia)grouped[nombre].instituciones[institucion].push({dia,tipo,desde,hasta,duracion});
      });
      importedData=Object.values(grouped).map(d=>({id:d.nombre.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-").slice(0,30)+"-"+Date.now().toString(36),nombre:d.nombre,servicio:d.servicio,instituciones:Object.entries(d.instituciones).map(([nombre,turnos])=>({nombre,turnos}))}));
      document.getElementById("preview-content").innerHTML=importedData.map(d=>`<div>✓ <strong>${d.nombre}</strong> — ${d.instituciones.reduce((a,i)=>a+i.turnos.length,0)} horarios</div>`).join("");
      document.getElementById("preview-title").textContent=`${importedData.length} profesionales detectados`;
      document.getElementById("upload-preview").style.display="block";
      selectImportMode("add");
    }catch(err){showToast("Error al leer el archivo");}
  };
  reader.readAsArrayBuffer(file);
}
function formatTime(val){if(!val)return"00:00";if(typeof val==="string"&&val.includes(":"))return val.slice(0,5);if(typeof val==="number"){const t=Math.round(val*24*60);return`${String(Math.floor(t/60)%24).padStart(2,"0")}:${String(t%60).padStart(2,"0")}`;}return"00:00";}
function selectImportMode(mode){
  importMode=mode;
  const a=document.getElementById("opt-add"),r=document.getElementById("opt-replace");
  if(mode==="add"){a.style.borderColor="var(--dorado)";a.style.color="var(--cobre)";a.style.background="rgba(201,169,110,.08)";r.style.borderColor="var(--arena)";r.style.color="var(--roble)";r.style.background="#fff";}
  else{r.style.borderColor="var(--dorado)";r.style.color="var(--cobre)";r.style.background="rgba(201,169,110,.08)";a.style.borderColor="var(--arena)";a.style.color="var(--roble)";a.style.background="#fff";}
}
function confirmImport(){
  if(!importedData.length)return;
  if(importMode==="replace")doctors=importedData;
  else importedData.forEach(nd=>{const i=doctors.findIndex(d=>normName(d.nombre)===normName(nd.nombre));if(i!==-1)doctors[i]=nd;else doctors.push(nd);});
  saveState();closeModal("modal-upload");renderDoctorsList();renderSchedule();renderHero();
  showToast(`${importedData.length} profesionales importados ✓`);importedData=[];
}

// ══════════════════════════════════════════════════════
// EXCEL COMISIONES IMPORT
// ══════════════════════════════════════════════════════
function openCsvModal(){
  document.getElementById("csv-preview").style.display="none";
  document.getElementById("csv-input").value="";
  document.getElementById("modal-csv").classList.add("open");
}
function handleCsvDrop(e){
  e.preventDefault();
  document.getElementById("csv-dropzone").classList.remove("dragover");
  const f=e.dataTransfer.files[0];
  if(f) processExcelFile(f);
}
function handleCsvInput(e){
  const f=e.target.files[0];
  if(f) processExcelFile(f);
}

function processExcelFile(file){
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const wb=XLSX.read(e.target.result,{type:"array"});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(ws,{header:1,defval:""});
      if(!rows.length){showToast("⚠️ El archivo está vacío");return;}

      let headerIdx=rows.findIndex(r=>r.some(c=>String(c).includes("Fecha")&&String(c).length<20));
      if(headerIdx===-1) headerIdx=0;
      const headers=rows[headerIdx].map(h=>String(h).trim());

      const fechaCol  =headers.findIndex(h=>h.toLowerCase().includes("fecha"));
      const clienteCol=headers.findIndex(h=>h.toLowerCase().includes("cliente"));
      const medicoCol =headers.findIndex(h=>h.toLowerCase().includes("medico")||h.toLowerCase().includes("médico"));
      const montoCol  =headers.findIndex(h=>h.toLowerCase().includes("total receta"));

      parsedCsvData=[];
      const newDoctors=new Set();

      rows.slice(headerIdx+1).forEach(row=>{
        if(!row||!row.length) return;
        const fechaRaw = row[fechaCol];
        // MEJORA: soporta fecha como serial de Excel, texto DD/MM/YYYY o Date
        const fecha = fechaToStr(fechaRaw);
        const cliente =String(row[clienteCol]||"").trim();
        const medico  =String(row[medicoCol]||"").trim();
        const montoRaw=row[montoCol];

        if(!medico||medico===""||medico.toUpperCase().includes("MINISTERIO")||medico.toUpperCase().includes("CONSUMIDOR")) return;
        if(!fecha) return;

        const monto=typeof montoRaw==="number"?montoRaw:parseFloat(String(montoRaw).replace(/[$,]/g,""))||0;
        if(monto<=0) return;

        const paciente=cliente.split(",")[0].trim();

        parsedCsvData.push({fecha,paciente,medico,monto,institucion:""});

        const exists=doctors.some(d=>normName(d.nombre)===normName(medico));
        if(!exists) newDoctors.add(medico);
      });

      if(!parsedCsvData.length){showToast("⚠️ No se encontraron recetas con médico asignado");return;}

      // MEJORA: detectar duplicados contra lo ya cargado
      const existentes=new Set(recetas.map(firmaReceta));
      const dupCount=parsedCsvData.filter(r=>existentes.has(firmaReceta(r))).length;

      const byDoc={};
      parsedCsvData.forEach(r=>{
        if(!byDoc[r.medico]) byDoc[r.medico]={count:0,total:0};
        byDoc[r.medico].count++;byDoc[r.medico].total+=r.monto;
      });

      const totalDocs=Object.keys(byDoc).length;
      const newCount=newDoctors.size;
      let titulo=parsedCsvData.length+" recetas de "+totalDocs+" médico"+(totalDocs!==1?"s":"")+(newCount>0?" ("+newCount+" nuevo"+(newCount>1?"s":"")+")":"");
      if(dupCount>0) titulo+=` · ⚠️ ${dupCount} ya cargadas`;
      document.getElementById("csv-preview-title").textContent=titulo;
      document.getElementById("csv-preview-content").innerHTML=
        Object.entries(byDoc).sort((a,b)=>b[1].total-a[1].total)
        .map(([med,d])=>"<div>"+(newDoctors.has(med)?"🆕 ":"✓ ")+"<strong>"+med+"</strong> — "+d.count+" receta"+(d.count>1?"s":"")+" · $"+formatNum(d.total)+"</div>")
        .join("");
      document.getElementById("csv-preview").style.display="block";
      selectCsvMode("replace");
    }catch(err){console.error(err);showToast("Error al leer el archivo: "+err.message);}
  };
  reader.readAsArrayBuffer(file);
}

// MEJORA: normaliza cualquier formato de fecha a "DD/MM/YYYY"
function fechaToStr(raw){
  if(raw===null||raw===undefined||raw==="") return "";
  if(raw instanceof Date && !isNaN(raw)) return `${String(raw.getDate()).padStart(2,"0")}/${String(raw.getMonth()+1).padStart(2,"0")}/${raw.getFullYear()}`;
  if(typeof raw==="number"){
    // Serial de Excel → Date (epoch 1899-12-30)
    const d=new Date(Math.round((raw-25569)*86400*1000));
    if(isNaN(d)) return "";
    return `${String(d.getUTCDate()).padStart(2,"0")}/${String(d.getUTCMonth()+1).padStart(2,"0")}/${d.getUTCFullYear()}`;
  }
  return String(raw).trim();
}

function selectCsvMode(mode){
  csvImportMode=mode;
  const a=document.getElementById("csv-opt-add"),r=document.getElementById("csv-opt-replace");
  if(mode==="add"){a.style.borderColor="var(--dorado)";a.style.color="var(--cobre)";a.style.background="rgba(201,169,110,.08)";r.style.borderColor="var(--arena)";r.style.color="var(--roble)";r.style.background="#fff";}
  else{r.style.borderColor="var(--dorado)";r.style.color="var(--cobre)";r.style.background="rgba(201,169,110,.08)";a.style.borderColor="var(--arena)";a.style.color="var(--roble)";a.style.background="#fff";}
}

function confirmCsvImport(){
  if(!parsedCsvData.length)return;
  // Auto-crear médicos nuevos
  const existing=new Set(doctors.map(d=>normName(d.nombre)));
  parsedCsvData.forEach(r=>{
    if(!r.medico)return;
    const match=doctors.find(d=>normName(d.nombre)===normName(r.medico)||normName(d.nombre).startsWith(normName(r.medico.split(",")[0])+","));
    if(!match&&!existing.has(normName(r.medico))){
      existing.add(normName(r.medico));
      doctors.push({id:r.medico.toLowerCase().replace(/[^a-z0-9]/g,"-").replace(/-+/g,"-").slice(0,30)+"-"+Date.now().toString(36),nombre:r.medico,servicio:"OFTALMOLOGIA-JR",instituciones:[{nombre:"Black Optica",turnos:[]}]});
    }
  });
  let omitidas=0;
  if(csvImportMode==="replace"){
    recetas=parsedCsvData;
  } else {
    // MEJORA: no duplicar recetas ya cargadas
    const existentes=new Set(recetas.map(firmaReceta));
    const nuevas=parsedCsvData.filter(r=>{
      if(existentes.has(firmaReceta(r))){omitidas++;return false;}
      existentes.add(firmaReceta(r));
      return true;
    });
    recetas=[...recetas,...nuevas];
  }
  saveState();closeModal("modal-csv");applyFilters();
  const importadas=parsedCsvData.length-omitidas;
  showToast(`${importadas} recetas importadas ✓${omitidas>0?` (${omitidas} duplicadas omitidas)`:""}`);
  parsedCsvData=[];
}


// ══════════════════════════════════════════════════════
// FACTURACIÓN ADICIONAL (cobertura obra social, etc.)
// Se guarda dentro de recetas con flag extra:true
// ══════════════════════════════════════════════════════
function openExtraModal(medicoPre){
  const sel=document.getElementById("extra-medico");
  const nombres=[...new Set([...doctors.map(d=>d.nombre),...recetas.map(r=>r.medico)])].sort();
  sel.innerHTML=nombres.map(n=>`<option value="${escAttr(n)}"${medicoPre&&normName(n)===normName(medicoPre)?" selected":""}>${escHtml(n)}</option>`).join("");
  const hoy=new Date();
  document.getElementById("extra-fecha").value=`${hoy.getFullYear()}-${String(hoy.getMonth()+1).padStart(2,"0")}-${String(hoy.getDate()).padStart(2,"0")}`;
  document.getElementById("extra-monto").value="";
  document.getElementById("extra-desc").value="";
  document.getElementById("modal-extra").classList.add("open");
}
function saveExtra(){
  const medico=document.getElementById("extra-medico").value;
  const fechaIso=document.getElementById("extra-fecha").value;
  const monto=parseFloat(document.getElementById("extra-monto").value);
  const desc=document.getElementById("extra-desc").value.trim();
  if(!medico){showToast("⚠️ Elegí un médico");return;}
  if(!fechaIso){showToast("⚠️ Ingresá la fecha");return;}
  if(!monto||monto<=0){showToast("⚠️ Ingresá un monto válido");return;}

  const p=fechaIso.split("-");
  const fecha=`${p[2]}/${p[1]}/${p[0]}`;
  recetas.push({fecha,paciente:desc||"Monto adicional",medico,monto,institucion:"",extra:true,xid:Date.now().toString(36)+Math.random().toString(36).slice(2,6)});
  saveState();
  closeModal("modal-extra");
  applyFilters();
  showToast(`✓ $${formatNum(monto)} agregados a ${medico.split(",")[0]}`);
}
function delExtra(xid){
  recetas=recetas.filter(r=>r.xid!==xid);
  saveState();
  applyFilters();
  showToast("Facturación eliminada");
}

// ══════════════════════════════════════════════════════
// COMISIONES DASHBOARD
// ══════════════════════════════════════════════════════
function parseDate(str){
  if(str===null||str===undefined||str==="") return null;
  // MEJORA: soporta serial de Excel por si quedó guardado como número
  if(typeof str==="number"){
    const d=new Date(Math.round((str-25569)*86400*1000));
    return isNaN(d)?null:d;
  }
  const s = String(str).trim();
  const parts = s.split("/");
  if(parts.length===3){
    const d=new Date(parseInt(parts[2]), parseInt(parts[1])-1, parseInt(parts[0]));
    return isNaN(d)?null:d;
  }
  const d=new Date(s);
  return isNaN(d)?null:d;
}
function fmtFecha(str){
  const d=parseDate(str);
  if(!d) return String(str);
  return `${String(d.getDate()).padStart(2,"0")}/${String(d.getMonth()+1).padStart(2,"0")}`;
}

function filterRecetas(desde,hasta,inst){
  return recetas.filter(r=>{
    if(inst&&r.institucion&&r.institucion!==inst)return false;
    if(desde||hasta){
      const d=parseDate(r.fecha);
      if(!d)return true;
      if(desde&&d<new Date(desde+"T00:00:00"))return false;
      if(hasta&&d>new Date(hasta+"T23:59:59"))return false;
    }
    return true;
  });
}

function applyFilters(){
  const desde=document.getElementById("periodo-desde").value;
  const hasta=document.getElementById("periodo-hasta").value;
  const inst=document.getElementById("filter-institucion").value;
  renderDashboard(filterRecetas(desde,hasta,inst), desde, hasta, inst);
}

function getPagoKey(medico, desde, hasta){ return `${normName(medico)}|${desde}|${hasta}`; }

function comisionDe(d){ return d.monto*getComision(d.medico)/100; }
function renderDashboard(data, desde, hasta, inst){
  const totalFact=data.reduce((a,r)=>a+r.monto,0);
  const byDoc={};
  data.forEach(r=>{
    if(!byDoc[r.medico])byDoc[r.medico]={medico:r.medico,monto:0,extras:0,count:0,pacientes:[],recetas:[]};
    byDoc[r.medico].monto+=r.monto;byDoc[r.medico].count++;
    if(r.extra)byDoc[r.medico].extras+=r.monto;
    byDoc[r.medico].pacientes.push(r.paciente);
    byDoc[r.medico].recetas.push(r);
  });
  const docList=Object.values(byDoc).sort((a,b)=>b.monto-a.monto);
  lastDocList=docList;
  const totalCom=docList.reduce((a,d)=>a+comisionDe(d),0);
  document.getElementById("kpi-facturacion").textContent=`$${formatNum(totalFact)}`;
  document.getElementById("kpi-comisiones").textContent=`$${formatNum(totalCom)}`;
  document.getElementById("kpi-pacientes").textContent=data.filter(r=>!r.extra).length;
  document.getElementById("kpi-medicos").textContent=docList.length;

  // MEJORA: comparativa vs período anterior de igual duración
  renderTrend(totalFact, desde, hasta, inst);

  // MEJORA: comisiones pendientes de pago
  const pendiente=docList.reduce((a,d)=>{
    if(pagos[getPagoKey(d.medico,desde,hasta)]) return a;
    return a+comisionDe(d);
  },0);
  const kpiPend=document.getElementById("kpi-pendiente");
  if(docList.length&&pendiente>0){
    kpiPend.textContent=`$${formatNum(pendiente)} sin pagar`;
    kpiPend.className="stat-card-trend down";
  } else if(docList.length){
    kpiPend.textContent="Todo pagado ✓";
    kpiPend.className="stat-card-trend up";
  } else { kpiPend.textContent=""; }

  renderBarChart(docList);
  renderCommissionCards(docList, desde, hasta);
  renderEvolution(data);
}

function renderTrend(totalActual, desde, hasta, inst){
  const el=document.getElementById("kpi-trend");
  el.textContent="";
  if(!desde||!hasta||totalActual<=0) return;
  const d1=new Date(desde+"T00:00:00"), d2=new Date(hasta+"T00:00:00");
  const durMs=d2-d1+86400000;
  const prevHasta=new Date(d1.getTime()-86400000);
  const prevDesde=new Date(prevHasta.getTime()-durMs+86400000);
  const iso=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  const prevData=filterRecetas(iso(prevDesde),iso(prevHasta),inst);
  const totalPrev=prevData.reduce((a,r)=>a+r.monto,0);
  if(totalPrev<=0) return;
  const pct=((totalActual-totalPrev)/totalPrev)*100;
  el.textContent=`${pct>=0?"▲":"▼"} ${Math.abs(pct).toFixed(0)}% vs período anterior`;
  el.className=`stat-card-trend ${pct>=0?"up":"down"}`;
}

function setChartMode(mode,btn){
  chartMode=mode;
  document.querySelectorAll(".chart-tab").forEach(t=>t.classList.remove("active"));
  btn.classList.add("active");
  applyFilters();
}

function renderBarChart(docList){
  if(!docList.length){document.getElementById("bar-chart").innerHTML='<div style="text-align:center;color:var(--roble);font-size:.82rem;padding:20px">Sin datos. Importá un Excel para ver el ranking.</div>';return;}
  const sorted=[...docList].sort((a,b)=>{
    if(chartMode==="comision")return comisionDe(b)-comisionDe(a);
    if(chartMode==="pacientes")return b.count-a.count;
    return b.monto-a.monto;
  });
  const max=sorted[0]?( chartMode==="comision"?comisionDe(sorted[0]): chartMode==="pacientes"?sorted[0].count:sorted[0].monto ):1;
  document.getElementById("bar-chart").innerHTML=sorted.map((d,i)=>{
    const val=chartMode==="comision"?comisionDe(d):chartMode==="pacientes"?d.count:d.monto;
    const pct=max>0?Math.max(5,val/max*100):5;
    const label=chartMode==="pacientes"?d.count+" pac":"$"+formatNum(val,true);
    const cls=i===0?" highlight":i===sorted.length-1?" lowlight":"";
    const shortName=d.medico.split(",")[0];
    return `<div class="bar-row${cls}"><div class="bar-label">${shortName}</div><div class="bar-track"><div class="bar-fill" style="width:${pct}%"><span class="bar-val">${label}</span></div></div></div>`;
  }).join("");
}

function renderCommissionCards(docList, desde, hasta){
  if(!docList.length){document.getElementById("commission-list").innerHTML='<div class="empty-state"><div class="empty-title">Sin datos de recetas</div><div class="empty-sub">Importá un Excel para ver las comisiones.</div></div>';return;}
  document.getElementById("commission-list").innerHTML=docList.map((d,idx)=>{
    const pct=getComision(d.medico);
    const com=comisionDe(d);
    const pacUniq=[...new Set(d.pacientes)];
    const pagado=!!pagos[getPagoKey(d.medico,desde,hasta)];
    const recetasHtml=d.recetas
      .slice().sort((a,b)=>(parseDate(a.fecha)||0)-(parseDate(b.fecha)||0))
      .map(r=>r.extra
        ?`<div class="detalle-row extra"><span class="detalle-fecha">${fmtFecha(r.fecha)}</span><span class="extra-tag">＋</span><span class="detalle-pac">${escHtml(r.paciente)}</span><span class="detalle-monto">$${formatNum(r.monto)}</span><button class="extra-del" onclick="delExtra('${r.xid}')" title="Eliminar">✕</button></div>`
        :`<div class="detalle-row"><span class="detalle-fecha">${fmtFecha(r.fecha)}</span><span class="detalle-pac">${escHtml(r.paciente)}</span><span class="detalle-monto">$${formatNum(r.monto)}</span></div>`).join("");
    const nExtras=d.recetas.filter(r=>r.extra).length;
    const nRec=d.count-nExtras;
    return `<div class="commission-card${pagado?" pagado":""}" style="animation-delay:${idx*40}ms" id="ccard-${idx}">
      <div style="display:flex;align-items:center;gap:12px">
        <div class="commission-avatar">${initials(d.medico)}</div>
        <div style="flex:1;min-width:0">
          <div class="commission-name">${escHtml(d.medico)}</div>
          <div style="font-size:.72rem;color:var(--roble);margin-top:2px">${nRec} receta${nRec!==1?"s":""}${nExtras>0?` · ${nExtras} monto${nExtras!==1?"s":""} agregado${nExtras!==1?"s":""}`:""} · fact. $${formatNum(d.monto)}</div>
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-family:var(--font-display);font-size:1.35rem;color:${pagado?"#2c9e61":"var(--oro-oscuro)"}">$${formatNum(com,true)}</div>
          <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;margin-top:4px">
            <span style="font-size:.68rem;color:var(--roble);font-weight:500">Comisión</span>
            <input class="commission-pct-input" type="number" min="0" max="100" value="${pct}" onchange="updateComision('${escAttr(d.medico)}',this.value,this)" title="Comisión %" />
            <span style="font-size:.68rem;color:var(--roble)">%</span>
          </div>
        </div>
        <div class="check-wrap${pagado?" on":""}">
          <button class="check-toggle${pagado?" on":""}" onclick="togglePago('${escAttr(d.medico)}')" title="${pagado?"Pagado — tocá para desmarcar":"Marcar como pagado"}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          </button>
          <span class="check-label">${pagado?"Pagado":"Pendiente"}</span>
        </div>
      </div>
      <div class="commission-footer">
        <button class="btn-detalle" onclick="toggleDetalle(${idx})">📋 Detalle</button>
        <button class="btn-extra" onclick="openExtraModal('${escAttr(d.medico)}')">+ Monto</button>
      </div>
      <div class="detalle-recetas" id="detalle-${idx}">${recetasHtml}</div>
    </div>`;
  }).join("");
}

function escHtml(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}
function escAttr(s){return String(s||"").replace(/'/g,"\\'").replace(/"/g,"&quot;");}

function toggleDetalle(idx){
  document.getElementById(`detalle-${idx}`).classList.toggle("open");
}
function togglePago(medico){
  const desde=document.getElementById("periodo-desde").value;
  const hasta=document.getElementById("periodo-hasta").value;
  const key=getPagoKey(medico,desde,hasta);
  const nuevoEstado=!pagos[key];
  if(nuevoEstado) pagos[key]=true; else delete pagos[key];
  saveState();
  applyFilters();
  showToast(nuevoEstado?`✓ ${medico.split(",")[0]} marcado como pagado`:`${medico.split(",")[0]} pendiente de pago`);
}

function updateComision(medico, val, input){
  const pct=Math.max(0,Math.min(100,parseFloat(val)||0));
  input.value=pct;
  setComision(medico,pct);
  applyFilters();
  showToast(`Comisión actualizada: ${pct}%`);
}

function renderEvolution(data){
  if(!data.length){document.getElementById("evol-section").style.display="none";return;}
  const byMonth={};
  data.forEach(r=>{
    const d=parseDate(r.fecha);
    if(!d)return;
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    if(!byMonth[key])byMonth[key]=0;
    byMonth[key]+=r.monto;
  });
  const keys=Object.keys(byMonth).sort();
  if(keys.length<2){document.getElementById("evol-section").style.display="none";return;}
  document.getElementById("evol-section").style.display="block";
  drawLineChart(keys,keys.map(k=>byMonth[k]));
}

function drawLineChart(labels, values){
  const canvas=document.getElementById("evol-canvas");
  const w=canvas.parentElement.clientWidth||300;
  canvas.width=w*2;canvas.height=320;
  canvas.style.width=w+"px";canvas.style.height="160px";
  const ctx=canvas.getContext("2d");
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const pad={t:20,r:20,b:50,l:60};
  const cw=canvas.width-pad.l-pad.r,ch=canvas.height-pad.t-pad.b;
  const maxV=Math.max(...values)*1.1||1;
  ctx.strokeStyle="rgba(212,197,169,.4)";ctx.lineWidth=1;
  for(let i=0;i<=4;i++){
    const y=pad.t+ch-(ch*i/4);
    ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+cw,y);ctx.stroke();
    ctx.fillStyle="rgba(139,111,71,.8)";ctx.font="19px Jost,sans-serif";ctx.textAlign="right";
    ctx.fillText("$"+formatNum(maxV*i/4),pad.l-8,y+6);
  }
  const xStep=labels.length>1?cw/(labels.length-1):cw;
  const pts=values.map((v,i)=>({x:pad.l+i*xStep,y:pad.t+ch-(ch*v/maxV)}));
  const grad=ctx.createLinearGradient(0,pad.t,0,pad.t+ch);
  grad.addColorStop(0,"rgba(201,169,110,.3)");grad.addColorStop(1,"rgba(201,169,110,0)");
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.lineTo(pts[pts.length-1].x,pad.t+ch);ctx.lineTo(pts[0].x,pad.t+ch);ctx.closePath();
  ctx.fillStyle=grad;ctx.fill();
  ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);pts.slice(1).forEach(p=>ctx.lineTo(p.x,p.y));
  ctx.strokeStyle="#C9A96E";ctx.lineWidth=4;ctx.lineJoin="round";ctx.stroke();
  pts.forEach(p=>{ctx.beginPath();ctx.arc(p.x,p.y,8,0,Math.PI*2);ctx.fillStyle="#fff";ctx.fill();ctx.strokeStyle="#C9A96E";ctx.lineWidth=4;ctx.stroke();});
  ctx.fillStyle="rgba(139,111,71,.8)";ctx.font="19px Jost,sans-serif";ctx.textAlign="center";
  labels.forEach((l,i)=>{const x=pad.l+i*xStep;ctx.fillText(l,x,pad.t+ch+36);});
}

function formatNum(n, decimals=false){
  if(decimals){
    return n.toLocaleString("es-AR", {minimumFractionDigits:2, maximumFractionDigits:2});
  }
  if(n>=1000000) return (n/1000000).toFixed(1)+"M";
  return Math.round(n).toLocaleString("es-AR");
}

// ══════════════════════════════════════════════════════
// PDF LIQUIDACIONES (una página por médico)
// ══════════════════════════════════════════════════════
function generatePdf(){
  if(!window.jspdf){showToast("⚠️ jsPDF no cargó. Recargá la página.");return;}
  const desde=document.getElementById("periodo-desde").value;
  const hasta=document.getElementById("periodo-hasta").value;
  if(!lastDocList.length){showToast("⚠️ Sin datos. Importá el Excel primero");return;}
  showToast("Generando PDF...");
  const {jsPDF}=window.jspdf;
  const pdf=new jsPDF({unit:"mm",format:"a4"});
  const pw=210, margin=18;
  const periodoTxt=(desde&&hasta)?`Período: ${desde.split("-").reverse().join("/")} al ${hasta.split("-").reverse().join("/")}`:"";

  lastDocList.forEach((d,i)=>{
    if(i>0) pdf.addPage();
    const pct=getComision(d.medico);
    const com=comisionDe(d);
    let y=margin;

    // Header banda negra
    pdf.setFillColor(26,20,16);
    pdf.rect(0,0,pw,30,"F");
    pdf.setTextColor(201,169,110);
    pdf.setFont("helvetica","bold");pdf.setFontSize(16);
    pdf.text("BLACK ÓPTICA",margin,13);
    pdf.setTextColor(255,255,255);
    pdf.setFont("helvetica","normal");pdf.setFontSize(9);
    pdf.text("Liquidación de comisiones",margin,20);
    if(periodoTxt){pdf.text(periodoTxt,pw-margin,20,{align:"right"});}

    y=42;
    pdf.setTextColor(26,20,16);
    pdf.setFont("helvetica","bold");pdf.setFontSize(14);
    pdf.text(d.medico.toUpperCase(),margin,y);
    y+=8;
    pdf.setDrawColor(201,169,110);pdf.setLineWidth(.6);
    pdf.line(margin,y,pw-margin,y);
    y+=8;

    // Resumen
    pdf.setFontSize(10);pdf.setFont("helvetica","normal");
    const nExtrasP=d.recetas.filter(r=>r.extra).length;
    const montoExtrasP=d.recetas.filter(r=>r.extra).reduce((a,r)=>a+r.monto,0);
    let resumen=`Recetas: ${d.count-nExtrasP}   ·   Facturación: $${formatNum(d.monto,true)}   ·   Comisión: ${pct}%`;
    if(nExtrasP>0) resumen=`Recetas: ${d.count-nExtrasP}   ·   Montos agregados: $${formatNum(montoExtrasP,true)}   ·   Facturación total: $${formatNum(d.monto,true)}   ·   Comisión: ${pct}%`;
    pdf.text(resumen,margin,y);
    y+=6;
    pdf.setFont("helvetica","bold");pdf.setFontSize(12);
    pdf.setTextColor(122,92,58);
    pdf.text(`Total a liquidar: $${formatNum(com,true)}`,margin,y);
    pdf.setTextColor(26,20,16);
    y+=10;

    // Tabla de recetas
    pdf.setFont("helvetica","bold");pdf.setFontSize(9);
    pdf.text("Fecha",margin,y);
    pdf.text("Paciente",margin+28,y);
    pdf.text("Monto",pw-margin,y,{align:"right"});
    y+=2;
    pdf.setDrawColor(212,197,169);pdf.setLineWidth(.3);
    pdf.line(margin,y,pw-margin,y);
    y+=5;
    pdf.setFont("helvetica","normal");

    const recs=d.recetas.slice().sort((a,b)=>(parseDate(a.fecha)||0)-(parseDate(b.fecha)||0));
    recs.forEach(r=>{
      if(y>275){pdf.addPage();y=margin;}
      pdf.text(fmtFecha(r.fecha),margin,y);
      if(r.extra){pdf.setFont("helvetica","bolditalic");pdf.setTextColor(122,92,58);}
      pdf.text(String(r.paciente).slice(0,52),margin+28,y);
      pdf.text("$"+formatNum(r.monto,true),pw-margin,y,{align:"right"});
      if(r.extra){pdf.setFont("helvetica","normal");pdf.setTextColor(26,20,16);}
      y+=5.5;
    });

    // Firma
    if(y>255){pdf.addPage();y=margin+10;} else {y=Math.max(y+20,255);}
    pdf.setDrawColor(26,20,16);pdf.setLineWidth(.3);
    pdf.line(margin,y,margin+60,y);
    pdf.setFontSize(8);
    pdf.text("Firma y aclaración",margin,y+5);
  });

  const nombre=`Liquidaciones_${desde||""}_${hasta||""}.pdf`.replace(/--/g,"-");
  pdf.save(nombre);
  showToast("✓ PDF descargado");
}

// ══════════════════════════════════════════════════════
// WORD GENERATOR
// ══════════════════════════════════════════════════════
function openWordModal(){
  const desde=document.getElementById("periodo-desde").value;
  const hasta=document.getElementById("periodo-hasta").value;
  const inst=document.getElementById("filter-institucion").value;
  const medicos=[...new Set(filterRecetas(desde,hasta,inst).filter(r=>!r.extra).map(r=>r.medico))].sort();
  document.getElementById("word-medico-filter").innerHTML='<option value="">Todos los médicos</option>'+medicos.map(m=>`<option value="${escAttr(m)}">${escHtml(m)}</option>`).join("");
  if(desde&&hasta){
    const d=new Date(desde+"T00:00:00"),h=new Date(hasta+"T00:00:00");
    const meses=["ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO","JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE"];
    document.getElementById("word-periodo-texto").value=`${d.getDate()} al ${h.getDate()} de ${meses[h.getMonth()]}`;
  }
  document.getElementById("modal-word").classList.add("open");
}
function selectWordOpt(opt){
  wordOpt=opt;
  document.getElementById("word-opt-todos").classList.toggle("selected",opt==="todos");
  document.getElementById("word-opt-individual").classList.toggle("selected",opt==="individual");
}

function generateWord(){
  const periodo=document.getElementById("word-periodo-texto").value.trim()||"";
  const instFilter=document.getElementById("word-inst-filter").value;
  const medicoFilter=document.getElementById("word-medico-filter").value;
  const desde=document.getElementById("periodo-desde").value;
  const hasta=document.getElementById("periodo-hasta").value;
  const filtered=filterRecetas(desde,hasta,instFilter);
  const byDoc={};
  filtered.forEach(r=>{
    if(r.extra)return; // los montos agregados no van en la lista de pacientes
    if(medicoFilter&&normName(r.medico)!==normName(medicoFilter))return;
    if(!byDoc[r.medico])byDoc[r.medico]=[];
    byDoc[r.medico].push(r.paciente);
  });
  if(!Object.keys(byDoc).length){showToast(medicoFilter?"⚠️ Sin pacientes de ese médico en el período":"⚠️ Sin datos para generar. Importá el Excel primero");return;}
  closeModal("modal-word");
  if(medicoFilter){
    const filename=medicoFilter.replace(/[^a-zA-Z0-9]/g,"_")+(periodo?"_"+periodo.replace(/\s/g,"_"):"")+".docx";
    generateWordDoc(byDoc,periodo,filename);
  } else if(wordOpt==="todos"){
    generateWordDoc(byDoc,periodo,"Comisiones_"+(periodo.replace(/\s/g,"_")||"doc")+".docx");
  } else {
    generateAllWordDocs(byDoc,periodo);
  }
}

function buildDocxXml(byDoc,periodo){
  let bodyContent="";
  const doctors_sorted=Object.keys(byDoc).sort();
  doctors_sorted.forEach((medico,idx)=>{
    const pacientes=[...new Set(byDoc[medico])].sort();
    bodyContent+=`<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:before="0" w:after="120"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="44"/><w:szCs w:val="44"/></w:rPr><w:t>${xmlEsc(medico.toUpperCase())}</w:t></w:r></w:p>`;
    bodyContent+=`<w:p><w:pPr><w:spacing w:before="120" w:after="60"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="28"/><w:szCs w:val="28"/></w:rPr><w:t>PACIENTE:</w:t></w:r></w:p>`;
    pacientes.forEach(p=>{
      bodyContent+=`<w:p><w:pPr><w:ind w:left="360"/><w:spacing w:before="0" w:after="40"/></w:pPr><w:r><w:rPr><w:b/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>-${xmlEsc(p)}</w:t></w:r></w:p>`;
    });
    if(periodo){
      bodyContent+=`<w:p><w:pPr><w:spacing w:before="120" w:after="0"/></w:pPr><w:r><w:rPr><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t xml:space="preserve">Período: ${xmlEsc(periodo)}</w:t></w:r></w:p>`;
    }
    if(idx<doctors_sorted.length-1){
      bodyContent+=`<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
    }
  });
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" mc:Ignorable="w14">
  <w:body>${bodyContent}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1500" w:bottom="1440" w:left="1500"/></w:sectPr></w:body>
</w:document>`;
}

// MEJORA: styles.xml + fontTable para que el .docx abra bien en Word mobile y Google Docs
const DOCX_STYLES=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:lang w:val="es-AR"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>
</w:styles>`;

function xmlEsc(s){return(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");}

function buildDocxZip(docXml){
  const zip=new JSZip();
  zip.file("word/document.xml",docXml);
  zip.file("word/styles.xml",DOCX_STYLES);
  zip.file("[Content_Types].xml",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`);
  zip.file("_rels/.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/_rels/document.xml.rels",`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`);
  return zip;
}

function downloadBlob(blob, filename){
  const a=document.createElement("a");
  a.href=URL.createObjectURL(blob);
  a.download=filename;
  a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href),5000); // MEJORA: liberar memoria
}

async function generateWordDoc(byDoc,periodo,filename){
  if(typeof JSZip==="undefined"){showToast("⚠️ Error: JSZip no cargó. Recargá la página.");return;}
  showToast("Generando documento...");
  const zip=buildDocxZip(buildDocxXml(byDoc,periodo));
  const blob=await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
  downloadBlob(blob,filename);
  showToast("✓ Documento descargado");
}

async function generateAllWordDocs(byDoc,periodo){
  if(typeof JSZip==="undefined"){showToast("⚠️ Error: JSZip no cargó. Recargá la página.");return;}
  showToast("Generando archivos...");
  const mainZip=new JSZip();
  for(const medico of Object.keys(byDoc)){
    const zip=buildDocxZip(buildDocxXml({[medico]:byDoc[medico]},periodo));
    const docBlob=await zip.generateAsync({type:"blob",mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
    mainZip.file(`${medico.replace(/[^a-zA-Z0-9]/g,"_")}.docx`,docBlob);
  }
  const zipBlob=await mainZip.generateAsync({type:"blob"});
  downloadBlob(zipBlob,`Comisiones_${periodo.replace(/\s/g,"_")}.zip`);
  showToast("✓ ZIP descargado");
}

// ══════════════════════════════════════════════════════
// MODAL HELPERS
// ══════════════════════════════════════════════════════
function closeModal(id){document.getElementById(id).classList.remove("open");}
document.querySelectorAll(".modal-overlay").forEach(el=>el.addEventListener("click",e=>{if(e.target===el)el.classList.remove("open");}));

// ══════════════════════════════════════════════════════
// TOAST
// ══════════════════════════════════════════════════════
let toastTimer;
function showToast(msg){const t=document.getElementById("toast");t.textContent=msg;t.classList.add("show");clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.remove("show"),2500);}

// ══════════════════════════════════════════════════════
// PWA
// ══════════════════════════════════════════════════════
const manifestData={name:"Black Óptica — CRM Oftalmólogos",short_name:"Black Optica",start_url:"./crm-oftalmologos.html",display:"standalone",background_color:"#1A1410",theme_color:"#C9A96E",icons:[{src:"data:image/png;base64,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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAJii/xNgAFlWiQFB4PqZAAAAAElFTkSuQmCC",sizes:"512x512",type:"image/png"}]};
const blob=new Blob([JSON.stringify(manifestData)],{type:"application/json"});
document.getElementById("manifest-link").href=URL.createObjectURL(blob);

// ══════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════


(async function bootCrmOftalmologos(){
  const session = await ensurePortalSession();
  if(!session) return;
  adaptEmbeddedPortal();
  checkOnboarding();
})();
