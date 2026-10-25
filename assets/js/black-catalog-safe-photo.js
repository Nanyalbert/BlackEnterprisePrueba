/* Black Catalog AI — retoque conservador sin generación de producto. */
(function(){
"use strict";
const input=document.getElementById('bulkImages');
const section=document.getElementById('bulkSection');
if(!input||!section)return;
const panel=document.createElement('section');panel.className='panel catalog-safe-editor';
panel.innerHTML='<h3>Estudio fotográfico fiel</h3><p>Sin IA generativa: no redibuja armazones. Limpia únicamente fondos claros conectados con los bordes, no reconstruye la geometría del producto y lo posiciona ligeramente debajo del centro (eje Y: 680 px) en un lienzo de 1200 × 1200, dejando libre la zona superior para los controles de Tiendanube.</p><div class="actions"><button type="button" id="safeRun">Preparar fotos sin redibujar</button><button type="button" class="secondary" id="safeClear">Limpiar resultados</button></div><p id="safeSummary" role="status"></p><div id="safeRows"></div>';
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
 const targetY=680,topMargin=65,bottomMargin=55;
 const maxHeight=2*Math.min(targetY-topMargin,side-bottomMargin-targetY);
 // Detectar el contorno visual, no la caja completa de la fotografía original.
 // Un fondo no blanco o una detección dudosa conserva el encuadre original.
 let left=w,top=h,right=-1,bottom=-1,count=0;
 const step=Math.max(1,Math.floor(Math.min(w,h)/550));
 for(let y=0;y<h;y+=step)for(let x=0;x<w;x+=step){
  const p=(y*w+x)*4,r=d[p],g=d[p+1],b=d[p+2];
  if(Math.min(r,g,b)<222||Math.max(r,g,b)-Math.min(r,g,b)>35){
   left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;
  }
 }
 const reliable=count>20&&right>left&&bottom>top&&(right-left)<w*.96&&(bottom-top)<h*.96;
 const pad=Math.round(Math.min(w,h)*.035);
 const sx=reliable?Math.max(0,left-pad):0,sy=reliable?Math.max(0,top-pad):0;
 const sw=reliable?Math.min(w-sx,right-left+step+pad*2):w,sh=reliable?Math.min(h-sy,bottom-top+step+pad*2):h;
 const fit=Math.min((side-120)/sw,maxHeight/sh)*Math.min(1,options.zoom);
 const dw=Math.round(sw*fit),dh=Math.round(sh*fit),dx=Math.round((side-dw)/2),dy=Math.round(targetY-dh/2);
 oc.drawImage(src,sx,sy,sw,sh,dx,dy,dw,dh);
 return {url:out.toDataURL('image/png'),backgroundSafe:!options.clean||tail>0,cleaned:tail};
}
let active=[];
function reset(){rows.replaceChildren();summary.textContent='';active=[]}
panel.querySelector('#safeClear').onclick=reset;
input.addEventListener('change',reset);
panel.querySelector('#safeRun').onclick=async()=>{
 reset();const files=[...input.files].filter(f=>/^image\/(png|jpeg|webp)$/.test(f.type));
 if(!files.length){summary.textContent='Seleccioná fotografías en la carga masiva.';return}
 summary.textContent='Preparando '+files.length+' fotografías…';
 for(const file of files){
  const row=document.createElement('article');row.className='catalog-compare-row';rows.append(row);
  row.innerHTML='<strong>'+esc(file.name)+'</strong><div class="catalog-photo-compare" style="margin-top:12px"><figure><figcaption>ORIGINAL</figcaption><img class="safeOriginal" alt="Original"></figure><figure><figcaption>RESULTADO FIEL</figcaption><img class="safeResult" alt="Retoque fiel"></figure></div><label>¿Qué querés corregir?</label><textarea class="safeNote" rows="2" placeholder="Ej.: quedó muy chico, fondo blanco irregular, quedó muy grande. No se permite modificar el armazón."></textarea><div class="actions"><button type="button" class="secondary safeRedo">Corregir y regenerar</button><button type="button" class="secondary safeReject">Rechazar resultado</button><button type="button" class="safeApprove">Aprobar y descargar</button></div><small class="safeStatus" role="status"></small>';
  const orig=row.querySelector('.safeOriginal'),result=row.querySelector('.safeResult'),status=row.querySelector('.safeStatus'),note=row.querySelector('.safeNote');
  const objectUrl=URL.createObjectURL(file);orig.src=objectUrl;active.push(objectUrl);
  let img;try{img=await load(file)}catch(e){status.textContent=e.message;continue}
  let approved=false,output='',zoom=1,threshold=242,clean=true;
  function render(){const processed=process(img,{zoom,threshold,clean});output=processed.url;result.src=output;approved=false;status.textContent=processed.cleaned?'Fondo claro periférico procesado. Revisá especialmente cristales transparentes y bordes antes de aprobar.':'No se detectó fondo claro seguro. Se conserva el fondo original; para eliminarlo sin riesgos, fotografiá sobre blanco.';row.querySelector('.safeApprove').textContent='Aprobar y descargar'}
  render();
  row.querySelector('.safeRedo').onclick=()=>{const n=note.value.toLowerCase();if(/más chico|muy grande|alejar|menos zoom/.test(n))zoom=Math.max(.65,zoom-.08);if(/más grande|muy chico|acercar/.test(n))zoom=Math.min(1.18,zoom+.08);if(/fondo|blanco|sombra/.test(n))threshold=Math.max(225,threshold-5);if(/conservar fondo|sin quitar fondo/.test(n))clean=false;render();status.textContent+=' Corrección aplicada solo al encuadre o fondo. No se reinterpretó el producto.'};
  row.querySelector('.safeReject').onclick=()=>{approved=false;status.textContent='Resultado rechazado. Conservamos la fotografía original. Escribí qué corregir y volvé a generar.';row.querySelector('.safeApprove').textContent='Aprobar y descargar'};
  row.querySelector('.safeApprove').onclick=()=>{approved=true;const a=document.createElement('a');a.href=output;a.download=file.name.replace(/\.[^.]+$/,'')+'-fiel-1200.png';a.click();status.textContent='Resultado aprobado y descargado. El archivo original no se modificó.';row.querySelector('.safeApprove').textContent='Aprobado ✓'};
 }
 summary.textContent='Preparadas '+files.length+' fotografías. La aprobación es individual y no publica automáticamente en Tiendanube.';
};
})();
