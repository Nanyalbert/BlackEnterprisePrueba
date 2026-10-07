(() => {
  const $=id=>document.getElementById(id);
  const fieldMap={
    'far.od.sphere':'od-sphere','far.od.cylinder':'od-cylinder','far.od.axis':'od-axis',
    'far.oi.sphere':'oi-sphere','far.oi.cylinder':'oi-cylinder','far.oi.axis':'oi-axis',
    'near.od.sphere':'near-od-sphere','near.od.cylinder':'near-od-cylinder','near.od.axis':'near-od-axis',
    'near.oi.sphere':'near-oi-sphere','near.oi.cylinder':'near-oi-cylinder','near.oi.axis':'near-oi-axis',
    add:'add'
  };
  let lastPrescription=null;

  function qualityLabel(value){
    return value==='high'?'Lectura clara':value==='medium'?'Revisar algunos datos':value==='low'?'Lectura incierta':'Lectura pendiente';
  }
  function fieldLabel(path){
    const labels={
      type:'Tipo de receta',
      'far.od.sphere':'OD esfera','far.od.cylinder':'OD cilindro','far.od.axis':'OD eje',
      'far.oi.sphere':'OI esfera','far.oi.cylinder':'OI cilindro','far.oi.axis':'OI eje',
      'near.od.sphere':'Cerca OD esfera','near.od.cylinder':'Cerca OD cilindro','near.od.axis':'Cerca OD eje',
      'near.oi.sphere':'Cerca OI esfera','near.oi.cylinder':'Cerca OI cilindro','near.oi.axis':'Cerca OI eje',
      add:'ADD'
    };
    return labels[path]||path;
  }
  function clearHighlights(){
    document.querySelectorAll('.rx-ai-review').forEach(el=>el.classList.remove('rx-ai-review'));
  }
  function renderRecognition(prescription){
    lastPrescription=prescription||null;
    const panel=$('recognitionReview');
    if(!panel)return;
    clearHighlights();
    if(!prescription){panel.hidden=true;return;}
    const uncertain=Array.isArray(prescription.uncertain)?prescription.uncertain:[];
    uncertain.forEach(path=>{const id=fieldMap[path];if(id)$(id)?.classList.add('rx-ai-review')});
    const badge=$('recognitionBadge'), title=$('recognitionTitle'), detail=$('recognitionDetail'), chips=$('recognitionChips');
    if(badge){badge.dataset.quality=prescription.quality||'medium';badge.textContent=qualityLabel(prescription.quality)}
    if(title)title.textContent=uncertain.length?'Black AI leyó la receta, pero hay datos para controlar':'Black AI leyó la receta con buena consistencia';
    if(detail)detail.textContent=prescription.notes||'Compará la lectura con la imagen original antes de confirmar la graduación.';
    if(chips){
      chips.replaceChildren(...uncertain.map(path=>{const span=document.createElement('span');span.textContent=fieldLabel(path);return span}));
      chips.hidden=!uncertain.length;
    }
    panel.hidden=false;
  }

  function removeUncertainForInput(input){
    if(!lastPrescription)return;
    const path=Object.entries(fieldMap).find(([,id])=>id===input.id)?.[0];
    if(!path)return;
    lastPrescription.uncertain=(lastPrescription.uncertain||[]).filter(x=>x!==path);
    input.classList.remove('rx-ai-review');
    renderRecognition(lastPrescription);
  }

  function patchAnalyzeResponse(){
    const client=window.parent?.BlackPortal?.getSupabase?.()||window.BlackPortal?.getSupabase?.();
    if(!client?.functions?.invoke||client.functions.__rxPatched)return;
    const original=client.functions.invoke.bind(client.functions);
    client.functions.invoke=async(name,options)=>{
      const result=await original(name,options);
      if(name==='black-recetas-analyze'&&result?.data?.ok&&result.data.prescription){
        queueMicrotask(()=>renderRecognition(result.data.prescription));
      }
      return result;
    };
    client.functions.__rxPatched=true;
  }

  function renderBestOffer(){
    const host=$('bestOffer');
    if(!host)return;
    const cards=[...document.querySelectorAll('#optionGrid .option')];
    const best=cards.find(card=>card.querySelector('.tier')?.textContent?.trim()==='Mejor opción');
    if(!best){host.hidden=true;host.replaceChildren();return;}
    const name=best.querySelector('h3')?.textContent?.trim();
    const benefit=best.querySelector('strong')?.textContent?.trim();
    const reason=best.querySelector('p')?.textContent?.trim();
    if(!name||/Pendiente de configuración/i.test(name)){host.hidden=true;host.replaceChildren();return;}
    host.innerHTML='<div class="best-offer-mark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.4 5.2L20 9l-4 4 .9 5.7L12 16l-4.9 2.7L8 13 4 9l5.6-.8Z"/></svg></div><div><span>MEJOR OPCIÓN PARA ESTE CASO</span><h3></h3><strong></strong><p></p></div>';
    host.querySelector('h3').textContent=name;
    host.querySelector('strong').textContent=benefit||'';
    host.querySelector('p').textContent=reason||'';
    host.hidden=false;
  }

  function observeResults(){
    const grid=$('optionGrid');if(!grid)return;
    new MutationObserver(()=>queueMicrotask(renderBestOffer)).observe(grid,{childList:true,subtree:true,characterData:true});
  }

  document.addEventListener('input',event=>{
    if(event.target.matches?.('.rx-row input,#add'))removeUncertainForInput(event.target);
  });
  document.addEventListener('change',event=>{
    if(event.target.matches?.('input[name="rxType"]')&&lastPrescription){
      lastPrescription.uncertain=(lastPrescription.uncertain||[]).filter(x=>x!=='type');
      renderRecognition(lastPrescription);
    }
  });
  $('clearButton')?.addEventListener('click',()=>{lastPrescription=null;clearHighlights();if($('recognitionReview'))$('recognitionReview').hidden=true});
  $('exampleButton')?.addEventListener('click',()=>{lastPrescription=null;clearHighlights();if($('recognitionReview'))$('recognitionReview').hidden=true});

  patchAnalyzeResponse();
  observeResults();
})();
