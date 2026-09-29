import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (value, status = 200) => new Response(JSON.stringify(value), {
  status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
});
const eyeSchema = { type: "object", additionalProperties: false,
  properties: { sphere: { type: "string" }, cylinder: { type: "string" }, axis: { type: "string" } },
  required: ["sphere", "cylinder", "axis"] };
const pairSchema = { type: "object", additionalProperties: false,
  properties: { od: eyeSchema, oi: eyeSchema }, required: ["od", "oi"] };
const schema = { type: "object", additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["distance", "near", "both", "unknown"] },
    far: pairSchema, near: pairSchema, add: { type: "string" },
    uncertain: { type: "array", items: { type: "string" } }, notes: { type: "string" },
  },
  required: ["type", "far", "near", "add", "uncertain", "notes"] };
const instructions = `Transcribí únicamente la graduación óptica de la imagen. No hagas diagnóstico ni recomendación. Ignorá nombre, fecha, profesional, domicilio y otros datos personales. Distinguí LEJOS/CERCA y OD/OI. "10° +0,25 +1,50" puede indicar eje, cilindro y esfera en ese orden. Otra receta puede usar esfera, cilindro x eje. Conservá cada signo. Devolvé esfera y cilindro con punto decimal, eje en grados sin símbolo. Si solo está escrita esfera y claramente no hay cilindro, devolvé cilindro "0.00" y eje vacío. Si un signo o dígito es dudoso, dejá ese campo vacío y agregalo a uncertain. No inventes ni calcules ADD: transcribila únicamente si está escrita. Si solo hay cerca, poné datos en near; si solo hay lejos, poné datos en far. Nunca copies datos personales o fechas en campos de graduación.`;

function firstSecret(raw) {
  if (!raw) return "";
  try {
    const value = JSON.parse(raw);
    if (typeof value === "string") return value;
    return String(Object.values(value).find(item => typeof item === "string" && item.length > 10) || "");
  } catch { return raw; }
}
function safeEye(value) {
  const sphere = String(value?.sphere ?? "").trim().replace(",", ".");
  const cylinder = String(value?.cylinder ?? "").trim().replace(",", ".");
  const axis = String(value?.axis ?? "").trim();
  if ((sphere && (!/^[+-]?\d{1,2}(?:\.\d{1,2})?$/.test(sphere) || Math.abs(Number(sphere)) > 30)) ||
      (cylinder && (!/^[+-]?\d{1,2}(?:\.\d{1,2})?$/.test(cylinder) || Math.abs(Number(cylinder)) > 12)) ||
      (axis && (!/^\d{1,3}$/.test(axis) || Number(axis) < 1 || Number(axis) > 180))) return null;
  return { sphere, cylinder, axis };
}
function safePair(value) {
  const od = safeEye(value?.od), oi = safeEye(value?.oi);
  return od && oi ? { od, oi } : null;
}
function sanitize(value) {
  const far = safePair(value?.far), near = safePair(value?.near);
  const add = String(value?.add ?? "").trim().replace(",", ".");
  if (!far || !near || !["distance", "near", "both", "unknown"].includes(value?.type) ||
      (add && (!/^\+?\d(?:\.\d{1,2})?$/.test(add) || Number(add) <= 0 || Number(add) > 4))) return null;
  return { type: value.type, far, near, add,
    uncertain: Array.isArray(value.uncertain) ? value.uncertain.filter(x => typeof x === "string").slice(0, 12) : [],
    notes: typeof value.notes === "string" ? value.notes.slice(0, 300) : "" };
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "Método no permitido" }, 405);
  const authorization = req.headers.get("Authorization");
  if (!authorization) return reply({ error: "Iniciá sesión en Black OS" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishable = firstSecret(Deno.env.get("SUPABASE_PUBLISHABLE_KEYS")) || Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !publishable) return reply({ error: "Supabase no está configurado" }, 503);
  const client = createClient(supabaseUrl, publishable, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: auth, error: authError } = await client.auth.getUser();
  if (authError || !auth?.user) return reply({ error: "Sesión inválida" }, 401);
  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return reply({ error: "La clave de OpenAI no está configurada en Supabase" }, 503);
  const body = await req.json().catch(() => ({}));
  const image = body?.image_data_url;
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 8_000_000)
    return reply({ error: "Usá JPG, PNG o WEBP de menos de 6 MB" }, 400);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-5.4", store: false,
        input: [{ role: "user", content: [{ type: "input_text", text: instructions }, { type: "input_image", image_url: image, detail: "high" }] }],
        text: { format: { type: "json_schema", name: "optical_prescription", strict: true, schema } },
      }),
    });
    if (!response.ok) return reply({ error: "OpenAI no pudo analizar esta imagen" }, 502);
    const payload = await response.json();
    const output = payload.output?.flatMap(item => item.content || []).find(item => item.type === "output_text")?.text;
    const prescription = sanitize(JSON.parse(output || "null"));
    if (!prescription) return reply({ error: "La lectura no tuvo un formato verificable" }, 502);
    return reply({ ok: true, prescription });
  } catch {
    return reply({ error: "No se pudo completar la lectura con IA" }, 502);
  }
});
