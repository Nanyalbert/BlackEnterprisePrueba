// Black Óptica — Entrega digital de liquidaciones médicas por WhatsApp
(() => {
  const client=window.BlackPortal?.getSupabase?.();
  if(!client) return;

  const state={doctors:new Map(),statuses:new Map(),loading:false};
  const canonicalBranch=code=>{
    const v=String(code||'').trim().toLowerCase();
    return ['alto-palermo','zona-norte','cerro'].includes(v)?'cerro-de-las-rosas':v;
  };
  const key=(doctor,branch)=>String(window.normName?.(doctor)||doctor||'')+'|'+canonicalBranch(branch);
  const fmtSent=value=>{
    if(!value)return '';
    const d=new Date(value); if(Number.isNaN(d.getTime()))return '';
    return d.toLocaleDateString('es-AR',{day:'2-digit',month:'2-digit'})+' · '+d.toLocaleTimeString('es-AR',{hour:'2-digit',minute:'2-digit'});
  };
  const escAttr=value=>String(value||'').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

  function injectStyles(){
    if(document.getElementById('doctor-delivery-styles'))return;
    const style=document.createElement('style');style.id='doctor-delivery-styles';
    style.textContent=`
      .commission-delivery-note{display:flex;align-items:flex-start;gap:10px;margin:10px 0 18px;padding:12px 14px;border:1px solid rgba(201,169,110,.28);border-radius:13px;background:linear-gradient(135deg,rgba(201,169,110,.10),rgba(255,255,255,.82));color:var(--roble)}
      .commission-delivery-note>svg{width:18px;height:18px;flex:0 0 auto;fill:none;stroke:var(--cobre);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;margin-top:1px}
      .commission-delivery-note strong{display:block;color:var(--black);font-size:.74rem;margin-bottom:2px}
      .commission-delivery-note span{display:block;font-size:.69rem;line-height:1.45}
      .branch-delivery{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-top:8px;padding-top:8px;border-top:1px solid rgba(26,20,16,.08)}
      .delivery-btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;min-height:34px;padding:0 12px;border:1px solid rgba(37,133,85,.24);border-radius:10px;background:rgba(37,133,85,.08);color:#247447;font:600 .7rem var(--font-sans);cursor:pointer;transition:.16s ease}
      .delivery-btn:hover:not(:disabled){background:rgba(37,133,85,.14);transform:translateY(-1px)}
      .delivery-btn:disabled{opacity:.48;cursor:not-allowed;transform:none}
      .delivery-btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
      .delivery-btn.sent{background:rgba(37,133,85,.1);border-color:rgba(37,133,85,.2);color:#247447}
      .delivery-btn.failed{background:rgba(192,86,78,.08);border-color:rgba(192,86,78,.22);color:#a54e48}
      .delivery-btn.no-phone{background:#f7f5f0;border-color:#ddd7cc;color:#8b8172}
      .delivery-state-text{font-size:.64rem;color:var(--roble);line-height:1.35}
      .delivery-state-text strong{color:#247447;font-weight:700}
      .delivery-confirm-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:18px;background:rgba(21,16,12,.62);backdrop-filter:blur(6px)}
      .delivery-confirm{width:min(460px,100%);background:#fff;border:1px solid var(--lino);border-radius:18px;padding:22px;box-shadow:0 28px 80px rgba(0,0,0,.24)}
      .delivery-confirm-kicker{font-size:.65rem;letter-spacing:.12em;text-transform:uppercase;color:var(--cobre);font-weight:700}
      .delivery-confirm h3{margin:6px 0 8px;font-family:var(--font-display);font-size:1.25rem;color:var(--black)}
      .delivery-confirm p{margin:0;color:var(--roble);font-size:.79rem;line-height:1.6}
      .delivery-confirm-data{margin:15px 0;padding:12px 13px;border:1px solid var(--lino);border-radius:12px;background:#faf9f6;display:grid;gap:7px}
      .delivery-confirm-data div{display:flex;justify-content:space-between;gap:12px;font-size:.72rem;color:var(--roble)}
      .delivery-confirm-data strong{color:var(--black);text-align:right}
      .delivery-confirm-actions{display:flex;gap:8px;margin-top:18px}
      .commission-detail-head{display:grid;grid-template-columns:72px minmax(135px,1.6fr) 88px 78px 88px 52px 98px;gap:8px;padding:8px 10px;margin-top:4px;border-bottom:1px solid var(--lino);font-size:.62rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--roble)}
      .branch-detail-row.commission-detail-grid{display:grid;grid-template-columns:72px minmax(135px,1.6fr) 88px 78px 88px 52px 98px;gap:8px;align-items:center}
      .detail-money,.detail-pct{text-align:right;font-variant-numeric:tabular-nums}
      .detail-commission{font-weight:700;color:var(--cobre)}
      @media(max-width:760px){
        .commission-detail-head{display:none}
        .branch-detail-row.commission-detail-grid{grid-template-columns:74px minmax(0,1fr) auto;padding:10px 8px}
        .branch-detail-row.commission-detail-grid .detail-net,.branch-detail-row.commission-detail-grid .detail-vat,.branch-detail-row.commission-detail-grid .detail-gross,.branch-detail-row.commission-detail-grid .detail-pct{font-size:.66rem}
        .branch-detail-row.commission-detail-grid .detail-net:before{content:'s/IVA ';color:var(--roble)}
        .branch-detail-row.commission-detail-grid .detail-vat:before{content:'IVA ';color:var(--roble)}
        .branch-detail-row.commission-detail-grid .detail-gross:before{content:'c/IVA ';color:var(--roble)}
        .branch-detail-row.commission-detail-grid .detail-pct:before{content:'Com. ';color:var(--roble)}
      }
    `;
    document.head.appendChild(style);
  }

  async function loadDoctors(){
    const {data,error}=await client.from('doctors').select('id,full_name,phone,active').eq('active',true);
    if(error)throw error;
    state.doctors.clear();
    (data||[]).forEach(d=>state.doctors.set(String(window.normName?.(d.full_name)||d.full_name||''),d));
    if(typeof doctors!=='undefined' && Array.isArray(doctors)){
      doctors.forEach(local=>{
        const cloud=state.doctors.get(String(window.normName?.(local.nombre)||local.nombre||''));
        if(cloud){local.telefono=cloud.phone||local.telefono||'';local._supabaseId=cloud.id;}
      });
      try{window.saveState?.()}catch(_){}
    }
  }

  async function loadStatuses(){
    const from=document.getElementById('periodo-desde')?.value||'';
    const to=document.getElementById('periodo-hasta')?.value||'';
    state.statuses.clear();
    if(!from||!to)return;
    const {data,error}=await client.rpc('doctor_commission_delivery_status',{p_period_from:from,p_period_to:to});
    if(error)throw error;
    (data||[]).forEach(row=>{
      state.statuses.set(key(row.doctor_name,row.branch_code),row);
    });
  }

  function phoneFor(doctor){return state.doctors.get(String(window.normName?.(doctor)||doctor||''))?.phone||''}
  function doctorIdFor(doctor){return state.doctors.get(String(window.normName?.(doctor)||doctor||''))?.id||null}
  function statusFor(doctor,branch){return state.statuses.get(key(doctor,branch))||null}

  function normalizeWaPhone(value){
    let d=String(value||'').replace(/\D/g,'');
    if(d.startsWith('54')) d=d.slice(2);
    if(d.startsWith('0')) d=d.slice(1);
    if(d.startsWith('9') && d.length===11) return '54'+d;
    if(d.length===10) return '549'+d;
    return '';
  }
  function directRows(doctor,branch){
    const from=document.getElementById('periodo-desde')?.value||'';
    const to=document.getElementById('periodo-hasta')?.value||'';
    const inst=document.getElementById('filter-institucion')?.value||'';
    const all=typeof window.filterRecetas==='function'?window.filterRecetas(from,to,inst):[];
    const dk=String(window.normName?.(doctor)||doctor||'');
    return (all||[]).filter(r=>String(window.normName?.(r.medico)||r.medico||'')===dk && canonicalBranch(window.branchCodeForRecipe?.(r)||r.branch||r.sucursal||'general-paz')===canonicalBranch(branch));
  }
  function directMessage(doctor,branch){
    const from=document.getElementById('periodo-desde')?.value||'';
    const to=document.getElementById('periodo-hasta')?.value||'';
    const rows=directRows(doctor,branch);
    const money=n=>new Intl.NumberFormat('es-AR',{style:'currency',currency:'ARS',maximumFractionDigits:2}).format(Number(n)||0);
    const dmy=v=>{const p=String(v||'').slice(0,10).split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:String(v||'')};
    let total=0,netTotal=0;
    const detail=[];
    rows.forEach(r=>{
      const net=Number(r.monto)||0;
      const pct=Number(window.BlackCommissionRules?.getPct?.(doctor,canonicalBranch(branch),r.fecha) ?? window.getComision?.(doctor,canonicalBranch(branch)) ?? 20)||20;
      const commission=net*pct/100;
      netTotal+=net; total+=commission;
      detail.push(dmy(r.fecha)+' · '+(r.paciente||'Paciente')+' · '+money(net)+' s/IVA · '+pct+'% · comisión '+money(commission));
    });
    const branchName=canonicalBranch(branch)==='cerro-de-las-rosas'?'Cerro de las Rosas':'General Paz';
    let msg='Hola Dr./Dra. '+doctor+'. Le compartimos el detalle de su liquidación de comisiones de Black Óptica.\n\n';
    msg+='Período: '+dmy(from)+' al '+dmy(to)+'\nSucursal: '+branchName+'\nOperaciones: '+rows.length+'\nBase s/IVA: '+money(netTotal)+'\n*Total comisión: '+money(total)+'*';
    if(detail.length){msg+='\n\n*Detalle*\n'+detail.join('\n');}
    msg+='\n\nBlack Óptica';
    return {msg,rows};
  }

  function buttonHTML(doctor,branch){
    const phone=phoneFor(doctor);
    const d=escAttr(doctor),b=escAttr(canonicalBranch(branch));
    const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 3.5a10 10 0 0 0-15.7 12L3 21l5.7-1.5a10 10 0 1 0 11.8-16Z"/><path d="M8.5 8.5c.6 3 2.8 5.2 5.9 6.1"/></svg>';
    if(!phone)return '<div class="branch-delivery"><button class="delivery-btn no-phone" type="button" disabled>'+icon+'Falta WhatsApp</button><span class="delivery-state-text">Cargalo en la ficha del profesional.</span></div>';
    return '<div class="branch-delivery"><button class="delivery-btn" type="button" onclick="BlackDoctorDelivery.send(\''+d+'\',\''+b+'\')">'+icon+'Enviar detalle por WhatsApp</button><span class="delivery-state-text">Abre el chat con el período seleccionado.</span></div>';
  }

  async function send(doctor,branch){
    const from=document.getElementById('periodo-desde')?.value||'',to=document.getElementById('periodo-hasta')?.value||'';
    if(!from||!to){window.showToast?.('Definí Desde y Hasta antes de abrir WhatsApp.');return}
    const phone=normalizeWaPhone(phoneFor(doctor));
    if(!phone){window.showToast?.('Revisá el WhatsApp cargado en la ficha del profesional.');return}
    const data=directMessage(doctor,branch);
    if(!data.rows.length){window.showToast?.('No hay operaciones para ese profesional en el período seleccionado.');return}
    window.open('https://wa.me/'+phone+'?text='+encodeURIComponent(data.msg),'_blank','noopener,noreferrer');
  }
  async function hydrate(){
    try{
      await loadDoctors();
      try{window.applyFilters?.()}catch(_){}
    }catch(error){console.warn('Entrega de liquidaciones',error)}
  }

  const originalApplyFilters=window.applyFilters;
  if(typeof originalApplyFilters==='function'){
    window.applyFilters=function(){
      const value=originalApplyFilters.apply(this,arguments);
      clearTimeout(window.__doctorDeliveryTimer);
      window.__doctorDeliveryTimer=setTimeout(()=>originalApplyFilters(),180);
      return value;
    };
  }
  ['periodo-desde','periodo-hasta'].forEach(id=>document.getElementById(id)?.addEventListener('change',()=>setTimeout(hydrate,50)));

  window.BlackDoctorDelivery={send,phoneFor,doctorIdFor,buttonHTML,hydrate,directMessage};
  injectStyles();
  setTimeout(hydrate,250);
})();