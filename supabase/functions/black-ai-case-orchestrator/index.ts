import { createClient } from "npm:@supabase/supabase-js@2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{"Content-Type":"application/json; charset=utf-8"}
});

function firstSecretValue(raw:string|undefined){
  if(!raw)return "";
  try{
    const parsed=JSON.parse(raw);
    if(typeof parsed==="string")return parsed;
    if(parsed&&typeof parsed==="object"){
      const value=Object.values(parsed).find((item)=>typeof item==="string"&&String(item).length>10);
      if(value)return String(value);
    }
  }catch(_){
    if(raw.length>10)return raw;
  }
  return "";
}

function getServiceKey(){
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
    || firstSecretValue(Deno.env.get("SUPABASE_SECRET_KEYS"));
}

function extractOutputText(payload:any){
  if(typeof payload?.output_text==="string"&&payload.output_text.trim())return payload.output_text.trim();
  const parts:string[]=[];
  for(const item of payload?.output||[]){
    for(const content of item?.content||[]){
      if(content?.type==="output_text"&&typeof content?.text==="string")parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function parseJsonObject(text:string){
  const cleaned=String(text||"").trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```$/i,"").trim();
  try{return JSON.parse(cleaned)}catch(_){ }
  const start=cleaned.indexOf("{");
  const end=cleaned.lastIndexOf("}");
  if(start>=0&&end>start){
    try{return JSON.parse(cleaned.slice(start,end+1))}catch(_){ }
  }
  return null;
}

function normalizeFacts(value:any){
  const allowedObjective=["quote","appointment","support","product_info","other"];
  const allowedCase=["monofocal","bifocal","occupational","multifocal"];
  const allowedPrice=["general","exact","none"];
  const facts:any={};
  if(allowedObjective.includes(value?.objective))facts.objective=value.objective;
  if(allowedCase.includes(value?.optical_case))facts.optical_case=value.optical_case;
  if(allowedPrice.includes(value?.price_request))facts.price_request=value.price_request;
  if(typeof value?.main_use==="string"&&value.main_use.trim())facts.main_use=value.main_use.trim().slice(0,160);
  if(typeof value?.previous_lens_type==="string"&&value.previous_lens_type.trim())facts.previous_lens_type=value.previous_lens_type.trim().slice(0,160);
  if(typeof value?.budget_context==="string"&&value.budget_context.trim())facts.budget_context=value.budget_context.trim().slice(0,160);
  if(typeof value?.urgency==="string"&&value.urgency.trim())facts.urgency=value.urgency.trim().slice(0,160);
  if(value?.preferences&&typeof value.preferences==="object"&&!Array.isArray(value.preferences))facts.preferences=value.preferences;
  return facts;
}

async function inferFactsWithAI(message:string,current:any){
  const openAiKey=Deno.env.get("OPENAI_API_KEY")||"";
  if(!openAiKey||!message.trim())return {facts:{},mode:"none"};
  const model=Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna";
  const prompt=`
Extraé hechos explícitos del mensaje de un paciente de una óptica. No completes nada por inferencia dudosa.
Usá el estado actual solo como contexto.

Valores permitidos:
- objective: quote | appointment | support | product_info | other | null
- optical_case: monofocal | bifocal | occupational | multifocal | null
- price_request: general | exact | none
- main_use: texto breve o null
- previous_lens_type: texto breve o null
- budget_context: texto breve o null
- urgency: texto breve o null
- preferences: objeto con preferencias explícitas, o {}

Reglas para price_request:
- general: pregunta cuánto sale una categoría, desde cuánto, precios aproximados u opciones de precio sin aportar receta completa.
- exact: pide cuánto le sale SU caso concreto, presupuesto exacto o precio con su receta/datos específicos.
- none: no está preguntando precios en este mensaje.

Interpretaciones válidas:
- progresivos = multifocal
- lentes para oficina / PC / pantalla, cuando se refiere al tipo de lente, puede ser occupational
- pedir precio, cotización o presupuesto = quote
- pedir turno = appointment
- reclamo, garantía, devolución o problema = support

No inventes receta, graduación, precio, stock ni diagnóstico.
Respondé SOLO JSON válido:
{"objective":null,"optical_case":null,"price_request":"none","main_use":null,"previous_lens_type":null,"budget_context":null,"urgency":null,"preferences":{}}

ESTADO ACTUAL:
${JSON.stringify({objective:current?.objective,optical_case:current?.optical_case,main_use:current?.main_use,previous_lens_type:current?.previous_lens_type,budget_context:current?.budget_context,urgency:current?.urgency})}

MENSAJE:
${message.slice(0,3000)}
`.trim();

  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":`Bearer ${openAiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model,
        input:[{role:"user",content:[{type:"input_text",text:prompt}]}],
        reasoning:{effort:"low"},
        max_output_tokens:350,
        store:false
      })
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      console.error("case extractor OpenAI",response.status,payload);
      return {facts:{},mode:"openai_error"};
    }
    const parsed=parseJsonObject(extractOutputText(payload));
    return {facts:normalizeFacts(parsed||{}),mode:parsed?"openai":"openai_invalid_json"};
  }catch(error){
    console.error("case extractor",error);
    return {facts:{},mode:"openai_error"};
  }
}

