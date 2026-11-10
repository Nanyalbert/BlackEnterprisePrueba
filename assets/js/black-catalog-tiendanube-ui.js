(()=>{
'use strict';
const panel=document.getElementById('tiendanubeIntegration');
if(!panel)return;
const form=document.createElement('div');
form.style.marginTop='24px';
form.innerHTML='<h3>Envío individual oculto</h3><p id="tnPhotos">Prueba manual sin fotos. Para incluir fotos aprobadas, prepará el envío desde la ficha generada.</p><label>Nombre confirmado<input id="tnName" maxlength="180"></label><label>SKU único<input id="tnSku" maxlength="60"></label><label>Precio ARS<input id="tnPrice" type="number" min="0.01" step="0.01"></label><label>Descripción HTML revisada<textarea id="tnDesc" rows="7"></textarea></label><label><input id="tnConsent" type="checkbox" style="width:auto"> Confirmo crear este producto oculto</label><div class="actions"><button id="tnSend" type="button">Crear producto oculto</button></div><p id="tnStatus" role="status"></p>';
panel.append(form);
const get=id=>document.getElementById(id),button=get('tnSend'),status=get('tnStatus');
let photos=[],reviewed='',busy=false,submitted=false,job=null,batchBusy=false;
window.BlackCatalogTiendanube={prepare({name,price,description,photos:approved}){
 document.querySelector('#catalogSidebar [data-tab="integraciones"]')?.click();
 if(batchBusy||busy||job&&job.next<job.images.length){status.textContent='Terminá o revisá primero el envío en curso.';return}
 photos=approved.slice();reviewed='';submitted=false;job=null;
 get('tnName').value=name;get('tnSku').value='';get('tnPrice').value=String(price??'');get('tnDesc').value=description;get('tnConsent').checked=false;
 get('tnPhotos').textContent=photos.length+' fotos aprobadas. La primera será la foto principal.';
 button.disabled=false;button.textContent='Crear producto oculto';status.textContent='Ingresá un SKU único y revisá los datos antes de confirmar.';
 form.scrollIntoView({behavior:'smooth',block:'start'});
}};
async function encode(file){
 const photo=await createImageBitmap(file);
 try{
  const scale=Math.min(1,1600/Math.max(photo.width,photo.height)),canvas=document.createElement('canvas');
  canvas.width=Math.max(1,Math.round(photo.width*scale));canvas.height=Math.max(1,Math.round(photo.height*scale));
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(photo,0,0,canvas.width,canvas.height);
  const jpeg=canvas.toDataURL('image/jpeg',.84).split(',')[1];
  if(!jpeg?.startsWith('/9j/')||jpeg.length>2000000)throw Error('No se pudo preparar la foto '+file.name);
  return jpeg;
 }finally{photo.close()}
}
async function invoke(body){
 let timer;
 try{
  const sb=window.BlackPortal.getSupabase();
  const {data,error}=await Promise.race([sb.functions.invoke('black-catalog-tiendanube',{body}),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tiendanube no respondió a tiempo')),30000)})]);
  if(error||data?.error){
   let detail=data?.error;
   if(error?.context?.json){try{detail=(await error.context.json()).error||detail}catch(_){}}
   throw Error(detail||error?.message||'Resultado no confirmado');
  }
  return data;
 }finally{clearTimeout(timer)}
}
button.onclick=async()=>{
 if(batchBusy||busy||submitted&&!job)return;
 let fields;
 if(!job){
  const name=get('tnName').value.trim(),sku=get('tnSku').value.trim(),price=get('tnPrice').value.trim(),description=get('tnDesc').value.trim();
  if(!get('tnConsent').checked||name.length<4||!/^[A-Za-z0-9_-]{5,60}$/.test(sku)||!/^\d{1,9}(\.\d{1,2})?$/.test(price)||Number(price)<=0||description.length<20||description.length>30000||photos.length>20){
   reviewed='';button.textContent='Crear producto oculto';
   status.textContent=photos.length>20?'El envío admite hasta 20 fotos.':description.length>30000?'El HTML supera los 30.000 caracteres.':'Revisá nombre, SKU, precio, descripción de al menos 20 caracteres y confirmación.';
   return;
  }
  fields={name,sku,price,description};
  const fingerprint=JSON.stringify(fields);
  if(reviewed!==fingerprint){reviewed=fingerprint;button.textContent='Confirmar envío';status.textContent='Confirmá el envío oculto de '+name+' · SKU '+sku+' · ARS '+price+' · '+photos.length+' fotos.';return}
 }
 busy=true;button.disabled=true;
 try{
  if(!job){
   status.textContent='Preparando fotografías…';
   const images=[];
   for(const file of photos)images.push(await encode(file));
   status.textContent='Creando producto oculto…';submitted=true;
   const data=await invoke({action:'create_hidden',...fields,confirmed:true});
   if(!data?.created||!data.product_id)throw Error('No se confirmó la creación del producto');
   job={id:data.product_id,sku:fields.sku,images,next:0};
  }
  while(job.next<job.images.length){
   const position=job.next+1;
   status.textContent='Producto oculto '+job.id+' · Enviando foto '+position+' de '+job.images.length+'…';
   const data=await invoke({action:'upload_hidden_image',sku:job.sku,position,attachment:job.images[job.next],confirmed:true});
   if(!data?.uploaded)throw Error('No se confirmó la carga de la foto');
   job.next++;
  }
  status.textContent='Producto oculto creado. ID Tiendanube: '+job.id+' · '+job.next+' fotos confirmadas.';
  button.textContent='Envío completado';
 }catch(error){
  status.textContent=job?'Producto oculto '+job.id+' · '+job.next+' de '+job.images.length+' fotos confirmadas. '+error.message+' Revisá la galería antes de continuar.':error.message+(submitted?'. Revisá Tiendanube antes de intentar de nuevo.':'');
  button.textContent=job?'Continuar con fotos pendientes':submitted?'Revisar estado del envío':'Confirmar envío';
 }finally{busy=false;button.disabled=job?job.next===job.images.length:submitted}
};

const batch=document.createElement('section');
batch.style.marginTop='24px';
batch.hidden=true;
batch.innerHTML='<h3>Envío masivo a Tiendanube</h3><p>Revisá las fichas. El SKU es opcional y se completa en cada modelo. Los productos se crean ocultos.</p><div id="tnBatchRows"></div><label><input id="tnBatchConsent" type="checkbox" style="width:auto"> Confirmo enviar los productos de este lote como ocultos</label><button id="tnBatchRun" type="button">Enviar lote oculto</button><p id="tnBatchStatus" role="status"></p>';
get('bulkSection').append(batch);
const batchButton=get('tnBatchRun'),batchStatus=get('tnBatchStatus');
let rows=[],batchStarted=false;
const attemptedReferences=new Set();
get('tnPrepareBatch')?.addEventListener('click',()=>{
 const source=get('tnBatchSourceStatus');
 if(busy||batchBusy||rows.some(row=>row.id&&!row.done)){source.textContent='Terminá el envío en curso antes de preparar otro lote.';return}
 const cards=[...document.querySelectorAll('#bulkResults .catalog-item-select:checked')].map(box=>box.closest('[id^="catalog-item-"]')).filter(Boolean);
 if(!cards.length){source.textContent='Seleccioná al menos un modelo.';return}
 const entries=cards.map(card=>({card,draft:card.tnBatchDraft?.()}));
 if(entries.some(entry=>attemptedReferences.has(entry.draft?.reference))){source.textContent='Hay modelos seleccionados que ya tienen un envío iniciado. Revisá su estado y quitá esos modelos de la selección.';return}
 if(entries.some(entry=>!entry.draft)){source.textContent='Generá una descripción actualizada para cada modelo seleccionado y verificá que sus fotos sigan aprobadas.';return}
 get('tnBatchRows').replaceChildren();
 rows=entries.map(({card,draft})=>{
  const row=document.createElement('div');row.className='panel';row.style.marginBottom='12px';
  const title=document.createElement('strong');title.textContent=draft.name+' · '+draft.photos.length+' fotos';
  const details=document.createElement('p');details.textContent='Precio ARS '+(draft.price||'pendiente')+' · '+(draft.sku?'SKU '+draft.sku:'Sin SKU');
  const note=document.createElement('p');note.setAttribute('role','status');
  row.append(title,details,note);get('tnBatchRows').append(row);
  return {card,draft,note,next:0};
 });
 batchStarted=false;batch.hidden=false;get('tnBatchConsent').checked=false;get('tnBatchConsent').disabled=false;batchButton.disabled=false;batchButton.textContent='Enviar lote oculto';batchStatus.textContent='';
 source.textContent='';
 batch.scrollIntoView({behavior:'smooth',block:'start'});
});
batchButton.onclick=async()=>{
 if(busy||batchBusy||!rows.length)return;
 if(!batchStarted){
  if(!get('tnBatchConsent').checked){batchStatus.textContent='Confirmá el envío del lote para continuar.';return}
  const skus=new Set();let invalid=false;
  for(const row of rows){
   const current=row.card.isConnected&&row.card.tnBatchDraft?.();
   const {name,description,photos}=row.draft;
   const {sku,price,reference}=row.draft;
   const message=attemptedReferences.has(reference)?'Este modelo ya tiene un envío iniciado. Prepará el lote sin este modelo.':!current||current.description!==description||current.sku!==sku||current.price!==price||current.photos.length!==photos.length||current.photos.some((file,index)=>file!==photos[index])?'La ficha cambió. Prepará el lote nuevamente.':
    sku&&(!/^[A-Za-z0-9_-]{5,60}$/.test(sku)||skus.has(sku.toLowerCase()))?'Si cargás un SKU, debe tener entre 5 y 60 caracteres válidos y ser único.':
    !/^\d{1,9}(\.\d{1,2})?$/.test(price)||Number(price)<=0?'Ingresá un precio válido.':
    name.length<4||name.length>180||description.length<20||description.length>30000||photos.length>20?'Revisá nombre, descripción y cantidad de fotos (máximo 20).':'';
   row.note.textContent=message;if(message)invalid=true;
   skus.add(sku.toLowerCase());
   row.fields={name,sku,price,description,reference};
  }
  if(invalid){batchStatus.textContent='Corregí las fichas indicadas antes de enviar.';return}
  batchStarted=true;
  get('tnBatchConsent').disabled=true;
 }
 batchBusy=true;batchButton.disabled=true;
 try{
  for(const row of rows){
   if(row.done||row.uncertain)continue;
   try{
    await sendRow(row);
   }catch(error){
    row.note.textContent=(row.id?'ID '+row.id+' · '+row.next+' fotos confirmadas. ':'')+error.message+(row.uncertain?' Revisá el SKU en Tiendanube antes de reenviar.':'');
   }
  }
 }finally{
  batchBusy=false;
  const complete=rows.filter(row=>row.done).length;
  batchStatus.textContent=complete+' de '+rows.length+' fichas completas.';
  batchButton.disabled=!rows.some(row=>!row.done&&!row.uncertain);
  batchButton.textContent=batchButton.disabled?'Lote procesado':'Reintentar pendientes';
 }
};

async function sendRow(row){
 if(!row.id){
  row.note.textContent='Preparando fotos…';
  row.images=[];
  for(const photo of row.draft.photos)row.images.push(await encode(photo));
  row.note.textContent='Creando producto oculto…';row.uncertain=true;attemptedReferences.add(row.fields.reference);
  const created=await invoke({action:'create_hidden',...row.fields,confirmed:true});
  if(!created?.created||!created.product_id)throw Error('No se confirmó la creación.');
  row.id=created.product_id;row.uncertain=false;
 }
 while(row.next<row.images.length){
  const position=row.next+1;
  row.note.textContent='ID '+row.id+' · Enviando foto '+position+' de '+row.images.length+'…';
  const result=await invoke({action:'upload_hidden_image',sku:row.fields.sku,reference:row.fields.reference,position,attachment:row.images[row.next],confirmed:true});
  if(!result?.uploaded)throw Error('No se confirmó la foto.');
  row.next++;
 }
 row.done=true;row.images=[];
 row.note.textContent='Completo · ID '+row.id+' · '+row.next+' fotos.';
}
const individualRows=new Map();
window.BlackCatalogTiendanube.sendApproved=async(draft,control,note)=>{
 if(busy||batchBusy)return;
 let row=individualRows.get(draft.reference);
 if(row?.done||row?.uncertain)return;
 if(!row){
  if(attemptedReferences.has(draft.reference)){note.textContent='Este modelo ya tiene un envío iniciado. Revisá el estado del lote.';return}
  const {name,sku,price,description,reference,photos}=draft;
  if(name.length<4||name.length>180||description.length<20||description.length>30000||!/^\d{1,9}(\.\d{1,2})?$/.test(price)||Number(price)<=0||(sku&&!/^[A-Za-z0-9_-]{5,60}$/.test(sku))||!photos.length||photos.length>20){
   note.textContent='Revisá el precio, la descripción, las fotos y el SKU si lo completaste.';return;
  }
  row={draft,fields:{name,sku,price,description,reference},next:0};
  individualRows.set(reference,row);
 }
 row.note=note;busy=true;control.disabled=true;
 try{await sendRow(row);control.textContent='Enviado como oculto'}
 catch(error){
  note.textContent=(row.id?'ID '+row.id+' · '+row.next+' fotos confirmadas. ':'')+error.message+(row.uncertain?' Revisá Tiendanube antes de reenviar.':'');
  control.textContent=row.id?'Continuar con fotos pendientes':row.uncertain?'Revisar envío en Tiendanube':'Aprobar y enviar a Tiendanube como oculto';
 }finally{busy=false;control.disabled=Boolean(row.done||row.uncertain);if(!row.id&&!row.uncertain)individualRows.delete(draft.reference)}
};
})();