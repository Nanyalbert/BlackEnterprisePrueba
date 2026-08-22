// Black Óptica — Administración

const adminData = { sales: [], cash: [], bank: [] };
const adminCharts = {};

const fmtCurrency = value => new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:0}).format(Number(value)||0);
const fmtNumber = value => new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(Number(value)||0);
const safe = value => String(value ?? '').trim();
const num = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (value == null || value === '') return 0;
  const raw = String(value).trim().replace(/\$/g,'').replace(/\s/g,'');
  if (!raw) return 0;
  const parsed = Number(raw.replace(/\.(?=\d{3}(?:\D|$))/g,'').replace(',','.'));
  return Number.isFinite(parsed) ? parsed : 0;
};

function parseDate(value){
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && window.XLSX?.SSF?.parse_date_code){
    const d = XLSX.SSF.parse_date_code(value);
    if (d) return new Date(d.y,d.m-1,d.d);
  }
  const text = String(value).trim();
  const m = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return new Date(Number(m[3]),Number(m[2])-1,Number(m[1]));
  const d = new Date(text);
  return Number.isNaN(d.getTime()) ? null : d;
}

function periodOf(rows, dateField){
  const dates = rows.map(r=>parseDate(r[dateField])).filter(Boolean).sort((a,b)=>a-b);
  if (!dates.length) return null;
  return {min:dates[0],max:dates[dates.length-1]};
}

function periodLabel(period){
  if (!period) return 'Sin datos';
  const f = d => d.toLocaleDateString('es-AR',{day:'2-digit',month:'short',year:'numeric'});
  return `${f(period.min)} — ${f(period.max)}`;
}

function monthKey(period){
  if (!period) return '';
  return `${period.min.getFullYear()}-${String(period.min.getMonth()+1).padStart(2,'0')}`;
}

async function readExcel(file){
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer,{type:'array',cellDates:true});
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws,{defval:null,raw:true});
  return rows.filter(row => Object.values(row).some(v => v !== null && v !== ''));
}

function validateColumns(rows, required){
  if (!rows.length) return required;
  const cols = new Set(Object.keys(rows[0]));
  return required.filter(c=>!cols.has(c));
}

function setFileState(kind,file){
  const id = kind==='sales'?'sales':kind==='cash'?'cash':'bank';
  document.getElementById(`${id}-state`).textContent = `${file.name} · ${adminData[kind].length} filas`;
  document.getElementById(`upload-${id}-card`).classList.add('loaded');
}

function showError(message){
  const box=document.getElementById('error-box');
  box.hidden=!message;
  box.textContent=message||'';
}

function sum(rows, field){ return rows.reduce((acc,row)=>acc+num(row[field]),0); }

function isTotalRow(row){
  const values=Object.values(row).map(safe).filter(Boolean);
  return values.some(v=>/^total(es)?$/i.test(v));
}

function cleanRows(rows){
  return rows.filter(r=>{
    const hasDate = safe(r['Fecha Cpte']) || safe(r['Fecha']);
    return !isTotalRow(r) && Boolean(hasDate);
  });
}

function getSalesMetrics(){
  const rows=cleanRows(adminData.sales);
  const total=sum(rows,'Total C/Iva');
  const profit=sum(rows,'Total Utilidad');
  const cost=sum(rows,'Costo de Vta');
  const units=sum(rows,'Total Cantidad');
  return {rows,total,profit,cost,units,margin:total?profit/total*100:0};
}

function getCashMetrics(){
  const rows=cleanRows(adminData.cash);
  const incomes=rows.filter(r=>safe(r['Tipo de Movimiento']).toLowerCase()==='ingreso');
  const expenses=rows.filter(r=>safe(r['Tipo de Movimiento']).toLowerCase()==='egreso');
  const payments={};
  incomes.forEach(r=>{
    const key=safe(r.Pago)||'Sin medio';
    payments[key]=(payments[key]||0)+num(r['Total Importe']);
  });
  const total=incomes.reduce((a,r)=>a+num(r['Total Importe']),0);
  const confirmedExpenses=Math.abs(expenses.reduce((a,r)=>a+num(r['Total Importe']),0));
  const byText = text => Object.entries(payments).filter(([k])=>k.toLowerCase().includes(text)).reduce((a,[,v])=>a+v,0);
  const cash=byText('efectivo');
  const transfer=Object.entries(payments).filter(([k])=>/dep[oó]sito|transfer/i.test(k)).reduce((a,[,v])=>a+v,0);
  const cards=Object.entries(payments).filter(([k])=>/visa|master|naranja|amex|tarjeta/i.test(k)).reduce((a,[,v])=>a+v,0);
  return {rows,total,payments,cash,transfer,cards,confirmedExpenses};
}