function money(value:number,currency="ARS"){
  try{return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(value)}
  catch(_){return `$${Math.round(value).toLocaleString("es-AR")}`}
}

async function getPriceSnapshot(supabase:any,opticalCase:string|null){
  if(!opticalCase)return null;
  const today=new Date().toISOString().slice(0,10);
  const {data,error}=await supabase
    .from("black_ai_products")
    .select("id,name,design,material,treatment,base_price,currency,valid_from,valid_until,supply_mode")
    .eq("is_active",true)
    .eq("family","lens")
    .eq("optical_case",opticalCase)
    .not("base_price","is",null)
    .order("base_price",{ascending:true})
    .limit(80);
  if(error){
    console.error("price snapshot",error);
    return null;
  }
  const rows=(data||[]).filter((x:any)=>{
    const p=Number(x.base_price);
    return Number.isFinite(p)&&p>0&&(!x.valid_from||x.valid_from<=today)&&(!x.valid_until||x.valid_until>=today);
  });
  if(!rows.length)return null;
  const unique:any[]=[];
  const seen=new Set<string>();
  for(const row of rows){
    const key=String(row.design||row.name||"").toLowerCase();
    if(seen.has(key))continue;
    seen.add(key);
    unique.push(row);
    if(unique.length>=4)break;
  }
  const min=Number(rows[0].base_price);
  const max=Number(rows[rows.length-1].base_price);
  return {
    optical_case:opticalCase,
    currency:rows[0].currency||"ARS",
    min_price:min,
    max_price:max,
    min_label:money(min,rows[0].currency||"ARS"),
    max_label:money(max,rows[0].currency||"ARS"),
    examples:unique.map((x:any)=>({
      name:x.name,
      design:x.design,
      material:x.material,
      treatment:x.treatment,
      price:Number(x.base_price),
      price_label:money(Number(x.base_price),x.currency||"ARS")
    }))
  };
}

function questionForKey(key:string|null,objective:string|null){
  if(objective==="appointment")return "Perfecto. ¿Qué día o franja horaria te quedaría cómoda para atenderte?";
  if(objective==="support")return "Contame brevemente qué pasó así te ayudo a derivarlo correctamente.";
  if(objective==="product_info")return "¿Qué producto o tipo de lente querés consultar?";
  const questions:Record<string,string>={
    clarify_objective:"¿Qué te gustaría resolver: cotizar unos lentes, consultar por un producto o coordinar atención?",
    request_prescription:"¿Tenés una receta óptica para pasarme? Podés enviarme una foto.",
    complete_prescription:"Me faltan algunos datos de la receta. ¿Podés mandarme una foto completa y nítida?",
    request_axis_od:"¿Me confirmás el eje del ojo derecho (OD)?",
    request_axis_oi:"¿Me confirmás el eje del ojo izquierdo (OI)?",
    request_addition:"¿La receta indica una adición (ADD) para cerca?",
    clarify_optical_case:"¿Buscás lentes monofocales, multifocales, ocupacionales o bifocales?",
    ask_main_use:"¿Para qué los vas a usar principalmente: lejos, lectura, computadora o uso diario?",
    ask_previous_lens_experience:"¿Ya usaste este tipo de lentes antes?",
    choose_technical_family:"Con esos datos ya puedo avanzar con la evaluación técnica del lente.",
    run_technical_evaluation:"Ya tengo los datos necesarios para evaluar la receta.",
    ready_for_proposal:"Ya tengo la información técnica necesaria para armarte una propuesta."
  };
  return key?(questions[key]||""):"";
}

