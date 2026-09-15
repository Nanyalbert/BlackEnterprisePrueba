import { createClient } from "npm:@supabase/supabase-js@2";

const BUILD_ID="black-ai-case-orchestrator-20260914-router2";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{
  status,
  headers:{"Content-Type":"application/json; charset=utf-8","x-black-ai-build":BUILD_ID}
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
  }catch(_){if(raw.length>10)return raw;}
  return "";
}

function getServiceKey(){
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||firstSecretValue(Deno.env.get("SUPABASE_SECRET_KEYS"));
}

function extractOutputText(payload:any){
  if(typeof payload?.output_text==="string"&&payload.output_text.trim())return payload.output_text.trim();
  const parts:string[]=[];
  for(const item of payload?.output||[])for(const content of item?.content||[])if(content?.type==="output_text"&&typeof content?.text==="string")parts.push(content.text);
  return parts.join("\n").trim();
}

function parseJsonObject(text:string){
  const cleaned=String(text||"").trim().replace(/^```json\s*/i,"").replace(/^```\s*/i,"").replace(/```$/i,"").trim();
  try{return JSON.parse(cleaned)}catch(_){ }
  const start=cleaned.indexOf("{");const end=cleaned.lastIndexOf("}");
  if(start>=0&&end>start){try{return JSON.parse(cleaned.slice(start,end+1))}catch(_){ }}
  return null;
}

function normalizeText(value:string){return String(value||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").trim();}
function words(value:string){return normalizeText(value).split(/[^a-z0-9]+/).filter((x)=>x.length>=3);}

function isAffirmative(message:string){
  const t=normalizeText(message);
  return /^(si|sí|correcto|correcta|correctos|esta bien|estan bien|tal cual|confirmo|confirmado|ok|okay|dale|perfecto)(\b|[.! ])/.test(t);
}
function isNegative(message:string){
  const t=normalizeText(message);
  return /^(no|incorrecto|incorrecta|esta mal|estan mal|no esta bien|hay un error)(\b|[.! ])/.test(t);
}
function explicitlyDeniesPrescription(message:string){
  const t=normalizeText(message);
  return /\b(no\s+(te\s+|les\s+)?(mande|envie|pase)\s+(ninguna\s+)?receta|todavia\s+no\s+(te\s+|les\s+)?(mande|envie|pase)\s+receta|no\s+mande\s+receta|no\s+envie\s+receta|no\s+tengo\s+receta)\b/.test(t);
}

function detectDirectIntent(message:string){
  const t=normalizeText(message);
  if(!t)return null;
  if(/^(hola|buenas|buen dia|buenas tardes|buenas noches|holi|hello)[!,. ]*$/.test(t))return "greeting";
  if(/\b(horario|horarios|a que hora|abren|abierto|cierran|cerrado|direccion|ubicacion|donde estan|donde queda|sucursal)\b/.test(t))return "hours_location";
  if(/\b(anteojos? de sol|lentes? de sol|solar|solares|gafas? de sol)\b/.test(t))return "sunglasses";
  if(/\b(armazon|armazones|marco|marcos)\b/.test(t))return "frames";
  if(/\b(lentes? de contacto|contactologia|contactolog)\b/.test(t))return "contact_lenses";
  if(/\b(cuotas?|tarjeta|transferencia|efectivo|medio[s]? de pago|formas? de pago|pagar)\b/.test(t))return "payment_methods";
  if(/\b(black protect|promocion|promo|descuento|beneficio|convenio|obra social|mutual|ministerio)\b/.test(t))return "promotion";
  if(/\b(turno|turnos|agenda|reservar|coordinar atencion)\b/.test(t))return "appointment";
  if(/\b(reclamo|garantia|problema|se rompio|se quebr|devolucion|no me adapto|adaptacion)\b/.test(t))return "support";
  if(/\b(multifocal|monofocal|ocupacional|bifocal|receta|graduacion|cristal|lente)\b/.test(t)&&/\b(precio|sale|cuesta|cotiz|presupuesto|valor)\b/.test(t))return "prescription_lens_quote";
  return null;
}

function normalizeFacts(value:any){
  const allowedObjective=["quote","appointment","support","product_info","other"];
  const allowedCase=["monofocal","bifocal","occupational","multifocal"];
  const allowedPrice=["general","exact","none"];
  const allowedIntent=["greeting","prescription_lens_quote","sunglasses","frames","contact_lenses","hours_location","payment_methods","appointment","support","promotion","general_product","other"];
  const facts:any={};
  if(allowedObjective.includes(value?.objective))facts.objective=value.objective;
  if(allowedCase.includes(value?.optical_case))facts.optical_case=value.optical_case;
  if(allowedPrice.includes(value?.price_request))facts.price_request=value.price_request;
  if(allowedIntent.includes(value?.intent))facts.intent=value.intent;
  if(typeof value?.product_category==="string"&&value.product_category.trim())facts.product_category=value.product_category.trim().slice(0,100);
  if(typeof value?.main_use==="string"&&value.main_use.trim())facts.main_use=value.main_use.trim().slice(0,160);
  if(typeof value?.previous_lens_type==="string"&&value.previous_lens_type.trim())facts.previous_lens_type=value.previous_lens_type.trim().slice(0,160);
  if(typeof value?.budget_context==="string"&&value.budget_context.trim())facts.budget_context=value.budget_context.trim().slice(0,160);
  if(typeof value?.urgency==="string"&&value.urgency.trim())facts.urgency=value.urgency.trim().slice(0,160);
  if(value?.preferences&&typeof value.preferences==="object"&&!Array.isArray(value.preferences))facts.preferences=value.preferences;
  return facts;
}

async function inferFactsWithAI(message:string,current:any){
  const directIntent=detectDirectIntent(message);
  const openAiKey=Deno.env.get("OPENAI_API_KEY")||"";
  if(!openAiKey||!message.trim())return {facts:directIntent?{intent:directIntent}:{},mode:directIntent?"deterministic":"none"};
  const model=Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna";
  const prompt=`
Clasificá el mensaje de un paciente de una óptica y extraé únicamente hechos explícitos.
No asumas que toda conversación es una cotización con receta.

intent permitido:
- greeting
- prescription_lens_quote: cotización de cristales/lentes con graduación, multifocal, monofocal, ocupacional o bifocal
- sunglasses: anteojos/lentes de sol
- frames: armazones
- contact_lenses: lentes de contacto/contactología
- hours_location: horarios, dirección, ubicación o sucursales
- payment_methods: formas de pago/cuotas
- appointment: turnos
- support: reclamos, garantías o problemas
- promotion: promociones, convenios, obras sociales, mutuales o beneficios
- general_product: otra consulta de producto
- other

objective permitido: quote | appointment | support | product_info | other | null
optical_case permitido: monofocal | bifocal | occupational | multifocal | null
price_request: general | exact | none

REGLAS:
- Una consulta de anteojos de sol NO es prescription_lens_quote salvo que el paciente además pregunte por graduación.
- Horarios, ubicación, pagos, promociones, convenios, obras sociales, turnos y reclamos NO requieren receta.
- Si el paciente menciona una institución, empresa, ministerio, mutual u obra social y pregunta o comenta algo relacionado a cobertura/beneficio, puede ser promotion aunque no diga la palabra convenio.
- Un saludo solo es greeting.
- progresivos = multifocal.
- precio general de una categoría = price_request general.
- precio exacto para su graduación/receta = price_request exact.
- No inventes receta, graduación, precio, stock ni diagnóstico.

Respondé SOLO JSON válido:
{"intent":"other","objective":null,"optical_case":null,"price_request":"none","product_category":null,"main_use":null,"previous_lens_type":null,"budget_context":null,"urgency":null,"preferences":{}}

ESTADO ACTUAL:
${JSON.stringify({objective:current?.objective,optical_case:current?.optical_case,prescription_status:current?.prescription_status,main_use:current?.main_use})}

MENSAJE:
${message.slice(0,3000)}
`.trim();
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",headers:{"Authorization":`Bearer ${openAiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({model,input:[{role:"user",content:[{type:"input_text",text:prompt}]}],reasoning:{effort:"low"},max_output_tokens:420,store:false})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){console.error("case extractor OpenAI",response.status,payload);return {facts:directIntent?{intent:directIntent}:{},mode:"openai_error"};}
    const parsed=normalizeFacts(parseJsonObject(extractOutputText(payload))||{});
    if(directIntent)parsed.intent=directIntent;
    return {facts:parsed,mode:"openai"};
  }catch(error){console.error("case extractor",error);return {facts:directIntent?{intent:directIntent}:{},mode:"openai_error"};}
}