function classifyBankConcept(concept){
  const c=safe(concept).toLowerCase();
  if (/impuesto|comisi[oó]n|gasto banc|mantenimiento|sellado|retenci[oó]n/.test(c)) return 'confirmed-expense';
  if (/dep[oó]sito bancario de terceros|acreditaci[oó]n|cobro|venta|pos|tarjeta/.test(c)) return 'informative-income';
  if (/transferencia/.test(c)) return 'pending-expense';
  return 'pending';
}

function getBankMetrics(){
  const rows=cleanRows(adminData.bank);
  let income=0,confirmedExpense=0,pendingExpense=0,pending=0;
  const concepts={};
  rows.forEach(r=>{
    const debe=num(r['Total Debe']);
    const haber=num(r['Total Haber']);
    const concept=safe(r.Concepto)||'Sin concepto';
    const type=classifyBankConcept(concept);
    if (debe>0) income+=debe;
    if (haber>0){
      if(type==='confirmed-expense') confirmedExpense+=haber;
      else if(type==='pending-expense') pendingExpense+=haber;
      else pending+=haber;
    }
    if(!concepts[concept]) concepts[concept]={debe:0,haber:0,type};
    concepts[concept].debe+=debe;
    concepts[concept].haber+=haber;
  });
  const net=sum(rows,'Total Debe')-sum(rows,'Total Haber');
  return {rows,income,confirmedExpense,pendingExpense,pending,net,concepts};
}

function aggregate(rows,keyField){
  const map={};
  rows.forEach(r=>{
    const key=safe(r[keyField])||'Sin clasificar';
    if(!map[key]) map[key]={sales:0,profit:0};
    map[key].sales+=num(r['Total C/Iva']);
    map[key].profit+=num(r['Total Utilidad']);
  });
  return Object.entries(map).map(([name,v])=>({name,...v,margin:v.sales?v.profit/v.sales*100:0})).sort((a,b)=>b.sales-a.sales);
}

function chartPalette(count){
  const base=['#f5f5f3','#a7a7a1','#74746f','#565652','#3a3a37','#242422','#b68c4a','#7d9d88'];
  return Array.from({length:count},(_,i)=>base[i%base.length]);
}

function destroyChart(id){
  if(adminCharts[id]){
    adminCharts[id].destroy();
    delete adminCharts[id];
  }
}

function makeChart(id, config){
  if(!window.Chart) return;
  const canvas=document.getElementById(id);
  if(!canvas) return;
  destroyChart(id);
  adminCharts[id]=new Chart(canvas,config);
}

const commonChartOptions={
  responsive:true,
  maintainAspectRatio:false,
  animation:{duration:350},
  plugins:{
    legend:{labels:{color:'#b8b8b3',boxWidth:10,boxHeight:10,font:{size:10,family:'Plus Jakarta Sans'}}},
    tooltip:{
      backgroundColor:'#0a0a0a',
      borderColor:'#333',
      borderWidth:1,
      titleColor:'#f5f5f3',
      bodyColor:'#cfcfca',
      callbacks:{label:ctx=>`${ctx.dataset.label||ctx.label}: ${fmtCurrency(ctx.raw)}`}
    }
  },
  scales:{
    x:{ticks:{color:'#666',font:{size:9}},grid:{color:'#1d1d1d'}},
    y:{ticks:{color:'#666',font:{size:9},callback:v=>new Intl.NumberFormat('es-AR',{notation:'compact',maximumFractionDigits:1}).format(v)},grid:{color:'#1d1d1d'}}
  }
};

