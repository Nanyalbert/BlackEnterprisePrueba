(()=>{
  const state={client:null,session:null,file:null,dataUrl:'',analysis:null,busy:false};
  const $=id=>document.getElementById(id);
  function resolveClient(){
    try{if(window.parent&&window.parent!==window&&window.parent.BlackPortal?.getSupabase)return window.parent.BlackPortal.getSupabase();}catch(_){ }
    return window.BlackPortal?.getSupabase?.()||null;
  }
  function setStatus(text,type=''){const el=$('rx-status');if(!el)return;el.textContent=text;el.className=`rx-status ${type}`;}
  function num(v){return v===null||v===undefined||v===''?'':String(v)}
  function setField(id,v){const el=$(id);if(el)el.value=num(v)}
  function getField(id){return ($(id)?.value||'').trim()}
  function confidenceLabel(value){
    const n=Number(value);if(!Number.isFinite(n))return ['Sin confianza',''];
    if(n>=0.85)return [`Alta ${Math.round(n*100)}%`,'high'];
    if(n>=0.6)return [`Media ${Math.round(n*100)}%`,''];
    return [`Baja ${Math.round(n*100)}%`,'low'];
  }
  function renderAnalysis(data){
    state.analysis=data||{};
    const od=data?.od||{},oi=data?.oi||{};
    setField('rx-od-sphere',od.sphere);setField('rx-od-cylinder',od.cylinder);setField('rx-od-axis',od.axis);setField('rx-od-add',od.addition);
    setField('rx-oi-sphere',oi.sphere);setField('rx-oi-cylinder',oi.cylinder);setField('rx-oi-axis',oi.axis);setField('rx-oi-add',oi.addition);
    setField('rx-pd',data?.pd);setField('rx-notes',data?.notes||'');
    const [label,cls]=confidenceLabel(data?.confidence);
    const chip=$('rx-confidence');if(chip){chip.textContent=label;chip.className=`rx-review-chip ${cls}`;}
    const warning=$('rx-warning');
    const issues=Array.isArray(data?.uncertain_fields)?data.uncertain_fields:[];
    if(warning){
      warning.textContent=issues.length?`Revisar: ${issues.join(', ')}`:'No se marcaron campos dudosos. Igual confirmá los valores contra la receta antes de cotizar.';
      warning.className=`rx-note ${issues.length?'warn':''}`;
    }
    $('rx-confirm')?.removeAttribute('disabled');
    const checkbox=$('rx-reviewed');if(checkbox)checkbox.checked=false;
    setStatus('Lectura completada. Revisá cada valor antes de confirmarlo.','ok');
  }
  function clearResult(){
    ['rx-od-sphere','rx-od-cylinder','rx-od-axis','rx-od-add','rx-oi-sphere','rx-oi-cylinder','rx-oi-axis','rx-oi-add','rx-pd','rx-notes'].forEach(id=>setField(id,''));
    const chip=$('rx-confidence');if(chip){chip.textContent='Sin analizar';chip.className='rx-review-chip';}
    const warning=$('rx-warning');if(warning){warning.textContent='La IA marcará acá cualquier dato que no pueda leer con seguridad.';warning.className='rx-note';}
    const checkbox=$('rx-reviewed');if(checkbox)checkbox.checked=false;
    const confirm=$('rx-confirm');if(confirm)confirm.disabled=true;
  }
  function previewFile(file){
    if(!file)return;
    if(!/^image\//.test(file.type)){setStatus('Elegí una imagen JPG, PNG o WEBP.','error');return;}
    if(file.size>8*1024*1024){setStatus('La imagen supera 8 MB.','error');return;}
    state.file=file;
    const reader=new FileReader();
    reader.onload=()=>{
      state.dataUrl=String(reader.result||'');
      const host=$('rx-preview');if(host)host.innerHTML=`<img src="${state.dataUrl}" alt="Vista previa de receta">`;
      clearResult();setStatus('Imagen lista para analizar.');
    };
    reader.readAsDataURL(file);
  }
  async function initClient(){
    if(!state.client)state.client=resolveClient();
    if(!state.client)throw new Error('Supabase no está disponible.');
    const {data:{session},error}=await state.client.auth.getSession();if(error)throw error;
    state.session=session;if(!session)throw new Error('No hay una sesión activa.');
  }
  async function analyze(){
    if(state.busy)return;
    if(!state.dataUrl){setStatus('Primero seleccioná una foto de la receta.','error');return;}
    state.busy=true;const btn=$('rx-analyze');if(btn){btn.disabled=true;btn.textContent='Analizando…';}
    setStatus('Leyendo la receta con Black AI…');
    try{
      await initClient();
      const {data,error}=await state.client.functions.invoke('black-ai-chat',{body:{action:'analyze_prescription',image_data_url:state.dataUrl}});
      if(error)throw error;if(!data?.ok||!data?.prescription)throw new Error(data?.error||'No se pudo interpretar la receta.');
      renderAnalysis(data.prescription);
    }catch(error){
      const msg=String(error?.context?.body?.error||error?.message||error||'No se pudo analizar la receta.');
      setStatus(msg,'error');
    }finally{state.busy=false;if(btn){btn.disabled=false;btn.textContent='Analizar receta';}}
  }
  function buildConfirmed(){
    return {
      od:{sphere:getField('rx-od-sphere'),cylinder:getField('rx-od-cylinder'),axis:getField('rx-od-axis'),addition:getField('rx-od-add')},
      oi:{sphere:getField('rx-oi-sphere'),cylinder:getField('rx-oi-cylinder'),axis:getField('rx-oi-axis'),addition:getField('rx-oi-add')},
      pd:getField('rx-pd'),notes:getField('rx-notes'),reviewed:true,confirmed_at:new Date().toISOString()
    };
  }
  function confirmReading(){
    if(!$('rx-reviewed')?.checked){setStatus('Marcá la confirmación después de comparar los valores con la receta.','error');return;}
    const payload=buildConfirmed();
    sessionStorage.setItem('black_ai_confirmed_prescription',JSON.stringify(payload));
    setStatus('Receta confirmada. Ya está lista para pasar al motor de cotización.','ok');
    const badge=$('rx-reader-badge');if(badge){badge.textContent='Receta confirmada';badge.className='rx-reader-badge ready';}
  }
  function mount(){
    const control=$('tab-control');if(!control||$('rx-reader-card'))return;
    const card=document.createElement('article');card.className='card rx-reader-card';card.id='rx-reader-card';
    card.innerHTML=`
      <div class="card-head rx-reader-head"><div><span class="card-kicker">VISIÓN · RECETA</span><h3>Lector de receta</h3><p>Subí una foto. Black AI transcribe los valores y te obliga a revisarlos antes de cotizar.</p></div><span class="rx-reader-badge" id="rx-reader-badge">Revisión humana obligatoria</span></div>
      <div class="rx-reader-shell">
        <div class="rx-upload">
          <div class="rx-drop" id="rx-preview"><div class="rx-drop-placeholder">Subí una foto clara de la receta. Evitá reflejos, sombras y recortes.</div></div>
          <input type="file" id="rx-file" accept="image/jpeg,image/png,image/webp">
          <div class="rx-upload-actions"><button class="btn-secondary" type="button" id="rx-pick">Elegir foto</button><button class="btn-primary" type="button" id="rx-analyze">Analizar receta</button></div>
        </div>
        <div class="rx-result">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center"><h4>Valores detectados</h4><span class="rx-review-chip" id="rx-confidence">Sin analizar</span></div>
          <div class="rx-grid">
            <div></div><div class="rx-head">Esfera</div><div class="rx-head">Cilindro</div><div class="rx-head axis-col">Eje</div><div class="rx-head">Adición</div>
            <div class="rx-eye-label">OD</div><div class="rx-field"><input id="rx-od-sphere"></div><div class="rx-field"><input id="rx-od-cylinder"></div><div class="rx-field axis-col"><input id="rx-od-axis"></div><div class="rx-field"><input id="rx-od-add"></div>
            <div class="rx-eye-label">OI</div><div class="rx-field"><input id="rx-oi-sphere"></div><div class="rx-field"><input id="rx-oi-cylinder"></div><div class="rx-field axis-col"><input id="rx-oi-axis"></div><div class="rx-field"><input id="rx-oi-add"></div>
          </div>
          <div class="rx-extra"><div class="rx-field"><label>DP / DIP</label><input id="rx-pd"></div><div class="rx-field"><label>Observaciones detectadas</label><input id="rx-notes"></div></div>
          <div class="rx-note" id="rx-warning">La IA marcará acá cualquier dato que no pueda leer con seguridad.</div>
          <label class="rx-confirm"><input type="checkbox" id="rx-reviewed"><span>Comparé estos valores con la receta original y confirmo que la transcripción es correcta.</span></label>
          <div class="rx-result-actions"><button class="btn-primary" type="button" id="rx-confirm" disabled>Confirmar receta</button></div>
          <div class="rx-status" id="rx-status"></div>
        </div>
      </div>`;
    const lab=$('ai-lab-card');if(lab)lab.insertAdjacentElement('beforebegin',card);else control.appendChild(card);
    $('rx-pick')?.addEventListener('click',()=>$('rx-file')?.click());
    $('rx-file')?.addEventListener('change',e=>previewFile(e.target.files?.[0]));
    $('rx-analyze')?.addEventListener('click',analyze);
    $('rx-confirm')?.addEventListener('click',confirmReading);
    $('rx-reviewed')?.addEventListener('change',e=>{const b=$('rx-confirm');if(b)b.disabled=!e.target.checked;});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
})();