function stripKnowledgePrices(value:string){
  return String(value||"").replace(/\$\s*[\d.]+(?:,\d+)?/g,"[precio: consultar Catálogo vigente]");
}

async function getKnowledgeSnapshot(supabase:any,message:string,intent:string|null){
  const today=new Date().toISOString().slice(0,10);
  const {data,error}=await supabase.from("black_ai_knowledge")
    .select("id,category,title,content,data,priority,valid_from,valid_until")
    .eq("is_active",true).order("priority",{ascending:true}).order("updated_at",{ascending:false}).limit(60);
  if(error){console.error("knowledge snapshot",error);return [];}
  const msgWords=new Set(words(message));
  const categoryWeight=(category:string)=>{
    if(intent==="hours_location"||intent==="appointment"||intent==="support")return category==="policy"?35:0;
    if(intent==="payment_methods")return category==="policy"?25:category==="promotion"?20:0;
    if(intent==="promotion")return category==="promotion"?35:category==="policy"?15:0;
    if(["sunglasses","frames","contact_lenses","general_product"].includes(String(intent)))return category==="commercial"?25:category==="price_product"?15:0;
    if(intent==="prescription_lens_quote")return category==="commercial"?25:category==="policy"?12:category==="promotion"?8:0;
    return category==="commercial"?8:category==="policy"?8:0;
  };
  return (data||[]).filter((x:any)=>(!x.valid_from||x.valid_from<=today)&&(!x.valid_until||x.valid_until>=today)).map((x:any)=>{
    const haystackWords=new Set(words(`${x.title} ${x.content}`));
    let overlap=0;for(const w of msgWords)if(haystackWords.has(w))overlap+=1;
    const score=categoryWeight(x.category)+(overlap*8)+Math.max(0,20-Math.min(20,Number(x.priority||100)/5));
    return {...x,score,overlap,content:stripKnowledgePrices(x.content)};
  }).sort((a:any,b:any)=>b.score-a.score||Number(a.priority||100)-Number(b.priority||100)).slice(0,8).map((x:any)=>({id:x.id,category:x.category,title:x.title,content:x.content,priority:x.priority,data:x.data||{},score:x.score,overlap:x.overlap}));
}

