import { createClient } from "npm:@supabase/supabase-js@2";

const BUILD_ID="black-ai-case-orchestrator-20260914-commercial1";

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
  if(/\b(multifocal|multifocales|progresivo|progresivos|monofocal|monofocales|ocupacional|ocupacionales|bifocal|bifocales|receta|graduacion|cristal|cristales|lente|lentes)\b/.test(t)&&/\b(precio|precios|sale|salen|cuesta|cuestan|cotiz|presupuesto|valor|valores)\b/.test(t))return "prescription_lens_quote";
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
- prescription_lens_quote
- sunglasses
- frames
- contact_lenses
- hours_location
- payment_methods
- appointment
- support
- promotion
- general_product
- other

objective permitido: quote | appointment | support | product_info | other | null
optical_case permitido: monofocal | bifocal | occupational | multifocal | null
price_request: general | exact | none

REGLAS:
- Una consulta de anteojos de sol NO es prescription_lens_quote salvo que el paciente además pregunte por graduación.
- Horarios, ubicación, pagos, promociones, convenios, obras sociales, turnos y reclamos NO requieren receta.
- Si el paciente menciona una institución, empresa, ministerio, mutual u obra social y pregunta o comenta algo relacionado a cobertura/beneficio, puede ser promotion aunque no diga la palabra convenio.
- progresivos = multifocal.
- Si dice que quiere multifocales pero NO pregunta precio, price_request=none.
- Si pregunta precios de multifocales/monofocales como categoría, price_request=general.
- price_request=exact solo cuando solicita precio exacto de SU caso particular con graduación/configuración específica.
- No deduzcas que es primer usuario de multifocales. previous_lens_type solo se completa si el paciente lo dijo explícitamente.
- No inventes receta, graduación, precio, stock ni diagnóstico.

Respondé SOLO JSON válido:
{"intent":"other","objective":null,"optical_case":null,"price_request":"none","product_category":null,"main_use":null,"previous_lens_type":null,"budget_context":null,"urgency":null,"preferences":{}}

ESTADO ACTUAL:
${JSON.stringify({objective:current?.objective,optical_case:current?.optical_case,prescription_status:current?.prescription_status,main_use:current?.main_use,previous_lens_type:current?.previous_lens_type})}

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
  return String(value||"").replace(/\$\s*[\d.]+(?:,\d+)?/g,"[precio: usar Catálogo vigente]");
}

function structuredKnowledgeBonus(data:any,context:any){
  if(!data||typeof data!=="object")return 0;
  let score=0;
  if(data.scope==="global")score+=12;
  if(data.intent&&context?.intent&&data.intent===context.intent)score+=30;
  if(data.optical_case&&context?.optical_case&&data.optical_case===context.optical_case)score+=40;
  if(data.supply_mode&&context?.supply_mode&&data.supply_mode===context.supply_mode)score+=35;
  if(data.treatment&&context?.treatment&&data.treatment===context.treatment)score+=25;
  return score;
}

async function getKnowledgeSnapshot(supabase:any,message:string,intent:string|null,context:any={}){
  const today=new Date().toISOString().slice(0,10);
  const {data,error}=await supabase.from("black_ai_knowledge")
    .select("id,category,title,content,data,priority,valid_from,valid_until")
    .eq("is_active",true).order("priority",{ascending:true}).order("updated_at",{ascending:false}).limit(80);
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
  return (data||[])
    .filter((x:any)=>(!x.valid_from||x.valid_from<=today)&&(!x.valid_until||x.valid_until>=today))
    .map((x:any)=>{
      const haystackWords=new Set(words(`${x.title} ${x.content}`));
      let overlap=0;for(const w of msgWords)if(haystackWords.has(w))overlap+=1;
      const score=categoryWeight(x.category)+(overlap*8)+structuredKnowledgeBonus(x.data,{...context,intent})+Math.max(0,20-Math.min(20,Number(x.priority||100)/5));
      return {...x,score,overlap,content:stripKnowledgePrices(x.content)};
    })
    .sort((a:any,b:any)=>b.score-a.score||Number(a.priority||100)-Number(b.priority||100))
    .slice(0,10)
    .map((x:any)=>({id:x.id,category:x.category,title:x.title,content:x.content,priority:x.priority,data:x.data||{},score:x.score,overlap:x.overlap}));
}

