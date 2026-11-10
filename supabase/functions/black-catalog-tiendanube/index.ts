import {createClient} from "npm:@supabase/supabase-js@2";
const h={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,apikey,content-type,x-client-info","Content-Type":"application/json"};
const send=(x:unknown,s=200)=>new Response(JSON.stringify(x),{status:s,headers:h});
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
 const store=Deno.env.get("TIENDANUBE_STORE_ID"),token=Deno.env.get("TIENDANUBE_ACCESS_TOKEN");
 if(!store||!token)return send({error:"Faltan credenciales"},503);
 const headers={"Authentication":"bearer "+token,"User-Agent":"BlackCatalogAI (blackoptica.ar@gmail.com)","Accept":"application/json"};
 if(body.action==="check_connection"){
  try{const res=await fetch("https://api.tiendanube.com/v1/"+store+"/products?per_page=1",{headers});if(!res.ok)return send({error:"Tiendanube HTTP "+res.status},502);return send({connected:true,store_id:store,mode:"read_only"})}catch{return send({error:"Error de conexión"},502)}
 }
 if(body.action==="upload_hidden_image"){
  const {sku,position,attachment}=body;
  if(body.confirmed!==true||typeof sku!=="string"||!/^[A-Za-z0-9_-]{5,60}$/.test(sku)||!Number.isInteger(position)||position<1||position>20||typeof attachment!=="string"||attachment.length>2000000||!/^\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(attachment))return send({error:"Foto o posición inválida"},400);
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!service)return send({error:"Servicio de auditoría no disponible"},503);
  const db=createClient(url,service),log=db.from("black_catalog_publish_log");
  const {data:entry,error:readError}=await log.select("remote_id").eq("product_key",sku).eq("state","created").maybeSingle();
  if(readError||!entry?.remote_id)return send({error:"No se encontró el producto creado por el catálogo"},409);
  const endpoint="https://api.tiendanube.com/v1/"+store+"/products/"+entry.remote_id;
  try{
   const check=await fetch(endpoint,{headers});
   if(!check.ok)return send({error:"No se pudo verificar el producto en Tiendanube (HTTP "+check.status+")"},502);
   const product=await check.json();
   if(product.published!==false||!product.variants?.some((v:{sku:string})=>v.sku===sku))return send({error:"La ficha ya no está oculta o su SKU cambió"},409);
   const key=sku+":image:"+position;
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
   const res=await fetch(endpoint+"/images",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({attachment,filename:sku+"-"+position+".jpg",position})});
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
 if(!body.confirmed||name.length<4||name.length>180||! /^[A-Za-z0-9_-]{5,60}$/.test(sku)||description.length<20||description.length>30000||! /^\d{1,9}(\.\d{1,2})?$/.test(price)||Number(price)<=0)return send({error:"Revisá nombre, SKU único, descripción, precio y confirmación"},400);
 const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
 if(!service)return send({error:"Servicio de auditoría no disponible"},503);
 const adminDb=createClient(url,service);
 const {error:reserveError}=await adminDb.from("black_catalog_publish_log").insert({product_key:sku,product_name:name,state:"pending",requested_by:user.id});
 if(reserveError){console.error("Catalog reservation failed",reserveError.code,reserveError.message);return send({error:reserveError.code==="23505"?"SKU ya reservado. No reintentar.":"Error al registrar publicación. Código: "+(reserveError.code||"desconocido"),error_code:reserveError.code||null},reserveError.code==="23505"?409:500);}
 try{
  const res=await fetch("https://api.tiendanube.com/v1/"+store+"/products",{method:"POST",headers:{...headers,"Content-Type":"application/json"},body:JSON.stringify({name:{es:name},description:{es:description},published:false,variants:[{price,sku,stock_management:false}]})});
  if(!res.ok){await adminDb.from("black_catalog_publish_log").update({state:"failed",last_error:"HTTP "+res.status,updated_at:new Date().toISOString()}).eq("product_key",sku);return send({error:"Tiendanube rechazó la creación (HTTP "+res.status+"). Revisá el registro antes de reintentar."},502)}
  const product=await res.json();
  if(!product?.id)return send({error:"Resultado no confirmado. Verificá Tiendanube antes de cualquier reintento."},502);
  await adminDb.from("black_catalog_publish_log").update({state:"created",remote_id:product.id,updated_at:new Date().toISOString()}).eq("product_key",sku);
  return send({created:true,product_id:product.id,published:false,sku});
 }catch{return send({error:"Resultado incierto. Comprobá la tienda antes de cualquier nuevo intento."},502)}
});