function generalFallback(intent:string|null){
  const map:Record<string,string>={
    greeting:"¡Hola! ¿En qué te puedo ayudar? Podés consultarme por anteojos, cristales, horarios, turnos u otra duda.",
    hours_location:"No tengo ese dato confirmado en la información disponible. Si querés, te lo confirma un asesor.",
    sunglasses:"Claro. ¿Qué tipo de anteojo de sol estás buscando?",
    frames:"Claro. ¿Buscás algún estilo de armazón en particular?",
    contact_lenses:"Puedo ayudarte con la consulta de lentes de contacto. ¿Qué necesitás saber?",
    payment_methods:"No tengo las condiciones de pago confirmadas en la información disponible. Puedo derivarte para que te las confirmen.",
    appointment:"Perfecto. ¿Qué día o franja horaria te quedaría cómoda para atenderte?",
    support:"Contame brevemente qué pasó así te ayudo a derivarlo correctamente.",
    promotion:"Puedo revisar los beneficios o convenios vigentes. ¿Sobre cuál querés consultar?",
    general_product:"¿Qué producto o beneficio querés consultar?"
  };
  return map[String(intent)]||"¿En qué te puedo ayudar?";
}

async function answerGeneralQuery(args:{message:string,intent:string|null,knowledge:any[],fallback:string,pendingPrescription:boolean}){
  const {message,intent,knowledge,fallback,pendingPrescription}=args;
  const openAiKey=Deno.env.get("OPENAI_API_KEY")||"";
  if(!openAiKey)return fallback;
  const model=Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna";
  const prompt=`
Sos Black AI, asistente de Black Óptica. Respondé la consulta actual en español argentino, breve y natural.

REGLAS:
- NO conviertas toda consulta en una cotización con receta.
- Horarios, ubicación, anteojos de sol, armazones, lentes de contacto, pagos, promociones, convenios, obras sociales, turnos y soporte se responden según su intención.
- Usá como hechos SOLO el CONOCIMIENTO APROBADO de abajo.
- Si el conocimiento contiene una institución o convenio que coincide con lo que menciona el paciente, respondé usando esa información aunque el paciente no haya dicho literalmente "convenio".
- Si el conocimiento no contiene el dato concreto, no lo inventes.
- Los importes dentro de Conocimiento NO son fuente autorizada de precio; fueron ocultados a propósito. Los precios deben venir del Catálogo en otra etapa.
- No inventes stock, horarios, sucursales, promociones, garantías ni tiempos.
- Si hay una receta pendiente de confirmación pero el paciente hizo otra consulta, respondé esa consulta sin obligarlo a volver a la receta en este mismo mensaje.
- Una sola pregunta principal como máximo.
- Devolvé SOLO el texto final.

INTENCIÓN: ${intent||"other"}
RECETA PENDIENTE: ${pendingPrescription?"sí":"no"}
MENSAJE: ${message.slice(0,2000)}
CONOCIMIENTO APROBADO:
${JSON.stringify(knowledge)}
`.trim();
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",headers:{"Authorization":`Bearer ${openAiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({model,input:[{role:"user",content:[{type:"input_text",text:prompt}]}],reasoning:{effort:"low"},max_output_tokens:260,store:false})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){console.error("general reply OpenAI",response.status,payload);return fallback;}
    return extractOutputText(payload).trim().slice(0,1200)||fallback;
  }catch(error){console.error("general reply",error);return fallback;}
}

