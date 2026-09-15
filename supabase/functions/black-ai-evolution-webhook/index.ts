import { createClient } from "npm:@supabase/supabase-js@2";

const BUILD_ID = "black-ai-evolution-webhook-20260914-rx2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "x-black-ai-build": BUILD_ID },
});

function firstSecretValue(raw: string | undefined) {
  if (!raw) return "";
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object") {
      const value = Object.values(parsed).find((item) => typeof item === "string" && String(item).length > 10);
      if (value) return String(value);
    }
  } catch (_) {
    if (raw.length > 10) return raw;
  }
  return "";
}

function getServiceKey() {
  return Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || firstSecretValue(Deno.env.get("SUPABASE_SECRET_KEYS"));
}

function digits(value: unknown) { return String(value || "").replace(/\D/g, ""); }
function phoneFromJid(jid: string) { return digits(jid.split("@")[0] || ""); }

function unwrapMessage(message: any): any {
  let current = message;
  for (let i = 0; i < 6; i++) {
    if (!current || typeof current !== "object") return current || {};
    if (current.ephemeralMessage?.message) { current = current.ephemeralMessage.message; continue; }
    if (current.viewOnceMessage?.message) { current = current.viewOnceMessage.message; continue; }
    if (current.viewOnceMessageV2?.message) { current = current.viewOnceMessageV2.message; continue; }
    if (current.viewOnceMessageV2Extension?.message) { current = current.viewOnceMessageV2Extension.message; continue; }
    if (current.documentWithCaptionMessage?.message) { current = current.documentWithCaptionMessage.message; continue; }
    break;
  }
  return current || {};
}

function classifyMessage(rawMessage: any) {
  const message = unwrapMessage(rawMessage);
  if (!message || typeof message !== "object") return { type: "unknown", mediaType: null, text: "", caption: "", mimetype: "", mediaUrl: "" };
  if (message.conversation) return { type: "text", mediaType: null, text: String(message.conversation), caption: "", mimetype: "", mediaUrl: "" };
  if (message.extendedTextMessage?.text) return { type: "text", mediaType: null, text: String(message.extendedTextMessage.text), caption: "", mimetype: "", mediaUrl: "" };
  if (message.imageMessage) return { type: "image", mediaType: "image", text: "", caption: String(message.imageMessage.caption || ""), mimetype: String(message.imageMessage.mimetype || "image/jpeg"), mediaUrl: String(message.imageMessage.url || "") };
  if (message.audioMessage) return { type: "audio", mediaType: "audio", text: "", caption: "", mimetype: String(message.audioMessage.mimetype || ""), mediaUrl: String(message.audioMessage.url || "") };
  if (message.videoMessage) return { type: "video", mediaType: "video", text: "", caption: String(message.videoMessage.caption || ""), mimetype: String(message.videoMessage.mimetype || ""), mediaUrl: String(message.videoMessage.url || "") };
  if (message.documentMessage) return { type: "document", mediaType: "document", text: "", caption: String(message.documentMessage.caption || message.documentMessage.fileName || ""), mimetype: String(message.documentMessage.mimetype || ""), mediaUrl: String(message.documentMessage.url || "") };
  const firstKey = Object.keys(message)[0] || "unknown";
  return { type: firstKey, mediaType: null, text: "", caption: "", mimetype: "", mediaUrl: "" };
}

function extractReferral(rawMessage: any, data: any) {
  const message = unwrapMessage(rawMessage);
  return message?.extendedTextMessage?.contextInfo?.externalAdReply
    || message?.imageMessage?.contextInfo?.externalAdReply
    || message?.videoMessage?.contextInfo?.externalAdReply
    || data?.contextInfo?.externalAdReply
    || data?.referral
    || null;
}

function extractOutputText(payload: any) {
  if (typeof payload?.output_text === "string" && payload.output_text.trim()) return payload.output_text.trim();
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === "output_text" && typeof content?.text === "string") parts.push(content.text);
    }
  }
  return parts.join("\n").trim();
}

function parseJsonObject(text: string) {
  const cleaned = String(text || "").trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  try { return JSON.parse(cleaned); } catch (_) {}
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try { return JSON.parse(cleaned.slice(start, end + 1)); } catch (_) {}
  }
  return null;
}