function generalFallback(intent:string|null){
  const map:Record<string,string>={
    greeting:"¡Hola! ¿En qué te puedo ayudar?",
    hours_location:"No tengo ese dato confirmado en la información disponible. Si querés, te lo confirma un asesor.",
    sunglasses:"Claro. ¿Qué tipo de anteojo de sol estás buscando?",
    frames:"Claro. ¿Buscás algún estilo de armazón en particular?",
    contact_lenses:"Puedo ayudarte con lentes de contacto. ¿Qué necesitás saber?",
    payment_methods:"No tengo las condiciones de pago confirmadas en la información disponible. Puedo derivarte para que te las confirmen.",
    appointment:"¿Qué día o franja horaria te quedaría cómoda para atenderte?",
    support:"Contame brevemente qué pasó así te ayudo a derivarlo correctamente.",
    promotion:"Puedo revisar los beneficios o convenios vigentes. ¿Sobre cuál querés consultar?",
    general_product:"¿Qué producto o beneficio querés consultar?"
  };
  return map[String(intent)]||"¿En qué te puedo ayudar?";
}

async function getAssistantConfig(supabase:any){
  try{
    const {data}=await supabase.from("black_ai_settings").select("config").eq("id","global").maybeSingle();
    return {tone:String(data?.config?.tone||"friendly"),length:String(data?.config?.length||"short"),emoji:String(data?.config?.emoji||"moderate")};
  }catch(_){return {tone:"friendly",length:"short",emoji:"moderate"};}
}

function styleInstruction(config:any){
  const tone=config?.tone==="formal"?"profesional y sobrio":config?.tone==="direct"?"directo y práctico":"cercano, natural y profesional";
  const length=config?.length==="long"?"Podés desarrollar un poco si aporta valor.":config?.length==="medium"?"Mantené una extensión moderada.":"Sé breve: normalmente 1 a 4 oraciones, salvo una cotización estructurada.";
  const emoji=config?.emoji==="none"?"No uses emojis.":config?.emoji==="high"?"Podés usar algunos emojis útiles, sin exagerar.":"Usá como máximo 1 emoji cuando resulte natural; no es obligatorio.";
  return `Tono ${tone}. ${length} ${emoji}`;
}

