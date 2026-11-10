import {createClient} from "npm:@supabase/supabase-js@2";
const h={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Content-Type":"application/json"};
const send=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:h});

const catalogText = value => typeof value === "object" && value !== null ? String(value.es ?? Object.values(value)[0] ?? "") : String(value ?? "");
const catalogCategoryIds = product => (product.categories || []).map(category => Number(category?.id ?? category)).sort((a,b) => a-b);
const catalogFields = product => ({
 name: catalogText(product.name), description: catalogText(product.description), brand: product.brand || "",
 tags: product.tags || "", seo_title: catalogText(product.seo_title), seo_description: catalogText(product.seo_description),
 handle: catalogText(product.handle), categories: catalogCategoryIds(product), published: product.published,
 free_shipping: Boolean(product.free_shipping)
});
const catalogCanonical = value => {
 if (Array.isArray(value)) return "[" + value.map(catalogCanonical).join(",") + "]";
 if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + catalogCanonical(value[key])).join(",") + "}";
 return JSON.stringify(value);
};
async function catalogRevision(product) {
 const bytes = new TextEncoder().encode(catalogCanonical(product));
 const digest = await crypto.subtle.digest("SHA-256", bytes);
 return Array.from(new Uint8Array(digest), value => value.toString(16).padStart(2,"0")).join("");
}
function catalogValidateChanges(product, changes, variants) {
 if (!changes || typeof changes !== "object" || Array.isArray(changes) || !Array.isArray(variants) || variants.length > 100) throw Error("Cambios inválidos.");
 const payload = {};
 const limits = {name:180, description:250000, brand:120, tags:400, seo_title:70, seo_description:320, handle:180};
 for (const [key,value] of Object.entries(changes)) {
  if (Object.hasOwn(limits,key)) {
   if (typeof value !== "string" || value.length > limits[key] || key === "name" && !value.trim()) throw Error("Revisá el campo " + key + ".");
   if (key === "handle" && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) throw Error("La URL debe usar letras minúsculas, números y guiones.");
   payload[key] = ["name","description","handle"].includes(key) ? {...(typeof product[key] === "object" ? product[key] : {}), es:value} :
    ["seo_title","seo_description"].includes(key) && typeof product[key] === "object" && product[key] !== null ? {...product[key], es:value} : value;
  } else if (["published","free_shipping"].includes(key)) {
   if (typeof value !== "boolean") throw Error("Estado inválido.");
   payload[key] = value;
  } else if (key === "categories") {
   if (!Array.isArray(value) || value.length > 50 || value.some(id => !Number.isSafeInteger(id) || id <= 0)) throw Error("Categorías inválidas.");
   payload.categories = [...new Set(value)];
  } else throw Error("Campo no permitido: " + key);
 }
 const ids = new Set();
 const variantPayloads = variants.map(change => {
  if (!change || !Number.isSafeInteger(change.id) || ids.has(change.id)) throw Error("Variante inválida o repetida.");
  ids.add(change.id);
  const original = product.variants?.find(item => item.id === change.id);
  if (!original) throw Error("La variante ya no existe en este producto.");
  const patch = {};
  for (const [key,value] of Object.entries(change)) {
   if (key === "id") continue;
   if (["price","promotional_price","cost","weight","width","height","depth"].includes(key)) {
    if (value === null && key !== "price") { patch[key] = null; continue; }
    if (typeof value !== "string" || !/^\d{1,9}(\.\d{1,4})?$/.test(value) || Number(value) < 0) throw Error("Revisá precio o dimensiones de la variante.");
    patch[key] = value;
   } else if (["sku","barcode","mpn"].includes(key)) {
    if (typeof value !== "string" || value.length > 100) throw Error("Código de variante inválido.");
    patch[key] = value;
   } else if (key === "stock") {
    if (original.inventory_levels?.length) throw Error("Este stock se modifica por ubicación.");
    if (value !== "" && (!Number.isSafeInteger(value) || value < 0 || value > 100000000)) throw Error("Stock inválido.");
    patch.stock = value;
   } else if (key === "inventory_levels") {
    if (!Array.isArray(value) || !value.length || value.length > 100) throw Error("Inventario por ubicación inválido.");
    const seen = new Set();
    patch.inventory_levels = value.map(level => {
     if (!level || !original.inventory_levels?.some(item => String(item.location_id) === String(level.location_id)) || seen.has(String(level.location_id))) throw Error("Ubicación inválida o repetida.");
     seen.add(String(level.location_id));
     if (level.stock !== "" && (!Number.isSafeInteger(level.stock) || level.stock < 0 || level.stock > 100000000)) throw Error("Stock por ubicación inválido.");
     return {location_id:level.location_id, stock:level.stock};
    });
   } else throw Error("Campo de variante no permitido: " + key);
  }
  return {id:change.id, patch};
 });
 if (!Object.keys(payload).length && !variantPayloads.some(item => Object.keys(item.patch).length)) throw Error("No hay cambios para guardar.");
 return {payload, variantPayloads};
}
function catalogVerifyChanges(product, changes, variants) {
 const issues = [];
 const actual = catalogFields(product);
 for (const [key,value] of Object.entries(changes)) {
  if (catalogCanonical(actual[key]) !== catalogCanonical(value)) issues.push(key);
 }
 for (const change of variants) {
  const variant = product.variants?.find(item => item.id === change.id);
  if (!variant) { issues.push("variante " + change.id); continue; }
  for (const [key,value] of Object.entries(change)) {
   if (key === "id") continue;
   if (key === "inventory_levels") {
    if (value.some(level => {
     const found = variant.inventory_levels?.find(item => String(item.location_id) === String(level.location_id));
     return !found || (level.stock === "" ? found.stock !== null : Number(found.stock) !== level.stock);
    })) issues.push("stock por ubicación");
   } else if (key === "stock") {
    if (value === "" ? variant.stock_management !== false : variant.stock_management !== true || Number(variant.stock) !== value) issues.push("stock");
   } else if (["price","promotional_price","cost","weight","width","height","depth"].includes(key)) {
    if (value === null ? variant[key] !== null : Number(variant[key]) !== Number(value)) issues.push(key);
   } else if (String(variant[key] ?? "") !== value) issues.push(key);
  }
 }
 return [...new Set(issues)];
}