function money(value:number,currency="ARS"){
  try{return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(value)}catch(_){return `$${Math.round(value).toLocaleString("es-AR")}`;}
}

async function getPriceSnapshot(supabase:any,opticalCase:string|null){
  if(!opticalCase)return null;
  const today=new Date().toISOString().slice(0,10);
  const {data,error}=await supabase.from("black_ai_products")
    .select("id,name,design,material,treatment,base_price,currency,valid_from,valid_until,supply_mode,metadata")
    .eq("is_active",true).eq("family","lens").eq("optical_case",opticalCase).not("base_price","is",null).order("base_price",{ascending:true}).limit(80);
  if(error){console.error("price snapshot",error);return null;}
  const rows=(data||[]).filter((x:any)=>{const p=Number(x.base_price);return Number.isFinite(p)&&p>0&&(!x.valid_from||x.valid_from<=today)&&(!x.valid_until||x.valid_until>=today);});
  if(!rows.length)return null;
  const unique:any[]=[];const seen=new Set<string>();
  for(const row of rows){const key=String(row.design||row.name||"").toLowerCase();if(seen.has(key))continue;seen.add(key);unique.push(row);if(unique.length>=4)break;}
  const min=Number(rows[0].base_price);const max=Number(rows[rows.length-1].base_price);
  return {optical_case:opticalCase,currency:rows[0].currency||"ARS",min_price:min,max_price:max,min_label:money(min,rows[0].currency||"ARS"),max_label:money(max,rows[0].currency||"ARS"),examples:unique.map((x:any)=>({id:x.id,name:x.name,design:x.design,material:x.material,treatment:x.treatment,price:Number(x.base_price),price_label:money(Number(x.base_price),x.currency||"ARS")}))};
}