async function answerGeneralQuery(args:{message:string,intent:string|null,knowledge:any[],fallback:string,pendingPrescription:boolean,style:any}){
  const {message,intent,knowledge,fallback,pendingPrescription,style}=args;
  const openAiKey=Deno.env.get("OPENAI_API_KEY")||"";
  if(!openAiKey)return fallback;
  const model=Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna";
  const prompt=`
Sos Black AI, asistente de Black Óptica. Respondé la consulta actual en español argentino.
${styleInstruction(style)}

REGLAS:
- Respondé primero exactamente lo que preguntó el paciente.
- NO conviertas toda consulta en una cotización con receta.
- Usá como hechos SOLO el CONOCIMIENTO APROBADO de abajo.
- Si el conocimiento no contiene el dato concreto, no lo inventes.
- Los importes dentro de Conocimiento NO son fuente autorizada de precio.
- No inventes stock, horarios, sucursales, promociones, garantías ni tiempos.
- Si hay una receta pendiente y el paciente cambió de tema, respondé el tema nuevo sin arrastrarlo a la receta.
- No termines con una pregunta salvo que realmente necesites un dato para responder o continuar la acción solicitada.
- No te presentes nuevamente si la conversación ya está en curso.
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
      body:JSON.stringify({model,input:[{role:"user",content:[{type:"input_text",text:prompt}]}],reasoning:{effort:"low"},max_output_tokens:300,store:false})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){console.error("general reply OpenAI",response.status,payload);return fallback;}
    return extractOutputText(payload).trim().slice(0,1400)||fallback;
  }catch(error){console.error("general reply",error);return fallback;}
}

function money(value:number,currency="ARS"){
  try{return new Intl.NumberFormat("es-AR",{style:"currency",currency,maximumFractionDigits:0}).format(Math.round(value))}catch(_){return `$${Math.round(value).toLocaleString("es-AR")}`;}
}

function recommendedDesignOrder(knowledge:any[],opticalCase:string|null){
  for(const item of knowledge||[]){
    if(item?.data?.role==="commercial_recommendation"&&(!item.data.optical_case||item.data.optical_case===opticalCase)&&Array.isArray(item.data.recommended_order)){
      return item.data.recommended_order.map((x:any)=>String(x).toUpperCase()).filter(Boolean);
    }
  }
  return [];
}

function productPreferenceScore(row:any,state:any){
  let score=0;
  const treatment=String(row?.treatment||"none");
  const name=normalizeText(row?.name||"");
  const prefs=state?.preferences||{};
  // Para el precio base de cada diseño preferimos la versión blanca/sin tratamiento.
  if(treatment==="none")score+=40;
  if(/organico blanco/.test(name))score+=20;
  if(/antirreflejo/.test(name))score-=5;
  if(/fotocrom/.test(name))score-=10;
  if(/filtro luz azul|super blue/.test(name))score-=10;
  if(prefs?.blue_filter===true&&["blue_filter","super_blue","photochromic_blue"].includes(treatment))score+=70;
  if(prefs?.antireflective===true&&treatment==="antireflective")score+=70;
  if(prefs?.photochromic===true&&["photochromic","photochromic_blue"].includes(treatment))score+=70;
  return score;
}

async function getPriceSnapshot(supabase:any,opticalCase:string|null,knowledge:any[],state:any){
  if(!opticalCase)return null;
  const today=new Date().toISOString().slice(0,10);
  const {data,error}=await supabase.from("black_ai_products")
    .select("id,name,design,material,treatment,base_price,currency,valid_from,valid_until,supply_mode,metadata")
    .eq("is_active",true).eq("family","lens").eq("optical_case",opticalCase).not("base_price","is",null).limit(250);
  if(error){console.error("price snapshot",error);return null;}
  const rows=(data||[]).filter((x:any)=>{
    const p=Number(x.base_price);
    return Number.isFinite(p)&&p>0&&(!x.valid_from||x.valid_from<=today)&&(!x.valid_until||x.valid_until>=today);
  });
  if(!rows.length)return null;

  const order=recommendedDesignOrder(knowledge,opticalCase);
  const designRank=(design:any)=>{
    const d=String(design||"").toUpperCase();
    const idx=order.indexOf(d);
    return idx>=0?idx:100;
  };

  // Elegimos una única referencia base por diseño según criterio comercial,
  // no simplemente el producto más barato de toda la categoría.
  const byDesign=new Map<string,any[]>();
  for(const row of rows){
    const design=String(row.design||row.name||"").trim().toUpperCase();
    if(!byDesign.has(design))byDesign.set(design,[]);
    byDesign.get(design)!.push(row);
  }

  const examples:any[]=[];
  const designs=[...byDesign.keys()].sort((a,b)=>designRank(a)-designRank(b)||a.localeCompare(b));
  for(const design of designs){
    const candidates=byDesign.get(design)||[];
    candidates.sort((a:any,b:any)=>productPreferenceScore(b,state)-productPreferenceScore(a,state)||Number(a.base_price)-Number(b.base_price));
    const chosen=candidates[0];
    if(!chosen)continue;
    examples.push({
      id:chosen.id,
      name:chosen.name,
      design:chosen.design,
      material:chosen.material,
      treatment:chosen.treatment,
      price:Number(chosen.base_price),
      price_label:money(Number(chosen.base_price),chosen.currency||"ARS"),
      commercial_rank:designRank(chosen.design),
      reason:productPreferenceScore(chosen,state)>=70?"explicit_preference":"commercial_base"
    });
    if(examples.length>=6)break;
  }

  const orderedExamples=examples.sort((a:any,b:any)=>a.commercial_rank-b.commercial_rank||a.price-b.price);
  const prices=orderedExamples.map((x:any)=>x.price).filter((x:any)=>Number.isFinite(x));
  return {
    optical_case:opticalCase,
    currency:rows[0].currency||"ARS",
    selection_mode:order.length?"knowledge_commercial_order":"catalog_design_order",
    recommended_order:order,
    min_price:prices.length?Math.min(...prices):null,
    max_price:prices.length?Math.max(...prices):null,
    min_label:prices.length?money(Math.min(...prices),rows[0].currency||"ARS"):null,
    max_label:prices.length?money(Math.max(...prices),rows[0].currency||"ARS"):null,
    examples:orderedExamples
  };
}

function questionForKey(key:string|null,objective:string|null){
  if(objective==="appointment")return "¿Qué día o franja horaria te quedaría cómoda para atenderte?";
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
    ask_main_use:"¿Para qué los vas a usar principalmente: lejos, lectura, computadora o uso diario?",
    ask_previous_lens_experience:"¿Ya usaste multifocales antes?",
    choose_technical_family:"Con esos datos ya puedo avanzar con la evaluación técnica del lente.",
    run_technical_evaluation:"Ya tengo los datos necesarios para evaluar la receta.",
    ready_for_proposal:"Ya tengo la información técnica necesaria para armarte una propuesta."
  };
  return key?(questions[key]||""):"";
}

async function writeContextualReply(args:{message:string,state:any,nextKey:string|null,fallback:string,price:any,priceRequest:string,repeated:boolean,previousReply:string,knowledge:any[],justConfirmed:boolean,style:any}){
  const {message,state,nextKey,fallback,price,priceRequest,repeated,previousReply,knowledge,justConfirmed,style}=args;
  const openAiKey=Deno.env.get("OPENAI_API_KEY")||"";
  if(!openAiKey||!message.trim())return fallback;
  const model=Deno.env.get("OPENAI_MODEL")||"gpt-5.6-luna";
  const prompt=`
Sos Black AI, asistente de Black Óptica en Argentina. Redactá UNA respuesta de WhatsApp natural.
${styleInstruction(style)}

REGLAS DURAS:
- Respondé primero lo que preguntó el paciente.
- NO afirmes nada sobre el paciente que no haya dicho explícitamente. Ejemplo: no digas "para tus primeros multifocales" si nunca dijo que sean sus primeros multifocales.
- Diferenciá información genérica de personalización: podés decir "Smart NEW suele orientarse a primeros usuarios" solo como descripción general, nunca como hecho sobre este paciente salvo confirmación explícita.
- NO recomiendes un diseño específico si todavía faltan datos que el PRÓXIMO PASO pide y el paciente no pidió una recomendación específica.
- Si price_request=none, NO muestres precios ni inventes una recomendación comercial: avanzá únicamente con la PREGUNTA BASE si hace falta.
- Si price_request=general y hay PRECIOS DEL CATÁLOGO, podés mostrar opciones. Respetá EXACTAMENTE el orden de examples y sus importes. No sustituyas un producto por otro.
- Si price_request=exact, solo cotizá si prescription_status=confirmed y el motor ya tiene información suficiente; si no, pedí el próximo dato.
- Los precios válidos son EXCLUSIVAMENTE los de PRECIOS DEL CATÁLOGO. Nunca uses precios escritos en CONOCIMIENTO.
- CONOCIMIENTO define orden, estilo, explicaciones y políticas, pero no reemplaza Catálogo.
- Si existe PREGUNTA BASE y todavía no corresponde cotizar, hacé esa pregunta; no inventes preguntas como armazón, color o presupuesto.
- Una sola pregunta principal.
- No repitas mecánicamente la respuesta anterior.
- No inventes stock, tiempos, garantías, características técnicas ni diagnósticos.
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
      body:JSON.stringify({model,input:[{role:"user",content:[{type:"input_text",text:prompt}]}],reasoning:{effort:"low"},max_output_tokens:420,store:false})
    });
    const payload=await response.json().catch(()=>({}));
    if(!response.ok){console.error("case reply OpenAI",response.status,payload);return fallback;}
    return extractOutputText(payload).trim().slice(0,1800)||fallback;
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
    const style=await getAssistantConfig(supabase);

    const body=await req.json().catch(()=>({}));
    const phone=String(body?.phone||"").replace(/\D/g,"");const message=String(body?.message||"").trim();
    if(!phone)return json({error:"Falta phone",build_id:BUILD_ID},400);

    const {data:existing,error:readError}=await supabase.from("black_ai_case_state").select("*").eq("phone",phone).maybeSingle();
    if(readError)throw readError;
    const current=existing||{phone,stage:"discovery",prescription:{},prescription_status:"none",preferences:{},technical_result:{},candidate_products:[],next_best_question_context:{}};

    const extraction=await inferFactsWithAI(message,current);
    const inferred=extraction.facts||{};
    const intent=String(inferred.intent||detectDirectIntent(message)||"other");
    const inferredOpticalCase=inferred.optical_case??current.optical_case??null;
    const pendingPrescription=current.prescription_status==="awaiting_confirmation"||current.prescription_status==="needs_review";
    let justConfirmed=false;

    if(explicitlyDeniesPrescription(message)){
      const upserted=await persistContext(supabase,current,phone,{
        prescription:{},prescription_status:"none",prescription_confirmed_at:null,prescription_source_message_id:null,prescription_analysis:{},prescription_updated_at:null,
        technical_result:{},candidate_products:[],missing_data:[],technical_family_key:null,requires_human_review:false,stage:"discovery",last_patient_message_at:new Date().toISOString(),
        next_best_question_key:null,next_best_question_context:{build_id:BUILD_ID,last_message:message.slice(0,500),route:"prescription_state_reset",reason:"patient_denied_having_sent_prescription"}
      });
      return json({ok:true,build_id:BUILD_ID,state:upserted,reply:"Perfecto, gracias por aclararlo. Dejamos de lado la receta. ¿Qué querés consultar?",route:"prescription_state_reset"});
    }

    const knowledgeProbe=await getKnowledgeSnapshot(supabase,message,intent,{optical_case:inferredOpticalCase});
    // Una coincidencia por conocimiento requiere coincidencia textual o estructurada real;
    // la categoría sola no puede secuestrar un mensaje ambiguo.
    const strongKnowledgeMatch=knowledgeProbe.some((x:any)=>Number(x.overlap||0)>=1||structuredKnowledgeBonus(x.data,{intent,optical_case:inferredOpticalCase})>=30);
    const directGeneral=["greeting","hours_location","sunglasses","frames","contact_lenses","payment_methods","appointment","support","promotion","general_product"].includes(intent)
      || (intent==="other"&&strongKnowledgeMatch&&inferredOpticalCase==null);

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

    if(directGeneral){
      const routedIntent=intent==="other"&&strongKnowledgeMatch?"general_product":intent;
      const fallback=generalFallback(routedIntent);
      const reply=await answerGeneralQuery({message,intent:routedIntent,knowledge:knowledgeProbe,fallback,pendingPrescription:pendingPrescription&&!justConfirmed,style});
      const upserted=await persistContext(supabase,current,phone,{
        prescription_status:current.prescription_status||"none",
        prescription_confirmed_at:current.prescription_confirmed_at||null,
        last_patient_message_at:new Date().toISOString(),
        next_best_question_context:{...(current.next_best_question_context||{}),build_id:BUILD_ID,last_message:message.slice(0,500),last_intent:routedIntent,knowledge_ids:knowledgeProbe.map((x:any)=>x.id),knowledge_match:strongKnowledgeMatch,route:"general_query"}
      });
      return json({ok:true,build_id:BUILD_ID,state:upserted,reply,intent:routedIntent,route:"general_query",knowledge_used:knowledgeProbe.map((x:any)=>({id:x.id,title:x.title,category:x.category,score:x.score,overlap:x.overlap,data:x.data}))});
    }

    if(current.prescription_status==="awaiting_confirmation"&&!justConfirmed){
      return json({ok:true,build_id:BUILD_ID,state:current,reply:"Antes de avanzar con la cotización, necesito que me confirmes si los valores que te leí de la receta están correctos.",route:"prescription_confirmation_gate"});
    }
    if(current.prescription_status==="needs_review"){
      return json({ok:true,build_id:BUILD_ID,state:current,reply:"La receta quedó pendiente de revisión porque hay datos que no se pudieron confirmar. Mandame una foto nueva, completa y nítida, y la vuelvo a leer.",route:"prescription_review_gate"});
    }

    const priceRequest=String(inferred.price_request||"none");
    const prescription=body?.prescription&&typeof body.prescription==="object"?{...(current.prescription||{}),...body.prescription}:current.prescription||{};
    const opticalCaseChanged=Boolean(inferred.optical_case&&current.optical_case&&inferred.optical_case!==current.optical_case);
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
      technical_family_key:body?.technical_family_key??(opticalCaseChanged?null:current.technical_family_key??null),
      main_use:body?.main_use??inferred.main_use??(opticalCaseChanged?null:current.main_use??null),
      previous_lens_type:body?.previous_lens_type??inferred.previous_lens_type??(opticalCaseChanged?null:current.previous_lens_type??null),
      budget_context:body?.budget_context??inferred.budget_context??current.budget_context??null,
      urgency:body?.urgency??inferred.urgency??current.urgency??null,
      preferences:{...(current.preferences||{}),...(inferred.preferences||{}),...(body?.preferences||{})},
      technical_result:opticalCaseChanged?{}:(current.technical_result||{}),candidate_products:opticalCaseChanged?[]:(current.candidate_products||[]),missing_data:opticalCaseChanged?[]:(current.missing_data||[]),requires_human_review:opticalCaseChanged?false:Boolean(current.requires_human_review),
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

    const knowledge=await getKnowledgeSnapshot(supabase,message,intent==="other"?"prescription_lens_quote":intent,{optical_case:state.optical_case,supply_mode:state.technical_result?.supply_mode||null,treatment:state.preferences?.blue_filter?"blue_filter":null});
    const allowPrice=priceRequest==="general"||(priceRequest==="exact"&&state.prescription_status==="confirmed"&&["ready_for_proposal","choose_technical_family","run_technical_evaluation"].includes(String(nextKey))===false);
    const price=(allowPrice&&state.optical_case)?await getPriceSnapshot(supabase,state.optical_case,knowledge,state):null;
    if(price?.examples)state.candidate_products=price.examples.map((x:any)=>x.id);

    const fallback=questionForKey(nextKey,state.objective);
    const previousKey=current.next_best_question_key||null;const previousContext=current.next_best_question_context||{};
    const repeated=Boolean(previousKey&&nextKey&&previousKey===nextKey);const previousReply=String(previousContext.generated_reply||"");const previousCount=Number(previousContext.repeat_count||0);const repeatCount=repeated?previousCount+1:0;
    const reply=await writeContextualReply({message,state,nextKey,fallback,price,priceRequest,repeated,previousReply,knowledge,justConfirmed,style});

    state.next_best_question_key=nextKey;
    state.next_best_question_context={...previousContext,build_id:BUILD_ID,suggested_question:fallback,generated_reply:reply,last_message:message.slice(0,500),last_intent:intent,inferred_facts:inferred,extraction_mode:extraction.mode,price_request:priceRequest,price_snapshot:price,knowledge_ids:knowledge.map((x:any)=>x.id),previous_question_key:previousKey,repeat_count:repeatCount,reply_mode:reply===fallback?"fallback":"openai_contextual",commercial_selection_mode:price?.selection_mode||null};

    const {data:upserted,error:upsertError}=await supabase.from("black_ai_case_state").upsert(state,{onConflict:"phone"}).select("*").single();
    if(upsertError)throw upsertError;
    return json({ok:true,build_id:BUILD_ID,state:upserted,next_question_key:nextKey,suggested_question:fallback,reply,intent,inferred_facts:inferred,extraction_mode:extraction.mode,price_request:priceRequest,price_snapshot:price,knowledge_used:knowledge.map((x:any)=>({id:x.id,title:x.title,category:x.category,score:x.score,overlap:x.overlap,data:x.data})),loop_guard:{repeated,repeat_count:repeatCount},route:"prescription_flow",reply_mode:reply===fallback?"fallback":"openai_contextual"});
  }catch(error){
    console.error("black-ai-case-orchestrator",error);
    return json({error:String((error as any)?.message||"Error interno"),build_id:BUILD_ID},500);
  }
});
