import { createClient } from "npm:@supabase/supabase-js@2";

const cors={
  "Access-Control-Allow-Origin":"*",
  "Access-Control-Allow-Headers":"content-type,x-terminal-code,x-terminal-secret,x-client-id",
  "Access-Control-Allow-Methods":"POST,OPTIONS",
  "Cache-Control":"no-store"
};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{...cors,"Content-Type":"application/json; charset=utf-8"}
});
const sha256=async(value:string)=>{
  const buf=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map(x=>x.toString(16).padStart(2,"0")).join("");
};
const localDateKey=(date:Date)=>new Intl.DateTimeFormat("en-CA",{
  timeZone:"America/Argentina/Cordoba",year:"numeric",month:"2-digit",day:"2-digit"
}).format(date);

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response("ok",{headers:cors});
  if(req.method!=="POST") return reply({ok:false,error:"Método no permitido"},405);

  const url=Deno.env.get("SUPABASE_URL");
  const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if(!url||!service) return reply({ok:false,error:"Servicio no configurado"},503);

  const terminalCode=String(req.headers.get("x-terminal-code")||"").trim();
  const terminalSecret=String(req.headers.get("x-terminal-secret")||"").trim();
  const clientId=String(req.headers.get("x-client-id")||"browser").trim().slice(0,120);
  if(!terminalCode||!terminalSecret) return reply({ok:false,error:"Terminal no configurada"},401);

  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:terminal,error:terminalError}=await admin.rpc("hr_validate_terminal_secret",{
    p_terminal_code:terminalCode,
    p_secret:terminalSecret
  });
  const terminalRow=Array.isArray(terminal)?terminal[0]:null;
  if(terminalError||!terminalRow) return reply({ok:false,error:"Terminal no autorizada"},401);

  const body=await req.json().catch(()=>({}));
  const pin=String(body?.pin||"").trim();
  if(!/^\d{4,6}$/.test(pin)) return reply({ok:false,error:"Ingresá un PIN válido de 4 a 6 dígitos"},400);

  const forwarded=String(req.headers.get("x-forwarded-for")||req.headers.get("cf-connecting-ip")||"");
  const clientHash=await sha256([terminalCode,clientId,forwarded.split(",")[0]?.trim()||""].join("|"));

  const since=new Date(Date.now()-5*60*1000).toISOString();
  const [{count},{count:terminalFailures}]=await Promise.all([
    admin.from("hr_terminal_pin_attempts").select("id",{count:"exact",head:true})
      .eq("terminal_code",terminalCode).eq("client_hash",clientHash).eq("success",false).gte("created_at",since),
    admin.from("hr_terminal_pin_attempts").select("id",{count:"exact",head:true})
      .eq("terminal_code",terminalCode).eq("success",false).gte("created_at",since)
  ]);

  if((count||0)>=5 || (terminalFailures||0)>=15){
    return reply({ok:false,error:"Demasiados intentos incorrectos. Esperá unos minutos e intentá nuevamente.",code:"rate_limited"},429);
  }

  const {data:mark,error:markError}=await admin.rpc("hr_mark_by_pin",{
    p_pin:pin,
    p_branch_code:terminalRow.branch_code,
    p_terminal_code:terminalCode
  });

  if(markError){
    const msg=String(markError.message||"No se pudo registrar la marcación");
    const invalidPin=/PIN incorrecto|PIN inválido/i.test(msg);
    if(invalidPin){
      await admin.from("hr_terminal_pin_attempts").insert({
        terminal_code:terminalCode,client_hash:clientHash,success:false
      });
      return reply({ok:false,error:"PIN incorrecto. Verificá los dígitos e intentá nuevamente.",code:"invalid_pin"},401);
    }
    if(/Esperá unos segundos/i.test(msg)){
      return reply({ok:false,error:"La marcación ya fue recibida. Esperá unos segundos antes de volver a marcar.",code:"duplicate"},409);
    }
    console.error("black-fichada-mark",markError);
    return reply({ok:false,error:"No pudimos registrar la marcación. Intentá nuevamente.",code:"mark_failed"},500);
  }

  await Promise.all([
    admin.from("hr_terminal_pin_attempts").insert({
      terminal_code:terminalCode,client_hash:clientHash,success:true
    }),
    admin.from("hr_terminals").update({last_seen_at:new Date().toISOString()}).eq("code",terminalCode)
  ]);

  const employeeId=mark?.employee_id;
  const markedAt=new Date(mark?.marked_at||Date.now());
  const targetDay=localDateKey(markedAt);
  const historyFrom=new Date(markedAt.getTime()-30*60*60*1000).toISOString();
  const {data:historyRaw}=employeeId
    ? await admin.from("hr_time_marks")
        .select("mark_type,marked_at")
        .eq("employee_id",employeeId)
        .gte("marked_at",historyFrom)
        .order("marked_at",{ascending:true})
        .limit(40)
    : {data:[]};
  const history=(historyRaw||[]).filter((x:any)=>localDateKey(new Date(x.marked_at))===targetDay);

  await admin.from("hr_terminal_pin_attempts")
    .delete()
    .lt("created_at",new Date(Date.now()-7*24*60*60*1000).toISOString());

  return reply({
    ok:true,
    employee_name:mark?.employee_name||"",
    mark_type:mark?.mark_type||"",
    marked_at:mark?.marked_at||new Date().toISOString(),
    next_type:mark?.next_type||"",
    branch_name:terminalRow.branch_name,
    terminal_name:terminalRow.terminal_name,
    today_marks:history.map((x:any)=>({type:x.mark_type,at:x.marked_at}))
  });
});