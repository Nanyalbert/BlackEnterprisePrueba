// Black Óptica — Subfunción Administración / Proveedores
(() => {
  const DB_NAME='blackos_administracion';
  const STORE='periodos';
  const DB_VERSION=1;
  const STORAGE_KEY='blackos_supplier_actions_v1';
  const adminData={sales:[]};
  const charts={};

  const safe=v=>String(v??'').trim();
  const num=value=>{
    if(typeof value==='number') return Number.isFinite(value)?value:0;
    if(value==null||value==='') return 0;
    const raw=String(value).trim().replace(/\$/g,'').replace(/\s/g,'');
    if(!raw) return 0;
    const parsed=Number(raw.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));
    return Number.isFinite(parsed)?parsed:0;
  };
  const fmtCurrency=v=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(v)||0);
  const fmtNumber=v=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(Number(v)||0);
  const esc=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  function parseDate(value){
    if(!value) return null;
    if(value instanceof Date&&!Number.isNaN(value.getTime())) return value;
    const d=new Date(value);
    return Number.isNaN(d.getTime())?null:d;
  }
  function periodName(key){
    if(!key) return 'Sin período';
    const [y,m]=key.split('-').map(Number);
    return new Date(y,m-1,1).toLocaleDateString('es-AR',{month:'long',year:'numeric'}).replace(/^./,c=>c.toUpperCase());
  }
  function periodLabelFromRows(rows){
    const dates=rows.map(r=>parseDate(r['Fecha Cpte'])).filter(Boolean).sort((a,b)=>a-b);
    if(!dates.length) return 'Sin datos';
    const f=d=>d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
    return `${f(dates[0])} — ${f(dates[dates.length-1])}`;
  }
  function cleanRows(rows){
    return rows.filter(r=>{
      const values=Object.values(r).map(safe).filter(Boolean);
      const isTotal=values.some(v=>/^total(es)?$/i.test(v));
      return !isTotal&&Boolean(safe(r['Fecha Cpte']));
    });
  }

  function openDB(){
    return new Promise((resolve,reject)=>{
      const req=indexedDB.open(DB_NAME,DB_VERSION);
      req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(STORE))db.createObjectStore(STORE,{keyPath:'id'});};
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
  }
  async function dbGet(id){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).get(id);
      req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);
    });
  }
  async function dbAll(){
    const db=await openDB();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(STORE,'readonly');
      const req=tx.objectStore(STORE).getAll();
      req.onsuccess=()=>resolve(req.result||[]);req.onerror=()=>reject(req.error);
    });
  }

  function currentPeriod(){return document.getElementById('supplier-period-select')?.value||'';}
  function loadActions(){try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');}catch{return {};}}
  function saveActions(all){localStorage.setItem(STORAGE_KEY,JSON.stringify(all));}
  function getAction(provider){const all=loadActions();return all[currentPeriod()]?.[provider]||{paid:0,replenished:0,note:''};}
  function patchAction(provider,patch){const all=loadActions();const period=currentPeriod();all[period]||={};all[period][provider]={paid:0,replenished:0,note:'',...(all[period][provider]||{}),...patch};saveActions(all);render();}

  function aggregateSuppliers(){
    const rows=cleanRows(adminData.sales).filter(r=>safe(r.Proveedor));
    const map={};
    rows.forEach(r=>{
      const provider=safe(r.Proveedor), brand=safe(r.Marca)||'Sin marca', article=safe(r.Articulo||r['Artículo'])||'Sin artículo';
      const cost=num(r['Costo de Vta']), sales=num(r['Total C/Iva']), profit=num(r['Total Utilidad']), units=num(r['Total Cantidad']);
      if(!map[provider])map[provider]={name:provider,cost:0,sales:0,profit:0,units:0,brands:{},articles:{}};
      const p=map[provider];p.cost+=cost;p.sales+=sales;p.profit+=profit;p.units+=units;
      if(!p.brands[brand])p.brands[brand]={name:brand,cost:0,sales:0,profit:0,units:0};
      const b=p.brands[brand];b.cost+=cost;b.sales+=sales;b.profit+=profit;b.units+=units;
      const k=`${brand}|||${article}`;
      if(!p.articles[k])p.articles[k]={brand,article,cost:0,sales:0,profit:0,units:0};
      const a=p.articles[k];a.cost+=cost;a.sales+=sales;a.profit+=profit;a.units+=units;
    });
    return Object.values(map).map(p=>({...p,margin:p.sales?p.profit/p.sales*100:0})).sort((a,b)=>b.cost-a.cost);
  }

  function makeChart(id,config){
    const canvas=document.getElementById(id);if(!canvas||!window.Chart)return;
    charts[id]?.destroy();charts[id]=new Chart(canvas,config);
  }
  const commonOptions={responsive:true,maintainAspectRatio:false,animation:{duration:250},plugins:{legend:{display:false},tooltip:{backgroundColor:'#0a0a0a',borderColor:'#333',borderWidth:1,titleColor:'#fff',bodyColor:'#ddd',callbacks:{label:ctx=>fmtCurrency(ctx.raw)}}},scales:{x:{ticks:{color:'#777',font:{size:9}},grid:{color:'#1d1d1d'}},y:{ticks:{color:'#777',font:{size:9},callback:v=>new Intl.NumberFormat('es-AR',{notation:'compact',maximumFractionDigits:1}).format(v)},grid:{color:'#1d1d1d'}}}};

  function card(provider,totalCost){
    const action=getAction(provider.name);const pending=Math.max(provider.cost-num(action.paid),0);const share=totalCost?provider.cost/totalCost*100:0;const encoded=encodeURIComponent(provider.name);
    const brands=Object.values(provider.brands).sort((a,b)=>b.cost-a.cost);
    const articles=Object.values(provider.articles).sort((a,b)=>b.cost-a.cost);
    return `<article class="supplier-card"><button class="supplier-card-head" data-toggle="${encoded}"><div class="supplier-main"><span class="supplier-chevron">⌄</span><div><strong>${esc(provider.name)}</strong><small>${brands.length} marca${brands.length===1?'':'s'} · ${fmtNumber(provider.units)} unidades</small></div></div><div class="supplier-consumption"><span>Consumo</span><strong>${fmtCurrency(provider.cost)}</strong><small>${fmtNumber(share)}% del total</small></div></button><div class="supplier-card-body"><div class="supplier-stat-grid"><div><span>Venta generada</span><strong>${fmtCurrency(provider.sales)}</strong></div><div><span>Utilidad</span><strong>${fmtCurrency(provider.profit)}</strong></div><div><span>Margen</span><strong>${fmtNumber(provider.margin)}%</strong></div><div><span>Pago registrado</span><strong>${fmtCurrency(action.paid)}</strong></div><div><span>Referencia pendiente</span><strong>${fmtCurrency(pending)}</strong></div><div><span>Reposición registrada</span><strong>${fmtCurrency(action.replenished)}</strong></div></div><div class="supplier-actions"><button data-pay="${encoded}">Registrar pago</button><button data-replenish="${encoded}">Registrar reposición</button><button data-note="${encoded}">Observación</button></div>${action.note?`<div class="supplier-note"><span>Observación</span>${esc(action.note)}</div>`:''}<div class="supplier-detail-grid"><div class="supplier-table-block"><div class="panel-title"><h3>Consumo por marca</h3><span>Proveedor → Marca</span></div><div class="table-scroll"><table><thead><tr><th>Marca</th><th>Unid.</th><th>Consumo</th><th>Venta</th><th>Utilidad</th></tr></thead><tbody>${brands.map(b=>`<tr><td>${esc(b.name)}</td><td>${fmtNumber(b.units)}</td><td>${fmtCurrency(b.cost)}</td><td>${fmtCurrency(b.sales)}</td><td>${fmtCurrency(b.profit)}</td></tr>`).join('')}</tbody></table></div></div><div class="supplier-table-block"><div class="panel-title"><h3>Detalle por artículo</h3><span>Mayor consumo primero</span></div><div class="table-scroll"><table><thead><tr><th>Artículo</th><th>Marca</th><th>Unid.</th><th>Consumo</th><th>Venta</th></tr></thead><tbody>${articles.map(a=>`<tr><td>${esc(a.article)}</td><td>${esc(a.brand)}</td><td>${fmtNumber(a.units)}</td><td>${fmtCurrency(a.cost)}</td><td>${fmtCurrency(a.sales)}</td></tr>`).join('')}</tbody></table></div></div></div></div></article>`;
  }

  function render(){
    const rows=cleanRows(adminData.sales);const providers=aggregateSuppliers();const totalCost=providers.reduce((s,p)=>s+p.cost,0);const totalUnits=providers.reduce((s,p)=>s+p.units,0);const totalPaid=providers.reduce((s,p)=>s+num(getAction(p.name).paid),0);const pending=providers.reduce((s,p)=>s+Math.max(p.cost-num(getAction(p.name).paid),0),0);const topShare=providers[0]&&totalCost?providers[0].cost/totalCost*100:0;
    const set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v;};
    set('suppliers-period',periodLabelFromRows(rows));set('supplier-total-cost',providers.length?fmtCurrency(totalCost):'$ --');set('supplier-total-units',providers.length?fmtNumber(totalUnits):'--');set('supplier-count',providers.length?String(providers.length):'--');set('supplier-pending-ref',providers.length?fmtCurrency(pending):'$ --');set('supplier-paid-total',providers.length?fmtCurrency(totalPaid):'$ --');set('supplier-top-share',providers.length?`${fmtNumber(topShare)}%`:'--');
    const ranking=document.getElementById('supplier-ranking');if(ranking)ranking.innerHTML=providers.length?providers.map((p,i)=>`<tr><td>${i+1}. ${esc(p.name)}</td><td>${fmtCurrency(p.cost)}</td><td>${fmtNumber(p.units)}</td><td>${fmtCurrency(p.sales)}</td><td>${fmtCurrency(p.profit)}</td><td>${fmtNumber(totalCost?p.cost/totalCost*100:0)}%</td></tr>`).join(''):'<tr><td colspan="6" class="empty-cell">Sin datos</td></tr>';
    const list=document.getElementById('supplier-list');if(list){const hasColumn=rows.some(r=>Object.prototype.hasOwnProperty.call(r,'Proveedor'));list.innerHTML=!adminData.sales.length?'<div class="supplier-empty">No hay un período de Ventas guardado. Volvé a Administración y cargá el Excel de Ventas.</div>':!hasColumn?'<div class="supplier-empty"><strong>El Excel de Ventas no incluye la columna Proveedor.</strong><br>Volvé a exportarlo agregando Proveedor para habilitar este análisis.</div>':!providers.length?'<div class="supplier-empty">No hay movimientos con proveedor identificado en este período.</div>':providers.map(p=>card(p,totalCost)).join('');}
    makeChart('supplier-consumption-chart',{type:'bar',data:{labels:providers.slice(0,8).map(p=>p.name),datasets:[{data:providers.slice(0,8).map(p=>p.cost),backgroundColor:'#A78BFA',borderRadius:7,borderSkipped:false}]},options:{...commonOptions,indexAxis:'y'}});
  }

  async function refreshPeriods(){
    const all=await dbAll();const periods=[...new Set(all.filter(x=>x.kind==='sales').map(x=>x.period).filter(Boolean))].sort().reverse();const select=document.getElementById('supplier-period-select');
    if(!select)return;
    select.innerHTML=periods.length?periods.map(p=>`<option value="${p}">${periodName(p)}</option>`).join(''):'<option value="">Sin períodos guardados</option>';
    let preferred='';try{preferred=sessionStorage.getItem('blackos_admin_period')||'';}catch{}
    select.value=periods.includes(preferred)?preferred:(periods[0]||'');
    await loadPeriod(select.value);
  }
  async function loadPeriod(period){
    adminData.sales=[];
    if(period){const rec=await dbGet(`${period}|sales`);adminData.sales=rec?.rows||[];try{sessionStorage.setItem('blackos_admin_period',period);}catch{}}
    const state=document.getElementById('supplier-source-state');if(state)state.textContent=period?`${periodName(period)} · ${adminData.sales.length} filas de Ventas guardadas.`:'No hay períodos guardados todavía.';
    render();
  }

  document.addEventListener('click',e=>{
    const toggle=e.target.closest('[data-toggle]');if(toggle){toggle.closest('.supplier-card')?.classList.toggle('open');return;}
    const pay=e.target.closest('[data-pay]');const repl=e.target.closest('[data-replenish]');const note=e.target.closest('[data-note]');
    const el=pay||repl||note;if(!el)return;const provider=decodeURIComponent(pay?.dataset.pay||repl?.dataset.replenish||note?.dataset.note||'');const action=getAction(provider);
    if(pay||repl){const type=pay?'paid':'replenished';const label=pay?'pago acumulado':'reposición acumulada';const raw=prompt(`Ingresá el ${label} para ${provider}`,action[type]||'');if(raw!==null)patchAction(provider,{[type]:num(raw)});}
    if(note){const text=prompt(`Observación para ${provider}`,action.note||'');if(text!==null)patchAction(provider,{note:text.trim()});}
  });
  document.getElementById('supplier-period-select')?.addEventListener('change',e=>loadPeriod(e.target.value));

  async function ensureSession(){try{const client=window.BlackPortal?.getSupabase?.();if(!client)return;const {data:{session}}=await client.auth.getSession();if(!session)location.replace('index.html');}catch{}}
  ensureSession();refreshPeriods().catch(err=>{console.error(err);const box=document.getElementById('supplier-error');if(box){box.hidden=false;box.textContent='No se pudieron leer los períodos guardados de Administración.';}});
})();