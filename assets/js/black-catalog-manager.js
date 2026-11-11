
(() => {
'use strict';
const root = document.getElementById('catalogManagerRoot');
if (!root) return;
const styles = document.createElement('style');
styles.textContent = `
.cm-toolbar{display:grid;grid-template-columns:2fr repeat(4,minmax(110px,1fr));gap:12px;align-items:end}
.cm-toolbar label,.cm-form label{display:block;font-size:12px;color:#c8ccd3}
.cm-toolbar input,.cm-toolbar select,.cm-form input,.cm-form select,.cm-form textarea{box-sizing:border-box;width:100%}
.cm-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:18px 0}
.cm-card{background:#1c1e23;border:1px solid #383c46;border-radius:16px;overflow:hidden}
.cm-card>img{display:block;width:100%;height:165px;object-fit:contain;background:#fff}
.cm-card-body{padding:14px}.cm-card h3{margin:9px 0;font-size:15px;line-height:1.45}
.cm-card p{font-size:12px;color:#c1c4cc;margin:7px 0}
.cm-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.cm-chip{padding:4px 9px;border-radius:20px;background:#30343d;font-size:11px;color:#d8dbe1}
.cm-card:has(input:checked){border-color:#c9ad72;box-shadow:0 0 0 1px #c9ad72}
.cm-detail,.cm-bulk,.cm-plan{border:1px solid #454955;border-radius:16px;background:#1b1d22;padding:20px;margin:18px 0}
.cm-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.cm-wide{grid-column:1/-1}
.cm-gallery{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}
.cm-gallery figure{margin:0}.cm-gallery img{width:100%;height:135px;object-fit:contain;background:#fff;border-radius:10px}
.cm-gallery figcaption{font-size:11px;color:#c4c6cc;line-height:1.5}
.cm-variant{border:1px solid #3d414d;border-radius:12px;padding:15px;margin:14px 0}
.cm-variant legend{padding:0 7px;font-size:13px}
.cm-preview{width:100%;height:420px;background:#fff;border:1px solid #424650;border-radius:10px}
.cm-plan li{margin:8px 0;overflow-wrap:anywhere}.cm-plan pre{white-space:pre-wrap;max-height:220px;overflow:auto}
.cm-error{color:#ffb1a8}.cm-note{color:#bcc2cf;font-size:12px;line-height:1.7}
.cm-result{font-size:13px;margin:12px 0}
@media(max-width:850px){.cm-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cm-toolbar{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:500px){.cm-grid{grid-template-columns:1fr}.cm-form{grid-template-columns:1fr}.cm-detail,.cm-bulk,.cm-plan{padding:14px}.cm-toolbar{grid-template-columns:1fr 1fr}.cm-search{grid-column:1/-1}}
`;
root.append(styles);
const el = (tag, text, className) => {
 const node = document.createElement(tag);
 if (text !== undefined) node.textContent = text;
 if (className) node.className = className;
 return node;
};
const actions = (...buttons) => { const box=el('div',undefined,'actions'); box.append(...buttons); return box; };
const button = (label, fn, secondary=true) => {
 const node=el('button',label); node.type='button';
 if (secondary) node.className='secondary';
 node.addEventListener('click',fn);
 return node;
};
const text = value => value && typeof value==='object' ? String(value.es ?? Object.values(value)[0] ?? '') : String(value ?? '');
const money = value => value === null || value === undefined || value === '' ? 'Sin precio' : Number(value).toLocaleString('es-AR',{style:'currency',currency:'ARS'});
const safeUrl = value => { try { const url=new URL(value);return ['https:','http:'].includes(url.protocol)?url.href:''; } catch { return ''; } };
const norm = value => String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const ids = product => (product.categories||[]).map(category=>Number(category?.id??category)).filter(Number.isSafeInteger).sort((a,b)=>a-b);
const heading = el('div');
heading.append(el('h2','Catálogo de Tiendanube'),el('p','Consultá los productos de tu tienda, revisá sus fotos y editá una ficha o varios productos juntos.'));
const mainStatus = el('p','Abrí esta sección para consultar Tiendanube.','cm-note');
mainStatus.setAttribute('role','status');
const toolbar=el('div',undefined,'cm-toolbar');
function inputField(container,label,value='',kind='text',max){
 const wrapper=el('label',label),field=document.createElement(kind==='textarea'?'textarea':'input');
 if (kind!=='textarea') field.type=kind;
 field.value=String(value??'');
 if(max)field.maxLength=max;
 wrapper.append(field);container.append(wrapper);return field;
}
function selectField(container,label,options,value=''){
 const wrapper=el('label',label),field=document.createElement('select');
 for(const [id,name] of options)field.append(new Option(name,String(id)));
 field.value=String(value);wrapper.append(field);container.append(wrapper);return field;
}
const search=inputField(toolbar,'Buscar nombre, marca, SKU, tags o ID');
search.parentElement.className='cm-search';
search.placeholder='Ej. Vulk Climber';
const brand=selectField(toolbar,'Marca',[['','Todas las marcas']]);
const category=selectField(toolbar,'Categoría',[['','Todas las categorías']]);
const visibility=selectField(toolbar,'Visibilidad',[['','Todas'],['true','Publicado'],['false','Oculto']]);
const pending=selectField(toolbar,'Pendientes',[['','Todos'],['photos','Sin fotos'],['category','Sin categoría'],['stock','Sin stock']]);
const selectionStatus=el('p','','cm-note');
selectionStatus.setAttribute('role','status');
const grid=el('div',undefined,'cm-grid');
const details=el('div'),bulkHost=el('div'),planHost=el('div');
const cardPageSize=60;
let cardLimit=cardPageSize;
let products=[],page=0,hasMore=true,loaded=false,loading=false,writing=false,stopLoading=false,opening=0;
let categories=[],categoriesLoaded=false,visible=[],editorDirty=false,currentPlan=null,bulkDirty=false;
const selected=new Set();
const reload=button('Actualizar desde Tiendanube',()=>load(true));
const resume=button('Continuar carga',()=>load(false));resume.hidden=true;
const showMore=button('Mostrar más resultados',()=>{cardLimit+=cardPageSize;render();});showMore.hidden=true;
const stop=button('Detener carga',()=>{stopLoading=true;});stop.hidden=true;
const selectVisible=button('Seleccionar coincidencias',()=>{visible.forEach(product=>selected.add(product.id));render();});
const clear=button('Quitar selección',()=>{selected.clear();render();});
const editSelected=button('Editar seleccionados',openBulk,false);
root.append(heading,toolbar,actions(reload,resume,stop),mainStatus,actions(selectVisible,clear,editSelected),selectionStatus,grid,actions(showMore),bulkHost,details,planHost);
async function api(body){
 let timer;
 try {
  const sb=window.BlackPortal?.getSupabase();
  if(!sb)throw Error('La sesión todavía no está disponible. Volvé a abrir la sección.');
  const {data,error}=await Promise.race([
   sb.functions.invoke('black-catalog-tiendanube',{body}),
   new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Tiendanube no respondió a tiempo. Actualizá el producto para verificar el resultado.')),45000);})
  ]);
  if(error||data?.error){
   let message=data?.error;
   if(error?.context?.json){try{message=(await error.context.json()).error||message;}catch(_){}}
   throw Error(message||error?.message||'No se pudo completar la operación.');
  }
  return data;
 } finally {clearTimeout(timer);}
}
function filterOptions(){
 const previousBrand=brand.value,previousCategory=category.value;
 brand.replaceChildren(new Option('Todas las marcas',''));
 const names=[...new Set(products.map(product=>product.brand).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'es'));
 if(products.some(product=>!product.brand))brand.append(new Option('Sin marca','__empty'));
 for(const name of names)brand.append(new Option(name,name));
 brand.value=[...brand.options].some(option=>option.value===previousBrand)?previousBrand:'';
 category.replaceChildren(new Option('Todas las categorías',''));
 const map=new Map(categories.map(item=>[item.id,item.name]));
 for(const product of products)for(const item of product.categories||[])map.set(Number(item.id??item),text(item.name)||map.get(Number(item.id??item))||String(item.id??item));
 for(const [id,name] of [...map].sort((a,b)=>a[1].localeCompare(b[1],'es')))category.append(new Option(name,String(id)));
 category.value=[...category.options].some(option=>option.value===previousCategory)?previousCategory:'';
}
function render(){
 const query=norm(search.value.trim());
 visible=products.filter(product=>{
  const haystack=norm([text(product.name),product.brand,product.tags,product.id,...(product.variants||[]).flatMap(item=>[item.sku,item.barcode,text(item.values?.[0])])].join(' '));
  const variants=product.variants||[];
  const matchesPending=!pending.value||
   pending.value==='photos'&&!(product.images||[]).some(photo=>safeUrl(photo.src))||
   pending.value==='category'&&!ids(product).length||
   pending.value==='stock'&&variants.length>0&&variants.every(variant=>variant.stock_management===true&&variant.stock!=null&&Number(variant.stock)===0);
  return matchesPending&&(!query||haystack.includes(query))&&(!brand.value||(brand.value==='__empty'?!product.brand:product.brand===brand.value))&&
   (!category.value||ids(product).includes(Number(category.value)))&&(!visibility.value||String(product.published)===visibility.value);
 });
 grid.replaceChildren();
 for(const product of visible.slice(0,cardLimit)){
  const card=el('article',undefined,'cm-card');
  const photo=(product.images||[]).slice().sort((a,b)=>a.position-b.position)[0];
  if(photo&&safeUrl(photo.src)){
   const img=document.createElement('img');img.src=safeUrl(photo.src);img.alt=text(photo.alt)||text(product.name);img.loading='lazy';card.append(img);
  }
  const body=el('div',undefined,'cm-card-body'),top=el('div',undefined,'cm-row'),label=el('label');
  const check=document.createElement('input');check.type='checkbox';check.style.width='auto';check.checked=selected.has(product.id);
  check.setAttribute('aria-label','Seleccionar '+text(product.name));
  check.addEventListener('change',()=>{check.checked?selected.add(product.id):selected.delete(product.id);selectionStatus.textContent=selected.size+' seleccionados · '+visible.length+' coincidencias · '+Math.min(cardLimit,visible.length)+' en pantalla de '+products.length+' productos cargados.';});
  label.append(check,document.createTextNode(' Seleccionar'));top.append(label,el('span',product.published?'Publicado':'Oculto','cm-chip'));
  body.append(top,el('h3',text(product.name)||'Sin nombre'),el('p',(product.brand||'Sin marca')+' · ID '+product.id));
  const variants=product.variants||[],prices=variants.map(item=>item.price).filter(value=>value!==null&&value!==undefined);
  body.append(el('p',prices.length?(new Set(prices.map(Number)).size>1?'Desde ':'')+money(Math.min(...prices.map(Number))):'Sin precio'));
  const stock=variants.some(item=>item.stock_management===false)?'Incluye stock ilimitado':variants.reduce((total,item)=>total+Number(item.stock||0),0)+' unidades';
  body.append(el('p',variants.length+' variantes · '+stock),el('p',(product.images||[]).length+' fotos · '+(product.categories||[]).map(item=>text(item.name)||categories.find(category=>category.id===Number(item.id??item))?.name||item.id||item).join(' / ')));
  body.append(button('Ver y editar',()=>openEditor(product.id),false));card.append(body);grid.append(card);
 }
 if(!visible.length)grid.append(el('p',products.length?'No hay coincidencias entre los productos cargados.':'No se encontraron productos.','cm-note'));
 selectionStatus.textContent=selected.size+' seleccionados · '+visible.length+' coincidencias · '+Math.min(cardLimit,visible.length)+' en pantalla de '+products.length+' productos cargados.';
 resume.hidden=loading||!hasMore;
 showMore.hidden=visible.length<=cardLimit;
 for(const control of [reload,resume,selectVisible,clear,editSelected])control.disabled=loading||writing;
}
async function load(reset){
 if(loading||writing)return;
 if(reset&&(editorDirty||bulkDirty||currentPlan)){mainStatus.textContent='Cerrá la edición y descartá la revisión pendiente antes de actualizar.';return;}
 loading=true;stopLoading=false;stop.hidden=false;mainStatus.classList.remove('cm-error');render();
 try {
  if(!categoriesLoaded){
   try{categories=(await api({action:'list_categories'})).categories||[];categoriesLoaded=true;}
   catch(error){mainStatus.textContent=error.message;}
  }
  if(reset){products=[];selected.clear();page=0;hasMore=true;cardLimit=cardPageSize;}
  do {
   if(!hasMore)break;
   mainStatus.textContent='Consultando Tiendanube · '+products.length+' productos cargados…';
   const data=await api({action:'catalog_list',page:page+1});
   if(data.page!==page+1||!Array.isArray(data.products))throw Error('Tiendanube devolvió una página inesperada. Continuá la carga para reintentar.');
   const known=new Set(products.map(product=>product.id));
   const incoming=data.products.filter(product=>{
    if(known.has(product.id))return false;
    known.add(product.id);return true;
   });
   if(data.products.length&&!incoming.length)throw Error('Tiendanube repitió una página. Continuá la carga para reintentar.');
   products.push(...incoming);
   page=data.page;hasMore=data.has_more;loaded=true;filterOptions();render();
  }while(hasMore&&!stopLoading);
  mainStatus.textContent=products.length+' productos cargados desde Tiendanube. '+(hasMore?'Carga pausada. Usá Continuar carga para incluir los productos restantes.':'Catálogo completo cargado.');
 }catch(error){mainStatus.textContent=products.length+' productos cargados. '+error.message+' Usá Continuar carga para retomar.';mainStatus.classList.add('cm-error');}
 finally{loading=false;stop.hidden=true;render();}
}
function categoryOptions(current){
 const known=new Map(categories.map(item=>[item.id,item.name]));
 for(const item of current.categories||[]){const id=Number(item?.id??item);if(!known.has(id))known.set(id,text(item?.name)||'Categoría '+id);}
 return [...known].sort((a,b)=>a[1].localeCompare(b[1],'es'));
}
function same(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function addChange(patch,changes,key,before,after,label){
 if(same(before,after))return;
 patch[key]=after;changes.push({label,before,after});
}
function numberValue(value,label,nullable=false){
 if(value===''&&nullable)return null;
 if(!/^\d{1,9}(\.\d{1,4})?$/.test(value)||Number(value)<0)throw Error('Revisá '+label+'.');
 return value;
}
function stockValue(value){
 if(value==='')return '';
 if(!/^\d{1,9}$/.test(value))throw Error('El stock debe ser un número entero o vacío para ilimitado.');
 return Number(value);
}
function stockBefore(variant){return variant.stock_management===false?'':Number(variant.stock??0);}
async function openEditor(id){
 if(writing)return;
 if(editorDirty||bulkDirty||currentPlan){mainStatus.textContent='Terminá o descartá la edición actual antes de abrir otro producto.';return;}
 bulkHost.replaceChildren();const request=++opening;
 details.replaceChildren(el('p','Cargando ficha…','cm-note'));details.scrollIntoView({behavior:'smooth',block:'start'});
 try{const data=await api({action:'catalog_get',id});if(request===opening)buildEditor(data);}
 catch(error){if(request===opening)details.replaceChildren(el('p',error.message,'cm-error'));}
}
function buildEditor(data){
 const product=data.product;editorDirty=false;
 details.replaceChildren();const panel=el('section',undefined,'cm-detail');
 const top=el('div',undefined,'cm-row');top.append(el('h3',text(product.name)),button('Cerrar ficha',()=>{
  if(editorDirty){editorDirty=false;top.lastChild.textContent='Descartar y cerrar';return;}
  details.replaceChildren();
 }));
 panel.append(top,el('p','ID '+product.id+' · Actualizado '+(product.updated_at||'—'),'cm-note'));
 const gallery=el('div',undefined,'cm-gallery');
 for(const photo of (product.images||[]).slice().sort((a,b)=>a.position-b.position)){
  const figure=el('figure'),link=document.createElement('a'),img=document.createElement('img');
  const src=safeUrl(photo.src);if(!src)continue;
  link.href=src;link.target='_blank';link.rel='noopener noreferrer';img.src=src;img.alt=text(photo.alt)||text(product.name);img.loading='lazy';link.append(img);
  figure.append(link,el('figcaption','Foto '+photo.position+(photo.alt?' · '+text(photo.alt):'')));gallery.append(figure);
 }
 panel.append(gallery,el('h4','Datos del producto'));
 const form=el('div',undefined,'cm-form'),controls={};
 controls.name=inputField(form,'Nombre',text(product.name),'text',180);
 controls.brand=inputField(form,'Marca',product.brand||'','text',120);
 controls.tags=inputField(form,'Tags separados por comas',product.tags||'','text',400);
 controls.published=selectField(form,'Visibilidad',[['false','Oculto'],['true','Publicado']],String(product.published));
 controls.seo_title=inputField(form,'Título SEO',text(product.seo_title),'text',70);
 controls.seo_description=inputField(form,'Descripción SEO',text(product.seo_description),'textarea',320);
 controls.handle=inputField(form,'URL del producto',text(product.handle),'text',180);
 controls.free_shipping=selectField(form,'Envío gratis',[['false','Desactivado'],['true','Activado']],String(Boolean(product.free_shipping)));
 const categoryBox=el('fieldset');categoryBox.className='cm-wide';categoryBox.append(el('legend','Categorías'));
 const categoryChecks=new Map();
 for(const [id,name] of categoryOptions(product)){
  const label=el('label'),check=document.createElement('input');check.type='checkbox';check.style.width='auto';check.checked=ids(product).includes(id);
  label.append(check,document.createTextNode(' '+name));categoryBox.append(label);categoryChecks.set(id,check);
 }
 if(!categoryChecks.size)categoryBox.append(el('p','No hay categorías disponibles. Actualizá el catálogo para volver a consultarlas.','cm-note'));
 form.append(categoryBox);
 controls.description=inputField(form,'Descripción HTML',text(product.description),'textarea',250000);controls.description.rows=10;controls.description.parentElement.className='cm-wide';
 panel.append(form);
 const preview=document.createElement('iframe');preview.sandbox='';preview.title='Vista previa de la descripción';preview.className='cm-preview';preview.srcdoc=controls.description.value;
 panel.append(actions(button('Actualizar vista previa',()=>{preview.srcdoc=controls.description.value;})),preview,el('h4','Variantes, inventario y envío'));
 const aiPanel=el('section',undefined,'cm-variant');
 aiPanel.append(el('h4','Actualizar textos con IA'),el('p','La IA usa los datos y hasta tres fotos de la ficha guardada. Elegí qué sugerencias llevar al editor y revisá los cambios antes de guardarlos.','cm-note'));
 const aiNotes=inputField(aiPanel,'Indicaciones para la redacción (opcional)','','textarea',2000);
 aiNotes.placeholder='Ej. Actualizar el tono de la descripción y conservar los datos técnicos.';
 const aiStatus=el('p','','cm-note');aiStatus.setAttribute('role','status');
 const aiResults=el('div');
 const generateAI=button('Generar propuesta con IA',async()=>{
  if(writing||currentPlan)return;
  writing=true;generateAI.disabled=true;render();aiStatus.textContent='Analizando la ficha y sus fotos…';aiResults.replaceChildren();
  try{
   const result=await api({action:'catalog_suggest',id:product.id,revision:data.revision,notes:aiNotes.value});
   if(!panel.isConnected)return;
   if(result.revision!==data.revision||!result.proposal)throw Error('La ficha cambió. Volvé a abrirla antes de aplicar sugerencias.');
   const labels={description:'Descripción',seo_title:'Título SEO',seo_description:'Descripción SEO',tags:'Tags',name:'Nombre'};
   const chosen=new Map();
   for(const key of ['description','seo_title','seo_description','tags','name']){
    const value=result.proposal[key];if(typeof value!=='string'||!value.trim())continue;
    const wrapper=el('details');wrapper.open=key==='description';
    wrapper.append(el('summary',labels[key]));
    const label=el('label'),check=document.createElement('input');check.type='checkbox';check.style.width='auto';check.checked=key!=='name';
    label.append(check,document.createTextNode(' Usar esta propuesta'));wrapper.append(label);chosen.set(key,{check,value});
    if(key==='description'){
     const frames=el('div',undefined,'cm-form');
     for(const [title,html] of [['Texto actual',controls.description.value],['Propuesta IA',value]]){
      const holder=el('div');holder.append(el('p',title,'cm-note'));
      const frame=document.createElement('iframe');frame.sandbox='';frame.title=title;frame.className='cm-preview';frame.srcdoc=html;holder.append(frame);frames.append(holder);
     }
     wrapper.append(frames);
    }else{
     wrapper.append(el('p','Actual · '+controls[key].value,'cm-note'),el('p','Propuesta · '+value));
    }
    aiResults.append(wrapper);
   }
   if(result.cautions?.length){
    const list=el('ul');for(const caution of result.cautions)list.append(el('li',String(caution)));
    aiResults.append(el('h4','Revisar antes de aplicar'),list);
   }
   aiResults.append(button('Usar textos seleccionados en el editor',()=>{
    if(writing||currentPlan)return;
    let count=0;
    for(const [key,{check,value}] of chosen)if(check.checked){controls[key].value=value;count++;}
    if(!count){aiStatus.textContent='Elegí al menos una propuesta.';return;}
    editorDirty=true;preview.srcdoc=controls.description.value;
    aiStatus.textContent='Propuestas incorporadas al editor. Pulsá Revisar cambios antes de guardar para confirmarlas.';
   },false));
   aiStatus.textContent='Propuesta lista para comparar.';
  }catch(error){aiStatus.textContent=error.message;}
  finally{writing=false;generateAI.disabled=false;render();}
 },false);
 aiPanel.append(actions(generateAI),aiStatus,aiResults);panel.append(aiPanel);

 const variantForms=[];
 for(const variant of product.variants||[]){
  const box=el('fieldset',undefined,'cm-variant'),title=(variant.values||[]).map(text).filter(Boolean).join(' · ')||'Variante única';
  box.append(el('legend',title+' · ID '+variant.id));const fields=el('div',undefined,'cm-form'),inputs={};
  for(const [key,label] of [['price','Precio ARS'],['promotional_price','Precio promocional ARS'],['cost','Costo ARS'],['sku','SKU'],['barcode','Código de barras'],['mpn','MPN'],['weight','Peso kg'],['depth','Profundidad cm'],['width','Ancho cm'],['height','Alto cm']]){
   inputs[key]=inputField(fields,label,variant[key]??'','text',100);
   if(!['sku','barcode','mpn'].includes(key))inputs[key].inputMode='decimal';
  }
  const locations=[];
  if(variant.inventory_levels?.length){
   for(const level of variant.inventory_levels){
    const field=inputField(fields,'Stock · ubicación '+level.location_id,level.stock??'','text',9);field.inputMode='numeric';
    locations.push({level,field});
   }
  }else{
   inputs.stock=inputField(fields,'Stock (vacío = ilimitado)',variant.stock_management===false?'':variant.stock??'','text',9);inputs.stock.inputMode='numeric';
  }
  fields.append(el('p','El stock ingresado reemplaza la cantidad de esa variante o ubicación.','cm-note'));
  box.append(fields);panel.append(box);variantForms.push({variant,inputs,locations,title});
 }
 const extra=el('details');extra.append(el('summary','Más información'));
 const facts=[['Creado',product.created_at],['Actualizado',product.updated_at],['Tipo',product.requires_shipping===false?'Digital':'Físico'],['URL',product.canonical_url],['Atributos',(product.attributes||[]).map(text).join(', ')]];
 for(const [label,value] of facts)if(value)extra.append(el('p',label+' · '+value,'cm-note'));
 for(const variant of product.variants||[])for(const key of ['gender','age_group','visible'])if(variant[key]!==undefined&&variant[key]!==null)extra.append(el('p','Variante '+variant.id+' · '+({gender:'Género',age_group:'Rango de edad',visible:'Visible'})[key]+' · '+variant[key],'cm-note'));
 panel.append(extra);
 panel.addEventListener('input',()=>{editorDirty=true;});panel.addEventListener('change',()=>{editorDirty=true;});
 const note=el('p','','cm-note');note.setAttribute('role','status');
 panel.append(actions(button('Revisar cambios antes de guardar',()=>{
  try{
   if(writing)return;
   if(currentPlan)throw Error('Descartá primero la revisión pendiente.');
   const patch={},changes=[],variants=[];
   for(const key of ['name','brand','tags','seo_title','seo_description','handle','description']){
    const before=key==='brand'||key==='tags'?String(product[key]||''):text(product[key]);
    const after=controls[key].value;
    if(key==='name'&&!after.trim())throw Error('Completá el nombre.');
    if(key==='handle'&&before!==after&&!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(after))throw Error('Revisá la URL del producto.');
    addChange(patch,changes,key,before,after,({name:'Nombre',brand:'Marca',tags:'Tags',seo_title:'Título SEO',seo_description:'Descripción SEO',handle:'URL',description:'Descripción HTML'})[key]);
   }
   for(const key of ['published','free_shipping'])addChange(patch,changes,key,Boolean(product[key]),controls[key].value==='true',key==='published'?'Publicado':'Envío gratis');
   addChange(patch,changes,'categories',ids(product),[...categoryChecks].filter(([,check])=>check.checked).map(([id])=>id).sort((a,b)=>a-b),'IDs de categorías');
   for(const {variant,inputs,locations,title} of variantForms){
    const update={id:variant.id},variantChanges=[];
    for(const [key,input] of Object.entries(inputs)){
     let before=variant[key]??'',after=input.value;
     if(key==='stock'){before=stockBefore(variant);after=stockValue(after);}
     else if(!['sku','barcode','mpn'].includes(key)){
      if(String(before)===after)continue;
      after=numberValue(after,key,key!=='price');
      if(after!==null&&before!==''&&Number(before)===Number(after))continue;
     }
     addChange(update,variantChanges,key,before,after,title+' · '+({price:'Precio',promotional_price:'Promoción',cost:'Costo',sku:'SKU',barcode:'Código de barras',mpn:'MPN',stock:'Stock',weight:'Peso',depth:'Profundidad',width:'Ancho',height:'Alto'})[key]);
    }
    const levels=[];
    for(const {level,field} of locations){
     const before=level.stock===null?'':Number(level.stock),after=stockValue(field.value);
     if(before!==after){levels.push({location_id:level.location_id,stock:after});variantChanges.push({label:title+' · stock ubicación '+level.location_id,before,after});}
    }
    if(levels.length)update.inventory_levels=levels;
    if(Object.keys(update).length>1){variants.push(update);changes.push(...variantChanges);}
   }
   if(variants.length>100)throw Error('Podés guardar hasta 100 variantes por producto en una revisión.');
   if(!changes.length)throw Error('No hay cambios para guardar.');
   showPlan([{id:product.id,name:text(product.name),revision:data.revision,changes:patch,variants,preview:changes}],()=>{note.textContent='Revisión descartada. Podés seguir editando la ficha.';});
  }catch(error){note.textContent=error.message;}
 },false)),note);
 details.append(panel);
 const link=safeUrl(product.canonical_url);
 if(link){const anchor=el('a','Ver producto en la tienda');anchor.href=link;anchor.target='_blank';anchor.rel='noopener noreferrer';panel.append(anchor);}
}
function openBulk(){
 if(writing||loading)return;
 if(editorDirty||bulkDirty||currentPlan){mainStatus.textContent='Terminá o descartá la edición actual antes de preparar otra.';return;}
 if(!selected.size){mainStatus.textContent='Seleccioná al menos un producto.';return;}
 opening++;details.replaceChildren();editorId=null;
 bulkHost.replaceChildren();const panel=el('section',undefined,'cm-bulk');
 panel.append(el('h3','Editar '+selected.size+' productos seleccionados'),el('p','Los campos que actives se aplicarán a todos los seleccionados, incluso si algún filtro los oculta. El precio y stock se aplican a cada una de sus variantes.','cm-note'));
 const form=el('div',undefined,'cm-form'),settings={};
 function setting(key,label,type,options){
  const container=el('div'),labelNode=el('label'),enabled=document.createElement('input');enabled.type='checkbox';enabled.style.width='auto';labelNode.append(enabled,document.createTextNode(' Modificar '+label));container.append(labelNode);
  const input=options?selectField(container,label,options):inputField(container,label,'',type);form.append(container);settings[key]={enabled,input};
 }
 setting('price','Precio ARS','text');
 setting('stock','Stock por variante','text');
 setting('brand','Marca','text');
 setting('tags','Tags (reemplazar listado)','text');
 setting('seo_title','Título SEO','text');
 setting('seo_description','Descripción SEO','textarea');
 setting('published','Visibilidad','text',[['false','Oculto'],['true','Publicado']]);
 setting('category','Categoría (reemplazar categorías)','text',[['','Sin categoría'],...categories.map(item=>[item.id,item.name])]);
 panel.append(form,el('p','Podés usar {nombre} y {marca} en los textos SEO. El stock reemplaza la cantidad actual. Las variantes con inventario por ubicación se editan desde su ficha individual.','cm-note'));
 const note=el('p','','cm-note');note.setAttribute('role','status');
 const prepare=button('Revisar cambios del lote',async()=>{
  if(writing||loading||currentPlan)return;
  const chosen=[...selected];const options=Object.fromEntries(Object.entries(settings).filter(([,value])=>value.enabled.checked).map(([key,value])=>[key,value.input.value]));
  if(!Object.keys(options).length){note.textContent='Activá al menos un campo.';return;}
  writing=true;render();prepare.disabled=true;note.textContent='Consultando las fichas actuales…';
  try{
   if('price'in options)numberValue(options.price,'precio');
   if('stock'in options)stockValue(options.stock);
   if(options.brand?.length>120||options.tags?.length>400)throw Error('Marca o tags demasiado largos.');
   const plans=[];
   for(const id of chosen){
    const data=await api({action:'catalog_get',id}),product=data.product,patch={},changes=[],variants=[];
    if('brand'in options)addChange(patch,changes,'brand',product.brand||'',options.brand,'Marca');
    if('tags'in options)addChange(patch,changes,'tags',product.tags||'',options.tags,'Tags');
    for(const [key,label,limit] of [['seo_title','Título SEO',70],['seo_description','Descripción SEO',320]]){
     if(!(key in options))continue;
     const value=options[key].replace(/\{(nombre|marca)\}/g,(_,token)=>token==='nombre'?text(product.name):product.brand||'').trim();
     if(value.length>limit)throw Error(label+' supera '+limit+' caracteres en '+text(product.name)+'.');
     addChange(patch,changes,key,text(product[key]),value,label);
    }
    if('published'in options)addChange(patch,changes,'published',product.published,options.published==='true','Publicado');
    if('category'in options)addChange(patch,changes,'categories',ids(product),options.category?[Number(options.category)]:[],'IDs de categorías');
    for(const variant of product.variants||[]){
     const update={id:variant.id},variantChanges=[];
     if('price'in options&&Number(variant.price)!==Number(options.price))addChange(update,variantChanges,'price',variant.price,options.price,'Variante '+variant.id+' · Precio ARS');
     if('stock'in options){
      if(variant.inventory_levels?.length)throw Error(text(product.name)+' tiene inventario por ubicación. Editá su stock desde la ficha individual o quitá el stock de este lote.');
      addChange(update,variantChanges,'stock',stockBefore(variant),stockValue(options.stock),'Variante '+variant.id+' · Stock');
     }
     if(Object.keys(update).length>1){variants.push(update);changes.push(...variantChanges);}
    }
    if(variants.length>100)throw Error(text(product.name)+' supera las 100 variantes editables por revisión.');
    if(changes.length)plans.push({id,name:text(product.name),revision:data.revision,changes:patch,variants,preview:changes});
    note.textContent=plans.length+' fichas con cambios · revisando '+(chosen.indexOf(id)+1)+' de '+chosen.length+'…';
   }
   if(!plans.length)throw Error('Los productos ya tienen esos valores.');
   showPlan(plans,()=>{note.textContent='Revisión descartada.';});
  }catch(error){note.textContent=error.message;}
  finally{writing=false;render();prepare.disabled=false;}
 },false);
 panel.append(actions(prepare,button('Cerrar edición del lote',()=>{if(currentPlan)return;bulkHost.replaceChildren();bulkDirty=false;})),note);
 form.addEventListener('input',()=>{bulkDirty=true;});form.addEventListener('change',()=>{bulkDirty=true;});
 bulkHost.append(panel);panel.scrollIntoView({behavior:'smooth',block:'start'});
}
function describe(value){if(value===null)return 'Vacío';if(value===true)return 'Sí';if(value===false)return 'No';if(value==='')return 'Vacío';return Array.isArray(value)?value.join(', '):String(value);}
function showPlan(plans,onDiscard){
 currentPlan=plans;details.inert=true;bulkHost.inert=true;
 const panel=el('section',undefined,'cm-plan');panel.append(el('h3','Revisar '+plans.length+' productos antes de guardar'));
 const resultNodes=[];
 for(const plan of plans){
  const block=el('details');block.open=plans.length===1;block.append(el('summary',plan.name+' · ID '+plan.id+' · '+plan.preview.length+' cambios'));
  const list=el('ul');
  for(const change of plan.preview){
   const item=el('li');item.append(el('strong',change.label));
   if(String(change.before).length+String(change.after).length>250){
    const before=el('details'),after=el('details');before.append(el('summary','Valor actual'),el('pre',describe(change.before)));after.append(el('summary','Valor nuevo'),el('pre',describe(change.after)));item.append(before,after);
   }else item.append(document.createTextNode(' · '+describe(change.before)+' → '+describe(change.after)));
   list.append(item);
  }
  const result=el('p','','cm-result');result.setAttribute('role','status');block.append(list,result);panel.append(block);resultNodes.push(result);
 }
 const consentLabel=el('label'),consent=document.createElement('input');consent.type='checkbox';consent.style.width='auto';consentLabel.append(consent,document.createTextNode(' Confirmo estos cambios en Tiendanube'));
 const status=el('p','','cm-note');status.setAttribute('role','status');
 const cancel=button('Descartar revisión',()=>{if(writing)return;currentPlan=null;details.inert=false;bulkHost.inert=false;planHost.replaceChildren();onDiscard();});
 const save=button('Guardar cambios en Tiendanube',async()=>{
  if(writing)return;
  if(!consent.checked){status.textContent='Marcá la confirmación para guardar.';return;}
  writing=true;save.disabled=true;cancel.disabled=true;consent.disabled=true;render();
  let completed=0;
  try{
   for(let index=0;index<plans.length;index++){
    const plan=plans[index],node=resultNodes[index];node.textContent='Guardando…';
    try{
     const data=await api({action:'catalog_update',id:plan.id,revision:plan.revision,changes:plan.changes,variants:plan.variants,confirmed:true});
     if(data.product){
      const position=products.findIndex(item=>item.id===data.product.id);
      if(position>=0)products[position]=data.product;
     }
     if(data.verified){completed++;node.textContent='Guardado y verificado.'+(data.audit_recorded===false?' El registro de auditoría quedó pendiente.':'');}
     else{node.textContent='Tiendanube recibió cambios. Revisá '+(data.issues||[]).join(', ')+'.';node.classList.add('cm-error');}
    }catch(error){node.textContent=error.message+' Volvé a abrir la ficha para revisar el estado antes de reenviar.';node.classList.add('cm-error');}
    status.textContent=completed+' de '+plans.length+' productos verificados.';
   }
  }finally{
   writing=false;details.inert=false;bulkHost.inert=false;editorDirty=false;bulkDirty=false;editorId=null;details.replaceChildren();bulkHost.replaceChildren();filterOptions();render();
   currentPlan=null;consentLabel.hidden=true;save.textContent='Revisión procesada';
   cancel.disabled=false;cancel.textContent='Cerrar resultados';
  }
 },false);
 panel.append(consentLabel,actions(save,cancel),status);planHost.replaceChildren(panel);panel.scrollIntoView({behavior:'smooth',block:'start'});
}
for(const control of [search,brand,category,visibility,pending])control.addEventListener(control===search?'input':'change',()=>{cardLimit=cardPageSize;render();});
document.addEventListener('black-catalog:catalog-open',()=>{if(!loaded&&!loading)load(false);});
if(location.hash==='#catalogo')load(false);
})();
