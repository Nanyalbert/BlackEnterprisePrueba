// Persistencia por período para Administración (IndexedDB)
(() => {
  const DB_NAME = 'blackos_administracion';
  const STORE = 'periodos';
  const DB_VERSION = 1;
  const KINDS = ['sales','cash','bank'];
  let currentPeriod = '';

  const style = document.createElement('style');
  style.textContent = `
    .period-manager{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;background:#0d0d0d;border:1px solid #232323;border-radius:16px;padding:14px 16px;margin:4px 0 14px}
    .period-manager-left{display:flex;align-items:center;gap:12px;flex-wrap:wrap}.period-manager-label{font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#666;font-weight:600}.period-select{appearance:none;background:#151515;border:1px solid #2b2b2b;color:#f5f5f3;border-radius:10px;padding:9px 34px 9px 12px;font:inherit;font-size:12px;min-width:170px;cursor:pointer;background-image:linear-gradient(45deg,transparent 50%,#777 50%),linear-gradient(135deg,#777 50%,transparent 50%);background-position:calc(100% - 15px) 14px,calc(100% - 10px) 14px;background-size:5px 5px,5px 5px;background-repeat:no-repeat}.period-select:focus{outline:none;border-color:#555}.period-save-state{font-size:11px;color:#34d399}.period-feedback{font-size:11px;color:#8d8d88}.period-feedback.warn{color:#f59e0b}@media(max-width:640px){.period-manager{align-items:flex-start;flex-direction:column}.period-manager-left{width:100%}.period-select{width:100%}}
  `;
  document.head.appendChild(style);

  function openDB(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{
        const db=req.result;
        if(!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE,{keyPath:'id'});
      };
      req.onsuccess=()=>resolve(req.result);
      req.onerror=()=>reject(req.error);
    });
  }

  async function dbGet(id){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null);
      req.onerror=()=>reject(req.error);
    });
  }

  async function dbPut(value){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readwrite');
      tx.objectStore(STORE).put(value);
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
    });
  }

  async function dbAll(){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).getAll();
      req.onsuccess=()=>resolve(req.result||[]);
      req.onerror=()=>reject(req.error);
    });
  }

  function rowMonth(kind,row){
    const field=kind==='sales'?'Fecha Cpte':'Fecha';
    const d=parseDate(row[field]);
    if(!d) return '';
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
  }

  function periodName(key){
    if(!key) return 'Sin período';
    const [y,m]=key.split('-').map(Number);
    return new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
  }

  function normalizeValue(value){
    if(value instanceof Date) return value.toISOString();
    if(value===null||value===undefined) return '';
    return String(value).trim();
  }

  function rowSignature(row){
    return Object.keys(row).sort().map(k=>`${k}:${normalizeValue(row[k])}`).join('|');
  }

  function mergeUnique(existing,incoming){
    const seen=new Set(existing.map(rowSignature));
    const added=[];
    let duplicates=0;
    for(const row of incoming){
      const key=rowSignature(row);
      if(seen.has(key)){duplicates++;continue;}
      seen.add(key);added.push(row);
    }
    return {rows:[...existing,...added],added:added.length,duplicates};
  }

  function injectManager(){
    if(document.getElementById('period-manager')) return;
    const uploads=document.querySelector('.upload-grid');
    if(!uploads) return;
    const box=document.createElement('section');
    box.id='period-manager';
    box.className='period-manager';
    box.innerHTML=`<div class="period-manager-left"><span class="period-manager-label">Período guardado</span><select id="period-select" class="period-select"><option value="">Sin períodos guardados</option></select><span class="period-save-state">Guardado automático</span></div><div id="period-feedback" class="period-feedback">Si volvés a cargar la misma información, Black OS omite los duplicados.</div>`;
    uploads.insertAdjacentElement('afterend',box);
    document.getElementById('period-select')?.addEventListener('change',e=>loadPeriod(e.target.value));
  }

  async function refreshPeriodSelect(preferred=''){
    injectManager();
    const select=document.getElementById('period-select');
    if(!select) return;
    const all=await dbAll();
    const periods=[...new Set(all.map(x=>x.period).filter(Boolean))].sort().reverse();
    select.innerHTML=periods.length?periods.map(p=>`<option value="${p}">${periodName(p)}</option>`).join(''):'<option value="">Sin períodos guardados</option>';
    const chosen=preferred&&periods.includes(preferred)?preferred:(currentPeriod&&periods.includes(currentPeriod)?currentPeriod:(periods[0]||''));
    select.value=chosen;
    currentPeriod=chosen;
  }

  function setSourceState(kind,count){
    const id=kind==='sales'?'sales':kind==='cash'?'cash':'bank';
    const state=document.getElementById(`${id}-state`);
    const card=document.getElementById(`upload-${id}-card`);
    if(count){
      if(state) state.textContent=`Guardado · ${count} filas`;
      card?.classList.add('loaded');
    }else{
      if(state) state.textContent='Seleccionar Excel';
      card?.classList.remove('loaded');
    }
  }

  async function loadPeriod(period){
    currentPeriod=period||'';
    for(const kind of KINDS){
      const rec=currentPeriod?await dbGet(`${currentPeriod}|${kind}`):null;
      adminData[kind]=rec?.rows||[];
      setSourceState(kind,adminData[kind].length);
    }
    const feedback=document.getElementById('period-feedback');
    if(feedback) feedback.textContent=currentPeriod?`Mostrando ${periodName(currentPeriod)} · datos guardados automáticamente.`:'Todavía no hay períodos guardados.';
    render();
  }

  function requiredFor(kind){
    return kind==='sales'
      ? ['Fecha Cpte','Vendedor','Rubro','Total Cantidad','Total C/Iva','Total Utilidad','Costo de Vta']
      : kind==='cash'
        ? ['Fecha','Concepto','Tipo de Movimiento','Pago','Total Importe']
        : ['Fecha','Cuenta','Concepto','Total Debe','Total Haber','Total Saldo'];
  }

  async function saveUpload(kind,file){
    showError('');
    const rows=await readExcel(file);
    const missing=validateColumns(rows,requiredFor(kind));
    if(missing.length) throw new Error(`El archivo ${file.name} no tiene estas columnas esperadas: ${missing.join(', ')}.`);

    const groups={};
    for(const row of rows){
      const p=rowMonth(kind,row);
      if(!p) continue;
      (groups[p] ||= []).push(row);
    }
    const periods=Object.keys(groups).sort();
    if(!periods.length) throw new Error(`No pude identificar el período del archivo ${file.name}.`);

    let totalAdded=0,totalDuplicates=0;
    for(const period of periods){
      const id=`${period}|${kind}`;
      const current=await dbGet(id);
      const merged=mergeUnique(current?.rows||[],groups[period]);
      await dbPut({id,period,kind,rows:merged.rows,updatedAt:new Date().toISOString(),sourceName:file.name});
      totalAdded+=merged.added;
      totalDuplicates+=merged.duplicates;
    }

    const target=periods[periods.length-1];
    await refreshPeriodSelect(target);
    await loadPeriod(target);
    const feedback=document.getElementById('period-feedback');
    if(feedback){
      feedback.classList.toggle('warn',totalDuplicates>0&&totalAdded===0);
      feedback.textContent=totalDuplicates
        ? `${file.name}: ${totalAdded} filas nuevas · ${totalDuplicates} duplicadas omitidas.`
        : `${file.name}: ${totalAdded} filas guardadas en ${periods.map(periodName).join(', ')}.`;
    }
  }

  function bindInputs(){
    const bindings=[['sales','sales-file'],['cash','cash-file'],['bank','bank-file']];
    for(const [kind,id] of bindings){
      const input=document.getElementById(id);
      if(!input) continue;
      input.addEventListener('change',async event=>{
        event.stopImmediatePropagation();
        const file=input.files?.[0];
        if(!file) return;
        try{ await saveUpload(kind,file); }
        catch(error){ console.error(error); showError(error.message||'No se pudo guardar el archivo.'); }
        finally{ input.value=''; }
      },true);
    }
  }

  async function init(){
    injectManager();
    bindInputs();
    await refreshPeriodSelect();
    if(currentPeriod) await loadPeriod(currentPeriod);
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})();