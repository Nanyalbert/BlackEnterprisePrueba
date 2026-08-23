// Black Óptica — Administración / Proveedores
(() => {
  const STORAGE_KEY = 'blackos_supplier_actions_v1';

  const esc = value => String(value ?? '').replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const getArticle = row => safe(row.Articulo || row['Artículo'] || 'Sin artículo');

  function supplierPeriodKey(){
    const rows = cleanRows(adminData.sales);
    const period = periodOf(rows,'Fecha Cpte');
    return monthKey(period) || 'sin-periodo';
  }

  function loadActions(){
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
  }

  function saveActions(actions){
    localStorage.setItem(STORAGE_KEY, JSON.stringify(actions));
  }

  function getAction(provider){
    const all = loadActions();
    const period = supplierPeriodKey();
    return all[period]?.[provider] || { paid:0, replenished:0, note:'' };
  }

  function patchAction(provider, patch){
    const all = loadActions();
    const period = supplierPeriodKey();
    all[period] ||= {};
    all[period][provider] = { paid:0, replenished:0, note:'', ...(all[period][provider] || {}), ...patch };
    saveActions(all);
    renderSuppliers();
  }

  function aggregateSuppliers(){
    const rows = cleanRows(adminData.sales).filter(row => safe(row.Proveedor));
    const map = {};

    rows.forEach(row => {
      const provider = safe(row.Proveedor);
      const brand = safe(row.Marca) || 'Sin marca';
      const article = getArticle(row);
      const cost = num(row['Costo de Vta']);
      const sales = num(row['Total C/Iva']);
      const profit = num(row['Total Utilidad']);
      const units = num(row['Total Cantidad']);

      if(!map[provider]) map[provider] = {name:provider,cost:0,sales:0,profit:0,units:0,brands:{},articles:{}};
      const p = map[provider];
      p.cost += cost; p.sales += sales; p.profit += profit; p.units += units;

      if(!p.brands[brand]) p.brands[brand] = {name:brand,cost:0,sales:0,profit:0,units:0,articles:{}};
      const b = p.brands[brand];
      b.cost += cost; b.sales += sales; b.profit += profit; b.units += units;

      const articleKey = `${brand}|||${article}`;
      if(!p.articles[articleKey]) p.articles[articleKey] = {brand,article,cost:0,sales:0,profit:0,units:0};
      p.articles[articleKey].cost += cost;
      p.articles[articleKey].sales += sales;
      p.articles[articleKey].profit += profit;
      p.articles[articleKey].units += units;
    });

    return Object.values(map).map(p => ({...p, margin:p.sales ? p.profit/p.sales*100 : 0})).sort((a,b)=>b.cost-a.cost);
  }

  function renderSupplierChart(providers){
    if(typeof makeChart !== 'function') return;
    const top = providers.slice(0,8);
    makeChart('supplier-consumption-chart',{
      type:'bar',
      data:{
        labels:top.map(x=>x.name),
        datasets:[{label:'Consumo',data:top.map(x=>x.cost),backgroundColor:'#A78BFA',borderRadius:7,borderSkipped:false}]
      },
      options:{...commonChartOptions,indexAxis:'y',plugins:{...commonChartOptions.plugins,legend:{display:false}}}
    });
  }

  function renderProviderCard(provider,totalCost){
    const action = getAction(provider.name);
    const pending = Math.max(provider.cost - num(action.paid),0);
    const brands = Object.values(provider.brands).sort((a,b)=>b.cost-a.cost);
    const articles = Object.values(provider.articles).sort((a,b)=>b.cost-a.cost);
    const encoded = encodeURIComponent(provider.name);
    const share = totalCost ? provider.cost/totalCost*100 : 0;

    const brandRows = brands.map(b => `
      <tr><td>${esc(b.name)}</td><td>${fmtNumber(b.units)}</td><td>${fmtCurrency(b.cost)}</td><td>${fmtCurrency(b.sales)}</td><td>${fmtCurrency(b.profit)}</td></tr>`).join('');
    const articleRows = articles.map(a => `
      <tr><td>${esc(a.article)}</td><td>${esc(a.brand)}</td><td>${fmtNumber(a.units)}</td><td>${fmtCurrency(a.cost)}</td><td>${fmtCurrency(a.sales)}</td></tr>`).join('');

    return `<article class="supplier-card" data-provider-card="${encoded}">
      <button type="button" class="supplier-card-head" data-action="toggle" data-provider="${encoded}">
        <div class="supplier-main"><span class="supplier-chevron">⌄</span><div><strong>${esc(provider.name)}</strong><small>${brands.length} marca${brands.length===1?'':'s'} · ${fmtNumber(provider.units)} unidades</small></div></div>
        <div class="supplier-consumption"><span>Consumo</span><strong>${fmtCurrency(provider.cost)}</strong><small>${fmtNumber(share)}% del total</small></div>
      </button>
      <div class="supplier-card-body">
        <div class="supplier-stat-grid">
          <div><span>Venta generada</span><strong>${fmtCurrency(provider.sales)}</strong></div>
          <div><span>Utilidad</span><strong>${fmtCurrency(provider.profit)}</strong></div>
          <div><span>Margen</span><strong>${fmtNumber(provider.margin)}%</strong></div>
          <div><span>Pago registrado</span><strong>${fmtCurrency(action.paid)}</strong></div>
          <div><span>Referencia pendiente</span><strong>${fmtCurrency(pending)}</strong></div>
          <div><span>Reposición registrada</span><strong>${fmtCurrency(action.replenished)}</strong></div>
        </div>
        <div class="supplier-actions">
          <button type="button" data-action="payment" data-provider="${encoded}">Registrar pago</button>
          <button type="button" data-action="replenishment" data-provider="${encoded}">Registrar reposición</button>
          <button type="button" data-action="note" data-provider="${encoded}">Observación</button>
        </div>
        ${action.note ? `<div class="supplier-note"><span>Observación</span>${esc(action.note)}</div>` : ''}
        <div class="supplier-detail-grid">
          <div class="supplier-table-block"><div class="panel-title"><h3>Consumo por marca</h3><span>Proveedor → Marca</span></div><div class="table-scroll"><table><thead><tr><th>Marca</th><th>Unid.</th><th>Consumo</th><th>Venta</th><th>Utilidad</th></tr></thead><tbody>${brandRows}</tbody></table></div></div>
          <div class="supplier-table-block"><div class="panel-title"><h3>Detalle por artículo</h3><span>Mayor consumo primero</span></div><div class="table-scroll"><table><thead><tr><th>Artículo</th><th>Marca</th><th>Unid.</th><th>Consumo</th><th>Venta</th></tr></thead><tbody>${articleRows}</tbody></table></div></div>
        </div>
      </div>
    </article>`;
  }

  function renderSuppliers(){
    const root = document.getElementById('suppliers-root');
    if(!root) return;
    const rows = cleanRows(adminData.sales);
    const hasSupplierColumn = rows.some(row => Object.prototype.hasOwnProperty.call(row,'Proveedor'));
    const providers = aggregateSuppliers();
    const period = periodOf(rows,'Fecha Cpte');
    const totalCost = providers.reduce((s,p)=>s+p.cost,0);
    const totalUnits = providers.reduce((s,p)=>s+p.units,0);
    const totalPaid = providers.reduce((s,p)=>s+num(getAction(p.name).paid),0);
    const pendingRef = providers.reduce((s,p)=>s+Math.max(p.cost-num(getAction(p.name).paid),0),0);
    const topShare = totalCost && providers[0] ? providers[0].cost/totalCost*100 : 0;

    const setText = (id,value) => { const el=document.getElementById(id); if(el) el.textContent=value; };
    setText('suppliers-period', period ? periodLabel(period) : 'Sin datos');
    setText('supplier-total-cost', providers.length ? fmtCurrency(totalCost) : '$ --');
    setText('supplier-total-units', providers.length ? fmtNumber(totalUnits) : '--');
    setText('supplier-count', providers.length ? String(providers.length) : '--');
    setText('supplier-pending-ref', providers.length ? fmtCurrency(pendingRef) : '$ --');
    setText('supplier-paid-total', providers.length ? fmtCurrency(totalPaid) : '$ --');
    setText('supplier-top-share', providers.length ? `${fmtNumber(topShare)}%` : '--');

    const ranking = document.getElementById('supplier-ranking');
    if(ranking) ranking.innerHTML = providers.length ? providers.map((p,i)=>{
      const share=totalCost?p.cost/totalCost*100:0;
      return `<tr><td>${i+1}. ${esc(p.name)}</td><td>${fmtCurrency(p.cost)}</td><td>${fmtNumber(p.units)}</td><td>${fmtCurrency(p.sales)}</td><td>${fmtCurrency(p.profit)}</td><td>${fmtNumber(share)}%</td></tr>`;
    }).join('') : '<tr><td colspan="6" class="empty-cell">Sin datos</td></tr>';

    const list = document.getElementById('supplier-list');
    if(list){
      if(!adminData.sales.length){
        list.innerHTML='<div class="supplier-empty">Cargá el Excel de Ventas para analizar el consumo por proveedor.</div>';
      }else if(!hasSupplierColumn){
        list.innerHTML='<div class="supplier-empty"><strong>El Excel cargado no incluye la columna “Proveedor”.</strong><br>El resto de Administración funciona normalmente, pero para este análisis el Cubo de Ventas debe exportar Proveedor y, idealmente, Marca y Articulo.</div>';
      }else if(!providers.length){
        list.innerHTML='<div class="supplier-empty">No encontré movimientos con proveedor identificado en este período.</div>';
      }else{
        list.innerHTML=providers.map(p=>renderProviderCard(p,totalCost)).join('');
      }
    }

    renderSupplierChart(providers);
  }

  function askAmount(provider,type){
    const current = getAction(provider);
    const label = type==='paid' ? 'pago acumulado registrado' : 'reposición acumulada registrada';
    const previous = num(current[type]);
    const raw = window.prompt(`Ingresá el ${label} para ${provider}.\nEste dato es una referencia interna y no modifica la deuda contable.`, previous || '');
    if(raw===null) return;
    const value = num(raw);
    if(value < 0 || !Number.isFinite(value)) return;
    patchAction(provider,{[type]:value});
  }

  document.addEventListener('click', event => {
    const btn = event.target.closest('[data-action][data-provider]');
    if(!btn || !document.getElementById('tab-proveedores')?.contains(btn)) return;
    const provider = decodeURIComponent(btn.dataset.provider || '');
    const action = btn.dataset.action;
    if(action==='toggle'){
      btn.closest('.supplier-card')?.classList.toggle('open');
      return;
    }
    if(action==='payment') askAmount(provider,'paid');
    if(action==='replenishment') askAmount(provider,'replenished');
    if(action==='note'){
      const current=getAction(provider);
      const note=window.prompt(`Observación para ${provider}`,current.note||'');
      if(note!==null) patchAction(provider,{note:note.trim()});
    }
  });

  const baseRender = window.render;
  if(typeof baseRender === 'function'){
    window.render = function(){
      baseRender();
      renderSuppliers();
    };
  }

  window.renderSuppliers = renderSuppliers;
  renderSuppliers();
})();