function numOrNull(value: any) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function normalizeEye(value: any) {
  const axisRaw = numOrNull(value?.axis);
  return {
    sphere: numOrNull(value?.sphere),
    cylinder: numOrNull(value?.cylinder),
    axis: axisRaw !== null && axisRaw >= 0 && axisRaw <= 180 ? Math.round(axisRaw) : null,
  };
}

function round2(value: number) { return Math.round(value * 100) / 100; }

function buildPrescriptionFromVision(value: any) {
  const farOd = normalizeEye(value?.distance?.od);
  const farOi = normalizeEye(value?.distance?.oi);
  const nearOd = normalizeEye(value?.near?.od);
  const nearOi = normalizeEye(value?.near?.oi);
  const addOd = farOd.sphere !== null && nearOd.sphere !== null ? round2(nearOd.sphere - farOd.sphere) : null;
  const addOi = farOi.sphere !== null && nearOi.sphere !== null ? round2(nearOi.sphere - farOi.sphere) : null;
  const sharedAdd = addOd !== null && addOi !== null && Math.abs(addOd - addOi) <= 0.12 ? round2((addOd + addOi) / 2) : null;
  return {
    od: { ...farOd, addition: sharedAdd ?? addOd },
    oi: { ...farOi, addition: sharedAdd ?? addOi },
    addition: sharedAdd,
    near: { od: nearOd, oi: nearOi },
    pd: numOrNull(value?.pd),
    source: "prescription_image",
    vision_confidence: Math.max(0, Math.min(1, Number(value?.confidence || 0))),
    uncertain_fields: Array.isArray(value?.uncertain_fields) ? value.uncertain_fields.map((x: any) => String(x)).slice(0, 20) : [],
  };
}

function prescriptionForInbox(p: any) {
  return {
    distance: { od: p?.od || null, oi: p?.oi || null },
    near: p?.near || null,
    explicit_addition: p?.addition ?? null,
    pd: p?.pd ?? null,
    uncertain_fields: Array.isArray(p?.uncertain_fields) ? p.uncertain_fields : [],
  };
}

function missingPrescriptionFields(p: any) {
  const missing: string[] = [];
  for (const [eyeKey, label] of [["od", "OD"], ["oi", "OI"]] as const) {
    const eye = p?.[eyeKey] || {};
    if (eye.sphere === null || eye.sphere === undefined) missing.push(`esfera ${label}`);
    if (eye.cylinder === null || eye.cylinder === undefined) missing.push(`cilindro ${label}`);
    if (eye.cylinder !== null && eye.cylinder !== undefined && Number(eye.cylinder) !== 0 && (eye.axis === null || eye.axis === undefined)) missing.push(`eje ${label}`);
  }
  return missing;
}