async function writeContextualReply(args:{message:string,state:any,nextKey:string|null,fallback:string,price:any,priceRequest:string,repeated:boolean,previousReply:string}){
  const {message,state,nextKey,fallback,price,priceRequest,repeated,previousReply}=args;
  const openAiKey=Deno.env.get("OPENAI_API_KEY")||"";
  if(!openAiKey||!message.trim())return fallback;
  const model=Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna";
  const prompt=`
Sos Black AI, asistente de Black Óptica en Argentina.
Redactá UNA respuesta breve de WhatsApp, natural, profesional y cálida, en español argentino.

REGLAS OBLIGATORIAS:
- Una sola pregunta principal por mensaje.
- Idealmente 1 a 4 oraciones.
- Contestá primero la consulta concreta del paciente y después pedí el próximo dato útil.
- No entres en bucle: si la próxima pregunta coincide con la anterior, NO repitas la misma frase ni ignores lo que el paciente acaba de preguntar.
- Si el usuario vuelve a preguntar precio y hay PRECIOS DEL CATÁLOGO, respondé el precio antes de volver a pedir receta.
- Si price_request=general y hay precios, podés informar "desde" el precio mínimo vigente y hasta 3 ejemplos reales.
- Si price_request=exact, aclarar que el precio exacto depende de la receta/configuración; podés dar una referencia "desde" si existe.
- Usá EXCLUSIVAMENTE los importes incluidos en PRECIOS DEL CATÁLOGO. No inventes ni calcules otros montos.
- Si no hay datos de precio, no inventes: explicá que necesitás más datos o confirmación.
- No inventes promociones, stock, tiempos, garantías, características técnicas ni diagnósticos.
- No prometas que una opción es la mejor si el motor no lo determinó.
- No menciones motores, bases de datos, estados internos ni IA.
- Devolvé SOLO el texto final, sin comillas ni markdown.

MENSAJE ACTUAL:
${message.slice(0,2000)}

CONTEXTO:
${JSON.stringify({objective:state?.objective,optical_case:state?.optical_case,main_use:state?.main_use,previous_lens_type:state?.previous_lens_type,budget_context:state?.budget_context,urgency:state?.urgency,preferences:state?.preferences})}

PRICE_REQUEST: ${priceRequest}
PRECIOS DEL CATÁLOGO:
${JSON.stringify(price||null)}

PRÓXIMO PASO DEL MOTOR: ${nextKey||"sin clave"}
PREGUNTA BASE: ${fallback||""}
SE REPITE EL MISMO PASO: ${repeated?"sí":"no"}
RESPUESTA ANTERIOR:
${String(previousReply||"").slice(0,1200)}
`.trim();

  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",
      headers:{"Authorization":`Bearer ${openAiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({
        model,
        input:[{role:"user",content:[{type:"input_text",text:prompt}]}],
        reasoning:{effort:"low"},
        max_output_tokens:240,
        store:false
      })
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){
      console.error("case reply OpenAI",response.status,payload);
      return fallback;
    }
    const text=extractOutputText(payload).trim();
    return text?text.slice(0,1200):fallback;
  }catch(error){
    console.error("case reply",error);
    return fallback;
  }
}

Deno.serve(async(req)=>{
  if(req.method!=="POST")return json({error:"Método no permitido"},405);
  try{
    const expected=Deno.env.get("BLACK_AI_WEBHOOK_SECRET")||"";
    const url=new URL(req.url);
    const supplied=req.headers.get("x-black-ai-webhook-secret")||url.searchParams.get("token")||"";
    if(!expected)return json({error:"BLACK_AI_WEBHOOK_SECRET no configurado"},500);
    if(supplied!==expected)return json({error:"No autorizado"},401);

    const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";
    const serviceKey=getServiceKey();
    if(!supabaseUrl||!serviceKey)return json({error:"Configuración de Supabase incompleta"},500);
    const supabase=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

    const body=await req.json().catch(()=>({}));
    const phone=String(body?.phone||"").replace(/\D/g,"");
    const message=String(body?.message||"").trim();
    if(!phone)return json({error:"Falta phone"},400);

    const {data:existing,error:readError}=await supabase.from("black_ai_case_state").select("*").eq("phone",phone).maybeSingle();
    if(readError)throw readError;
    const current=existing||{phone,stage:"discovery",prescription:{},preferences:{},technical_result:{},candidate_products:[],next_best_question_context:{}};

    const extraction=await inferFactsWithAI(message,current);
    const inferred=extraction.facts||{};
    const priceRequest=String(inferred.price_request||"none");
    const prescription=body?.prescription&&typeof body.prescription==="object"
      ? {...(current.prescription||{}),...body.prescription}
      : current.prescription||{};

    const state:any={
      phone,
      objective:body?.objective??inferred.objective??current.objective??null,
      stage:body?.stage??current.stage??"discovery",
      prescription,
      optical_case:body?.optical_case??inferred.optical_case??current.optical_case??null,
      technical_family_key:body?.technical_family_key??current.technical_family_key??null,
      main_use:body?.main_use??inferred.main_use??current.main_use??null,
      previous_lens_type:body?.previous_lens_type??inferred.previous_lens_type??current.previous_lens_type??null,
      budget_context:body?.budget_context??inferred.budget_context??current.budget_context??null,
      urgency:body?.urgency??inferred.urgency??current.urgency??null,
      preferences:{...(current.preferences||{}),...(inferred.preferences||{}),...(body?.preferences||{})},
      technical_result:current.technical_result||{},
      candidate_products:current.candidate_products||[],
      last_inbox_id:body?.inbox_id??current.last_inbox_id??null,
      updated_at:new Date().toISOString()
    };

    if(state.technical_family_key&&state.optical_case&&state.prescription?.od&&state.prescription?.oi){
      const od=state.prescription.od||{};
      const oi=state.prescription.oi||{};
      const addition=state.prescription.addition??od.addition??oi.addition??null;
      const {data:evaluation,error:evaluationError}=await supabase.rpc("black_ai_evaluate_prescription_case",{
        p_family_key:state.technical_family_key,p_optical_case:state.optical_case,
        p_sphere_od:od.sphere??null,p_cylinder_od:od.cylinder??null,p_axis_od:od.axis??null,
        p_sphere_oi:oi.sphere??null,p_cylinder_oi:oi.cylinder??null,p_axis_oi:oi.axis??null,p_addition:addition
      });
      if(evaluationError)throw evaluationError;
      if(evaluation){
        state.technical_result=evaluation;
        state.missing_data=Array.isArray(evaluation?.missing_data)?evaluation.missing_data:[];
        state.requires_human_review=Boolean(evaluation?.requires_human_review);
        if(evaluation?.status==="resolved")state.stage="technical";
      }
    }

    let nextKey:string|null=null;
    if(["appointment","support","product_info"].includes(state.objective)){
      nextKey=state.objective==="appointment"?"appointment_details":state.objective==="support"?"support_details":"product_details";
    }else{
      const {data,error}=await supabase.rpc("black_ai_next_question_key",{
        p_objective:state.objective,p_prescription:state.prescription,p_optical_case:state.optical_case,
        p_main_use:state.main_use,p_previous_lens_type:state.previous_lens_type,
        p_technical_family_key:state.technical_family_key,p_technical_result:state.technical_result
      });
      if(error)throw error;
      nextKey=data;
    }

    const price=(priceRequest!=="none"&&state.optical_case)?await getPriceSnapshot(supabase,state.optical_case):null;
    const fallback=questionForKey(nextKey,state.objective);
    const previousKey=current.next_best_question_key||null;
    const previousContext=current.next_best_question_context||{};
    const repeated=Boolean(previousKey&&nextKey&&previousKey===nextKey);
    const previousReply=String(previousContext.generated_reply||"");
    const previousCount=Number(previousContext.repeat_count||0);
    const repeatCount=repeated?previousCount+1:0;

    const reply=await writeContextualReply({message,state,nextKey,fallback,price,priceRequest,repeated,previousReply});
    state.next_best_question_key=nextKey;
    state.next_best_question_context={
      ...previousContext,
      suggested_question:fallback,
      generated_reply:reply,
      last_message:message.slice(0,500),
      inferred_facts:inferred,
      extraction_mode:extraction.mode,
      price_request:priceRequest,
      price_snapshot:price,
      previous_question_key:previousKey,
      repeat_count:repeatCount,
      reply_mode:reply===fallback?"fallback":"openai_contextual"
    };

    const {data:upserted,error:upsertError}=await supabase.from("black_ai_case_state").upsert(state,{onConflict:"phone"}).select("*").single();
    if(upsertError)throw upsertError;

    return json({
      ok:true,state:upserted,next_question_key:nextKey,suggested_question:fallback,reply,
      inferred_facts:inferred,extraction_mode:extraction.mode,price_request:priceRequest,
      price_snapshot:price,loop_guard:{repeated,repeat_count:repeatCount},
      reply_mode:reply===fallback?"fallback":"openai_contextual"
    });
  }catch(error){
    console.error("black-ai-case-orchestrator",error);
    return json({error:String((error as any)?.message||"Error interno")},500);
  }
});
