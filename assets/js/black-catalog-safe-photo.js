/* Black Catalog AI — retoque conservador sin generación de producto. */
(function(){
"use strict";
const input=document.getElementById('bulkImages');
const section=document.getElementById('bulkSection');
if(!input||!section)return;
const panel=document.createElement('section');panel.className='panel catalog-safe-editor';
panel.innerHTML='<h3>Preparación automática de fotografías</h3><p>El sistema prepara las fotografías seleccionadas en 1200 × 1200 px. La versión preparada es la predeterminada, pero siempre ves la original a su lado para comparar. Revisá el encuadre y aprobá antes de agrupar.</p><div class="actions"><button type="button" id="safeRun">Volver a preparar fotografías</button><button type="button" class="secondary" id="safeClear">Limpiar resultados</button></div><p id="safeSummary" role="status"></p><div id="safeRows"></div>';
section.querySelector('#bulkStats').after(panel);
const rows=panel.querySelector('#safeRows'),summary=panel.querySelector('#safeSummary');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const load=file=>new Promise((resolve,reject)=>{const img=new Image(),url=URL.createObjectURL(file);img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('No se pudo abrir la fotografía'))};img.src=url});
function process(img,options){
 const max=1800,scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight)),w=Math.max(1,Math.round(img.naturalWidth*scale)),h=Math.max(1,Math.round(img.naturalHeight*scale));
 const src=document.createElement('canvas');src.width=w;src.height=h;const ctx=src.getContext('2d',{willReadFrequently:true});ctx.drawImage(img,0,0,w,h);
 const pixels=ctx.getImageData(0,0,w,h),d=pixels.data;
 const bright=(x,y)=>{const p=(y*w+x)*4,r=d[p],g=d[p+1],b=d[p+2];return r>=options.threshold&&g>=options.threshold&&b>=options.threshold&&Math.max(r,g,b)-Math.min(r,g,b)<18};
 let mask=new Uint8Array(w*h),queue=new Int32Array(w*h),head=0,tail=0;
 const add=(x,y)=>{const i=y*w+x;if(!mask[i]&&bright(x,y)){mask[i]=1;queue[tail++]=i}};
 if(options.clean){for(let x=0;x<w;x++){add(x,0);add(x,h-1)}for(let y=0;y<h;y++){add(0,y);add(w-1,y)}
 while(head<tail){const i=queue[head++],x=i%w,y=(i-x)/w;if(x>0)add(x-1,y);if(x+1<w)add(x+1,y);if(y>0)add(x,y-1);if(y+1<h)add(x,y+1)}
 for(let i=0;i<mask.length;i++)if(mask[i]){const p=i*4;d[p]=255;d[p+1]=255;d[p+2]=255;d[p+3]=255}
 }
 ctx.putImageData(pixels,0,0);
 // Solo se traslada y escala la imagen completa. No se altera la geometría de ningún componente.
 const side=1200,out=document.createElement('canvas');out.width=side;out.height=side;const oc=out.getContext('2d');oc.fillStyle='#fff';oc.fillRect(0,0,side,side);
 // Tiendanube: centro visual a y=680px (80px por debajo del centro del lienzo), con márgenes seguros.
 const targetY=options.targetY??680;
 // Calcular escala sin depender de la posición vertical.
 // Detectar el producto por contraste contra el fondo, con protección ante bordes y sombras.
 // La imagen original puede tener mucho margen blanco: no usar su caja completa como tamaño del anteojo.
 const threshold=options.clean?220:238;
 const rowCounts=new Uint32Array(h),colCounts=new Uint32Array(w);
 const stride=Math.max(1,Math.floor(Math.max(w,h)/1600));
 for(let y=0;y<h;y+=stride)for(let x=0;x<w;x+=stride){
   const p=(y*w+x)*4,r=d[p],g=d[p+1],b=d[p+2],dark=Math.min(r,g,b)<threshold;
   const colored=Math.max(r,g,b)-Math.min(r,g,b)>20&&Math.min(r,g,b)<248;
   if(dark||colored){rowCounts[y]++;colCounts[x]++}
 }
 // Descartar ruido periférico aislado: exigir evidencia a lo largo de varias filas/columnas.
 const minCol=Math.max(2,Math.round(h/stride*.012)),minRow=Math.max(2,Math.round(w/stride*.012));
 let left=0,right=w-1,top=0,bottom=h-1;
 let x1=colCounts.findIndex(v=>v>=minCol),x2=colCounts.findLastIndex(v=>v>=minCol);
 let y1=rowCounts.findIndex(v=>v>=minRow),y2=rowCounts.findLastIndex(v=>v>=minRow);
 const detected=x1>=0&&x2>x1&&y1>=0&&y2>y1;
 if(detected){left=x1;right=x2;top=y1;bottom=y2}
 const pad=Math.round(Math.min(w,h)*.014);
 const sx=Math.max(0,left-pad),sy=Math.max(0,top-pad);
 const sw=Math.min(w-sx,right-left+1+2*pad),sh=Math.min(h-sy,bottom-top+1+2*pad);
 // El tamaño es independiente de la posición: 82 % del ancho por defecto.
 // Se limita la altura para evitar recortes; la posición vertical no modifica la escala.
 const targetWidth=side*(options.widthPercent??83)/100;
 const fit=Math.min(targetWidth/sw,(side*.90)/sh);
 const dw=Math.round(sw*fit),dh=Math.round(sh*fit),dx=Math.round((side-dw)/2);
 const dy=Math.round(Math.max(0,Math.min(side-dh,targetY-dh/2)));
 oc.drawImage(src,sx,sy,sw,sh,dx,dy,dw,dh);
 return {url:out.toDataURL('image/png'),backgroundSafe:!options.clean||tail>0,cleaned:tail};
}
let active=[],generation=0;
const modal=document.createElement('dialog');modal.className='catalog-safe-lightbox';modal.setAttribute('aria-label','Vista ampliada de fotografía');
modal.innerHTML='<div class="safe-lightbox-head"><strong id="safeLightboxTitle">Vista ampliada</strong><button type="button" class="secondary" id="safeLightboxClose">Cerrar ×</button></div><img id="safeLightboxImage" alt="Fotografía ampliada"><p>Compará los detalles antes de aprobar.</p>';
document.body.append(modal);modal.querySelector('#safeLightboxClose').onclick=()=>modal.close();modal.addEventListener('click',event=>{if(event.target===modal)modal.close()});
function enlarge(url,title){modal.querySelector('#safeLightboxImage').src=url;modal.querySelector('#safeLightboxTitle').textContent=title;modal.showModal()}
const style=document.createElement('style');style.textContent='.catalog-safe-editor .safeOriginal,.catalog-safe-editor .safeResult{cursor:zoom-in}.catalog-safe-editor .safe-controls{display:flex;gap:14px;align-items:center;flex-wrap:wrap;margin:12px 0}.catalog-safe-editor .safe-controls label{flex:1 1 230px;font-size:13px}.catalog-safe-editor .safe-controls input{width:100%;accent-color:#D4C4B5}.catalog-safe-lightbox{width:min(94vw,1080px);max-width:94vw;max-height:94vh;box-sizing:border-box;border:1px solid #5a5a5a;border-radius:16px;padding:18px;background:#151515;color:#fff}.catalog-safe-lightbox::backdrop{background:rgba(0,0,0,.88)}.catalog-safe-lightbox .safe-lightbox-head{display:flex;justify-content:space-between;align-items:center;gap:15px;margin-bottom:14px}.catalog-safe-lightbox img{display:block;width:100%;max-height:75vh;object-fit:contain;background:#fff;border-radius:8px}.catalog-safe-lightbox p{font-size:12px;color:#bbb}.catalog-safe-editor .safePreview{background:#D4C4B5;color:#121212;border-color:#D4C4B5}';style.textContent+='.catalog-safe-editor .catalog-photo-compare{align-items:start}.catalog-safe-editor .catalog-photo-compare figure{min-width:0}.catalog-safe-editor .catalog-photo-compare img{width:100%!important;height:auto!important;aspect-ratio:1/1!important;object-fit:contain!important;background:#fff;border:1px solid #494949;border-radius:12px}.catalog-safe-editor .safe-size-note{color:#bfbfbf;font-size:12px;margin:8px 0 14px}.catalog-safe-editor .safeResult{outline:2px solid #D4C4B5;outline-offset:2px}';document.head.append(style);
function reset(){generation++;rows.replaceChildren();summary.textContent='';for(const u of active)URL.revokeObjectURL(u);active=[]}
panel.querySelector('#safeClear').onclick=reset;
input.addEventListener('change',()=>{reset();if(input.files.length)panel.querySelector('#safeRun').click()});
panel.querySelector('#safeRun').onclick=async()=>{
 reset();const currentGeneration=generation;const files=[...input.files].filter(f=>/^image\/(png|jpeg|webp)$/.test(f.type));
 if(!files.length){summary.textContent='Primero seleccioná fotografías en la etapa de carga. Esta herramienta utiliza exactamente esos archivos.';return}
 summary.textContent='Preparando '+files.length+' fotografías…';
 for(const file of files){
  const row=document.createElement('article');row.className='catalog-compare-row';rows.append(row);
  row.innerHTML='<strong>'+esc(file.name)+'</strong><div class="catalog-photo-compare" style="margin-top:12px"><figure><figcaption>ORIGINAL · REFERENCIA</figcaption><img class="safeOriginal" alt="Original"></figure><figure><figcaption>PREPARADA · SE USARÁ AL APROBAR</figcaption><img class="safeResult" alt="Retoque fiel"></figure></div><div class="safe-controls"><label>Tamaño del armazón <input class="safeWidth" type="range" min="65" max="90" step="1" value="83"></label><span class="safeWidthValue">83 %</span></div><div class="safe-controls"><label>Posición vertical del armazón <input class="safePosition" type="range" min="560" max="760" step="10" value="680"></label><span class="safePositionValue">+80 px</span></div><div class="actions"><button type="button" class="secondary safeReset">Restablecer encuadre</button><button type="button" class="secondary safeAI">Probar fondo de estudio con IA (opcional)</button></div><div class="safe-size-note">Vista previa cuadrada · 1200 × 1200 px · tamaño inicial 83 % del ancho.</div><div class="actions"><button type="button" class="secondary safePreview">Ampliar resultado</button><button type="button" class="secondary safePreviewOriginal">Ampliar original</button></div><label>¿Qué querés corregir?</label><textarea class="safeNote" rows="2" placeholder="Ej.: quedó muy chico, fondo blanco irregular, quedó muy grande. No se permite modificar el armazón."></textarea><div class="actions"><button type="button" class="secondary safeRedo">Aplicar ajustes</button><button type="button" class="safeApprove">Aprobar fotografía preparada</button></div><small class="safeStatus" role="status"></small>';
  const orig=row.querySelector('.safeOriginal'),result=row.querySelector('.safeResult'),status=row.querySelector('.safeStatus'),note=row.querySelector('.safeNote');
  const objectUrl=URL.createObjectURL(file);orig.src=objectUrl;active.push(objectUrl);
  let img;try{img=await load(file)}catch(e){if(currentGeneration===generation)status.textContent=e.message;continue}
  if(currentGeneration!==generation)return;
  let approved=false,output='',threshold=242,clean=true,targetY=680,widthPercent=83;
  const widthControl=row.querySelector('.safeWidth');widthControl.addEventListener('input',()=>{widthPercent=Number(widthControl.value);row.querySelector('.safeWidthValue').textContent=widthPercent+' %';render()});
  row.querySelector('.safeReset').onclick=()=>{widthPercent=83;targetY=680;threshold=242;clean=true;widthControl.value='83';row.querySelector('.safeWidthValue').textContent='83 %';row.querySelector('.safePositionValue').textContent='+80 px';row.querySelector('.safePosition').value='680';note.value='';render();};
  const position=row.querySelector('.safePosition');position.addEventListener('input',()=>{targetY=Number(position.value);row.querySelector('.safePositionValue').textContent=(targetY>=600?'+':'')+(targetY-600)+' px';render()});
  row.querySelector('.safePreview').onclick=()=>enlarge(output,'Resultado ampliado · '+file.name);
  row.querySelector('.safePreviewOriginal').onclick=()=>enlarge(objectUrl,'Fotografía original · '+file.name);
  orig.onclick=()=>enlarge(objectUrl,'Fotografía original · '+file.name);
  result.onclick=()=>enlarge(output,'Resultado ampliado · '+file.name);
  function render(){
   const processed=process(img,{threshold,clean,targetY,widthPercent});
   output=processed.url;result.src=output;approved=false;
   row.dataset.photoReady='true';row.dataset.photoApproved='false';
   document.dispatchEvent(new CustomEvent('black-catalog:photo-dirty',{detail:{originalName:file.name}}));
   row.querySelector('.safeApprove').textContent='Aprobar fotografía preparada';
   status.textContent=processed.cleaned?'Pendiente de aprobación · fondo claro y encuadre preparados. Revisá los bordes y cristales transparentes.':'Pendiente de aprobación · encuadre preparado. No se pudo eliminar todo el fondo con seguridad; revisá la comparación.';
  }
  render();
  // Edición generativa opcional: nunca se ejecuta al preparar el lote.
  // El resultado no se aprueba automáticamente y puede descartarse restaurando el encuadre.
  row.querySelector('.safeAI').onclick=async()=>{
   const aiButton=row.querySelector('.safeAI');
   if(!window.BlackPortal?.getSupabase){status.textContent='La edición IA requiere iniciar sesión en Black OS.';return}
   if(!confirm('La edición con IA consume créditos de API y puede alterar el color de los cristales, logos o detalles del armazón. Se mostrará para revisión y NO se aprobará automáticamente. ¿Querés probarla?'))return;
   aiButton.disabled=true;
   status.textContent='Generando fondo de estudio con IA… Conservaremos el original para comparar.';
   try{
    // Enviar el original: el retoque local no separa el producto de fondos complejos.
    const image=await new Promise((resolve,reject)=>{
     const reader=new FileReader();
     reader.onload=()=>resolve(reader.result);
     reader.onerror=()=>reject(Error('No se pudo leer la fotografía original'));
     reader.readAsDataURL(file);
    });
    if(image.length>9000000)throw Error('La imagen supera el tamaño admitido por el editor IA. Reducí el archivo original antes de volver a intentar.');
    const response=await window.BlackPortal.getSupabase().functions.invoke('black-catalog-photo-edit',{body:{image}});
    if(response.error||response.data?.error)throw Error(response.data?.detail||response.data?.error||response.error?.message||'Error de edición');
    const edited=response.data?.image;
    if(typeof edited!=='string'||!/^data:image\/png;base64,/.test(edited))throw Error('El servicio no devolvió una imagen válida');
    // Mantener la salida aprobable en 1200 × 1200, sin estirar el producto.
    const aiImage=await new Promise((resolve,reject)=>{
     const imageElement=new Image();
     imageElement.onload=()=>resolve(imageElement);
     imageElement.onerror=()=>reject(Error('No se pudo abrir la imagen editada'));
     imageElement.src=edited;
    });
    const canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1200;
    const context=canvas.getContext('2d');
    context.fillStyle='#fff';context.fillRect(0,0,1200,1200);
    const fit=Math.min(1200/aiImage.naturalWidth,1200/aiImage.naturalHeight);
    const dw=aiImage.naturalWidth*fit,dh=aiImage.naturalHeight*fit;
    context.drawImage(aiImage,(1200-dw)/2,(1200-dh)/2,dw,dh);
    output=canvas.toDataURL('image/png');
    result.src=output;
    approved=false;row.dataset.photoReady='true';row.dataset.photoApproved='false';
    document.dispatchEvent(new CustomEvent('black-catalog:photo-dirty',{detail:{originalName:file.name}}));
    row.querySelector('.safeApprove').textContent='Aprobar resultado IA (revisar primero)';
    status.textContent='Resultado IA listo, SIN aprobar. Compará con el original: color exacto de cristales y clip-on, forma, logo, bisagras y cantidad de piezas. Si cambió algo, NO lo apruebes. Usá «Restablecer encuadre» para volver al modo fiel.';
   }catch(error){status.textContent='No se pudo generar el fondo de estudio: '+error.message+'. La preparación fiel sigue disponible.'}
   finally{aiButton.disabled=false}
  };
  row.querySelector('.safeRedo').onclick=()=>{const n=note.value.toLowerCase();if(/más chico|muy grande|alejar|menos zoom/.test(n)){widthPercent=Math.max(65,widthPercent-3);widthControl.value=String(widthPercent)}
  if(/más abajo|bajar|bajalo|más bajo/.test(n)){targetY=Math.min(760,targetY+30);position.value=String(targetY)}
  if(/más arriba|subir|subilo|más alto/.test(n)){targetY=Math.max(560,targetY-30);position.value=String(targetY)}
  row.querySelector('.safePositionValue').textContent=(targetY>=600?'+':'')+(targetY-600)+' px';if(/más grande|muy chico|acercar/.test(n)){widthPercent=Math.min(90,widthPercent+3);widthControl.value=String(widthPercent)}row.querySelector('.safeWidthValue').textContent=widthPercent+' %';if(/limpiar fondo|blanquear fondo|quitar fondo/.test(n)){clean=true;threshold=Math.max(225,threshold-5)}if(/conservar fondo|sin quitar fondo|mantener fondo/.test(n))clean=false;render();status.textContent+=' Corrección aplicada solo al encuadre o fondo. No se reinterpretó el producto.'};
  row._approvePrepared=async()=>{
   const button=row.querySelector('.safeApprove');button.disabled=true;
   try{
     const response=await fetch(output),blob=await response.blob();
     const newName=file.name;
     const approvedFile=new File([blob],newName,{type:'image/png'});
     // El evento vincula el resultado con su ficha en la carga actual, sin alterar el archivo fuente.
     document.dispatchEvent(new CustomEvent('black-catalog:photo-approved',{detail:{originalName:file.name,file:approvedFile,variant:'editada'}}));
     approved=true;row.dataset.photoApproved='true';status.textContent='Aprobada ✓ · se utilizará la versión seleccionada al agrupar. El original sigue disponible como referencia.';
     button.textContent='Fotografía aprobada ✓';
   }catch(error){status.textContent='No se pudo guardar la aprobación: '+error.message}
   finally{button.disabled=false}
  };
  row.querySelector('.safeApprove').onclick=row._approvePrepared;
 }
 if(currentGeneration!==generation)return;
 summary.textContent='Preparadas '+files.length+' fotografías. Compará original y preparada; la preparada es la opción predeterminada. Aprobá todas para pasar a la agrupación.';
};
window.BlackCatalogSafePhoto={
  approveAll:async()=>{const list=[...rows.querySelectorAll('.catalog-compare-row')];if(!list.length)throw Error('Primero cargá fotografías.');for(const row of list){if(row.dataset.photoReady!=='true')throw Error('Todavía hay fotografías procesándose.');if(row.dataset.photoApproved!=='true'){await row._approvePrepared();if(row.dataset.photoApproved!=='true')throw Error('No se pudo aprobar una fotografía.')}}return true},
  count:()=>({total:rows.querySelectorAll('.catalog-compare-row').length,approved:rows.querySelectorAll('[data-photo-approved="true"]').length})
};
})();
