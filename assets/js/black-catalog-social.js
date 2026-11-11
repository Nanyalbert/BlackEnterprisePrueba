
(() => {
'use strict';
const root=document.getElementById('catalogSocialRoot');
if(!root)return;
const node=(tag,value,className)=>{const result=document.createElement(tag);if(value!==undefined)result.textContent=value;if(className)result.className=className;return result;};
const button=(label,action)=>{const result=node('button',label);result.type='button';result.className='secondary';result.addEventListener('click',action);return result;};
const style=node('style');style.textContent=`
#catalogSocialRoot [hidden]{display:none!important}.rs-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}.rs-controls label{font-size:12px;color:#c4c7d0}.rs-controls input,.rs-controls select{display:block;width:100%;box-sizing:border-box;margin-top:7px}.rs-list{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;margin-top:20px}.rs-piece{min-width:0;border:1px solid #3e4350;border-radius:16px;background:#1a1c22;padding:12px}.rs-piece>img{width:100%;height:auto;display:block;border-radius:10px;background:#000}.rs-piece p,.rs-piece summary{font-size:12px;line-height:1.6}.rs-piece select{width:100%;box-sizing:border-box}.rs-note{font-size:12px;line-height:1.7;color:#c6cbd3}.rs-item{padding:10px 0;border-bottom:1px solid #353943}.rs-piece .actions{display:flex;flex-wrap:wrap;gap:8px}.rs-error{color:#ffb7ab}.rs-piece button{white-space:normal}
@media(max-width:850px){.rs-list{grid-template-columns:repeat(2,minmax(0,1fr))}.rs-controls{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:500px){.rs-list,.rs-controls{grid-template-columns:1fr}}
`;root.append(style,node('h2','RRSS'),node('p','Generá historias y publicaciones con los modelos disponibles de Tiendanube.'));
const controls=node('div',undefined,'rs-controls');
function select(label,options){const box=node('label',label),field=document.createElement('select');for(const [value,text]of options)field.append(new Option(text,value));box.append(field);controls.append(box);return field;}
const brand=select('Marca',[['','Todas las marcas']]);
const category=select('Categoría',[['','Todas las categorías']]);
const grouping=select('Organizar las placas',[['category','Por categoría'],['brand','Por marca']]);
const format=select('Formato',[['story','Historia · 1080 × 1920'],['feed','Publicación · 1080 × 1350']]);
const showNames=select('Nombres de los modelos',[['yes','Mostrar nombres'],['no','Ocultar nombres']]);
const titleLabel=node('label','Título (opcional)'),customTitle=document.createElement('input');customTitle.maxLength=70;customTitle.placeholder='La IA propone un título si lo dejás vacío';titleLabel.append(customTitle);controls.append(titleLabel);
const footerLabel=node('label','Texto inferior (opcional)'),footerText=document.createElement('input');footerText.maxLength=70;footerText.value='BY BLACK ÓPTICA';footerText.placeholder='Ej. 20% OFF · Desde $99.000';footerLabel.append(footerText);controls.append(footerLabel);
const maxPerPiece=select('Modelos por placa',[['6','Hasta 6'],['4','Hasta 4']]);
const progress=node('p','Consultá el stock para cargar las marcas y categorías.','rs-note');progress.setAttribute('role','status');
const stats=node('p','','rs-note'),list=node('div',undefined,'rs-list');
const refresh=button('Consultar stock',()=>loadOptions());
const generate=button('Generar todas las placas',()=>generatePieces());
const stop=button('Detener',()=>{stopping=true;progress.textContent='Se detendrá al terminar la placa actual.';});stop.hidden=true;
const downloadAll=button('Descargar placas listas (ZIP)',()=>exportAll());downloadAll.disabled=true;
const toolbar=node('div',undefined,'actions');toolbar.append(refresh,generate,stop,downloadAll);
root.append(controls,toolbar,progress,stats,list);
let catalog=[],brands=[],pieces=[],busy=false,stopping=false,loaded=false;
const assetCache=new Map(),logoCache=new Map();
const text=value=>value&&typeof value==='object'?String(value.es??Object.values(value)[0]??''):String(value??'');
const normalized=value=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const slug=value=>normalized(value).replace(/ /g,'-').slice(0,65)||'seleccion';
function available(variant){
 if(!variant||variant.visible===false)return false;
 if(variant.inventory_levels?.length)return variant.inventory_levels.some(level=>level.stock===null||Number(level.stock)>0);
 return variant.stock_management===false||variant.stock!==null&&Number(variant.stock)>0;
}
const eligible=product=>product.published===true&&product.requires_shipping!==false&&(product.variants||[]).some(available)&&(product.images||[]).some(photo=>photo.src&&photo.id);
async function api(body){
 let timer;
 try{
  const {data,error}=await Promise.race([
   window.BlackPortal.getSupabase().functions.invoke('black-catalog-tiendanube',{body}),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('La consulta tardó demasiado. Volvé a intentar.')),45000);})
  ]);
  if(error||data?.error){
   let message=data?.error;
   if(error?.context?.json){try{message=(await error.context.json()).error||message;}catch(_){}}
   throw Error(message||error?.message||'No se pudo consultar la tienda.');
  }
  return data;
 }finally{clearTimeout(timer);}
}
function setBusy(value){
 busy=value;
 for(const element of [refresh,generate,brand,category,grouping,format,showNames,customTitle,footerText,maxPerPiece])element.disabled=value;
 for(const select of root.querySelectorAll('.rs-piece select'))select.disabled=value;
 stop.hidden=!value;downloadAll.disabled=value||!pieces.some(piece=>piece.blob);
}
async function readCatalog(){
 const products=[],seen=new Set();let page=1;
 for(;;){
  progress.textContent='Consultando stock · '+products.length+' productos…';
  const data=await api({action:'catalog_list',page});
  if(data.page!==page||!Array.isArray(data.products))throw Error('Tiendanube devolvió una página inesperada.');
  const incoming=data.products.filter(product=>!seen.has(product.id));
  if(data.products.length&&!incoming.length)throw Error('Tiendanube repitió una página. Volvé a consultar.');
  for(const product of incoming){seen.add(product.id);products.push(product);}
  if(!data.has_more||stopping)return products;
  page++;
 }
}
function populate(){
 const previousBrand=brand.value,previousCategory=category.value;
 brand.replaceChildren(new Option('Todas las marcas',''));
 const ready=catalog.filter(eligible);
 for(const name of [...new Set(ready.map(product=>product.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es')))brand.append(new Option(name,name));
 const categories=new Map();
 for(const product of ready)for(const item of product.categories||[])categories.set(String(item.id??item),text(item.name)||'Categoría '+(item.id??item));
 category.replaceChildren(new Option('Todas las categorías',''));
 for(const [id,name]of [...categories].sort((a,b)=>a[1].localeCompare(b[1],'es')))category.append(new Option(name,id));
 brand.value=[...brand.options].some(option=>option.value===previousBrand)?previousBrand:'';
 category.value=[...category.options].some(option=>option.value===previousCategory)?previousCategory:'';
 stats.textContent=ready.length+' modelos publicados con disponibilidad y fotos · '+catalog.length+' productos consultados.';
}
async function loadOptions(){
 if(busy)return;
 stopping=false;setBusy(true);
 try{
  const products=await readCatalog();
  if(stopping){progress.textContent='Consulta detenida. Volvé a consultar para incluir toda la tienda.';return;}
  catalog=products;populate();loaded=true;
  try{brands=(await api({action:'social_options'})).brands||[];}catch(_){brands=[];}
  progress.textContent='Elegí una marca o categoría. Al generar se vuelve a consultar el stock.';
 }catch(error){progress.textContent=error.message;}
 finally{setBusy(false);}
}
function photoFor(product,variant){
 const photos=(product.images||[]).slice().sort((a,b)=>a.position-b.position);
 if(product.variants.length>1&&variant.image_id)return photos.find(photo=>photo.id===variant.image_id)||photos[0];
 return photos.find(photo=>/frente|frontal|front/i.test((photo.alt||'')+' '+photo.src)&&!/perfil|lateral|side/i.test((photo.alt||'')+' '+photo.src))||photos.find(photo=>photo.id===variant.image_id)||photos[0];
}
function makeItem(product){
 const variant=product.variants.find(available),photo=photoFor(product,variant);
 return {product,variantId:variant.id,imageId:photo.id,name:text(product.name),brand:product.brand||'',color:(variant.values||[]).map(text).filter(Boolean).join(' / ')};
}
function bucketFor(product){
 if(grouping.value==='brand')return {key:'brand:'+normalized(product.brand||'Varias marcas'),label:product.brand||'Selección de anteojos'};
 if(category.value){const option=[...category.options].find(option=>option.value===category.value);return {key:'category:'+category.value,label:option?.textContent||'Selección de anteojos'};}
 const primary=(product.categories||[])[0];return primary?{key:'category:'+(primary.id??primary),label:text(primary.name)||'Selección de anteojos'}:{key:'other',label:'Selección de anteojos'};
}
function logoFor(items){
 const names=[...new Set(items.map(item=>normalized(item.brand)).filter(Boolean))];
 if(names.length!==1)return null;
 return brands.find(item=>{
  const aliases=Array.isArray(item.aliases)?item.aliases:String(item.aliases||'').split(',');
  return item.logo&&[item.name,...aliases].some(alias=>normalized(alias)===names[0]);
 })||null;
}
function updateProgress(){
 const ready=pieces.filter(piece=>piece.blob).length;
 progress.textContent=ready+' de '+pieces.length+' placas listas.'+(stopping?' Generación detenida. Podés descargar las listas o volver a generar.':'');
 downloadAll.disabled=busy||ready===0;
}
async function generatePieces(){
 if(busy)return;
 stopping=false;setBusy(true);
 try{
  const selectedBrand=brand.value,selectedCategory=category.value;
  const products=await readCatalog();
  if(stopping){progress.textContent='Generación detenida antes de preparar las placas.';return;}
  catalog=products;populate();loaded=true;
  if(selectedBrand&&!products.some(product=>eligible(product)&&product.brand===selectedBrand)){progress.textContent='Esa marca ya no tiene modelos disponibles con fotos.';return;}
  if(selectedCategory&&!products.some(product=>eligible(product)&&(product.categories||[]).some(item=>String(item.id??item)===selectedCategory))){progress.textContent='Esa categoría ya no tiene modelos disponibles con fotos.';return;}
  brand.value=selectedBrand;category.value=selectedCategory;
  try{brands=(await api({action:'social_options'})).brands||[];}catch(_){brands=[];}
  const selected=products.filter(product=>eligible(product)&&(!selectedBrand||product.brand===selectedBrand)&&(!selectedCategory||(product.categories||[]).some(item=>String(item.id??item)===selectedCategory)));
  const groups=new Map();
  for(const product of selected){const bucket=bucketFor(product);if(!groups.has(bucket.key))groups.set(bucket.key,{...bucket,items:[]});groups.get(bucket.key).items.push(makeItem(product));}
  for(const piece of pieces)if(piece.url)URL.revokeObjectURL(piece.url);
  pieces=[];assetCache.clear();logoCache.clear();list.replaceChildren();
  for(const group of groups.values()){
   if(stopping)break;
   let title=customTitle.value.trim();
   if(!title){
    progress.textContent='Preparando encabezado · '+group.label+'…';
    try{title=(await api({action:'social_title',category:group.label,brand:selectedBrand,models:group.items.slice(0,6).map(item=>item.name)})).title;}
    catch(_){title=group.label;}
   }
   const size=Number(maxPerPiece.value);
   for(let offset=0;offset<group.items.length;offset+=size){
    const items=group.items.slice(offset,offset+size);
    const piece={items,showNames:showNames.value==='yes',title,footer:footerText.value.trim(),logo:customTitle.value.trim()?null:logoFor(items),format:format.value,group:group.label,index:pieces.length+1,checkedAt:new Date()};
    pieces.push(piece);buildPiece(piece);
   }
  }
  if(!pieces.length){progress.textContent='No hay modelos disponibles para esa selección.';return;}
  for(const piece of pieces){
   if(stopping)break;
   progress.textContent='Componiendo placa '+piece.index+' de '+pieces.length+' · '+piece.group+'…';
   await renderPiece(piece);
  }
 }catch(error){progress.textContent=error.message;}
 finally{setBusy(false);if(pieces.length)updateProgress();}
}
function buildPiece(piece){
 const card=node('article',undefined,'rs-piece'),preview=document.createElement('img');preview.alt='Vista previa de '+piece.title;preview.hidden=true;
 const title=node('p',piece.group+' · Placa '+piece.index+' · '+piece.items.length+' modelos');
 const titleLabel=node('label','Título de esta placa'),titleInput=document.createElement('input');titleInput.maxLength=70;titleInput.value=piece.title;titleInput.style.width='100%';titleInput.style.boxSizing='border-box';titleLabel.append(titleInput);
 const footerLabel=node('label','Texto inferior de esta placa'),footerInput=document.createElement('input');footerInput.maxLength=70;footerInput.value=piece.footer;footerInput.style.width='100%';footerInput.style.boxSizing='border-box';footerLabel.append(footerInput);
 const setTitle=button('Aplicar textos',()=>{if(busy||piece.rendering)return;if(!titleInput.value.trim()){piece.note.textContent='Escribí el título que querés usar.';return;}if(piece.title!==titleInput.value.trim())piece.logo=null;piece.title=titleInput.value.trim();piece.footer=footerInput.value.trim();renderPiece(piece);});
 const note=node('p','Pendiente de composición.','rs-note');note.setAttribute('role','status');
 const options=document.createElement('details');options.append(node('summary','Modelos, colores y fotos'));
 for(const item of piece.items){
  const row=node('div',undefined,'rs-item');row.append(node('p',item.name));
  const variants=document.createElement('select');variants.setAttribute('aria-label','Color de '+item.name);
  for(const variant of item.product.variants.filter(available))variants.append(new Option((variant.values||[]).map(text).filter(Boolean).join(' / ')||'Variante única',String(variant.id)));
  variants.value=String(item.variantId);variants.disabled=busy;
  const photos=document.createElement('select');photos.setAttribute('aria-label','Foto frontal de '+item.name);
  photos.disabled=busy;
  const fillPhotos=()=>{
   photos.replaceChildren();
   for(const photo of item.product.images||[])photos.append(new Option('Foto '+photo.position+(photo.alt?' · '+text(photo.alt):''),String(photo.id)));
   photos.value=String(item.imageId);
  };
  fillPhotos();
  variants.addEventListener('change',()=>{if(busy)return;const variant=item.product.variants.find(variant=>variant.id===Number(variants.value));item.variantId=variant.id;item.imageId=photoFor(item.product,variant).id;item.color=(variant.values||[]).map(text).join(' / ');fillPhotos();renderPiece(piece);});
  photos.addEventListener('change',()=>{if(busy)return;item.imageId=Number(photos.value);renderPiece(piece);});
  row.append(variants,photos);options.append(row);
 }
 const namesLabel=node('label','Nombres en esta placa'),namesSelect=document.createElement('select');namesSelect.append(new Option('Mostrar nombres','yes'),new Option('Ocultar nombres','no'));namesSelect.value=piece.showNames?'yes':'no';namesSelect.disabled=busy;namesLabel.append(namesSelect);
 namesSelect.addEventListener('change',()=>{if(busy||piece.rendering)return;piece.showNames=namesSelect.value==='yes';renderPiece(piece);});
 const download=button('Descargar PNG',()=>downloadPiece(piece));
 const retry=button('Volver a componer',()=>{if(!busy)renderPiece(piece);});
 const buttons=node('div',undefined,'actions');buttons.append(download,retry);
 card.append(preview,title,titleLabel,footerLabel,namesLabel,setTitle,note,options,buttons);list.append(card);
 Object.assign(piece,{card,preview,note,download,retry,namesSelect});download.disabled=true;
}
async function loadImage(data){
 const image=new Image();image.src=data;await image.decode();return image;
}
async function getPhoto(item){
 const key=item.product.id+':'+item.variantId+':'+item.imageId;
 if(assetCache.size>=24&&!assetCache.has(key))assetCache.delete(assetCache.keys().next().value);
 if(!assetCache.has(key))assetCache.set(key,api({action:'social_image',productId:item.product.id,variantId:item.variantId,imageId:item.imageId}).then(data=>loadImage(data.image)).catch(error=>{assetCache.delete(key);throw error;}));
 return assetCache.get(key);
}
async function getLogo(brand){
 if(!brand)return null;
 if(!logoCache.has(brand.id))logoCache.set(brand.id,api({action:'social_image',logoId:brand.id}).then(data=>loadImage(data.image)).catch(()=>null));
 return logoCache.get(brand.id);
}
function bounds(image){
 const sample=document.createElement('canvas'),scale=Math.min(1,320/Math.max(image.naturalWidth,image.naturalHeight));
 sample.width=Math.max(1,Math.round(image.naturalWidth*scale));sample.height=Math.max(1,Math.round(image.naturalHeight*scale));
 const ctx=sample.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,sample.width,sample.height);
 const {data}=ctx.getImageData(0,0,sample.width,sample.height);
 let minX=sample.width,minY=sample.height,maxX=-1,maxY=-1;
 for(let y=0;y<sample.height;y++)for(let x=0;x<sample.width;x++){
  const i=(y*sample.width+x)*4;
  if(data[i+3]>30&&Math.min(data[i],data[i+1],data[i+2])<215){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
 }
 if(maxX<0)return {x:0,y:0,w:image.naturalWidth,h:image.naturalHeight};
 const pad=Math.max(3,Math.ceil((maxX-minX)*.035));
 minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(sample.width-1,maxX+pad);maxY=Math.min(sample.height-1,maxY+pad);
 return {x:minX/scale,y:minY/scale,w:(maxX-minX+1)/scale,h:(maxY-minY+1)/scale};
}
function fitText(ctx,value,maxWidth,size,min=15){
 for(let font=size;font>=min;font--){ctx.font='600 '+font+'px Arial,sans-serif';if(ctx.measureText(value).width<=maxWidth)return value;}
 let result=value;while(result&&ctx.measureText(result+'…').width>maxWidth)result=result.slice(0,-1);return result+'…';
}
function drawContained(ctx,image,box,crop=bounds(image)){
 const scale=Math.min(box.w/crop.w,box.h/crop.h),w=crop.w*scale,h=crop.h*scale;
 ctx.drawImage(image,crop.x,crop.y,crop.w,crop.h,box.x+(box.w-w)/2,box.y+(box.h-h)/2,w,h);
}
function whiteLogo(image){
 const crop=bounds(image),canvas=document.createElement('canvas');
 canvas.width=Math.max(1,Math.ceil(crop.w));canvas.height=Math.max(1,Math.ceil(crop.h));
 const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,crop.x,crop.y,crop.w,crop.h,0,0,canvas.width,canvas.height);
 const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
 const darkBackground=(pixels.data[0]+pixels.data[1]+pixels.data[2])/3<100;
 for(let i=0;i<pixels.data.length;i+=4){
  const shade=(pixels.data[i]+pixels.data[i+1]+pixels.data[i+2])/3;
  pixels.data[i+3]=Math.round(pixels.data[i+3]*(darkBackground?Math.min(1,shade/230):1-Math.min(1,shade/230)));
  pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;
 }
 ctx.putImageData(pixels,0,0);return canvas;
}
async function compose(piece){
 const images=[];
 for(const item of piece.items)images.push(await getPhoto(item));
 const logo=await getLogo(piece.logo),canvas=document.createElement('canvas');
 canvas.width=1080;canvas.height=piece.format==='feed'?1350:1920;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#000';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.textAlign='center';ctx.textBaseline='middle';
 const columns=piece.items.length===1?1:piece.format==='feed'&&piece.items.length>=5?3:2;
 const rows=Math.ceil(piece.items.length/columns),gap=28,availableWidth=936,top=piece.format==='feed'?250:310,bottom=canvas.height-220;
 const size=Math.min((availableWidth-gap*(columns-1))/columns,(bottom-top-gap*(rows-1))/rows,piece.items.length===1?700:1000);
 const gridWidth=columns*size+gap*(columns-1),gridHeight=rows*size+gap*(rows-1),startX=(1080-gridWidth)/2,startY=top+(bottom-top-gridHeight)/2;
 if(logo){
  const mark=whiteLogo(logo);const scale=Math.min(420/mark.width,150/mark.height);ctx.drawImage(mark,(1080-mark.width*scale)/2,110,mark.width*scale,mark.height*scale);
 }else{
  ctx.fillStyle='#fff';const title=fitText(ctx,piece.title.toUpperCase(),920,piece.format==='feed'?48:52,25);ctx.fillText(title,540,piece.format==='feed'?145:190);
 }
 for(let index=0;index<piece.items.length;index++){
  const row=Math.floor(index/columns),col=index%columns;
  const lastRowCount=Math.min(columns,piece.items.length-row*columns);
  const offset=(columns-lastRowCount)*(size+gap)/2;
  const x=startX+offset+col*(size+gap),y=startY+row*(size+gap);
  ctx.fillStyle='#fff';ctx.beginPath();ctx.roundRect(x,y,size,size,32);ctx.fill();
  drawContained(ctx,images[index],{x:x+24,y:y+35,w:size-48,h:size-(piece.showNames?110:70)});
  if(piece.showNames){
  ctx.fillStyle='#111';
  const shortName=piece.items[index].name.replace(/anteojos? de (?:sol|receta)/gi,'').split(/[|—]/)[0].trim();
  const label=fitText(ctx,shortName,size-40,22,16);ctx.fillText(label,x+size/2,y+size-38);
  }
 }
 if(piece.footer){ctx.fillStyle='#fff';const footer=fitText(ctx,piece.footer,930,30,18);ctx.fillText(footer,540,canvas.height-105);}
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('No se pudo exportar la placa.')),'image/png'));
}
async function renderPiece(piece){
 if(piece.rendering)return;
 piece.rendering=true;piece.namesSelect.disabled=true;piece.download.disabled=true;piece.retry.disabled=true;piece.blob=null;
 piece.note.textContent='Componiendo las fotos originales…';piece.note.classList.remove('rs-error');
 try{
  const blob=await compose(piece);
  if(piece.url)URL.revokeObjectURL(piece.url);piece.blob=blob;piece.url=URL.createObjectURL(blob);piece.preview.src=piece.url;piece.preview.hidden=false;
  piece.note.textContent='Lista. Revisá las fotos frontales en la vista previa.';piece.download.disabled=false;
 }catch(error){piece.note.textContent=error.message;piece.note.classList.add('rs-error');piece.preview.hidden=true;}
 finally{piece.rendering=false;piece.namesSelect.disabled=busy;piece.retry.disabled=false;if(!busy)updateProgress();}
}
async function validate(piece){
 const result=await api({action:'social_validate',items:piece.items.map(item=>({productId:item.product.id,variantId:item.variantId,imageId:item.imageId}))});
 if(!result.valid){piece.blob=null;piece.download.disabled=true;piece.note.textContent='Cambió la disponibilidad. Volvé a generar para reemplazar los modelos agotados.';throw Error('La placa '+piece.index+' incluye modelos que ya no están disponibles. Volvé a generar.');}
 return result;
}
function saveBlob(blob,name){
 const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
async function downloadPiece(piece){
 if(busy||piece.rendering||!piece.blob)return;
 setBusy(true);piece.download.disabled=true;
 try{await validate(piece);saveBlob(piece.blob,'black-optica-'+slug(piece.group)+'-'+piece.index+'.png');piece.note.textContent='Disponibilidad comprobada antes de descargar.';}
 catch(error){piece.note.textContent=error.message;}
 finally{setBusy(false);piece.download.disabled=!piece.blob;}
}
function zipFiles(files){
 const encoder=new TextEncoder(),parts=[],central=[];let offset=0,totalCentral=0;
 const crc32=bytes=>{let crc=0xffffffff;for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;};
 for(const file of files){
  const name=encoder.encode(file.name),crc=crc32(file.bytes),header=new Uint8Array(30+name.length),view=new DataView(header.buffer);
  view.setUint32(0,0x04034b50,true);view.setUint16(4,20,true);view.setUint16(6,0x800,true);view.setUint32(14,crc,true);view.setUint32(18,file.bytes.length,true);view.setUint32(22,file.bytes.length,true);view.setUint16(26,name.length,true);header.set(name,30);
  parts.push(header,file.bytes);
  const entry=new Uint8Array(46+name.length),entryView=new DataView(entry.buffer);
  entryView.setUint32(0,0x02014b50,true);entryView.setUint16(4,20,true);entryView.setUint16(6,20,true);entryView.setUint16(8,0x800,true);entryView.setUint32(16,crc,true);entryView.setUint32(20,file.bytes.length,true);entryView.setUint32(24,file.bytes.length,true);entryView.setUint16(28,name.length,true);entryView.setUint32(42,offset,true);entry.set(name,46);
  central.push(entry);totalCentral+=entry.length;offset+=header.length+file.bytes.length;
 }
 const end=new Uint8Array(22),view=new DataView(end.buffer);view.setUint32(0,0x06054b50,true);view.setUint16(8,files.length,true);view.setUint16(10,files.length,true);view.setUint32(12,totalCentral,true);view.setUint32(16,offset,true);
 return new Blob([...parts,...central,end],{type:'application/zip'});
}
async function exportAll(){
 if(busy)return;
 const ready=pieces.filter(piece=>piece.blob&&!piece.rendering);
 if(!ready.length)return;
 stopping=false;setBusy(true);
 try{
  const files=[];
  for(const piece of ready){
   if(stopping)throw Error('Descarga detenida. Las placas permanecen en la pantalla.');
   progress.textContent='Comprobando disponibilidad de la placa '+piece.index+'…';
   const checked=await validate(piece);
   files.push({name:slug(piece.group)+'-'+piece.index+'.png',bytes:new Uint8Array(await piece.blob.arrayBuffer())});
  }
  saveBlob(zipFiles(files),'black-optica-rrss-'+new Date().toISOString().slice(0,10)+'.zip');
  progress.textContent=ready.length+' placas descargadas. Stock comprobado antes de exportar.';
 }catch(error){progress.textContent=error.message;}
 finally{setBusy(false);}
}
document.addEventListener('black-catalog:social-open',()=>{if(!loaded&&!busy)loadOptions();});
if(location.hash==='#rrss')loadOptions();
})();
