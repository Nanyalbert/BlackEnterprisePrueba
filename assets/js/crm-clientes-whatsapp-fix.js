(() => {
  const nativeFetch = window.fetch.bind(window);

  function digits(value){ return String(value||'').replace(/\D/g,''); }
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
    if(d.length===11){
      const pos=d.indexOf('15',2);
      if(pos>=2 && pos<=4) d=d.slice(0,pos)+d.slice(pos+2);
    }
    d=d.replace(/^15/,'');
    if(d.length===10) return '549'+d;
    if(d.length===11 && d.startsWith('9')) return '54'+d;
    if(d.length===12 && d.startsWith('54')) return d;
    if(d.length===13 && d.startsWith('549')) return d;
    return d;
  }

  window.BlackWhatsApp = window.BlackWhatsApp || {};
  window.BlackWhatsApp.normalizeArgentina = normalizeArgentinaWhatsApp;
  window.BlackWhatsApp.lastError = null;

  function notifyError(err){
    window.BlackWhatsApp.lastError=err;
    console.error('[Black OS WhatsApp]',err);
    const message = err.kind==='network'
      ? 'WhatsApp: Evolution no respondió desde el navegador. Posible CORS/red.'
      : `WhatsApp: Evolution ${err.status||''} ${err.message||'rechazó el envío'}`.trim();
    try{ if(typeof window.toast==='function') window.toast(message); }catch{}
    window.dispatchEvent(new CustomEvent('blackos-whatsapp-error',{detail:err}));
  }

  window.fetch = async function(input, init={}){
    const url = typeof input==='string' ? input : (input?.url || '');
    const isEvolutionSend = /\/message\/sendText\//i.test(url);
    if(!isEvolutionSend) return nativeFetch(input,init);

    let nextInit={...init};
    let originalNumber='';
    let normalized='';
    try{
      if(typeof nextInit.body==='string'){
        const payload=JSON.parse(nextInit.body);
        originalNumber=payload.number||'';
        normalized=normalizeArgentinaWhatsApp(originalNumber);
        if(normalized) payload.number=normalized;
        nextInit.body=JSON.stringify(payload);
      }
    }catch(e){ console.warn('[Black OS WhatsApp] No se pudo normalizar payload',e); }

    try{
      const response=await nativeFetch(input,nextInit);
      if(!response.ok){
        let raw='';
        try{ raw=await response.clone().text(); }catch{}
        notifyError({
          kind:'http',status:response.status,
          message:(raw||response.statusText||'Error de Evolution').slice(0,350),
          originalNumber,normalized,url
        });
      }else{
        window.BlackWhatsApp.lastError=null;
        window.dispatchEvent(new CustomEvent('blackos-whatsapp-ok',{detail:{originalNumber,normalized,url}}));
      }
      return response;
    }catch(error){
      notifyError({kind:'network',status:0,message:error?.message||'Failed to fetch',originalNumber,normalized,url});
      throw error;
    }
  };
})();