function questionForKey(key:string|null,objective:string|null){
  if(objective==="appointment")return "Perfecto. ¿Qué día o franja horaria te quedaría cómoda para atenderte?";
  if(objective==="support")return "Contame brevemente qué pasó así te ayudo a derivarlo correctamente.";
  if(objective==="product_info")return "¿Qué producto querés consultar?";
  const questions:Record<string,string>={
    clarify_objective:"¿Qué te gustaría consultar?",
    request_prescription:"Si querés una cotización para lentes con graduación, ¿tenés una receta óptica para pasarme? Podés enviarme una foto.",
    complete_prescription:"Me faltan algunos datos de la receta. ¿Podés mandarme una foto completa y nítida?",
    request_axis_od:"¿Me confirmás el eje del ojo derecho (OD)?",
    request_axis_oi:"¿Me confirmás el eje del ojo izquierdo (OI)?",
    request_addition:"¿La receta indica una adición (ADD) para cerca?",
    clarify_optical_case:"¿Buscás lentes monofocales, multifocales, ocupacionales o bifocales?",
    ask_main_use:"Perfecto, receta confirmada. ¿Para qué los vas a usar principalmente: lejos, lectura, computadora o uso diario?",
    ask_previous_lens_experience:"¿Ya usaste este tipo de lentes antes?",
    choose_technical_family:"Con esos datos ya puedo avanzar con la evaluación técnica del lente.",
    run_technical_evaluation:"Ya tengo los datos necesarios para evaluar la receta.",
    ready_for_proposal:"Ya tengo la información técnica necesaria para armarte una propuesta."
  };
  return key?(questions[key]||""):"";
}

