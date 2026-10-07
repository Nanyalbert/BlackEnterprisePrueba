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

const eyeSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    sphere: { type: "string" },
    cylinder: { type: "string" },
    axis: { type: "string" },
  },
  required: ["sphere", "cylinder", "axis"],
};
const pairSchema = {
  type: "object",
  additionalProperties: false,
  properties: { od: eyeSchema, oi: eyeSchema },
  required: ["od", "oi"],
};
const uncertainFields = [
  "type",
  "far.od.sphere", "far.od.cylinder", "far.od.axis",
  "far.oi.sphere", "far.oi.cylinder", "far.oi.axis",
  "near.od.sphere", "near.od.cylinder", "near.od.axis",
  "near.oi.sphere", "near.oi.cylinder", "near.oi.axis",
  "add",
];
const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["distance", "near", "both", "unknown"] },
    far: pairSchema,
    near: pairSchema,
    add: { type: "string" },
    quality: { type: "string", enum: ["high", "medium", "low"] },
    uncertain: { type: "array", items: { type: "string", enum: uncertainFields } },
    notes: { type: "string" },
  },
  required: ["type", "far", "near", "add", "quality", "uncertain", "notes"],
};

const instructions = `Sos un transcriptor especializado en recetas oftálmicas argentinas. Tu única tarea es leer la graduación de la imagen: NO diagnostiques, NO recomiendes cristales y NO copies datos personales.

PRIORIDADES:
1. Diferenciá OD/OI y LEJOS/CERCA.
2. Conservá exactamente los signos + y - de esfera y cilindro.
3. El eje debe ser un entero de 1 a 180 y devolverse sin símbolo de grados.
4. ADD se transcribe solamente si está escrita; nunca la calcules.
5. Si un signo o dígito no se ve con suficiente claridad, dejá ese campo vacío y agregá su ruta exacta a uncertain.

FORMATOS FRECUENTES:
- ESF / CIL / EJE.
- -0.50 x 180 o -0.50*180.
- Eje primero: "10° +0,25 +1,50" puede representar EJE / CIL / ESF.
- PL, PLANO o 0 pueden significar esfera 0.00 cuando está inequívocamente indicado.
- Si está escrita únicamente una esfera y no hay cilindro indicado, devolvé cylinder "0.00" y axis vacío solo cuando sea claro que no existe componente cilíndrico.
- OI puede aparecer como OS.
- No confundas fecha, agudeza visual, DP/DNP, altura, firma, matrícula o números administrativos con graduación.

TYPE:
- distance: solo lejos.
- near: solo cerca.
- both: aparecen datos de lejos y cerca o una ADD explícita junto a la graduación de lejos.
- unknown: no se puede determinar con seguridad.

QUALITY:
- high: ambos ojos y estructura se leen con claridad, sin campos ópticos dudosos relevantes.
- medium: lectura mayormente clara pero uno o más campos requieren control.
- low: receta borrosa, ambigua, recortada o con varios valores dudosos.

En notes describí únicamente una observación óptica breve útil para revisar la transcripción, sin incluir nombre del paciente, profesional, fecha ni otros datos personales.`;

function firstSecret(raw: string | undefined) {
  if (!raw) return "";
  try {
    const value = JSON.parse(raw);
    if (typeof value === "string") return value;
    return String(Object.values(value).find(item => typeof item === "string" && item.length > 10) || "");
  } catch { return raw; }
}
function normalizeDecimal(value: unknown) {
  return String(value ?? "").trim().replace(/,/g, ".").replace(/[−–—]/g, "-");
}
function safeEye(value: any) {
  let sphere = normalizeDecimal(value?.sphere);
  let cylinder = normalizeDecimal(value?.cylinder);
  let axis = String(value?.axis ?? "").trim().replace(/[°º]/g, "");
  const plano = /^(PL|PLANO)$/i;
  if (plano.test(sphere)) sphere = "0.00";
  if (plano.test(cylinder)) cylinder = "0.00";
  if ((sphere && (!/^[+-]?\d{1,2}(?:\.\d{1,2})?$/.test(sphere) || Math.abs(Number(sphere)) > 30)) ||
      (cylinder && (!/^[+-]?\d{1,2}(?:\.\d{1,2})?$/.test(cylinder) || Math.abs(Number(cylinder)) > 12)) ||
      (axis && (!/^\d{1,3}$/.test(axis) || Number(axis) < 1 || Number(axis) > 180))) return null;
  return { sphere, cylinder, axis };
}
function safePair(value: any) {
  const od = safeEye(value?.od), oi = safeEye(value?.oi);
  return od && oi ? { od, oi } : null;
}
function sanitize(value: any) {
  const far = safePair(value?.far), near = safePair(value?.near);
  const add = normalizeDecimal(value?.add);
  if (!far || !near || !["distance", "near", "both", "unknown"].includes(value?.type) ||
      !["high", "medium", "low"].includes(value?.quality) ||
      (add && (!/^\+?\d(?:\.\d{1,2})?$/.test(add) || Number(add) <= 0 || Number(add) > 4))) return null;
  const uncertain = Array.isArray(value.uncertain)
    ? [...new Set(value.uncertain.filter((x: unknown) => typeof x === "string" && uncertainFields.includes(x as string)))].slice(0, 14)
    : [];
  return {
    type: value.type,
    far,
    near,
    add,
    quality: value.quality,
    uncertain,
    notes: typeof value.notes === "string" ? value.notes.replace(/\s+/g, " ").trim().slice(0, 260) : "",
  };
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

  const { data: access, error: accessError } = await client.rpc("black_os_has_permission", {
    p_module: "recetas",
    p_permission: "interpret",
  });
  if (accessError || access !== true) return reply({ error: "Tu usuario no tiene permiso para interpretar recetas con Black AI" }, 403);

  const key = Deno.env.get("OPENAI_API_KEY");
  if (!key) return reply({ error: "La clave de OpenAI no está configurada en Supabase" }, 503);

  const body = await req.json().catch(() => ({}));
  const image = body?.image_data_url;
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image) || image.length > 8_000_000)
    return reply({ error: "Usá JPG, PNG o WEBP de menos de 6 MB" }, 400);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: Deno.env.get("OPENAI_MODEL") || "gpt-5.4",
        store: false,
        input: [{
          role: "user",
          content: [
            { type: "input_text", text: instructions },
            { type: "input_image", image_url: image, detail: "high" },
          ],
        }],
        text: { format: { type: "json_schema", name: "optical_prescription", strict: true, schema } },
      }),
    });
    if (!response.ok) {
      console.error("black-recetas-analyze OpenAI", response.status, await response.text());
      return reply({ error: "Black AI no pudo analizar esta imagen" }, 502);
    }
    const payload = await response.json();
    const output = payload.output?.flatMap((item: any) => item.content || []).find((item: any) => item.type === "output_text")?.text;
    const prescription = sanitize(JSON.parse(output || "null"));
    if (!prescription) return reply({ error: "La lectura no tuvo un formato verificable" }, 502);
    return reply({ ok: true, prescription });
  } catch (error) {
    console.error("black-recetas-analyze", error);
    return reply({ error: "No se pudo completar la lectura con Black AI" }, 502);
  }
});
