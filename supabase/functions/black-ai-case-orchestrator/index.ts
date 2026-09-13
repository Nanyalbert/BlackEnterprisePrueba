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
    const prescription=body?.prescription&&typeof body.prescription==="object"
      ? {...(current.prescription||{}),...body.prescription}
      : current.prescription||{};

    const state:any={
      phone,
      objective:body?.objective??current.objective??null,
      stage:body?.stage??current.stage??"discovery",
      prescription,
      optical_case:body?.optical_case??current.optical_case??null,
      technical_family_key:body?.technical_family_key??current.technical_family_key??null,
      main_use:body?.main_use??current.main_use??null,
      previous_lens_type:body?.previous_lens_type??current.previous_lens_type??null,
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

    state.next_best_question_key=nextKey;

    const {data:upserted,error:upsertError}=await supabase
      .from("black_ai_case_state")
      .upsert(state,{onConflict:"phone"})
      .select("*")
      .single();
    if(upsertError)throw upsertError;

    return json({ok:true,state:upserted,next_question_key:nextKey});
  }catch(error){
    console.error("black-ai-case-orchestrator",error);
    return json({error:String((error as any)?.message||"Error interno")},500);
  }
});
