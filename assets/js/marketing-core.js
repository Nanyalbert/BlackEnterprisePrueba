// Black OS · Marketing — utilidades puras compartidas
((global)=>{
  const TZ='America/Argentina/Buenos_Aires';
  const pad=n=>String(n).padStart(2,'0');
  const clean=v=>String(v??'').trim();
  const slug=value=>clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  const safeNumber=value=>{
    if(value===null||value===undefined||value==='')return null;
    const n=Number(String(value).replace(/\s/g,'').replace(/\./g,'').replace(',','.'));
    return Number.isFinite(n)?n:null;
  };
  const formatMoney=(value,currency='ARS')=>{
    const n=Number(value);
    if(!Number.isFinite(n))return '—';
    try{return new Intl.NumberFormat('es-AR',{style:'currency',currency,maximumFractionDigits:0}).format(n)}catch{return `$${Math.round(n).toLocaleString('es-AR')}`}
  };
  const isoToday=()=>{
    const parts=new Intl.DateTimeFormat('en-CA',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const v=Object.fromEntries(parts.map(x=>[x.type,x.value]));
    return `${v.year}-${v.month}-${v.day}`;
  };
  const parseISODate=value=>{
    const m=clean(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if(!m)return null;
    return new Date(Number(m[1]),Number(m[2])-1,Number(m[3]),12,0,0);
  };
  const toISODate=date=>date instanceof Date&&!Number.isNaN(date.valueOf())?`${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`:null;
  const addDays=(date,days)=>{const d=new Date(date);d.setDate(d.getDate()+days);return d};
  const addMonths=(date,months)=>{const d=new Date(date);d.setDate(1);d.setMonth(d.getMonth()+months);return d};
  const startOfWeek=(date)=>{const d=new Date(date);const day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(12,0,0,0);return d};
  const monthGrid=(anchor)=>{
    const first=new Date(anchor.getFullYear(),anchor.getMonth(),1,12);
    const start=startOfWeek(first);
    return Array.from({length:42},(_,i)=>addDays(start,i));
  };
  const weekGrid=anchor=>{const start=startOfWeek(anchor);return Array.from({length:7},(_,i)=>addDays(start,i))};
  const contentReadiness=item=>{
    const missing=[];
    if(!clean(item?.title))missing.push('título');
    if(!clean(item?.content_type_id))missing.push('tipo');
    if(!clean(item?.format_id))missing.push('formato');
    if(!clean(item?.objective))missing.push('objetivo');
    if(!clean(item?.brief))missing.push('brief');
    if(['approved','scheduled','published','analyzed'].includes(item?.status_id)&&!clean(item?.cta))missing.push('CTA');
    if(['scheduled','published','analyzed'].includes(item?.status_id)&&!clean(item?.publish_date))missing.push('fecha');
    if(item?.ad_decision_id!=='organic'&&['approved','scheduled','published','analyzed'].includes(item?.status_id)&&!clean(item?.destination))missing.push('destino');
    return {ready:missing.length===0,missing};
  };
  const resultMetrics=row=>{
    const spend=safeNumber(row?.spend),revenue=safeNumber(row?.revenue),sales=safeNumber(row?.sales),inq=safeNumber(row?.qualified_inquiries),contribution=safeNumber(row?.contribution_before_ads);
    return {
      cpa:spend!==null&&sales>0?spend/sales:null,
      cost_per_qualified_inquiry:spend!==null&&inq>0?spend/inq:null,
      roas:spend!==null&&spend>0&&sales>0&&revenue!==null?revenue/spend:null,
      contribution_after_ads:contribution!==null&&spend!==null?contribution-spend:null,
      close_rate:sales!==null&&inq>0?sales/inq:null
    };
  };
  const csvRows=text=>{
    const rows=[];let row=[],cell='',quoted=false;
    const s=String(text||'');
    for(let i=0;i<s.length;i++){
      const ch=s[i];
      if(ch==='"'){
        if(quoted&&s[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;
      }else if(ch===','&&!quoted){row.push(cell);cell='';}
      else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&s[i+1]==='\n')i++;row.push(cell);if(row.some(x=>x!==''))rows.push(row);row=[];cell='';}
      else cell+=ch;
    }
    row.push(cell);if(row.some(x=>x!==''))rows.push(row);
    if(!rows.length)return [];
    const headers=rows.shift().map(x=>clean(x));
    return rows.map(values=>Object.fromEntries(headers.map((h,i)=>[h,values[i]??''])));
  };
  const importPreview=(incoming,existingByStableId,hashFn)=>{
    const seen=new Set();
    return (incoming||[]).map(item=>{
      const stable=clean(item.stable_id);
      const issues=[];
      if(!stable)issues.push('Falta ID estable');
      if(!clean(item.title))issues.push('Falta título');
      if(stable&&seen.has(stable))issues.push('ID duplicado dentro del lote');
      seen.add(stable);
      const existing=existingByStableId?.get?.(stable)||null;
      const incomingHash=hashFn?hashFn(item):null;
      let action=issues.length?'review':existing?'update':'new';
      if(existing&&incomingHash&&existing.source_hash===incomingHash)action='duplicate';
      return {stable_id:stable,item,existing,action,issues,incoming_hash:incomingHash};
    });
  };
  const stableJson=value=>{
    if(value===null||typeof value!=='object')return JSON.stringify(value);
    if(Array.isArray(value))return `[${value.map(stableJson).join(',')}]`;
    return `{${Object.keys(value).sort().map(k=>`${JSON.stringify(k)}:${stableJson(value[k])}`).join(',')}}`;
  };
  const fastHash=value=>{
    const s=stableJson(value);let h=2166136261;
    for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}
    return `fnv1a-${(h>>>0).toString(16).padStart(8,'0')}`;
  };
  const uniqueStableIds=items=>{
    const ids=(items||[]).map(x=>clean(x.stable_id));
    return ids.length===new Set(ids).size&&ids.every(Boolean);
  };
  const escapeHtml=value=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  const api={TZ,slug,safeNumber,formatMoney,isoToday,parseISODate,toISODate,addDays,addMonths,startOfWeek,monthGrid,weekGrid,contentReadiness,resultMetrics,csvRows,importPreview,stableJson,fastHash,uniqueStableIds,escapeHtml};
  global.BlackMarketingCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:window);