function fmtRxNumber(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  if (n === 0) return "0.00";
  return `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
}

function fmtAxis(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? `${Math.round(n)}°` : "—";
}

function eyeLine(label: string, eye: any) {
  return `${label}: Esf ${fmtRxNumber(eye?.sphere)} · Cil ${fmtRxNumber(eye?.cylinder)} · Eje ${fmtAxis(eye?.axis)}`;
}

function hasNearValues(p: any) {
  const eyes = [p?.near?.od, p?.near?.oi];
  return eyes.some((eye) => eye && [eye.sphere, eye.cylinder, eye.axis].some((v) => v !== null && v !== undefined));
}

function prescriptionConfirmationReply(p: any, missing: string[]) {
  const lines = ["Perfecto, pude leer la receta. Antes de cotizar quiero confirmar los valores:", "", "*LEJOS*", eyeLine("OD", p?.od), eyeLine("OI", p?.oi)];
  if (hasNearValues(p)) {
    lines.push("", "*CERCA*", eyeLine("OD", p?.near?.od), eyeLine("OI", p?.near?.oi));
  }
  if (p?.addition !== null && p?.addition !== undefined) lines.push(`ADD calculada: ${fmtRxNumber(p.addition)}`);
  if (p?.pd !== null && p?.pd !== undefined) lines.push(`DP: ${p.pd}`);
  if (missing.length) {
    lines.push("", `Hay datos que no pude leer con seguridad: ${missing.join(", ")}. ¿Podés enviarme una foto más nítida o confirmarme esos valores?`);
  } else {
    lines.push("", "¿Me confirmás que estos valores están correctos?");
  }
  return lines.join("\n");
}

function evolutionConfig() {
  const baseUrl = Deno.env.get("EVOLUTION_API_URL") || Deno.env.get("EVOLUTION_URL") || "";
  const apiKey = Deno.env.get("EVOLUTION_API_KEY") || Deno.env.get("EVOLUTION_KEY") || "";
  const instance = Deno.env.get("EVOLUTION_INSTANCE") || "";
  return { baseUrl: baseUrl.replace(/\/+$/, ""), apiKey, instance };
}

function findEvolutionMessageRecord(payload: any, messageId: string) {
  const candidates = [payload, payload?.messages, payload?.records, payload?.data, payload?.messages?.records, payload?.data?.messages, payload?.data?.records];
  for (const candidate of candidates) {
    const list = Array.isArray(candidate) ? candidate : [];
    const exact = list.find((x: any) => String(x?.key?.id || x?.id || x?.messageId || "") === messageId);
    if (exact) return exact;
    if (list.length === 1) return list[0];
  }
  return null;
}

function asWebMessageInfo(record: any, row: any) {
  if (!record) return null;
  const key = record?.key && typeof record.key === "object" ? record.key : { id: row?.message_id, remoteJid: row?.remote_jid || undefined, fromMe: Boolean(row?.from_me) };
  const message = record?.message && typeof record.message === "object" ? record.message : null;
  if (!key?.id || !message) return null;
  return { key, message, messageTimestamp: record?.messageTimestamp ?? record?.timestamp ?? undefined, pushName: record?.pushName ?? row?.push_name ?? undefined, participant: record?.participant ?? undefined };
}

async function requestEvolutionBase64(cfg: any, instance: string, webMessage: any, row: any) {
  const response = await fetch(`${cfg.baseUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": cfg.apiKey },
    body: JSON.stringify({ message: webMessage, convertToMp4: false }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`MEDIA_BASE64_HTTP_${response.status}:${String(payload?.message || payload?.error || "getBase64")}`);
  const raw = String(payload?.base64 || payload?.data?.base64 || payload?.media?.base64 || "");
  if (!raw) throw new Error("MEDIA_BASE64_EMPTY");
  if (/^data:image\//i.test(raw)) return raw;
  const mime = String(payload?.mimetype || payload?.mimeType || row?.media_mimetype || "image/jpeg").split(";")[0];
  return `data:${mime};base64,${raw}`;
}

async function getEvolutionMediaBase64(row: any) {
  const cfg = evolutionConfig();
  const instance = String(row?.instance_name || cfg.instance || "");
  const messageId = String(row?.message_id || "");
  if (!cfg.baseUrl || !cfg.apiKey || !instance || !messageId) throw new Error("MEDIA_CONFIG_OR_ID_MISSING");

  // Camino principal: usamos el WebMessageInfo que Evolution acaba de enviar.
  // Evita perder metadatos de cifrado al reconstruir el mensaje desde cero.
  const directMessage = row?._provider_message_info;
  if (directMessage?.key?.id && directMessage?.message) {
    try {
      const dataUrl = await requestEvolutionBase64(cfg, instance, directMessage, row);
      return { dataUrl, messageFound: true, mediaDownloaded: true, retrievalMode: "webhook_message" };
    } catch (directError) {
      console.warn("media direct fallback", String((directError as any)?.message || directError));
    }
  }

  // Fallback: buscar el mensaje completo en Evolution por ID.
  const findResponse = await fetch(`${cfg.baseUrl}/chat/findMessages/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": cfg.apiKey },
    body: JSON.stringify({ where: { key: { id: messageId } }, limit: 1 }),
  });
  const findPayload = await findResponse.json().catch(() => ({}));
  if (!findResponse.ok) throw new Error(`MEDIA_FIND_HTTP_${findResponse.status}:${String(findPayload?.message || findPayload?.error || "findMessages")}`);
  const record = findEvolutionMessageRecord(findPayload, messageId);
  if (!record) throw new Error("MEDIA_MESSAGE_NOT_FOUND");
  const webMessage = asWebMessageInfo(record, row);
  if (!webMessage) throw new Error("MEDIA_MESSAGE_INCOMPLETE");
  const dataUrl = await requestEvolutionBase64(cfg, instance, webMessage, row);
  return { dataUrl, messageFound: true, mediaDownloaded: true, retrievalMode: "findMessages" };
}

async function analyzePrescriptionImage(row: any) {
  const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!openAiKey) throw new Error("OPENAI_API_KEY_MISSING");
  const media = await getEvolutionMediaBase64(row);
  const imageDataUrl = media.dataUrl;
  if (!/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(imageDataUrl)) throw new Error("MEDIA_NOT_SUPPORTED_IMAGE");
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";
  const prompt = `
Sos un lector de recetas ópticas. Analizá la imagen y transcribí SOLO lo que sea visible.
Primero decidí si la imagen contiene una receta óptica.

REGLAS ESTRICTAS:
- Conservá exactamente los signos + y -.
- NO hagas transposición óptica.
- Separá LEJOS y CERCA si aparecen ambos.
- NO calcules ADD; el sistema la calcula después.
- Eje válido: 0 a 180. Si no se lee con seguridad, null.
- Diferenciá 0.00 real de un valor ilegible. Ilegible = null.
- Si un dato es dudoso, usá null y agregá su nombre a uncertain_fields.
- No diagnostiques ni completes datos ausentes.
- confidence representa confianza global en la transcripción, de 0 a 1.

Respondé SOLO JSON válido con esta forma exacta:
{"is_prescription":true,"distance":{"od":{"sphere":null,"cylinder":null,"axis":null},"oi":{"sphere":null,"cylinder":null,"axis":null}},"near":{"od":{"sphere":null,"cylinder":null,"axis":null},"oi":{"sphere":null,"cylinder":null,"axis":null}},"pd":null,"confidence":0,"uncertain_fields":[],"notes":""}
`.trim();

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [{ role: "user", content: [{ type: "input_text", text: prompt }, { type: "input_image", image_url: imageDataUrl, detail: "high" }] }],
      reasoning: { effort: "low" },
      max_output_tokens: 700,
      store: false,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`VISION_HTTP_${response.status}:${String(payload?.error?.message || "OpenAI vision")}`);
  const parsed = parseJsonObject(extractOutputText(payload));
  if (!parsed) throw new Error("VISION_INVALID_JSON");
  const isPrescription = parsed?.is_prescription === true;
  return {
    message_found: media.messageFound,
    media_downloaded: media.mediaDownloaded,
    retrieval_mode: media.retrievalMode,
    vision_ok: true,
    is_prescription: isPrescription,
    prescription: isPrescription ? buildPrescriptionFromVision(parsed) : null,
    confidence: Math.max(0, Math.min(1, Number(parsed?.confidence || 0))),
    uncertain_fields: Array.isArray(parsed?.uncertain_fields) ? parsed.uncertain_fields.map((x: any) => String(x)).slice(0, 20) : [],
    notes: String(parsed?.notes || "").slice(0, 500),
  };
}

async function callCaseOrchestrator(supabaseUrl: string, secret: string, row: any, extra: any = {}) {
  if (!row?.phone || row?.from_me || row?.is_group) return { skipped: true };
  const response = await fetch(`${supabaseUrl}/functions/v1/black-ai-case-orchestrator`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-black-ai-webhook-secret": secret },
    body: JSON.stringify({
      phone: row.phone,
      message: extra.message || row.text_content || row.caption || "",
      source: "evolution",
      message_type: row.message_type,
      provider_message_id: row.message_id,
      media_received: Boolean(row.has_media),
      prescription: extra.prescription || undefined,
      prescription_analysis: extra.prescription_analysis || undefined,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Orchestrator HTTP ${response.status}`);
  return payload;
}

function normalizedList(value: unknown) { return String(value || "").split(/[\n,;]/).map(digits).filter(Boolean); }
function isAuthorized(config: any, phone: string) {
  if (!config?.enabled || config?.replyMode !== "automatic") return false;
  const scope = String(config?.scope || "single");
  if (scope === "all") return true;
  if (scope === "single") return digits(config?.testNumber) === phone;
  if (scope === "list") return normalizedList(config?.testNumberList).includes(phone);
  return false;
}

async function sendEvolutionText(phone: string, text: string, instanceFromEvent: string) {
  const cfg = evolutionConfig();
  const instance = instanceFromEvent || cfg.instance;
  if (!cfg.baseUrl || !cfg.apiKey || !instance) throw new Error("EVOLUTION_SEND_CONFIG_MISSING");
  const response = await fetch(`${cfg.baseUrl}/message/sendText/${encodeURIComponent(instance)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": cfg.apiKey },
    body: JSON.stringify({ number: phone, text }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.message || payload?.error || `Evolution HTTP ${response.status}`);
  return payload;
}

function textOf(row: any) { return String(row?.text_content || row?.caption || "").trim(); }

function looksLikeCommercialQuote(text: string) {
  const t = String(text || "");
  const hasMoney = /\$\s*[\d.]{2,}/.test(t) || /\b\d{2,3}(?:[.\s]\d{3})+\b/.test(t);
  const hasCommercialFormat = /👉|~\s*\$|\*\s*\$|\boff\b|descuento|precio|cotiz|presupuesto/i.test(t);
  const hasOpticalProduct = /org[aá]nico|antirreflejo|filtro azul|super blue|multifocal|bifocal|ocupacional|cristal|lente|alto [ií]ndice/i.test(t);
  return hasMoney && (hasCommercialFormat || hasOpticalProduct);
}

function detectPatientFollowupSignal(text: string) {
  const t = String(text || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (/\b(te|les)?\s*(confirmo|aviso)\b|\bdespues\s+(te|les)?\s*(confirmo|aviso)\b|\bmanana\s+(te|les)?\s*(confirmo|aviso)\b|\blo\s+(voy\s+a\s+)?pensar\b|\bdejame\s+pensarlo\b|\bte\s+digo\b|\bmas\s+tarde\s+(te\s+)?(aviso|confirmo)\b/.test(t)) return "pending_confirmation";
  const interested = /\bme\s+(interesa|gusta|sirve|conviene)\b|\bquiero\s+eso\b|\bme\s+quedaria\s+bien\b/.test(t);
  const defer = /\bmas\s+adelante\b|\bpor\s+ahora\b|\bno\s+ahora\b|\bdespues\b|\botro\s+dia\b|\bcuando\s+pueda\b/.test(t);
  if (interested && defer) return "interested_no_close";
  return null;
}

async function getScenario(supabase: any, key: string) {
  const { data, error } = await supabase.from("black_ai_followup_scenarios").select("id,key,is_active,initial_delay_hours,max_attempts").eq("key", key).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function closeOpenFollowupsForReply(supabase: any, phone: string, at: string) {
  if (!phone) return 0;
  const { data, error } = await supabase.from("black_ai_followup_opportunities").update({ status: "replied", last_patient_message_at: at, next_followup_at: null, stop_reason: "patient_replied", updated_at: at }).eq("phone", phone).in("status", ["waiting", "scheduled", "paused"]).select("id");
  if (error) throw error;
  return (data || []).length;
}

async function openOrRefreshFollowup(supabase: any, args: { phone: string; scenarioKey: string; sourceId?: string | null; sourceType?: string; context?: any; businessAt?: string | null; patientAt?: string | null; }) {
  const scenario = await getScenario(supabase, args.scenarioKey);
  if (!scenario?.is_active) return { skipped: true, reason: "scenario_inactive" };
  const now = new Date();
  const delay = Math.max(1, Number(scenario.initial_delay_hours || 24));
  const next = new Date(now.getTime() + delay * 3600000).toISOString();
  const { data: existing, error: findError } = await supabase.from("black_ai_followup_opportunities").select("id,context").eq("phone", args.phone).eq("scenario_id", scenario.id).in("status", ["waiting", "scheduled", "paused"]).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (findError) throw findError;
  const payload: any = { scenario_id: scenario.id, phone: args.phone, source_type: args.sourceType || "conversation", source_id: args.sourceId || null, status: "scheduled", next_followup_at: next, stop_reason: null, context: { ...(existing?.context || {}), ...(args.context || {}), detected_at: now.toISOString(), detector_version: 2 }, updated_at: now.toISOString() };
  if (args.businessAt) payload.last_business_message_at = args.businessAt;
  if (args.patientAt) payload.last_patient_message_at = args.patientAt;
  if (existing?.id) {
    const { data, error } = await supabase.from("black_ai_followup_opportunities").update(payload).eq("id", existing.id).select("id,status,next_followup_at").single();
    if (error) throw error;
    return { refreshed: true, opportunity: data };
  }
  const { data, error } = await supabase.from("black_ai_followup_opportunities").insert({ ...payload, followup_count: 0, created_at: now.toISOString() }).select("id,status,next_followup_at").single();
  if (error) throw error;
  return { created: true, opportunity: data };
}

async function updateInboxAnalysis(supabase: any, row: any, patch: any) {
  if (!row?.message_id) return;
  try {
    const { data } = await supabase.from("black_ai_inbox").select("metadata").eq("provider", "evolution").eq("message_id", row.message_id).maybeSingle();
    const update: any = {
      metadata: { ...(data?.metadata || {}), build_id: BUILD_ID, media_pipeline: { ...(patch.trace || {}), checked_at: new Date().toISOString() } },
    };
    if (patch.ai_status) update.ai_status = patch.ai_status;
    if (patch.ai_classification) update.ai_classification = patch.ai_classification;
    if (patch.ai_analysis) update.ai_analysis = patch.ai_analysis;
    await supabase.from("black_ai_inbox").update(update).eq("provider", "evolution").eq("message_id", row.message_id);
  } catch (error) {
    console.error("inbox analysis trace", error);
  }
}

async function savePrescriptionPendingConfirmation(supabase: any, row: any, analysis: any, missing: string[]) {
  const now = new Date().toISOString();
  const status = missing.length ? "needs_review" : "awaiting_confirmation";
  const payload: any = {
    phone: String(row.phone),
    stage: "prescription",
    prescription: analysis.prescription,
    prescription_status: status,
    prescription_confirmed_at: null,
    prescription_source_message_id: row.message_id || null,
    prescription_analysis: {
      confidence: analysis.confidence,
      uncertain_fields: analysis.uncertain_fields,
      notes: analysis.notes,
      retrieval_mode: analysis.retrieval_mode,
      build_id: BUILD_ID,
    },
    prescription_updated_at: now,
    last_patient_message_at: now,
    technical_result: {},
    candidate_products: [],
    missing_data: missing,
    next_best_question_key: missing.length ? "complete_prescription" : "confirm_prescription",
    next_best_question_context: {
      build_id: BUILD_ID,
      prescription_status: status,
      prescription_source_message_id: row.message_id || null,
    },
    requires_human_review: Boolean(missing.length),
    updated_at: now,
  };
  const { error } = await supabase.from("black_ai_case_state").upsert(payload, { onConflict: "phone" });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido", build_id: BUILD_ID }, 405);
  const expected = Deno.env.get("BLACK_AI_WEBHOOK_SECRET") || "";
  const url = new URL(req.url);
  const supplied = req.headers.get("x-black-ai-webhook-secret") || url.searchParams.get("token") || "";
  if (!expected || supplied !== expected) return json({ error: "Webhook no autorizado", build_id: BUILD_ID }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = getServiceKey();
  if (!supabaseUrl || !serviceKey) return json({ error: "Configuración de Supabase incompleta", build_id: BUILD_ID }, 500);

  try {
    const payload = await req.json().catch(() => ({}));
    const eventName = String(payload?.event || payload?.type || payload?.eventType || "unknown");
    const instanceName = String(payload?.instance || payload?.instanceName || payload?.sender || "");
    const data = payload?.data || payload;
    const candidates = Array.isArray(data) ? data : [data];
    const rows: any[] = [];

    for (const item of candidates) {
      const key = item?.key || item?.data?.key || {};
      const rawMessage = item?.message || item?.data?.message || {};
      const remoteJid = String(key?.remoteJid || item?.remoteJid || item?.jid || "");
      const fromMe = Boolean(key?.fromMe || item?.fromMe);
      const messageId = String(key?.id || item?.id || item?.messageId || "") || null;
      const parsed = classifyMessage(rawMessage);
      const phone = phoneFromJid(remoteJid);
      const providerTsRaw = item?.messageTimestamp || item?.timestamp || payload?.date_time || null;
      let providerTimestamp: string | null = null;
      if (providerTsRaw) {
        const n = Number(providerTsRaw);
        providerTimestamp = Number.isFinite(n) ? new Date(n < 1e12 ? n * 1000 : n).toISOString() : new Date(String(providerTsRaw)).toISOString();
      }
      rows.push({
        provider: "evolution",
        event_name: eventName,
        instance_name: instanceName || null,
        message_id: messageId,
        remote_jid: remoteJid || null,
        phone: phone || null,
        push_name: String(item?.pushName || item?.data?.pushName || "") || null,
        from_me: fromMe,
        is_group: /@g\.us$/i.test(remoteJid),
        message_type: parsed.type,
        media_type: parsed.mediaType,
        text_content: parsed.text || null,
        caption: parsed.caption || null,
        media_mimetype: parsed.mimetype || null,
        media_url: parsed.mediaUrl || null,
        has_media: Boolean(parsed.mediaType),
        referral: extractReferral(rawMessage, item),
        metadata: { source_event: eventName, server_url: payload?.server_url || null, destination: payload?.destination || null, build_id: BUILD_ID },
        provider_timestamp: providerTimestamp,
        _provider_message_info: { key, message: rawMessage, messageTimestamp: item?.messageTimestamp, pushName: item?.pushName },
      });
    }

    if (!rows.length) return json({ ok: true, build_id: BUILD_ID, received: 0, processed: 0, orchestrated: 0, replied: 0 });
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

    const messageIds = rows.map((r) => r.message_id).filter(Boolean);
    const existingIds = new Set<string>();
    if (messageIds.length) {
      const { data: existingRows, error: existingError } = await supabase.from("black_ai_inbox").select("message_id").eq("provider", "evolution").in("message_id", messageIds);
      if (existingError) throw existingError;
      for (const item of existingRows || []) if (item?.message_id) existingIds.add(String(item.message_id));
    }
    const processingRows = rows.filter((r) => !r.message_id || !existingIds.has(String(r.message_id)));
    if (processingRows.length) {
      const dbRows = processingRows.map(({ _provider_message_info, ...dbRow }) => dbRow);
      const { error } = await supabase.from("black_ai_inbox").upsert(dbRows, { onConflict: "provider,message_id", ignoreDuplicates: true });
      if (error) return json({ error: "No se pudo registrar el evento", detail: error.message, build_id: BUILD_ID }, 500);
    }

    const { data: settingsRow } = await supabase.from("black_ai_settings").select("config").eq("id", "global").maybeSingle();
    const config = settingsRow?.config || {};
    let followupDetected = 0, followupClosed = 0, followupErrors = 0, orchestrated = 0, orchestrationErrors = 0, replied = 0, replyErrors = 0, imagesAnalyzed = 0, prescriptionsRead = 0, mediaFailures = 0;

    for (const row of processingRows) {
      if (!row?.phone || row?.is_group) continue;
      const at = row.provider_timestamp || new Date().toISOString();
      try {
        if (!row.from_me) {
          followupClosed += await closeOpenFollowupsForReply(supabase, String(row.phone), at);
          const signal = detectPatientFollowupSignal(textOf(row));
          if (signal) {
            const f = await openOrRefreshFollowup(supabase, { phone: String(row.phone), scenarioKey: signal, sourceId: row.message_id, sourceType: "patient_message", patientAt: at, context: { trigger_text: textOf(row).slice(0, 1000), trigger: signal } });
            if (!f?.skipped) followupDetected += 1;
          }
        } else if (textOf(row) && looksLikeCommercialQuote(textOf(row))) {
          const f = await openOrRefreshFollowup(supabase, { phone: String(row.phone), scenarioKey: "quote_no_reply", sourceId: row.message_id, sourceType: "outbound_quote", businessAt: at, context: { quote_text: textOf(row).slice(0, 1600), trigger: "outbound_quote" } });
          if (!f?.skipped) followupDetected += 1;
        }
      } catch (e) {
        followupErrors += 1;
        console.error("followup detection", e);
      }

      if (row.from_me) continue;
      try {
        let result: any;
        if (row.message_type === "image") {
          imagesAnalyzed += 1;
          const trace: any = { build_id: BUILD_ID, message_found: false, media_downloaded: false, vision_ok: false, prescription_detected: false };
          try {
            const analysis = await analyzePrescriptionImage(row);
            trace.message_found = Boolean(analysis.message_found);
            trace.media_downloaded = Boolean(analysis.media_downloaded);
            trace.retrieval_mode = analysis.retrieval_mode;
            trace.vision_ok = Boolean(analysis.vision_ok);
            trace.prescription_detected = Boolean(analysis.is_prescription);
            trace.confidence = analysis.confidence;
            trace.uncertain_fields = analysis.uncertain_fields;

            if (analysis.is_prescription && analysis.prescription) {
              prescriptionsRead += 1;
              const missing = missingPrescriptionFields(analysis.prescription);
              await savePrescriptionPendingConfirmation(supabase, row, analysis, missing);
              await updateInboxAnalysis(supabase, row, {
                trace,
                ai_status: missing.length ? "needs_review" : "classified",
                ai_classification: "prescription",
                ai_analysis: {
                  build_id: BUILD_ID,
                  confidence: analysis.confidence,
                  prescription: prescriptionForInbox(analysis.prescription),
                  uncertain_fields: analysis.uncertain_fields,
                  missing_fields: missing,
                  status: missing.length ? "needs_review" : "awaiting_confirmation",
                  retrieval_mode: analysis.retrieval_mode,
                },
              });
              result = { reply: prescriptionConfirmationReply(analysis.prescription, missing), prescription_gate: true };
            } else {
              await updateInboxAnalysis(supabase, row, {
                trace,
                ai_status: "needs_review",
                ai_classification: "other",
                ai_analysis: { build_id: BUILD_ID, confidence: analysis.confidence, summary: "La imagen no fue identificada como receta óptica." },
              });
              result = { reply: "Recibí la imagen, pero no pude identificar una receta óptica. Si es una receta, mandame una foto completa, de frente y con buena luz.", media_guard: true };
            }
          } catch (visionError) {
            mediaFailures += 1;
            const errorText = String((visionError as any)?.message || visionError || "MEDIA_UNKNOWN_ERROR").slice(0, 500);
            trace.error = errorText;
            await updateInboxAnalysis(supabase, row, {
              trace,
              ai_status: "error",
              ai_classification: "unclear",
              ai_analysis: { build_id: BUILD_ID, error_code: errorText, summary: "Falló el procesamiento de la imagen antes de confirmar la receta." },
            });
            console.error("prescription vision", errorText);
            result = { reply: "Recibí la foto, pero tuve un problema al procesarla. No hace falta que la envíes varias veces. Voy a necesitar otra foto solo si te lo indico después de revisar el error.", media_guard: true };
          }
        } else {
          result = await callCaseOrchestrator(supabaseUrl, expected, row);
          orchestrated += result?.skipped ? 0 : 1;
        }

        const reply = String(result?.reply || result?.suggested_question || "").trim();
        if (reply && isAuthorized(config, String(row.phone))) {
          try {
            await sendEvolutionText(String(row.phone), reply, String(row.instance_name || instanceName || ""));
            replied += 1;
          } catch (e) {
            replyErrors += 1;
            console.error("Evolution reply", e);
          }
        }
      } catch (e) {
        orchestrationErrors += 1;
        console.error("orchestration", e);
      }
    }

    return json({
      ok: true,
      build_id: BUILD_ID,
      received: rows.length,
      processed: processingRows.length,
      duplicates_ignored: rows.length - processingRows.length,
      orchestrated,
      orchestration_errors: orchestrationErrors,
      replied,
      reply_errors: replyErrors,
      images_analyzed: imagesAnalyzed,
      prescriptions_read: prescriptionsRead,
      media_failures: mediaFailures,
      followups_detected: followupDetected,
      followups_closed_by_reply: followupClosed,
      followup_errors: followupErrors,
    });
  } catch (error) {
    console.error("black-ai-evolution-webhook", error);
    return json({ error: String((error as any)?.message || "Error interno"), build_id: BUILD_ID }, 500);
  }
});
