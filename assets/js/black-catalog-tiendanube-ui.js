(()=>{
'use strict';
const panel=document.getElementById('tiendanubeIntegration');
if(!panel)return;
const form=document.createElement('div');
form.style.marginTop='24px';
form.innerHTML='<h3>Envío individual oculto</h3><p id="tnPhotos">Prueba manual sin fotos. Para incluir fotos aprobadas, prepará el envío desde la ficha generada.</p><label>Nombre confirmado<input id="tnName" maxlength="180"></label><label>SKU único<input id="tnSku" maxlength="60"></label><label>Precio ARS<input id="tnPrice" type="number" min="0.01" step="0.01"></label><label>Descripción HTML revisada<textarea id="tnDesc" rows="7"></textarea></label><label><input id="tnConsent" type="checkbox" style="width:auto"> Confirmo crear este producto oculto</label><div class="actions"><button id="tnSend" type="button">Crear producto oculto</button></div><p id="tnStatus" role="status"></p>';
panel.append(form);
const get=id=>document.getElementById(id),button=get('tnSend'),status=get('tnStatus');
let photos=[],reviewed='',busy=false,submitted=false,job=null;
window.BlackCatalogTiendanube={prepare({name,price,description,photos:approved}){
 document.querySelector('#catalogSidebar [data-tab="integraciones"]')?.click();
 if(busy||job&&job.next<job.images.length){status.textContent='Terminá o revisá primero el envío en curso.';return}
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
 if(busy||submitted&&!job)return;
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
})();