function renderCharts(s,c,b,seller,cats,expenses,result){
  makeChart('summary-composition-chart',{
    type:'bar',
    data:{labels:['Facturación','Costo','Utilidad'],datasets:[{label:'ARS',data:[s.total,s.cost,s.profit],backgroundColor:['#f5f5f3','#5c5c58','#b68c4a'],borderRadius:7,borderSkipped:false}]},
    options:{...commonChartOptions,plugins:{...commonChartOptions.plugins,legend:{display:false}}}
  });

  makeChart('summary-result-chart',{
    type:'doughnut',
    data:{labels:['Resultado confirmado','Gastos confirmados'],datasets:[{data:[Math.max(result,0),Math.max(expenses,0)],backgroundColor:['#f5f5f3','#565652'],borderColor:'#111',borderWidth:4,hoverOffset:3}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'68%',plugins:commonChartOptions.plugins}
  });

  const sellerTop=seller.slice(0,6);
  makeChart('seller-chart',{
    type:'bar',
    data:{labels:sellerTop.map(x=>x.name),datasets:[{label:'Venta',data:sellerTop.map(x=>x.sales),backgroundColor:'#f5f5f3',borderRadius:6,borderSkipped:false},{label:'Utilidad',data:sellerTop.map(x=>x.profit),backgroundColor:'#74746f',borderRadius:6,borderSkipped:false}]},
    options:{...commonChartOptions,indexAxis:'y'}
  });

  const catTop=cats.slice(0,6);
  makeChart('category-chart',{
    type:'doughnut',
    data:{labels:catTop.map(x=>x.name),datasets:[{data:catTop.map(x=>x.sales),backgroundColor:chartPalette(catTop.length),borderColor:'#111',borderWidth:4,hoverOffset:3}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'58%',plugins:commonChartOptions.plugins}
  });

  const paymentEntries=Object.entries(c.payments).sort((a,b)=>b[1]-a[1]);
  makeChart('payments-chart',{
    type:'doughnut',
    data:{labels:paymentEntries.map(([name])=>name),datasets:[{data:paymentEntries.map(([,value])=>value),backgroundColor:chartPalette(paymentEntries.length),borderColor:'#111',borderWidth:4,hoverOffset:3}]},
    options:{responsive:true,maintainAspectRatio:false,cutout:'60%',plugins:commonChartOptions.plugins}
  });

  makeChart('bank-chart',{
    type:'bar',
    data:{labels:['Ingresos','Gastos confirmados','Por clasificar'],datasets:[{label:'ARS',data:[b.income,b.confirmedExpense,b.pendingExpense+b.pending],backgroundColor:['#f5f5f3','#74746f','#b68c4a'],borderRadius:7,borderSkipped:false}]},
    options:{...commonChartOptions,plugins:{...commonChartOptions.plugins,legend:{display:false}}}
  });
}

function render(){
  const s=getSalesMetrics(), c=getCashMetrics(), b=getBankMetrics();
  const expenses=c.confirmedExpenses+b.confirmedExpense;
  const result=s.profit-expenses;

  document.getElementById('kpi-result').textContent=adminData.sales.length?fmtCurrency(result):'$ --';
  document.getElementById('kpi-sales').textContent=adminData.sales.length?fmtCurrency(s.total):'$ --';
  document.getElementById('kpi-profit').textContent=adminData.sales.length?fmtCurrency(s.profit):'$ --';
  document.getElementById('kpi-margin').textContent=adminData.sales.length?`Margen ${fmtNumber(s.margin)}%`:'Margen --';
  document.getElementById('kpi-expenses').textContent=(adminData.cash.length||adminData.bank.length)?fmtCurrency(expenses):'$ --';
  document.getElementById('flow-profit').textContent=adminData.sales.length?fmtCurrency(s.profit):'$ --';
  document.getElementById('flow-cash-expenses').textContent=adminData.cash.length?fmtCurrency(c.confirmedExpenses):'$ --';
  document.getElementById('flow-bank-expenses').textContent=adminData.bank.length?fmtCurrency(b.confirmedExpense):'$ --';
  document.getElementById('flow-result').textContent=adminData.sales.length?fmtCurrency(result):'$ --';
  document.getElementById('pending-expenses').textContent=adminData.bank.length?fmtCurrency(b.pendingExpense+b.pending):'$ --';

  document.getElementById('sales-total').textContent=adminData.sales.length?fmtCurrency(s.total):'$ --';
  document.getElementById('sales-cost').textContent=adminData.sales.length?fmtCurrency(s.cost):'$ --';
  document.getElementById('sales-profit').textContent=adminData.sales.length?fmtCurrency(s.profit):'$ --';
  document.getElementById('sales-units').textContent=adminData.sales.length?fmtNumber(s.units):'--';

  const seller=aggregate(s.rows,'Vendedor');
  document.getElementById('seller-table').innerHTML=seller.length?seller.map(x=>`<tr><td>${x.name}</td><td>${fmtCurrency(x.sales)}</td><td>${fmtCurrency(x.profit)}</td><td>${fmtNumber(x.margin)}%</td></tr>`).join(''):'<tr><td colspan="4" class="empty-cell">Sin datos</td></tr>';
  const cats=aggregate(s.rows,'Rubro').slice(0,8);
  document.getElementById('category-table').innerHTML=cats.length?cats.map(x=>`<tr><td>${x.name}</td><td>${fmtCurrency(x.sales)}</td><td>${fmtCurrency(x.profit)}</td></tr>`).join(''):'<tr><td colspan="3" class="empty-cell">Sin datos</td></tr>';

  document.getElementById('cash-total').textContent=adminData.cash.length?fmtCurrency(c.total):'$ --';
  document.getElementById('cash-cash').textContent=adminData.cash.length?fmtCurrency(c.cash):'$ --';
  document.getElementById('cash-transfer').textContent=adminData.cash.length?fmtCurrency(c.transfer):'$ --';
  document.getElementById('cash-cards').textContent=adminData.cash.length?fmtCurrency(c.cards):'$ --';
  const maxPayment=Math.max(1,...Object.values(c.payments));
  document.getElementById('payment-list').innerHTML=Object.keys(c.payments).length?Object.entries(c.payments).sort((a,b)=>b[1]-a[1]).map(([name,value])=>`<div class="payment-row"><div class="payment-name">${name}</div><div class="payment-bar"><span style="width:${Math.max(2,value/maxPayment*100)}%"></span></div><div class="payment-value">${fmtCurrency(value)}</div></div>`).join(''):'<div class="empty-cell">Sin datos</div>';

  document.getElementById('bank-income').textContent=adminData.bank.length?fmtCurrency(b.income):'$ --';
  document.getElementById('bank-expense').textContent=adminData.bank.length?fmtCurrency(b.confirmedExpense):'$ --';
  document.getElementById('bank-pending').textContent=adminData.bank.length?fmtCurrency(b.pendingExpense+b.pending):'$ --';
  document.getElementById('bank-net').textContent=adminData.bank.length?fmtCurrency(b.net):'$ --';
  const ruleLabel={
    'confirmed-expense':'Gasto confirmado · resta',
    'informative-income':'Ingreso informativo · no suma',
    'pending-expense':'Egreso pendiente · no resta todavía',
    pending:'Requiere clasificación'
  };
  document.getElementById('bank-rules').innerHTML=Object.keys(b.concepts).length?Object.entries(b.concepts).map(([name,v])=>`<div class="bank-rule-row"><div class="rule-name">${name}</div><div class="rule-type">${ruleLabel[v.type]||ruleLabel.pending}</div><div class="rule-value">${v.debe?'+ '+fmtCurrency(v.debe):'− '+fmtCurrency(v.haber)}</div></div>`).join(''):'<div class="empty-cell">Sin datos</div>';

  renderCharts(s,c,b,seller,cats,expenses,result);

  const ps=periodOf(s.rows,'Fecha Cpte'), pc=periodOf(c.rows,'Fecha'), pb=periodOf(b.rows,'Fecha');
  document.getElementById('sales-period').textContent=periodLabel(ps);
  document.getElementById('cash-period').textContent=periodLabel(pc);
  document.getElementById('bank-period').textContent=periodLabel(pb);
  document.getElementById('summary-period').textContent=ps?periodLabel(ps):'Cargá los archivos para comenzar';
  const periods=[ps,pc,pb].filter(Boolean);
  const keys=[...new Set(periods.map(monthKey))];
  const warn=document.getElementById('period-warning');
  if(keys.length>1){warn.hidden=false;warn.textContent='Atención: los archivos cargados pertenecen a períodos distintos. Black OS los muestra, pero no los cruza como si fueran el mismo mes.';}else{warn.hidden=true;warn.textContent='';}

  const loaded=[adminData.sales.length,adminData.cash.length,adminData.bank.length].filter(Boolean).length;
  document.getElementById('data-status').textContent=loaded===3?'3/3 archivos cargados':loaded?`${loaded}/3 archivos cargados`:'Sin datos cargados';
}

async function attachFile(kind,file){
  if(!file) return;
  showError('');
  try{
    const rows=await readExcel(file);
    const required= kind==='sales'
      ? ['Fecha Cpte','Vendedor','Rubro','Total Cantidad','Total C/Iva','Total Utilidad','Costo de Vta']
      : kind==='cash'
        ? ['Fecha','Concepto','Tipo de Movimiento','Pago','Total Importe']
        : ['Fecha','Cuenta','Concepto','Total Debe','Total Haber','Total Saldo'];
    const missing=validateColumns(rows,required);
    if(missing.length) throw new Error(`El archivo ${file.name} no tiene estas columnas esperadas: ${missing.join(', ')}.`);
    adminData[kind]=rows;
    setFileState(kind,file);
    render();
  }catch(error){
    console.error(error);
    showError(error.message||'No se pudo leer el archivo.');
  }
}

[['sales','sales-file'],['cash','cash-file'],['bank','bank-file']].forEach(([kind,id])=>{
  const input=document.getElementById(id);
  input?.addEventListener('change',()=>attachFile(kind,input.files?.[0]));
});

document.querySelectorAll('.admin-tab').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.admin-tab').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    setTimeout(()=>Object.values(adminCharts).forEach(chart=>chart.resize()),30);
  });
});

async function ensureSession(){
  try{
    const client=window.BlackPortal?.getSupabase?.();
    if(!client) return;
    const {data:{session}}=await client.auth.getSession();
    if(!session) window.location.replace('index.html');
  }catch(error){console.warn('No se pudo validar sesión:',error);}
}

ensureSession();
render();