async function writeContextualReply(args:{message:string,state:any,nextKey:string|null,fallback:string,price:any,priceRequest:string,repeated:boolean,previousReply:string,knowledge:any[],justConfirmed:boolean}){
  const {message,state,nextKey,fallback,price,priceRequest,repeated,previousReply,knowledge,justConfirmed}=args;
  const openAiKey=Deno.env.get("OPENAI_API_KEY")||"";
  if(!openAiKey||!message.trim())return fallback;
  const model=Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna";
  const prompt=`
Sos Black AI, asistente de Black Óptica en Argentina. Redactá UNA respuesta breve de WhatsApp, natural y profesional.

REGLAS:
- Una sola pregunta principal.
- Si la receta acaba de ser confirmada, reconocelo brevemente y avanzá al próximo dato; NO vuelvas a pedir la receta.
- No cotices un caso exacto mientras prescription_status no sea confirmed.
- Respondé primero la consulta concreta y luego pedí el próximo dato útil.
- No repitas mecánicamente la respuesta anterior.
- Si price_request=general y hay PRECIOS DEL CATÁLOGO, podés informar "desde" usando exclusivamente esos importes.
- Si price_request=exact y la receta está confirmada, podés usar únicamente PRECIOS DEL CATÁLOGO.
- Nunca uses importes escritos en CONOCIMIENTO como fuente de precio.
- CONOCIMIENTO define estilo, explicaciones, políticas y criterios comerciales aprobados.
- No inventes promociones, stock, tiempos, garantías, características ni diagnósticos.
- No menciones motores, bases de datos, estados internos ni IA.
- Devolvé SOLO el texto final.

MENSAJE: ${message.slice(0,2000)}
CONTEXTO: ${JSON.stringify({objective:state?.objective,optical_case:state?.optical_case,main_use:state?.main_use,previous_lens_type:state?.previous_lens_type,preferences:state?.preferences,prescription_status:state?.prescription_status})}
RECETA ACABA DE CONFIRMARSE: ${justConfirmed?"sí":"no"}
PRICE_REQUEST: ${priceRequest}
PRECIOS DEL CATÁLOGO: ${JSON.stringify(price||null)}
CONOCIMIENTO APROBADO: ${JSON.stringify(knowledge)}
PRÓXIMO PASO: ${nextKey||"sin clave"}
PREGUNTA BASE: ${fallback||""}
SE REPITE: ${repeated?"sí":"no"}
RESPUESTA ANTERIOR: ${String(previousReply||"").slice(0,1000)}
`.trim();
  try{
    const response=await fetch("https://api.openai.com/v1/responses",{
      method:"POST",headers:{"Authorization":`Bearer ${openAiKey}`,"Content-Type":"application/json"},
      body:JSON.stringify({model,input:[{role:"user",content:[{type:"input_text",text:prompt}]}],reasoning:{effort:"low"},max_output_tokens:260,store:false})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){console.error("case reply OpenAI",response.status,payload);return fallback;}
    return extractOutputText(payload).trim().slice(0,1200)||fallback;
  }catch(error){console.error("case reply",error);return fallback;}
}

async function persistContext(supabase:any,current:any,phone:string,patch:any){
  const payload={...current,phone,...patch,updated_at:new Date().toISOString()};
  delete payload.id;delete payload.created_at;
  const {data,error}=await supabase.from("black_ai_case_state").upsert(payload,{onConflict:"phone"}).select("*").single();
  if(error)throw error;
  return data;
}

Deno.serve(async(req)=>{
  if(req.method!=="POST")return json({error:"Método no permitido",build_id:BUILD_ID},405);
  try{
    const expected=Deno.env.get("BLACK_AI_WEBHOOK_SECRET")||"";
    const url=new URL(req.url);const supplied=req.headers.get("x-black-ai-webhook-secret")||url.searchParams.get("token")||"";
    if(!expected)return json({error:"BLACK_AI_WEBHOOK_SECRET no configurado",build_id:BUILD_ID},500);
    if(supplied!==expected)return json({error:"No autorizado",build_id:BUILD_ID},401);

    const supabaseUrl=Deno.env.get("SUPABASE_URL")||"";const serviceKey=getServiceKey();
    if(!supabaseUrl||!serviceKey)return json({error:"Configuración de Supabase incompleta",build_id:BUILD_ID},500);
    const supabase=createClient(supabaseUrl,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});

    const body=await req.json().catch(()=>({}));
    const phone=String(body?.phone||"").replace(/\D/g,"");const message=String(body?.message||"").trim();
    if(!phone)return json({error:"Falta phone",build_id:BUILD_ID},400);

    const {data:existing,error:readError}=await supabase.from("black_ai_case_state").select("*").eq("phone",phone).maybeSingle();
    if(readError)throw readError;
    const current=existing||{phone,stage:"discovery",prescription:{},prescription_status:"none",preferences:{},technical_result:{},candidate_products:[],next_best_question_context:{}};

    const extraction=await inferFactsWithAI(message,current);
    const inferred=extraction.facts||{};
    const intent=String(inferred.intent||detectDirectIntent(message)||"other");
    const pendingPrescription=current.prescription_status==="awaiting_confirmation"||current.prescription_status==="needs_review";
    let justConfirmed=false;

    // Si el paciente aclara que nunca envió receta, un estado viejo no puede secuestrar la conversación.
    if(explicitlyDeniesPrescription(message)){
      const upserted=await persistContext(supabase,current,phone,{
        prescription:{},prescription_status:"none",prescription_confirmed_at:null,prescription_source_message_id:null,prescription_analysis:{},prescription_updated_at:null,
        technical_result:{},candidate_products:[],missing_data:[],technical_family_key:null,requires_human_review:false,stage:"discovery",last_patient_message_at:new Date().toISOString(),
        next_best_question_key:null,next_best_question_context:{build_id:BUILD_ID,last_message:message.slice(0,500),route:"prescription_state_reset",reason:"patient_denied_having_sent_prescription"}
      });
      return json({ok:true,build_id:BUILD_ID,state:upserted,reply:"Perfecto, gracias por aclararlo. Dejamos de lado la receta. ¿Qué querés consultar?",route:"prescription_state_reset"});
    }

    // Primero consultamos Conocimiento. Una coincidencia clara tiene prioridad sobre un estado viejo de receta.
    const knowledgeProbe=await getKnowledgeSnapshot(supabase,message,intent);
    const strongKnowledgeMatch=knowledgeProbe.some((x:any)=>Number(x.overlap||0)>=2||Number(x.score||0)>=34);
    const directGeneral=["greeting","hours_location","sunglasses","frames","contact_lenses","payment_methods","appointment","support","promotion","general_product"].includes(intent)
      || (intent==="other"&&strongKnowledgeMatch);

    // La confirmación de receta solo se procesa cuando realmente es una respuesta a esa confirmación.
    if(current.prescription_status==="awaiting_confirmation"&&isAffirmative(message)&&!directGeneral){
      justConfirmed=true;
      current.prescription_status="confirmed";
      current.prescription_confirmed_at=new Date().toISOString();
      current.stage="needs";
      current.requires_human_review=false;
    }else if(current.prescription_status==="awaiting_confirmation"&&isNegative(message)&&!directGeneral){
      const upserted=await persistContext(supabase,current,phone,{
        prescription_status:"needs_review",stage:"prescription",requires_human_review:true,last_patient_message_at:new Date().toISOString(),
        next_best_question_key:"correct_prescription",next_best_question_context:{...(current.next_best_question_context||{}),build_id:BUILD_ID,last_message:message.slice(0,500),reason:"patient_rejected_transcription"}
      });
      return json({ok:true,build_id:BUILD_ID,state:upserted,reply:"Gracias por avisarme. Para no cotizar con un dato incorrecto, mandame otra foto de la receta más de frente y nítida y la vuelvo a leer.",route:"prescription_correction"});
    }

    // Consultas generales o coincidencias claras de Conocimiento tienen prioridad sobre el flujo de receta.
    if(directGeneral){
      const routedIntent=intent==="other"&&strongKnowledgeMatch?"general_product":intent;
      const knowledge=knowledgeProbe;
      const fallback=generalFallback(routedIntent);
      const reply=await answerGeneralQuery({message,intent:routedIntent,knowledge,fallback,pendingPrescription:pendingPrescription&&!justConfirmed});
      const upserted=await persistContext(supabase,current,phone,{
        prescription_status:current.prescription_status||"none",
        prescription_confirmed_at:current.prescription_confirmed_at||null,
        last_patient_message_at:new Date().toISOString(),
        next_best_question_context:{...(current.next_best_question_context||{}),build_id:BUILD_ID,last_message:message.slice(0,500),last_intent:routedIntent,knowledge_ids:knowledge.map((x:any)=>x.id),knowledge_match:strongKnowledgeMatch,route:"general_query"}
      });
      return json({ok:true,build_id:BUILD_ID,state:upserted,reply,intent:routedIntent,route:"general_query",knowledge_used:knowledge.map((x:any)=>({id:x.id,title:x.title,category:x.category,score:x.score,overlap:x.overlap}))});
    }

    if(current.prescription_status==="awaiting_confirmation"&&!justConfirmed){
      return json({ok:true,build_id:BUILD_ID,state:current,reply:"Antes de avanzar con la cotización, necesito que me confirmes si los valores que te leí de la receta están correctos.",route:"prescription_confirmation_gate"});
    }
    if(current.prescription_status==="needs_review"){
      return json({ok:true,build_id:BUILD_ID,state:current,reply:"La receta quedó pendiente de revisión porque hay datos que no se pudieron confirmar. Mandame una foto nueva, completa y nítida, y la vuelvo a leer.",route:"prescription_review_gate"});
    }

    const priceRequest=String(inferred.price_request||"none");
    const prescription=body?.prescription&&typeof body.prescription==="object"?{...(current.prescription||{}),...body.prescription}:current.prescription||{};
    const state:any={
      phone,
      objective:body?.objective??inferred.objective??current.objective??null,
      stage:body?.stage??current.stage??"discovery",
      prescription,
      prescription_status:current.prescription_status||"none",
      prescription_confirmed_at:current.prescription_confirmed_at||null,
      prescription_source_message_id:current.prescription_source_message_id||null,
      prescription_analysis:current.prescription_analysis||{},
      prescription_updated_at:current.prescription_updated_at||null,
      conversation_started_at:current.conversation_started_at||new Date().toISOString(),
      last_patient_message_at:new Date().toISOString(),
      optical_case:body?.optical_case??inferred.optical_case??current.optical_case??null,
      technical_family_key:body?.technical_family_key??current.technical_family_key??null,
      main_use:body?.main_use??inferred.main_use??current.main_use??null,
      previous_lens_type:body?.previous_lens_type??inferred.previous_lens_type??current.previous_lens_type??null,
      budget_context:body?.budget_context??inferred.budget_context??current.budget_context??null,
      urgency:body?.urgency??inferred.urgency??current.urgency??null,
      preferences:{...(current.preferences||{}),...(inferred.preferences||{}),...(body?.preferences||{})},
      technical_result:current.technical_result||{},candidate_products:current.candidate_products||[],missing_data:current.missing_data||[],requires_human_review:Boolean(current.requires_human_review),
      last_inbox_id:body?.inbox_id??current.last_inbox_id??null,updated_at:new Date().toISOString()
    };

    if(state.prescription_status==="confirmed"&&state.technical_family_key&&state.optical_case&&state.prescription?.od&&state.prescription?.oi){
      const od=state.prescription.od||{};const oi=state.prescription.oi||{};const addition=state.prescription.addition??od.addition??oi.addition??null;
      const {data:evaluation,error:evaluationError}=await supabase.rpc("black_ai_evaluate_prescription_case",{
        p_family_key:state.technical_family_key,p_optical_case:state.optical_case,p_sphere_od:od.sphere??null,p_cylinder_od:od.cylinder??null,p_axis_od:od.axis??null,p_sphere_oi:oi.sphere??null,p_cylinder_oi:oi.cylinder??null,p_axis_oi:oi.axis??null,p_addition:addition
      });
      if(evaluationError)throw evaluationError;
      if(evaluation){state.technical_result=evaluation;state.missing_data=Array.isArray(evaluation?.missing_data)?evaluation.missing_data:[];state.requires_human_review=Boolean(evaluation?.requires_human_review);if(evaluation?.status==="resolved")state.stage="technical";}
    }

    let nextKey:string|null=null;
    if(["appointment","support","product_info"].includes(state.objective)){
      nextKey=state.objective==="appointment"?"appointment_details":state.objective==="support"?"support_details":"product_details";
    }else{
      const prescriptionForDecision=state.prescription_status==="confirmed"?state.prescription:{};
      const {data,error}=await supabase.rpc("black_ai_next_question_key",{
        p_objective:state.objective,p_prescription:prescriptionForDecision,p_optical_case:state.optical_case,p_main_use:state.main_use,p_previous_lens_type:state.previous_lens_type,p_technical_family_key:state.technical_family_key,p_technical_result:state.technical_result
      });
      if(error)throw error;nextKey=data;
    }

    const allowPrice=priceRequest==="general"||(priceRequest==="exact"&&state.prescription_status==="confirmed");
    const price=(allowPrice&&state.optical_case)?await getPriceSnapshot(supabase,state.optical_case):null;
    const knowledge=knowledgeProbe.length?knowledgeProbe:await getKnowledgeSnapshot(supabase,message,intent==="other"?"prescription_lens_quote":intent);
    const fallback=questionForKey(nextKey,state.objective);
    const previousKey=current.next_best_question_key||null;const previousContext=current.next_best_question_context||{};
    const repeated=Boolean(previousKey&&nextKey&&previousKey===nextKey);const previousReply=String(previousContext.generated_reply||"");const previousCount=Number(previousContext.repeat_count||0);const repeatCount=repeated?previousCount+1:0;
    const reply=await writeContextualReply({message,state,nextKey,fallback,price,priceRequest,repeated,previousReply,knowledge,justConfirmed});

    state.next_best_question_key=nextKey;
    state.next_best_question_context={...previousContext,build_id:BUILD_ID,suggested_question:fallback,generated_reply:reply,last_message:message.slice(0,500),last_intent:intent,inferred_facts:inferred,extraction_mode:extraction.mode,price_request:priceRequest,price_snapshot:price,knowledge_ids:knowledge.map((x:any)=>x.id),previous_question_key:previousKey,repeat_count:repeatCount,reply_mode:reply===fallback?"fallback":"openai_contextual"};

    const {data:upserted,error:upsertError}=await supabase.from("black_ai_case_state").upsert(state,{onConflict:"phone"}).select("*").single();
    if(upsertError)throw upsertError;
    return json({ok:true,build_id:BUILD_ID,state:upserted,next_question_key:nextKey,suggested_question:fallback,reply,intent,inferred_facts:inferred,extraction_mode:extraction.mode,price_request:priceRequest,price_snapshot:price,knowledge_used:knowledge.map((x:any)=>({id:x.id,title:x.title,category:x.category,score:x.score,overlap:x.overlap})),loop_guard:{repeated,repeat_count:repeatCount},route:"prescription_flow",reply_mode:reply===fallback?"fallback":"openai_contextual"});
  }catch(error){
    console.error("black-ai-case-orchestrator",error);
    return json({error:String((error as any)?.message||"Error interno"),build_id:BUILD_ID},500);
  }
});
