import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (value: unknown, status = 200) => new Response(JSON.stringify(value), {
  status,
  headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});

const MODULES = new Set(["crm-black","administracion","crm-oftalmologos","recetas","marketing","catalogo","turnos","rrhh"]);
const LEVELS = new Set(["none","read","operator","full","custom"]);

function sanitizePermissions(raw: any) {
  const out: Record<string,{level:string;items:"*"|string[]}> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [moduleId, cfg] of Object.entries(raw)) {
    if (!MODULES.has(moduleId)) continue;
    const value:any = cfg || {};
    const level = LEVELS.has(value.level) ? value.level : "none";
    const items = value.items === "*" ? "*" : Array.isArray(value.items) ? value.items.filter((x:any)=>typeof x==="string").slice(0,50) : [];
    out[moduleId] = { level, items };
  }
  return out;
}
function sanitizeBranches(raw:any){
  const aliases:Record<string,string> = {
    "zona-norte":"cerro-de-las-rosas",
    "alto-palermo":"cerro-de-las-rosas",
    "cerro":"cerro-de-las-rosas"
  };
  const allowed = new Set(["all","general-paz","cerro-de-las-rosas"]);
  const values = Array.isArray(raw)
    ? raw.map((x:any)=>aliases[String(x)]||String(x)).filter((x:any)=>allowed.has(x))
    : [];
  return values.length ? [...new Set(values)] : ["all"];
}
function appsFromPermissions(permissions:Record<string,any>){
  return Object.entries(permissions).filter(([,cfg])=>cfg?.level && cfg.level!=="none").map(([id])=>id);
}
function isOwnerByMetadata(user:any){
  const email=String(user?.email||"").toLowerCase();
  return user?.app_metadata?.black_os_super_admin===true || email==="leandro@blackoptica.ar" || email==="nanyalbert@gmail.com";
}
async function loadAdminIds(admin:any){
  const {data:role,error:roleError}=await admin.from("roles").select("id").eq("code","admin").maybeSingle();
  if(roleError || !role?.id) return new Set<string>();
  const {data:links,error:linksError}=await admin.from("user_roles").select("user_id").eq("role_id",role.id);
  if(linksError) return new Set<string>();
  return new Set<string>((links||[]).map((x:any)=>String(x.user_id)));
}
function serializeUser(user:any,adminIds:Set<string>=new Set()){
  const meta=user?.app_metadata||{};
  const permissions=sanitizePermissions(meta.black_os_permissions||{});
  return {
    id:user.id,
    nombre:user.user_metadata?.full_name||user.user_metadata?.name||String(user.email||"").split("@")[0],
    email:user.email||"",
    permissions,
    apps:Array.isArray(meta.black_os_apps)?meta.black_os_apps:appsFromPermissions(permissions),
    branchScope:sanitizeBranches(meta.black_os_branch_scope),
    superAdmin:isOwnerByMetadata(user)||adminIds.has(String(user.id)),
    activo:meta.black_os_active!==false && !user.banned_until,
    createdAt:user.created_at||null,
    lastSignInAt:user.last_sign_in_at||null,
  };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);

  const authorization=req.headers.get("Authorization");
  if(!authorization) return reply({error:"Iniciá sesión en Black OS"},401);

  const url=Deno.env.get("SUPABASE_URL");
  const anon=Deno.env.get("SUPABASE_ANON_KEY")||Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!anon||!service) return reply({error:"Supabase no está configurado para administrar usuarios"},503);

  const callerClient=createClient(url,anon,{
    global:{headers:{Authorization:authorization}},
    auth:{persistSession:false,autoRefreshToken:false}
  });
  const {data:callerData,error:callerError}=await callerClient.auth.getUser();
  const caller=callerData?.user;
  if(callerError||!caller) return reply({error:"Sesión inválida"},401);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const adminIds=await loadAdminIds(admin);
  if(!isOwnerByMetadata(caller) && !adminIds.has(String(caller.id))) return reply({error:"Solo un administrador principal puede gestionar usuarios"},403);

  const body=await req.json().catch(()=>({}));
  const action=String(body?.action||"list");

  try{
    if(action==="list"){
      const users:any[]=[];
      let page=1;
      while(page<=10){
        const {data,error}=await admin.auth.admin.listUsers({page,perPage:100});
        if(error) throw error;
        users.push(...(data?.users||[]));
        if((data?.users||[]).length<100) break;
        page++;
      }
      return reply({ok:true,users:users.map(user=>serializeUser(user,adminIds))});
    }

    if(action==="create"){
      const email=String(body?.email||"").trim().toLowerCase();
      const password=String(body?.password||"");
      const nombre=String(body?.nombre||"").trim();
      if(!/^\S+@\S+\.\S+$/.test(email)) return reply({error:"Email inválido"},400);
      if(password.length<8) return reply({error:"La contraseña temporal debe tener al menos 8 caracteres"},400);
      if(!nombre) return reply({error:"Ingresá el nombre del usuario"},400);
      const permissions=sanitizePermissions(body?.permissions);
      const branchScope=sanitizeBranches(body?.branchScope);
      const apps=appsFromPermissions(permissions);
      const {data,error}=await admin.auth.admin.createUser({
        email,password,email_confirm:true,
        user_metadata:{full_name:nombre},
        app_metadata:{
          black_os_active:true,
          black_os_super_admin:false,
          black_os_permissions:permissions,
          black_os_branch_scope:branchScope,
          black_os_apps:apps,
        }
      });
      if(error) throw error;
      return reply({ok:true,user:serializeUser(data.user,adminIds)});
    }

    if(action==="update"){
      const id=String(body?.id||"");
      if(!id) return reply({error:"Falta el ID del usuario"},400);
      const {data:current,error:getError}=await admin.auth.admin.getUserById(id);
      if(getError||!current?.user) throw getError||new Error("Usuario no encontrado");
      if(isOwnerByMetadata(current.user)||adminIds.has(String(current.user.id))) return reply({error:"El administrador principal no se edita desde esta pantalla"},400);

      const permissions=sanitizePermissions(body?.permissions);
      const branchScope=sanitizeBranches(body?.branchScope);
      const apps=appsFromPermissions(permissions);
      const nombre=String(body?.nombre||current.user.user_metadata?.full_name||"").trim();
      const email=String(body?.email||current.user.email||"").trim().toLowerCase();
      const password=String(body?.password||"");
      const attrs:any={
        email,
        email_confirm:true,
        user_metadata:{...(current.user.user_metadata||{}),full_name:nombre},
        app_metadata:{
          ...(current.user.app_metadata||{}),
          black_os_active:body?.activo!==false,
          black_os_super_admin:false,
          black_os_permissions:permissions,
          black_os_branch_scope:branchScope,
          black_os_apps:apps,
        }
      };
      if(password) {
        if(password.length<8) return reply({error:"La nueva contraseña debe tener al menos 8 caracteres"},400);
        attrs.password=password;
      }
      const {data,error}=await admin.auth.admin.updateUserById(id,attrs);
      if(error) throw error;
      return reply({ok:true,user:serializeUser(data.user)});
    }

    if(action==="delete"){
      const id=String(body?.id||"");
      if(!id) return reply({error:"Falta el ID del usuario"},400);
      if(id===caller.id) return reply({error:"No podés eliminar tu propio usuario"},400);
      const {data:current}=await admin.auth.admin.getUserById(id);
      if(current?.user && (isOwnerByMetadata(current.user)||adminIds.has(String(current.user.id)))) return reply({error:"No se puede eliminar al administrador principal"},400);
      const {error}=await admin.auth.admin.deleteUser(id);
      if(error) throw error;
      return reply({ok:true});
    }

    return reply({error:"Acción desconocida"},400);
  }catch(error:any){
    console.error("black-os-user-admin",error);
    const message=String(error?.message||error||"Error administrando usuarios");
    if(/already registered|already been registered|duplicate/i.test(message)) return reply({error:"Ese email ya está registrado en Supabase"},409);
    return reply({error:message},500);
  }
});
