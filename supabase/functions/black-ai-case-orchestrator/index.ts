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

function normalizeText(value:unknown){
  return String(value||"")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g,"")
    .trim();
}

function inferFactsFromMessage(message:string,current:any){
  const text=normalizeText(message);
  const facts:any={};
  if(!text)return facts;

  if(!current?.objective){
    if(/\b(cotiz|precio|cuanto|presupuesto|sale|valor|anteojo|lente|cristal)\b/.test(text)) facts.objective="quote";
    else if(/\b(turno|reserva|cita|atender|consulta con)\b/.test(text)) facts.objective="appointment";
    else if(/\b(reclamo|problema|garantia|cambio|devolucion|rompio|roto)\b/.test(text)) facts.objective="support";
    else if(/\b(receta|graduacion|aumento|esfera|cilindro|eje|adicion)\b/.test(text)) facts.objective="quote";
  }

  if(!current?.optical_case){
    if(/\b(multifoc|progresiv)\w*/.test(text)) facts.optical_case="multifocal";
    else if(/\b(ocupacional|oficina|computadora|pc|pantalla)\w*/.test(text)) facts.optical_case="occupational";
    else if(/\b(bifoc)\w*/.test(text)) facts.optical_case="bifocal";
    else if(/\b(monofoc)\w*|\bsolo lejos\b|\bsolo cerca\b/.test(text)) facts.optical_case="monofocal";
  }

  if(!current?.main_use){
    if(/\b(computadora|pc|pantalla|oficina|trabajo de cerca)\b/.test(text)) facts.main_use="computadora/oficina";
    else if(/\b(leer|lectura|celular|cerca)\b/.test(text)) facts.main_use="cerca/lectura";
    else if(/\b(manejar|conducir|lejos|calle)\b/.test(text)) facts.main_use="lejos/uso diario";
    else if(/\b(todo el dia|uso diario|todo uso)\b/.test(text)) facts.main_use="uso diario";
  }

  if(!current?.previous_lens_type){
    if(/\b(nunca use multifoc|nunca tuve multifoc|primer multifoc)\w*/.test(text)) facts.previous_lens_type="sin experiencia en multifocales";
    else if(/\b(uso multifoc|ya use multifoc|tengo multifoc)\w*/.test(text)) facts.previous_lens_type="usa multifocales";
  }

  return facts;
}

function questionForKey(key:string|null){
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
    ready_for_proposal:"Ya tengo la información técnica necesaria para armarte una propuesta.",
  };
  return key ? (questions[key]||"") : "";
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

    const supabase=createClient(supabaseUrl,serviceKey,{
      auth:{persistSession:false,autoRefreshToken:false}
    });

    const body=await req.json().catch(()=>({}));
    const phone=String(body?.phone||"").replace(/\D/g,"");
    if(!phone)return json({error:"Falta phone"},400);

    const {data:existing,error:readError}=await supabase
      .from("black_ai_case_state")
      .select("*")
      .eq("phone",phone)
      .maybeSingle();
    if(readError)throw readError;

    const current=existing||{phone,stage:"discovery",prescription:{},preferences:{},technical_result:{},candidate_products:[]};
    const inferred=inferFactsFromMessage(String(body?.message||""),current);
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
      budget_context:body?.budget_context??current.budget_context??null,
      urgency:body?.urgency??current.urgency??null,
      preferences:{...(current.preferences||{}),...(body?.preferences||{})},
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
        p_family_key:state.technical_family_key,
        p_optical_case:state.optical_case,
        p_sphere_od:od.sphere??null,
        p_cylinder_od:od.cylinder??null,
        p_axis_od:od.axis??null,
        p_sphere_oi:oi.sphere??null,
        p_cylinder_oi:oi.cylinder??null,
        p_axis_oi:oi.axis??null,
        p_addition:addition
      });
      if(evaluationError)throw evaluationError;
      if(evaluation){
        state.technical_result=evaluation;
        state.missing_data=Array.isArray(evaluation?.missing_data)?evaluation.missing_data:[];
        state.requires_human_review=Boolean(evaluation?.requires_human_review);
        if(evaluation?.status==="resolved")state.stage="technical";
      }
    }

    const {data:nextKey,error:nextError}=await supabase.rpc("black_ai_next_question_key",{
      p_objective:state.objective,
      p_prescription:state.prescription,
      p_optical_case:state.optical_case,
      p_main_use:state.main_use,
      p_previous_lens_type:state.previous_lens_type,
      p_technical_family_key:state.technical_family_key,
      p_technical_result:state.technical_result
    });
    if(nextError)throw nextError;

    const suggestedQuestion=questionForKey(nextKey);
    state.next_best_question_key=nextKey;
    state.next_best_question_context={
      ...(current.next_best_question_context||{}),
      suggested_question:suggestedQuestion,
      last_message:String(body?.message||"").slice(0,500),
      inferred_facts:inferred
    };

    const {data:upserted,error:upsertError}=await supabase
      .from("black_ai_case_state")
      .upsert(state,{onConflict:"phone"})
      .select("*")
      .single();
    if(upsertError)throw upsertError;

    return json({
      ok:true,
      state:upserted,
      next_question_key:nextKey,
      suggested_question:suggestedQuestion,
      inferred_facts:inferred
    });
  }catch(error){
    console.error("black-ai-case-orchestrator",error);
    return json({error:String((error as any)?.message||"Error interno")},500);
  }
});
