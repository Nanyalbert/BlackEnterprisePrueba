(() => {
  function digits(value){return String(value||'').replace(/\D/g,'');}
  function normalizeArgentinaWhatsApp(value){
    let d=digits(value);
    if(!d) return '';
    if(d.startsWith('00')) d=d.slice(2);
    if(d.startsWith('549')) return d;
    if(d.startsWith('54')){
      let local=d.slice(2).replace(/^0+/,'');
      if(local.startsWith('9')) return '54'+local;
      local=local.replace(/^15/,'');
      return '549'+local;
    }
    d=d.replace(/^0+/,'');
    d=d.replace(/^15/,'');
    if(d.length===10) return '549'+d;
    if(d.length===11 && d.startsWith('9')) return '54'+d;
    return d;
  }

  window.BlackWhatsApp = window.BlackWhatsApp || {};
  window.BlackWhatsApp.normalizeArgentina = normalizeArgentinaWhatsApp;
  window.BlackWhatsApp.lastError = null;

  // Reemplaza el envío histórico del CRM. Todas las campañas pasan por acá.
  window.evolutionSendText = async function(tel, texto){
    const normalized=normalizeArgentinaWhatsApp(tel);
    window.BlackWhatsApp.lastError=null;
    if(!normalized){
      window.BlackWhatsApp.lastError={status:0,message:'Teléfono inválido',input:tel,normalized:''};
      return false;
    }
    try{
      if(!window.cfg?.evoUrl || !window.cfg?.evoKey || !window.cfg?.evoInstance){
        window.BlackWhatsApp.lastError={status:0,message:'Evolution API no está configurada',input:tel,normalized};
        return false;
      }
      const url=window.cfg.evoUrl.replace(/\/$/,'')+'/message/sendText/'+encodeURIComponent(window.cfg.evoInstance);
      const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','apikey':window.cfg.evoKey},body:JSON.stringify({number:normalized,text:texto})});
      const raw=await r.text().catch(()=> '');
      if(!r.ok){
        window.BlackWhatsApp.lastError={status:r.status,message:raw.slice(0,300)||('HTTP '+r.status),input:tel,normalized};
        console.error('[Black OS WhatsApp] Evolution rechazó el envío',window.BlackWhatsApp.lastError);
        return false;
      }
      return true;
    }catch(err){
      window.BlackWhatsApp.lastError={status:0,message:err?.message||'Error de red',input:tel,normalized};
      console.error('[Black OS WhatsApp] Error de envío',window.BlackWhatsApp.lastError);
      return false;
    }
  };

  // Normaliza también el helper utilizado por cargas/campañas cuando el binding global es reemplazable.
  try{
    const old=window.normalizarTel;
    window.normalizarTel=function(value){
      const normalized=normalizeArgentinaWhatsApp(value);
      return normalized || (typeof old==='function'?old(value):digits(value));
    };
  }catch{}
})();