Deno.serve(async req=>{
 if(req.method==="OPTIONS")return new Response("",{headers:h});
 if(req.method!=="POST")return send({error:"Método no permitido"},405);
 const auth=req.headers.get("Authorization")||"";
 if(!auth.startsWith("Bearer "))return send({error:"Sesión requerida"},401);
 const url=Deno.env.get("SUPABASE_URL")!,anon=Deno.env.get("SUPABASE_ANON_KEY")!;
 const sb=createClient(url,anon,{global:{headers:{Authorization:auth}}});
 const {data:{user}}=await sb.auth.getUser();
 if(!user)return send({error:"Sesión inválida"},401);
 const {data:admin}=await sb.rpc("black_os_is_admin");
 if(admin!==true)return send({error:"Solo administradores"},403);
 const body=await req.json().catch(()=>({}));
 const reference=typeof body.reference==="string"&&/^catalog:[a-f0-9-]{36}$/.test(body.reference)?body.reference:"";
 const store=Deno.env.get("TIENDANUBE_STORE_ID"),token=Deno.env.get("TIENDANUBE_ACCESS_TOKEN");
 if(!store||!token)return send({error:"Faltan credenciales"},503);
 const headers={"Authentication":"bearer "+token,"User-Agent":"BlackCatalogAI (blackoptica.ar@gmail.com)","Accept":"application/json"};

 if (["catalog_list","catalog_get","catalog_update"].includes(body.action)) {
  const base = "https://api.tiendanube.com/v1/" + store;
  const remote = async (path, options={}) => {
   const response = await fetch(base + path, {...options, headers:{...headers, "Content-Type":"application/json"}});
   if (!response.ok) throw Error("Tiendanube respondió HTTP " + response.status + (response.status === 429 ? ". Esperá unos segundos antes de volver a consultar." : "."));
   return response.json();
  };
  let auditId = null;
  let wrote = false;
  try {
   if (body.action === "catalog_list") {
    const page = Number(body.page || 1);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000) return send({error:"Página inválida."},400);
    const params = new URLSearchParams({page:String(page), per_page:"50"});
    const response = await fetch(base + "/products?" + params,{headers});
    if (response.status === 404 && page > 1) return send({products:[], has_more:false, page});
    if (!response.ok) throw Error("Tiendanube respondió HTTP " + response.status + ".");
    const products = await response.json();
    if (!Array.isArray(products)) throw Error("Listado de productos inválido.");
    const summaries = products.map(product => ({
     id:product.id, name:catalogText(product.name), brand:product.brand || "",
     published:product.published, tags:product.tags || "", categories:product.categories || [],
     images:(product.images || []).slice().sort((a,b) => a.position-b.position),
     variants:product.variants || [], updated_at:product.updated_at
    }));
    const total = response.headers.get("x-total-count");
    return send({products:summaries, has_more:total && /^\d+$/.test(total) ? page*50 < Number(total) : products.length === 50, page});
   }
   const id = Number(body.id);
   if (!Number.isSafeInteger(id) || id <= 0) return send({error:"Producto inválido."},400);
   const product = await remote("/products/" + id);
   if (body.action === "catalog_get") return send({product, revision:await catalogRevision(product)});
   if (body.confirmed !== true || typeof body.revision !== "string") return send({error:"Revisá y confirmá los cambios."},400);
   if (body.revision !== await catalogRevision(product)) return send({error:"El producto cambió en Tiendanube. Volvé a abrirlo y revisá la versión actual.", conflict:true},409);
   let validated;
   try { validated = catalogValidateChanges(product, body.changes, body.variants || []); }
   catch (error) { return send({error:error.message},400); }
   const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
   if (!service) return send({error:"Servicio de auditoría no disponible."},503);
   const db = createClient(url,service);
   const audit = await db.from("black_catalog_publish_log").insert({
    product_key:"edit:" + id + ":" + crypto.randomUUID(), remote_id:id, state:"pending", requested_by:user.id,
    product_name:catalogText(product.name)
   }).select("id").single();
   if (audit.error || !audit.data) return send({error:"No se pudo registrar la edición."},500);
   auditId = audit.data.id;
   if (Object.keys(validated.payload).length) {
    wrote = true;
    await remote("/products/" + id, {method:"PUT", body:JSON.stringify(validated.payload)});
   }
   for (const variant of validated.variantPayloads) {
    if (!Object.keys(variant.patch).length) continue;
    wrote = true;
    await remote("/products/" + id + "/variants/" + variant.id, {method:"PUT", body:JSON.stringify(variant.patch)});
   }
   const saved = await remote("/products/" + id);
   const issues = catalogVerifyChanges(saved, body.changes, body.variants || []);
   const auditResult = await db.from("black_catalog_publish_log").update({
    state:issues.length ? "failed" : "created", last_error:issues.length ? "Diferencias: " + issues.join(", ") : null, updated_at:new Date().toISOString()
   }).eq("id",auditId);
   return send({saved:true, verified:issues.length===0, issues, audit_recorded:!auditResult.error, product:saved, revision:await catalogRevision(saved)});
  } catch (error) {
   if (auditId) {
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    await createClient(url,service).from("black_catalog_publish_log").update({state:"failed", last_error:String(error.message).slice(0,500), updated_at:new Date().toISOString()}).eq("id",auditId);
   }
   return send({error:error.message || "No se pudo consultar Tiendanube.", partial:wrote},502);
  }
 }

 if(body.action==="check_connection"){
  try{const res=await fetch("https://api.tiendanube.com/v1/"+store+"/products?per_page=1",{headers});if(!res.ok)return send({error:"Tiendanube HTTP "+res.status},502);return send({connected:true,store_id:store,mode:"read_only"})}catch{return send({error:"Error de conexión"},502)}
 }
 if(body.action==="list_categories"){
  try{
   const categories=[];
   for(let page=1;page<=10;page++){
    const response=await fetch("https://api.tiendanube.com/v1/"+store+"/categories?per_page=100&page="+page,{headers});
    if(response.status===404&&page>1)break;
    if(!response.ok)return send({error:"No se pudieron consultar las categorías (HTTP "+response.status+")"},502);
    const items=await response.json();
    if(!Array.isArray(items))return send({error:"Listado de categorías inválido"},502);
    categories.push(...items.flatMap(item=>Number.isSafeInteger(item.id)?[{id:item.id,parent:item.parent??null,name:String(item.name?.es||Object.values(item.name||{})[0]||item.id)}]:[]));
    if(items.length<100)break;
   }
   return send({categories});
  }catch{return send({error:"No se pudieron consultar las categorías"},502)}
 }
 if(body.action==="verify_hidden"){
  const sku=typeof body.sku==="string"?body.sku:"";
  const key=sku||reference,photoCount=Number(body.photoCount);
  if(!key||(sku&&!/^[A-Za-z0-9_-]{5,60}$/.test(sku))||!Number.isInteger(photoCount)||photoCount<0||photoCount>20)return send({error:"Datos de verificación inválidos"},400);
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!service)return send({error:"Servicio de auditoría no disponible"},503);
  const log=createClient(url,service).from("black_catalog_publish_log");
  try{
   const {data:entry,error}=await log.select("remote_id").eq("product_key",key).eq("state","created").maybeSingle();
   if(error||!entry?.remote_id)return send({error:"No se encontró el alta registrada"},409);
   const endpoint="https://api.tiendanube.com/v1/"+store+"/products/"+entry.remote_id;
   const response=await fetch(endpoint,{headers});
   if(!response.ok)return send({error:"Tiendanube no devolvió el producto (HTTP "+response.status+")"},502);
   const product=await response.json(),variant=product.variants?.[0],expected=body.metadata||{};
   const issues=[];
   if(product.published!==false)issues.push("visibilidad");
   if(product.name?.es!==body.name)issues.push("nombre");
   if(product.description?.es!==body.description)issues.push("descripción");
   if(Number(variant?.price)!==Number(body.price))issues.push("precio");
   if(variant?.stock_management!==true||Number(variant?.stock)!==1)issues.push("stock");
   if(!variant||Number(variant.weight)!==.25||Number(variant.depth)!==10||Number(variant.width)!==25||Number(variant.height)!==10)issues.push("caja");
   if(sku&&variant?.sku!==sku)issues.push("SKU");
   if(expected.brand&&product.brand!==expected.brand)issues.push("marca");
   if(expected.category&&!product.categories?.some(category=>Number(category?.id??category)===Number(expected.category)))issues.push("categoría");
   if(expected.seoTitle&&(product.seo_title?.es??product.seo_title)!==expected.seoTitle)issues.push("título SEO");
   if(expected.seoDescription&&(product.seo_description?.es??product.seo_description)!==expected.seoDescription)issues.push("descripción SEO");
   const tagList=(value:unknown)=>String(value||"").split(",").map(tag=>tag.trim().toLowerCase()).filter(Boolean).sort().join(",");
   if(expected.tags&&tagList(product.tags)!==tagList(expected.tags))issues.push("tags");
   const photos=Array.isArray(product.images)?product.images:[];
   if(photos.length!==photoCount)issues.push("cantidad de fotos");
   if(photoCount){
    const keys=Array.from({length:photoCount},(_,i)=>key+":image:"+(i+1));
    const {data:images,error:imageError}=await log.select("product_key,remote_id").in("product_key",keys).eq("state","created");
    if(imageError||images?.length!==photoCount||keys.some((imageKey,i)=>!photos.some(photo=>Number(photo.position)===i+1&&Number(photo.id)===Number(images?.find(image=>image.product_key===imageKey)?.remote_id))))issues.push("orden de fotos");
   }
   return send({verified:issues.length===0,issues,product_id:entry.remote_id});
  }catch{return send({error:"No se pudo verificar el producto"},502)}
 }
 if(body.action==="upload_hidden_image"){
  const {sku,position,attachment}=body;
  const productKey=sku||reference;
  if(body.confirmed!==true||typeof sku!=="string"||!productKey||(sku&&!/^[A-Za-z0-9_-]{5,60}$/.test(sku))||!Number.isInteger(position)||position<1||position>20||typeof attachment!=="string"||attachment.length>2000000||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(attachment))return send({error:"Foto o posición inválida"},400);
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!service)return send({error:"Servicio de auditoría no disponible"},503);
  const db=createClient(url,service),log=db.from("black_catalog_publish_log");
  const {data:entry,error:readError}=await log.select("remote_id").eq("product_key",productKey).eq("state","created").maybeSingle();
  if(readError||!entry?.remote_id)return send({error:"No se encontró el producto creado por el catálogo"},409);
  const endpoint="https://api.tiendanube.com/v1/"+store+"/products/"+entry.remote_id;
  try{
   const check=await fetch(endpoint,{headers});
   if(!check.ok)return send({error:"No se pudo verificar el producto en Tiendanube (HTTP "+check.status+")"},502);
   const product=await check.json();
   if(product.published!==false||(sku&&!product.variants?.some((v:{sku:string})=>v.sku===sku)))return send({error:"La ficha ya no está oculta o su SKU cambió"},409);
   const key=productKey+":image:"+position;
   const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(attachment));
   const fingerprint=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
   const {data:previous,error:lookupError}=await log.select("state,remote_id,product_name").eq("product_key",key).maybeSingle();
   if(lookupError)return send({error:"No se pudo consultar el estado de la foto"},500);
   if(previous?.product_name&&previous.product_name!==fingerprint)return send({error:"La foto para esta posición cambió. Revisá la galería de Tiendanube."},409);
   if(previous?.state==="created")return send({uploaded:true,image_id:previous.remote_id,position});
   if(previous&&previous.state!=="failed")return send({error:"La foto tiene un envío pendiente o incierto. Revisá la galería antes de continuar."},409);
   if(product.images?.some((img:{position:number})=>img.position===position))return send({error:"Esa posición ya tiene una foto en Tiendanube. Revisá la galería."},409);
   const reservation=previous
    ?await log.update({state:"pending",updated_at:new Date().toISOString()}).eq("product_key",key).eq("state","failed").select("id").maybeSingle()
    :await log.insert({product_key:key,product_name:fingerprint,state:"pending",requested_by:user.id}).select("id").single();
   if(reservation.error||!reservation.data)return send({error:"No se pudo reservar la foto. Revisá la galería."},409);
   const res=await fetch(endpoint+"/images",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({attachment,filename:(sku||"catalogo")+"-"+position+".jpg",position})});
   if(!res.ok){
    if([400,401,403,404,422,429].includes(res.status))await log.update({state:"failed",last_error:"HTTP "+res.status,updated_at:new Date().toISOString()}).eq("id",reservation.data.id);
    return send({error:"Tiendanube no confirmó la foto "+position+" (HTTP "+res.status+")."},502);
   }
   const image=await res.json();
   if(!image?.id)return send({error:"Resultado incierto. Revisá la galería."},502);
   const saved=await log.update({state:"created",remote_id:image.id,updated_at:new Date().toISOString()}).eq("id",reservation.data.id);
   if(saved.error)return send({error:"La foto fue recibida, pero no se pudo registrar. Revisá la galería."},502);
   return send({uploaded:true,image_id:image.id,position});
  }catch{return send({error:"Resultado incierto. Revisá la galería de Tiendanube."},502)}
 }
 if(body.action!=="create_hidden")return send({error:"Operación no permitida"},400);
 const name=String(body.name||"").trim(),sku=String(body.sku||"").trim(),description=String(body.description||"").trim(),price=String(body.price||"").trim();
 const productKey=sku||reference;
 if(!body.confirmed||!productKey||name.length<4||name.length>180||(sku&&!/^[A-Za-z0-9_-]{5,60}$/.test(sku))||description.length<20||description.length>30000||! /^\d{1,9}(\.\d{1,2})?$/.test(price)||Number(price)<=0)return send({error:"Revisá nombre, SKU único, descripción, precio y confirmación"},400);
 const metadata=body.metadata||{};
 const brand=String(metadata.brand||"").trim().slice(0,120),tags=String(metadata.tags||"").split(",").map(s=>s.trim()).filter(Boolean).slice(0,12).join(",").slice(0,400);
 const seoTitle=String(metadata.seoTitle||"").trim().slice(0,70),seoDescription=String(metadata.seoDescription||"").trim().slice(0,320);
 const category=Number(metadata.category||0);
 if(!Number.isSafeInteger(category)||category<0)return send({error:"Categoría inválida"},400);
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!service)return send({error:"Servicio de auditoría no disponible"},503);
 const adminDb=createClient(url,service);
 const {error:reserveError}=await adminDb.from("black_catalog_publish_log").insert({product_key:productKey,product_name:name,state:"pending",requested_by:user.id});
 if(reserveError?.code==="23505"&&reference&&!sku){
  const {data:prior}=await adminDb.from("black_catalog_publish_log").select("remote_id,product_name").eq("product_key",productKey).eq("state","created").maybeSingle();
  if(prior?.remote_id&&prior.product_name===name)return send({created:true,product_id:prior.remote_id,published:false,sku,resumed:true});
 }
 if(reserveError){console.error("Catalog reservation failed",reserveError.code,reserveError.message);return send({error:reserveError.code==="23505"?"SKU ya reservado. No reintentar.":"Error al registrar publicación. Código: "+(reserveError.code||"desconocido"),error_code:reserveError.code||null},reserveError.code==="23505"?409:500);}
 try{
  const res=await fetch("https://api.tiendanube.com/v1/"+store+"/products",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({name:{es:name},description:{es:description},published:false,...(brand?{brand}:{}),...(tags?{tags}:{}),...(seoTitle?{seo_title:seoTitle}:{}),...(seoDescription?{seo_description:seoDescription}:{}),...(category?{categories:[category]}:{}),variants:[{price,...(sku?{sku}:{}),stock:1,weight:"0.250",depth:"10",width:"25",height:"10"}]})});
  if(!res.ok){await adminDb.from("black_catalog_publish_log").update({state:"failed",last_error:"HTTP "+res.status,updated_at:new Date().toISOString()}).eq("product_key",productKey);return send({error:"Tiendanube rechazó la creación (HTTP "+res.status+"). Revisá el registro antes de reintentar."},502)}
  const product=await res.json();
  if(!product?.id)return send({error:"Resultado no confirmado. Verificá Tiendanube antes de cualquier reintento."},502);
  await adminDb.from("black_catalog_publish_log").update({state:"created",remote_id:product.id,updated_at:new Date().toISOString()}).eq("product_key",productKey);
  return send({created:true,product_id:product.id,published:false,sku});
 }catch{return send({error:"Resultado incierto. Comprobá la tienda antes de cualquier nuevo intento."},502)}
});