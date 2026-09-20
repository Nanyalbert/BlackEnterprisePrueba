import { createClient } from "npm:@supabase/supabase-js@2";

type CommercialPreferences = {
  brand?: string | null;
  material?: string | null;
  treatment?: string | null;
  antireflective?: boolean | null;
  blue_filter?: boolean | null;
  photochromic?: boolean | null;
  high_index?: boolean | null;
  polarized?: boolean | null;
};

type CatalogProduct = {
  id?: string;
  name?: string | null;
  family?: string | null;
  optical_case?: string | null;
  design?: string | null;
  material?: string | null;
  treatment?: string | null;
  supply_mode?: string | null;
  base_price?: number | string | null;
  currency?: string | null;
  is_active?: boolean | null;
  valid_from?: string | null;
  valid_until?: string | null;
  metadata?: any;
};

const BUILD_ID = "black-ai-case-orchestrator-20260920-enhancements1";

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

function normalizeText(value: unknown) {
  return String(value || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

function words(value: string) {
  return normalizeText(value).split(/[^a-z0-9]+/).filter((x) => x.length >= 3);
}

function bool(value: unknown) {
  return value === true ? true : value === false ? false : null;
}

function explicitString(value: unknown) {
  const s = String(value || "").trim();
  return s ? s.slice(0, 120) : null;
}

function normalizeCommercialPreferences(value: any): CommercialPreferences {
  const p = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return {
    brand: explicitString(p.brand),
    material: explicitString(p.material),
    treatment: explicitString(p.treatment),
    antireflective: bool(p.antireflective),
    blue_filter: bool(p.blue_filter),
    photochromic: bool(p.photochromic),
    high_index: bool(p.high_index),
    polarized: bool(p.polarized),
  };
}

function mergeCommercialPreferences(...values: any[]): CommercialPreferences {
  const out: any = {};
  for (const value of values) {
    const normalized = normalizeCommercialPreferences(value);
    for (const [key, val] of Object.entries(normalized)) {
      if (val !== null && val !== undefined && val !== "") out[key] = val;
    }
  }
  return out;
}

function metadataText(metadata: any) {
  try { return normalizeText(JSON.stringify(metadata || {})); }
  catch (_) { return ""; }
}

function searchableProductText(row: CatalogProduct) {
  return normalizeText([
    row.name,
    row.family,
    row.optical_case,
    row.design,
    row.material,
    row.treatment,
    row.supply_mode,
    metadataText(row.metadata),
  ].filter(Boolean).join(" "));
}

function productBrand(row: CatalogProduct) {
  const candidates = [
    row.metadata?.brand,
    row.metadata?.marca,
    row.metadata?.manufacturer,
    row.metadata?.fabricante,
    row.metadata?.source?.brand,
    row.metadata?.source?.marca,
  ];
  for (const candidate of candidates) {
    const value = explicitString(candidate);
    if (value) return value;
  }
  return null;
}

function isHighIndex(row: CatalogProduct) {
  const text = searchableProductText(row);
  const material = normalizeText(row.material);
  return /alto indice|high index|1[.,](60|67|74)|\b160\b|\b167\b|\b174\b/.test(`${text} ${material}`);
}

function hasTreatment(row: CatalogProduct, kind: string) {
  const treatment = normalizeText(row.treatment);
  const text = searchableProductText(row);
  if (kind === "blue_filter") return ["blue_filter", "super_blue", "photochromic_blue"].includes(treatment) || /filtro (de )?luz azul|blue|super blue/.test(text);
  if (kind === "photochromic") return ["photochromic", "photochromic_blue"].includes(treatment) || /fotocrom|photochrom/.test(text);
  if (kind === "antireflective") return treatment === "antireflective" || /antirreflejo|anti reflejo|\bar\b/.test(text);
  if (kind === "polarized") return treatment === "polarized" || /polariz/.test(text);
  return false;
}

function preferenceMatchScore(row: CatalogProduct, preferences: CommercialPreferences) {
  let score = 0;
  const text = searchableProductText(row);
  const brand = normalizeText(preferences.brand);
  const material = normalizeText(preferences.material);
  const treatment = normalizeText(preferences.treatment);

  if (brand) {
    const rowBrand = normalizeText(productBrand(row));
    if ((rowBrand && rowBrand.includes(brand)) || text.includes(brand)) score += 180;
    else score -= 120;
  }
  if (material) {
    if (normalizeText(row.material).includes(material) || text.includes(material)) score += 100;
    else score -= 35;
  }
  if (treatment) {
    if (normalizeText(row.treatment).includes(treatment) || text.includes(treatment)) score += 100;
    else score -= 35;
  }
  if (preferences.blue_filter === true) score += hasTreatment(row, "blue_filter") ? 120 : -50;
  if (preferences.photochromic === true) score += hasTreatment(row, "photochromic") ? 120 : -50;
  if (preferences.antireflective === true) score += hasTreatment(row, "antireflective") ? 100 : -35;
  if (preferences.polarized === true) score += hasTreatment(row, "polarized") ? 120 : -50;
  if (preferences.high_index === true) score += isHighIndex(row) ? 120 : -50;
  return score;
}

function baseCommercialScore(row: CatalogProduct) {
  let score = 0;
  const treatment = normalizeText(row.treatment || "none");
  const text = searchableProductText(row);
  if (!treatment || treatment === "none") score += 35;
  if (/organico blanco|blanco/.test(text)) score += 20;
  if (/antirreflejo/.test(text)) score += 5;
  if (/fotocrom|filtro (de )?luz azul|super blue|polariz/.test(text)) score -= 5;
  return score;
}

function designRank(row: CatalogProduct, recommendedOrder: string[]) {
  const design = String(row.design || "").trim().toUpperCase();
  const idx = recommendedOrder.map((x) => String(x).toUpperCase()).indexOf(design);
  return idx >= 0 ? idx : 100;
}

function filterAndRankCatalogProducts(args: {
  products: CatalogProduct[];
  preferences?: CommercialPreferences;
  recommendedOrder?: string[];
  opticalCase?: string | null;
  family?: string | null;
  supplyMode?: string | null;
  max?: number;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const preferences = normalizeCommercialPreferences(args.preferences || {});
  const recommendedOrder = Array.isArray(args.recommendedOrder) ? args.recommendedOrder : [];

  const eligible = (args.products || []).filter((row) => {
    const price = Number(row.base_price);
    if (row.is_active === false) return false;
    if (!Number.isFinite(price) || price <= 0) return false;
    if (row.valid_from && row.valid_from > today) return false;
    if (row.valid_until && row.valid_until < today) return false;
    if (args.opticalCase && row.optical_case && row.optical_case !== args.opticalCase) return false;
    if (args.family && row.family && row.family !== args.family) return false;
    if (args.supplyMode && row.supply_mode && row.supply_mode !== args.supplyMode) return false;
    return true;
  });

  const grouped = new Map<string, CatalogProduct[]>();
  for (const row of eligible) {
    const key = String(row.design || row.name || row.id || "unknown").trim().toUpperCase();
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(row);
  }

  const selected: any[] = [];
  const groups = [...grouped.entries()].sort((a, b) => {
    const ar = designRank(a[1][0] || {}, recommendedOrder);
    const br = designRank(b[1][0] || {}, recommendedOrder);
    return ar - br || a[0].localeCompare(b[0]);
  });

  for (const [, rows] of groups) {
    rows.sort((a, b) => {
      const as = preferenceMatchScore(a, preferences) + baseCommercialScore(a);
      const bs = preferenceMatchScore(b, preferences) + baseCommercialScore(b);
      if (as !== bs) return bs - as;
      return Number(a.base_price) - Number(b.base_price);
    });
    const chosen = rows[0];
    if (!chosen) continue;
    selected.push({
      ...chosen,
      commercial_rank: designRank(chosen, recommendedOrder),
      preference_score: preferenceMatchScore(chosen, preferences),
      detected_brand: productBrand(chosen),
    });
    if (selected.length >= Math.max(1, args.max || 6)) break;
  }
  return selected;
}

function availableCatalogFeatures(products: CatalogProduct[]) {
  const features = new Set<string>();
  const brands = new Set<string>();
  const materials = new Set<string>();
  for (const row of products || []) {
    if (hasTreatment(row, "antireflective")) features.add("antirreflejo");
    if (hasTreatment(row, "blue_filter")) features.add("filtro de luz azul");
    if (hasTreatment(row, "photochromic")) features.add("fotocromático");
    if (hasTreatment(row, "polarized")) features.add("polarizado");
    if (isHighIndex(row)) features.add("alto índice");
    const brand = productBrand(row); if (brand) brands.add(brand);
    const material = explicitString(row.material); if (material) materials.add(material);
  }
  return { features: [...features], brands: [...brands].slice(0, 20), materials: [...materials].slice(0, 20) };
}

function preferenceSummary(preferences: CommercialPreferences) {
  const parts: string[] = [];
  if (preferences.brand) parts.push(`marca ${preferences.brand}`);
  if (preferences.material) parts.push(`material ${preferences.material}`);
  if (preferences.antireflective) parts.push("antirreflejo");
  if (preferences.blue_filter) parts.push("filtro de luz azul");
  if (preferences.photochromic) parts.push("fotocromático");
  if (preferences.high_index) parts.push("alto índice");
  if (preferences.polarized) parts.push("polarizado");
  if (preferences.treatment) parts.push(preferences.treatment);
  return parts;
}

function isAffirmative(message: string) {
  const t = normalizeText(message);
  return /^(?:si(?:,?\s+)?|los\s+valores\s+)?(?:estan?\s+(?:bien|correctos?|correctas?)|esta\s+bien|correctos?|correctas?|tal cual|confirmo|confirmado|ok|okay|dale|perfecto)\b/i.test(t);
}

function detectDesignMention(message: string) {
  const t = normalizeText(message);
  if (/\b(?:smart\s+)?ailens\b/.test(t)) return "AILENS";
  if (/\b(?:smart\s+)?free\b/.test(t)) return "FREE";
  if (/\b(?:smart\s+)?new\b/.test(t)) return "NEW";
  if (/\b(?:smart\s+)?one\b/.test(t)) return "ONE";
  return null;
}

function isFeatureAvailabilityQuestion(message: string) {
  const t = normalizeText(message);
  return /\b(tiene|tienen|hay|viene|se puede|puede llevar|puedo pedir|trabajan)\b/.test(t)
    && /\b(filtro azul|luz azul|fotocrom|antirreflejo|alto indice|polariz|policarbonato|1[.,](56|59|60|67|74))\b/.test(t);
}

function isUpgradeQuestion(message: string) {
  const t = normalizeText(message);
  return /\b(mejora|mejoras|mejorarlo|mejorarla|algo mejor|opcion mejor|que le puedo agregar|que se le puede agregar|con que lo puedo mejorar|upgrade|tratamiento|tratamientos)\b/.test(t);
}

function enhancementKey(row: CatalogProduct) {
  if (hasTreatment(row, "photochromic")) return "photochromic";
  if (hasTreatment(row, "blue_filter")) return "blue_filter";
  if (hasTreatment(row, "antireflective")) return "antireflective";
  if (hasTreatment(row, "polarized")) return "polarized";
  if (isHighIndex(row)) return "high_index";
  return "base";
}

function buildEnhancementOptions(rows: CatalogProduct[]) {
  const best = new Map<string, CatalogProduct>();
  for (const row of rows || []) {
    const price = Number(row.base_price);
    if (!Number.isFinite(price) || price <= 0) continue;
    const key = enhancementKey(row);
    const prev = best.get(key);
    if (!prev || Number(prev.base_price) > price) best.set(key, row);
  }
  const order = ["base", "antireflective", "blue_filter", "photochromic", "high_index", "polarized"];
  return order
    .filter((key) => best.has(key))
    .map((key) => {
      const row = best.get(key)!;
      return {
        key,
        name: row.name,
        material: row.material,
        treatment: row.treatment,
        price: Number(row.base_price),
        price_label: money(Number(row.base_price), row.currency || "ARS"),
      };
    });
}

function staleConversation(lastPatientMessageAt: unknown, hours = 8) {
  if (!lastPatientMessageAt) return false;
  const ts = new Date(String(lastPatientMessageAt)).getTime();
  return Number.isFinite(ts) && (Date.now() - ts) > hours * 60 * 60 * 1000;
}

function resetCaseContext(current: any) {
  current.objective = null;
  current.stage = "discovery";
  current.prescription = {};
  current.prescription_status = "none";
  current.prescription_confirmed_at = null;
  current.prescription_source_message_id = null;
  current.prescription_analysis = {};
  current.prescription_updated_at = null;
  current.optical_case = null;
  current.technical_family_key = null;
  current.main_use = null;
  current.previous_lens_type = null;
  current.budget_context = null;
  current.urgency = null;
  current.preferences = {};
  current.technical_result = {};
  current.candidate_products = [];
  current.missing_data = [];
  current.requires_human_review = false;
  current.next_best_question_key = null;
  current.next_best_question_context = {};
  current.conversation_started_at = new Date().toISOString();
  return current;
}

function isNegative(message: string) {
  return /^(no|incorrecto|incorrecta|esta mal|estan mal|no esta bien|hay un error)(\b|[.! ])/i.test(normalizeText(message));
}

function explicitlyDeniesPrescription(message: string) {
  return /\b(no\s+(te\s+|les\s+)?(mande|envie|pase)\s+(ninguna\s+)?receta|todavia\s+no\s+(te\s+|les\s+)?(mande|envie|pase)\s+receta|no\s+mande\s+receta|no\s+envie\s+receta|no\s+tengo\s+receta)\b/.test(normalizeText(message));
}

function detectDirectIntent(message: string) {
  const t = normalizeText(message);
  if (!t) return null;
  if (/^(hola|buenas|buen dia|buenas tardes|buenas noches|holi|hello)[!,. ]*$/.test(t)) return "greeting";

  // Seguridad clínica: explicar óptica sí; diagnosticar síntomas no.
  if (/\b(dolor (de|en) (ojo|ojos)|perdi(d[ao])? (la )?vision|no veo de golpe|vision borrosa de golpe|golpe en el ojo|ojo rojo con dolor|destellos repentinos|moscas volantes repentinas)\b/.test(t)) return "clinical_symptom";

  // Señales comerciales explícitas.
  if (/\b(esta muy caro|es muy caro|me parece caro|se me va|no me alcanza|fuera de (mi )?presupuesto|algo mas barato|opcion mas barata|demasiado caro|es mucho)\b/.test(t)) return "sales_objection";
  if (/\b(me quedo con (ese|esa|el|la)|quiero ese|quiero esa|dale con (ese|esa)|avancemos|hagamoslo|lo quiero hacer|quiero hacerlo|como seguimos|reservame|lo llevo|cierro con)\b/.test(t)) return "buying_signal";
  if (/\b(cual me recomendas|que me recomendas|cual me conviene|que me conviene|cual elegir|cual elegirias|que opcion elegir)\b/.test(t)) return "recommendation_request";

  if (/\b(horario|horarios|a que hora|abren|abierto|cierran|cerrado|direccion|ubicacion|donde estan|donde queda|sucursal)\b/.test(t)) return "hours_location";
  if (/\b(cuotas?|tarjeta|transferencia|efectivo|medio[s]? de pago|formas? de pago|pagar)\b/.test(t)) return "payment_methods";
  if (/\b(black protect|promocion|promo|descuento|beneficio|convenio|obra social|mutual|ministerio)\b/.test(t)) return "promotion";
  if (/\b(turno|turnos|agenda|reservar|coordinar atencion)\b/.test(t)) return "appointment";
  if (/\b(reclamo|garantia|problema|se rompio|se quebr|devolucion|no me adapto|adaptacion)\b/.test(t)) return "support";

  const opticalTerms = /\b(multifocal|multifocales|progresivo|progresivos|monofocal|monofocales|ocupacional|ocupacionales|bifocal|bifocales|antirreflejo|fotocromatico|fotocromaticos|filtro azul|alto indice|policarbonato|polarizado|polarizados|indice 1[.,](56|59|60|67|74)|cristal|cristales|lente|lentes)\b/;
  if (opticalTerms.test(t) && /\b(que es|que son|que significa|como funciona|como funcionan|para que sirve|para que sirven|cual es la diferencia|que diferencia|diferencia entre|ventaja|ventajas|desventaja|desventajas)\b/.test(t)) return "technical_question";

  if (/\b(anteojos? de sol|lentes? de sol|solar|solares|gafas? de sol)\b/.test(t)) return "sunglasses";
  if (/\b(armazon|armazones|marco|marcos)\b/.test(t)) return "frames";
  if (/\b(lentes? de contacto|contactologia|contactolog)\b/.test(t)) return "contact_lenses";
  if (/\b(multifocal|multifocales|progresivo|progresivos|monofocal|monofocales|ocupacional|ocupacionales|bifocal|bifocales|receta|graduacion|cristal|cristales|lente|lentes)\b/.test(t) && /\b(precio|precios|sale|salen|cuesta|cuestan|cotiz|presupuesto|valor|valores)\b/.test(t)) return "prescription_lens_quote";
  return null;
}

function normalizeFacts(value: any) {
  const allowedObjective = ["quote", "appointment", "support", "product_info", "other"];
  const allowedCase = ["monofocal", "bifocal", "occupational", "multifocal"];
  const allowedPrice = ["general", "exact", "none"];
  const allowedIntent = ["greeting", "prescription_lens_quote", "sunglasses", "frames", "contact_lenses", "hours_location", "payment_methods", "appointment", "support", "promotion", "general_product", "technical_question", "clinical_symptom", "recommendation_request", "sales_objection", "buying_signal", "other"];
  const facts: any = {};
  if (allowedObjective.includes(value?.objective)) facts.objective = value.objective;
  if (allowedCase.includes(value?.optical_case)) facts.optical_case = value.optical_case;
  if (allowedPrice.includes(value?.price_request)) facts.price_request = value.price_request;
  if (allowedIntent.includes(value?.intent)) facts.intent = value.intent;
  if (typeof value?.product_category === "string" && value.product_category.trim()) facts.product_category = value.product_category.trim().slice(0, 100);
  if (typeof value?.main_use === "string" && value.main_use.trim()) facts.main_use = value.main_use.trim().slice(0, 160);
  if (typeof value?.previous_lens_type === "string" && value.previous_lens_type.trim()) facts.previous_lens_type = value.previous_lens_type.trim().slice(0, 160);
  if (typeof value?.budget_context === "string" && value.budget_context.trim()) facts.budget_context = value.budget_context.trim().slice(0, 160);
  if (typeof value?.urgency === "string" && value.urgency.trim()) facts.urgency = value.urgency.trim().slice(0, 160);
  facts.preferences = normalizeCommercialPreferences(value?.preferences || {});
  return facts;
}

async function inferFactsWithAI(message: string, current: any) {
  const directIntent = detectDirectIntent(message);
  const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!openAiKey || !message.trim()) return { facts: directIntent ? { intent: directIntent } : {}, mode: directIntent ? "deterministic" : "none" };
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";
  const prompt = `
Clasificá el mensaje de un paciente de una óptica y extraé solamente hechos explícitos.
No asumas que toda conversación es una cotización con receta.

intent: greeting | prescription_lens_quote | sunglasses | frames | contact_lenses | hours_location | payment_methods | appointment | support | promotion | general_product | technical_question | clinical_symptom | recommendation_request | sales_objection | buying_signal | other
objective: quote | appointment | support | product_info | other | null
optical_case: monofocal | bifocal | occupational | multifocal | null
price_request: general | exact | none

preferences debe usar SOLO estas claves si el paciente las expresa:
- brand: marca pedida literalmente, por ejemplo Varilux, Essilor, Zeiss, etc.
- material: material pedido literalmente, por ejemplo policarbonato.
- treatment: otro tratamiento explícito que no encaje abajo.
- antireflective: true solo si pide antirreflejo.
- blue_filter: true solo si pide filtro azul / blue.
- photochromic: true solo si pide fotocromático.
- high_index: true solo si pide alto índice, lente más fino/delgado por graduación alta.
- polarized: true solo si pide polarizado.

REGLAS:
- progresivos = multifocal.
- No deduzcas que es primer usuario de multifocales.
- No asumas filtro azul, fotocromático, marca, alto índice, material ni ninguna otra preferencia.
- Si pregunta precio de una categoría, price_request=general.
- price_request=exact solo para una configuración/caso personal concreto.
- technical_question: pregunta conceptual sobre lentes, materiales, tratamientos o diseños. No requiere receta salvo que pida recomendación personalizada.
- clinical_symptom: describe dolor, pérdida súbita de visión, golpe u otro síntoma clínico; no diagnostiques.
- recommendation_request: pide elegir o recomendar una opción.
- sales_objection: expresa un freno comercial, por ejemplo precio o presupuesto.
- buying_signal: expresa una decisión concreta de avanzar con una opción.
- Horarios, ubicación, pagos, convenios, turnos y reclamos no requieren receta.
- No inventes receta, precio, stock ni diagnóstico.

Respondé SOLO JSON válido:
{"intent":"other","objective":null,"optical_case":null,"price_request":"none","product_category":null,"main_use":null,"previous_lens_type":null,"budget_context":null,"urgency":null,"preferences":{"brand":null,"material":null,"treatment":null,"antireflective":null,"blue_filter":null,"photochromic":null,"high_index":null,"polarized":null}}

ESTADO ACTUAL:
${JSON.stringify({ objective: current?.objective, optical_case: current?.optical_case, prescription_status: current?.prescription_status, main_use: current?.main_use, previous_lens_type: current?.previous_lens_type, preferences: current?.preferences })}

MENSAJE:
${message.slice(0, 3000)}
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }], reasoning: { effort: "low" }, max_output_tokens: 520, store: false }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return { facts: directIntent ? { intent: directIntent } : {}, mode: "openai_error" };
    const parsed = normalizeFacts(parseJsonObject(extractOutputText(payload)) || {});
    if (directIntent) parsed.intent = directIntent;
    return { facts: parsed, mode: "openai" };
  } catch (_) {
    return { facts: directIntent ? { intent: directIntent } : {}, mode: "openai_error" };
  }
}

function stripKnowledgePrices(value: string) {
  return String(value || "").replace(/\$\s*[\d.]+(?:,\d+)?/g, "[precio: usar Catálogo vigente]");
}

function structuredKnowledgeBonus(data: any, context: any) {
  if (!data || typeof data !== "object") return 0;
  let score = 0;
  if (data.scope === "global") score += 12;
  if (data.intent && context?.intent && data.intent === context.intent) score += 30;
  if (data.optical_case && context?.optical_case && data.optical_case === context.optical_case) score += 40;
  if (data.supply_mode && context?.supply_mode && data.supply_mode === context.supply_mode) score += 35;
  if (data.treatment && context?.treatment && data.treatment === context.treatment) score += 25;
  return score;
}

async function getKnowledgeSnapshot(supabase: any, message: string, intent: string | null, context: any = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from("black_ai_knowledge")
    .select("id,category,title,content,data,priority,valid_from,valid_until")
    .eq("is_active", true).order("priority", { ascending: true }).order("updated_at", { ascending: false }).limit(100);
  if (error) return [];
  const msgWords = new Set(words(message));
  const categoryWeight = (category: string) => {
    if (intent === "hours_location" || intent === "appointment" || intent === "support") return category === "policy" ? 35 : 0;
    if (intent === "payment_methods") return category === "policy" ? 25 : category === "promotion" ? 20 : 0;
    if (intent === "promotion") return category === "promotion" ? 35 : category === "policy" ? 15 : 0;
    if (["sunglasses", "frames", "contact_lenses", "general_product"].includes(String(intent))) return category === "commercial" ? 25 : category === "price_product" ? 15 : 0;
    if (intent === "prescription_lens_quote") return category === "commercial" ? 25 : category === "policy" ? 12 : category === "promotion" ? 8 : 0;
    return category === "commercial" ? 8 : category === "policy" ? 8 : 0;
  };
  return (data || [])
    .filter((x: any) => (!x.valid_from || x.valid_from <= today) && (!x.valid_until || x.valid_until >= today))
    .map((x: any) => {
      const haystackWords = new Set(words(`${x.title} ${x.content}`));
      let overlap = 0;
      for (const w of msgWords) if (haystackWords.has(w)) overlap += 1;
      const score = categoryWeight(x.category) + (overlap * 8) + structuredKnowledgeBonus(x.data, { ...context, intent }) + Math.max(0, 20 - Math.min(20, Number(x.priority || 100) / 5));
      return { ...x, score, overlap, content: stripKnowledgePrices(x.content) };
    })
    .sort((a: any, b: any) => b.score - a.score || Number(a.priority || 100) - Number(b.priority || 100))
    .slice(0, 12)
    .map((x: any) => ({ id: x.id, category: x.category, title: x.title, content: x.content, priority: x.priority, data: x.data || {}, score: x.score, overlap: x.overlap }));
}

function generalFallback(intent: string | null) {
  const map: Record<string, string> = {
    greeting: "¡Hola! ¿En qué te puedo ayudar?",
    hours_location: "No tengo ese dato confirmado en la información disponible. Si querés, te lo confirma un asesor.",
    sunglasses: "Claro. ¿Qué tipo de anteojo de sol estás buscando?",
    frames: "Claro. ¿Buscás algún estilo de armazón en particular?",
    contact_lenses: "Puedo ayudarte con lentes de contacto. ¿Qué necesitás saber?",
    payment_methods: "No tengo las condiciones de pago confirmadas en la información disponible. Puedo derivarte para que te las confirmen.",
    appointment: "¿Qué día o franja horaria te quedaría cómoda para atenderte?",
    support: "Contame brevemente qué pasó así te ayudo a derivarlo correctamente.",
    promotion: "Puedo revisar los beneficios o convenios vigentes. ¿Sobre cuál querés consultar?",
    general_product: "¿Qué producto o beneficio querés consultar?",
    technical_question: "Te lo explico de forma simple.",
    clinical_symptom: "Esa consulta necesita evaluación profesional. Si querés, te ayudo a coordinar la atención.",
  };
  return map[String(intent)] || "¿En qué te puedo ayudar?";
}

async function getAssistantConfig(supabase: any) {
  try {
    const { data } = await supabase.from("black_ai_settings").select("config").eq("id", "global").maybeSingle();
    return { tone: String(data?.config?.tone || "friendly"), length: String(data?.config?.length || "short"), emoji: String(data?.config?.emoji || "moderate") };
  } catch (_) {
    return { tone: "friendly", length: "short", emoji: "moderate" };
  }
}

function styleInstruction(config: any) {
  const tone = config?.tone === "formal" ? "profesional y sobrio" : config?.tone === "direct" ? "directo y práctico" : "cercano, natural y profesional";
  const length = config?.length === "long" ? "Podés desarrollar un poco si aporta valor." : config?.length === "medium" ? "Mantené una extensión moderada." : "Sé breve, salvo que una cotización necesite varias líneas.";
  const emoji = config?.emoji === "none" ? "No uses emojis." : config?.emoji === "high" ? "Podés usar algunos emojis útiles, sin exagerar." : "Usá como máximo 1 emoji cuando sea natural; no es obligatorio.";
  return `Tono ${tone}. ${length} ${emoji}`;
}

async function answerGeneralQuery(args: { message: string; intent: string | null; knowledge: any[]; fallback: string; pendingPrescription: boolean; style: any }) {
  const { message, intent, knowledge, fallback, pendingPrescription, style } = args;
  const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!openAiKey) return fallback;
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";
  const prompt = `
Sos Black AI, asistente de Black Óptica. Respondé en español argentino.
${styleInstruction(style)}
- Respondé primero exactamente lo que preguntó el paciente.
- Usá como hechos SOLO el CONOCIMIENTO APROBADO.
- Si falta el dato concreto, no lo inventes.
- Si INTENCIÓN=technical_question: explicá el concepto en 1 a 3 frases, con lenguaje simple y preciso. No uses listas salvo que el paciente esté comparando opciones. Evitá convertir la explicación en una venta; como máximo conectá con el producto si aporta valor.
- Si INTENCIÓN=clinical_symptom: no diagnostiques ni sugieras un lente como solución. Indicá brevemente que requiere evaluación profesional y ofrecé ayudar con la atención.
- No arrastres al paciente a una receta si cambió de tema.
- No termines siempre con una pregunta.
- No te presentes nuevamente si la conversación ya está en curso.
MENSAJE: ${message.slice(0, 2000)}
INTENCIÓN: ${intent || "other"}
RECETA PENDIENTE: ${pendingPrescription ? "sí" : "no"}
CONOCIMIENTO APROBADO: ${JSON.stringify(knowledge)}
`.trim();
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }], reasoning: { effort: "low" }, max_output_tokens: 320, store: false }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return fallback;
    return sanitizeWhatsappReply(extractOutputText(payload).trim().slice(0, 1500) || fallback);
  } catch (_) {
    return fallback;
  }
}

function money(value: number, currency = "ARS") {
  try { return new Intl.NumberFormat("es-AR", { style: "currency", currency, maximumFractionDigits: 0 }).format(Math.round(value)); }
  catch (_) { return `$${Math.round(value).toLocaleString("es-AR")}`; }
}

function recommendedDesignOrder(knowledge: any[], opticalCase: string | null) {
  for (const item of knowledge || []) {
    if (item?.data?.role === "commercial_recommendation" && (!item.data.optical_case || item.data.optical_case === opticalCase) && Array.isArray(item.data.recommended_order)) {
      return item.data.recommended_order.map((x: any) => String(x).toUpperCase()).filter(Boolean);
    }
  }
  return [];
}

function treatmentContext(preferences: any) {
  if (preferences?.photochromic) return "photochromic";
  if (preferences?.blue_filter) return "blue_filter";
  if (preferences?.antireflective) return "antireflective";
  if (preferences?.polarized) return "polarized";
  return preferences?.treatment || null;
}

async function getCommercialSnapshot(supabase: any, state: any, knowledge: any[], options: any = {}) {
  const opticalCase = state?.optical_case || null;
  if (!opticalCase) return null;

  const { data, error } = await supabase.from("black_ai_products")
    .select("id,name,family,optical_case,design,material,treatment,base_price,currency,valid_from,valid_until,supply_mode,metadata,is_active")
    .eq("is_active", true)
    .eq("family", "lens")
    .eq("optical_case", opticalCase)
    .not("base_price", "is", null)
    .limit(500);
  if (error) {
    console.error("commercial catalog", error);
    return null;
  }

  let rows = data || [];
  const preferences = normalizeCommercialPreferences(state?.preferences || {});
  const selectedDesign = String(options?.selectedDesign || "").trim().toUpperCase();
  if (selectedDesign) rows = rows.filter((row: any) => String(row.design || "").trim().toUpperCase() === selectedDesign);

  if (options?.strictPreferences) {
    rows = rows.filter((row: any) => {
      if (preferences.blue_filter === true && !hasTreatment(row, "blue_filter")) return false;
      if (preferences.photochromic === true && !hasTreatment(row, "photochromic")) return false;
      if (preferences.antireflective === true && !hasTreatment(row, "antireflective")) return false;
      if (preferences.polarized === true && !hasTreatment(row, "polarized")) return false;
      if (preferences.high_index === true && !isHighIndex(row)) return false;
      if (preferences.material && !searchableProductText(row).includes(normalizeText(preferences.material))) return false;
      if (preferences.brand) {
        const brand = normalizeText(preferences.brand);
        if (!normalizeText(productBrand(row)).includes(brand) && !searchableProductText(row).includes(brand)) return false;
      }
      return true;
    });
  }

  const order = recommendedDesignOrder(knowledge, opticalCase);
  const supplyMode = state?.technical_result?.supply_mode || null;
  const examples = filterAndRankCatalogProducts({ products: rows, preferences, recommendedOrder: order, opticalCase, family: "lens", supplyMode, max: selectedDesign ? 3 : 8 });
  const features = availableCatalogFeatures(rows);
  const enhancementOptions = selectedDesign ? buildEnhancementOptions(rows) : [];

  let brandMatchCount: number | null = null;
  if (preferences.brand) {
    const target = normalizeText(preferences.brand);
    brandMatchCount = rows.filter((row: any) => normalizeText(productBrand(row)).includes(target) || searchableProductText(row).includes(target)).length;
  }

  return {
    optical_case: opticalCase,
    currency: examples[0]?.currency || rows[0]?.currency || "ARS",
    selection_mode: order.length ? "knowledge_commercial_order" : "generic_catalog_rank",
    recommended_order: order,
    preferences,
    preference_summary: preferenceSummary(preferences),
    requested_brand_found: brandMatchCount === null ? null : brandMatchCount > 0,
    selected_design: selectedDesign || null,
    strict_preferences: Boolean(options?.strictPreferences),
    exact_match_found: examples.length > 0,
    available_features: features.features,
    available_brands: features.brands,
    available_materials: features.materials,
    enhancement_options: enhancementOptions,
    examples: examples.map((x: any) => ({
      id: x.id,
      name: x.name,
      design: x.design,
      material: x.material,
      treatment: x.treatment,
      supply_mode: x.supply_mode,
      brand: x.detected_brand || null,
      price: Number(x.base_price),
      price_label: money(Number(x.base_price), x.currency || "ARS"),
      commercial_rank: x.commercial_rank,
      preference_score: x.preference_score,
    })),
  };
}

function questionForKey(key: string | null, objective: string | null) {
  if (objective === "appointment") return "¿Qué día o franja horaria te quedaría cómoda para atenderte?";
  if (objective === "support") return "Contame brevemente qué pasó así te ayudo a derivarlo correctamente.";
  if (objective === "product_info") return "¿Qué producto querés consultar?";
  const questions: Record<string, string> = {
    clarify_objective: "¿Qué te gustaría consultar?",
    request_prescription: "Si querés una cotización para lentes con graduación, ¿tenés una receta óptica para pasarme? Podés enviarme una foto.",
    complete_prescription: "Me faltan algunos datos de la receta. ¿Podés mandarme una foto completa y nítida?",
    request_axis_od: "¿Me confirmás el eje del ojo derecho (OD)?",
    request_axis_oi: "¿Me confirmás el eje del ojo izquierdo (OI)?",
    request_addition: "¿La receta indica una adición (ADD) para cerca?",
    clarify_optical_case: "¿Buscás lentes monofocales, multifocales, ocupacionales o bifocales?",
    ask_main_use: "¿Para qué los vas a usar principalmente: lejos, lectura, computadora o uso diario?",
    ask_previous_lens_experience: "¿Ya usaste este tipo de lentes antes?",
    choose_technical_family: "Con esos datos ya puedo avanzar con la evaluación técnica del lente.",
    run_technical_evaluation: "Ya tengo los datos necesarios para evaluar la receta.",
    ready_for_proposal: "Ya tengo la información necesaria para armarte una propuesta.",
  };
  return key ? (questions[key] || "") : "";
}

function sanitizeWhatsappReply(text: string) {
  return String(text || "")
    .replace(/\*\*/g, "")
    .replace(/`/g, "")
    .replace(/^\s*[-•]\s*\*/gm, "- ")
    .replace(/\*/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .trim();
}

async function writeContextualReply(args: { message: string; intent: string; state: any; nextKey: string | null; fallback: string; commercial: any; priceRequest: string; repeated: boolean; previousReply: string; knowledge: any[]; justConfirmed: boolean; style: any }) {
  const { message, intent, state, nextKey, fallback, commercial, priceRequest, repeated, previousReply, knowledge, justConfirmed, style } = args;
  const openAiKey = Deno.env.get("OPENAI_API_KEY") || "";
  if (!openAiKey || !message.trim()) return fallback;
  const model = Deno.env.get("OPENAI_MODEL") || "gpt-5.6-luna";
  const prompt = `
Sos Black AI, asistente de Black Óptica en Argentina. Redactá UNA respuesta de WhatsApp natural.
${styleInstruction(style)}

REGLAS DURAS:
- Respondé primero lo que preguntó el paciente.
- No afirmes preferencias, experiencia ni necesidades que el paciente no haya expresado.
- No supongas que quiere filtro azul: también pueden existir antirreflejo, fotocromático, alto índice, polarizado, materiales y marcas, pero nombrá solo características presentes en CATÁLOGO DISPONIBLE o CONOCIMIENTO.
- Si el paciente expresó marca/material/tratamiento, respetá esa preferencia. Si requested_brand_found=false, no afirmes que esa marca está disponible.
- Si price_request=none, no muestres precios.
- Si price_request=general, podés mostrar opciones de CATÁLOGO DISPONIBLE en el orden exacto recibido.
- Si price_request=general y ya respondiste con precios/opciones, NO agregues después una frase sobre "evaluación técnica", "familia técnica" o el PRÓXIMO PASO salvo que el paciente haya pedido una cotización personalizada con su receta.
- Si CATÁLOGO DISPONIBLE trae selected_design, interpretá pronombres como "ese", "eso" o "el Free" dentro de ese diseño.
- Diferenciá filtro de luz azul y antirreflejo: son mejoras distintas. Nunca los presentes como si fueran lo mismo.
- Si CATÁLOGO DISPONIBLE trae enhancement_options, podés ofrecer como máximo DOS mejoras relevantes del mismo diseño. Solo nombrá variantes realmente presentes en el catálogo.
- Las mejoras son OPCIONALES salvo que el motor técnico o CONOCIMIENTO indique otra cosa. No digas que el paciente "necesita" filtro azul, antirreflejo, alto índice o fotocromático solo por inferencia.
- Si el paciente pregunta "qué mejora le puedo agregar", compará brevemente las alternativas disponibles y preguntá cuál prioriza si hace falta: comodidad visual/reflejos, cambio con el sol, espesor/peso u otra necesidad.
- Si hay una diferencia técnica sobre una mejora y CONOCIMIENTO no la explica, no inventes la ventaja: limitate a indicar que esa variante existe y su precio cuando corresponda.
- Si strict_preferences=true y exact_match_found=false, decí que esa combinación no quedó confirmada en el catálogo y no inventes un precio.
- Para cada opción mostrada, agregá una descripción MUY BREVE basada exclusivamente en CONOCIMIENTO. Si Conocimiento no describe esa opción, no inventes una característica: usá solo el nombre y precio.
- Si price_request=exact, cotizá únicamente cuando la receta esté confirmada y el flujo técnico permita avanzar.
- Los precios válidos salen exclusivamente de CATÁLOGO DISPONIBLE.
- No uses asteriscos, doble asterisco, backticks ni Markdown. Texto plano de WhatsApp.
- No hagas una recomendación personalizada si todavía falta información necesaria.
- Si INTENCIÓN=recommendation_request y ya hay datos suficientes: elegí UNA opción principal y, solo si aporta valor, UNA alternativa. Explicá el motivo en una frase por opción. Si falta un dato decisivo, hacé una sola pregunta.
- Si INTENCIÓN=sales_objection: reconocé la objeción sin discutir ni presionar. No inventes descuentos. Si el catálogo trae alternativas válidas, ofrecé una opción de menor costo o distinta configuración explicando brevemente el cambio.
- Si INTENCIÓN=buying_signal: dejá de sobreexplicar. Confirmá brevemente la opción elegida si está identificada y proponé UN siguiente paso concreto para avanzar.
- No repitas muletillas como "Perfecto", "Claro" o "Genial" en todos los mensajes.
- No preguntes por todo junto. Una sola pregunta principal y solo si realmente hace falta.
- No inventes stock, disponibilidad de marca, tiempos, garantías, beneficios ni diagnósticos.

INTENCIÓN: ${intent}
MENSAJE: ${message.slice(0, 2000)}
CONTEXTO: ${JSON.stringify({ objective: state?.objective, optical_case: state?.optical_case, main_use: state?.main_use, previous_lens_type: state?.previous_lens_type, preferences: state?.preferences, prescription_status: state?.prescription_status })}
RECETA ACABA DE CONFIRMARSE: ${justConfirmed ? "sí" : "no"}
PRICE_REQUEST: ${priceRequest}
CATÁLOGO DISPONIBLE: ${JSON.stringify(commercial || null)}
CONOCIMIENTO APROBADO: ${JSON.stringify(knowledge)}
PRÓXIMO PASO: ${nextKey || "sin clave"}
PREGUNTA BASE: ${fallback || ""}
SE REPITE: ${repeated ? "sí" : "no"}
RESPUESTA ANTERIOR: ${String(previousReply || "").slice(0, 1000)}
`.trim();

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${openAiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, input: [{ role: "user", content: [{ type: "input_text", text: prompt }] }], reasoning: { effort: "low" }, max_output_tokens: 520, store: false }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) return fallback;
    return sanitizeWhatsappReply(extractOutputText(payload).trim().slice(0, 2000) || fallback);
  } catch (_) {
    return fallback;
  }
}

async function persistContext(supabase: any, current: any, phone: string, patch: any) {
  const payload = { ...current, phone, ...patch, updated_at: new Date().toISOString() };
  delete payload.id;
  delete payload.created_at;
  const { data, error } = await supabase.from("black_ai_case_state").upsert(payload, { onConflict: "phone" }).select("*").single();
  if (error) throw error;
  return data;
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Método no permitido", build_id: BUILD_ID }, 405);
  try {
    const expected = Deno.env.get("BLACK_AI_WEBHOOK_SECRET") || "";
    const url = new URL(req.url);
    const supplied = req.headers.get("x-black-ai-webhook-secret") || url.searchParams.get("token") || "";
    if (!expected) return json({ error: "BLACK_AI_WEBHOOK_SECRET no configurado", build_id: BUILD_ID }, 500);
    if (supplied !== expected) return json({ error: "No autorizado", build_id: BUILD_ID }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = getServiceKey();
    if (!supabaseUrl || !serviceKey) return json({ error: "Configuración de Supabase incompleta", build_id: BUILD_ID }, 500);
    const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const style = await getAssistantConfig(supabase);

    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone || "").replace(/\D/g, "");
    const message = String(body?.message || "").trim();
    if (!phone) return json({ error: "Falta phone", build_id: BUILD_ID }, 400);

    const { data: existing, error: readError } = await supabase.from("black_ai_case_state").select("*").eq("phone", phone).maybeSingle();
    if (readError) throw readError;
    let current = existing || { phone, stage: "discovery", prescription: {}, prescription_status: "none", preferences: {}, technical_result: {}, candidate_products: [], next_best_question_context: {} };

    // Un saludo tras varias horas inicia un caso conversacional nuevo y evita arrastrar receta/estado viejos.
    if (detectDirectIntent(message) === "greeting" && staleConversation(current.last_patient_message_at, 8)) {
      current = resetCaseContext({ ...current });
    }

    const extraction = await inferFactsWithAI(message, current);
    const inferred = extraction.facts || {};
    const intent = String(inferred.intent || detectDirectIntent(message) || "other");
    const inferredOpticalCase = inferred.optical_case ?? current.optical_case ?? null;
    const pendingPrescription = current.prescription_status === "awaiting_confirmation" || current.prescription_status === "needs_review";
    let justConfirmed = false;

    if (explicitlyDeniesPrescription(message)) {
      const upserted = await persistContext(supabase, current, phone, {
        prescription: {}, prescription_status: "none", prescription_confirmed_at: null, prescription_source_message_id: null, prescription_analysis: {}, prescription_updated_at: null,
        technical_result: {}, candidate_products: [], missing_data: [], technical_family_key: null, requires_human_review: false, stage: "discovery", last_patient_message_at: new Date().toISOString(),
        next_best_question_key: null, next_best_question_context: { build_id: BUILD_ID, last_message: message.slice(0, 500), route: "prescription_state_reset", reason: "patient_denied_having_sent_prescription" },
      });
      return json({ ok: true, build_id: BUILD_ID, state: upserted, reply: "Perfecto, gracias por aclararlo. Dejamos de lado la receta. ¿Qué querés consultar?", route: "prescription_state_reset" });
    }

    const knowledgeProbe = await getKnowledgeSnapshot(supabase, message, intent, { optical_case: inferredOpticalCase, treatment: treatmentContext(inferred.preferences) });
    const strongKnowledgeMatch = knowledgeProbe.some((x: any) => Number(x.overlap || 0) >= 1 || structuredKnowledgeBonus(x.data, { intent, optical_case: inferredOpticalCase }) >= 30);
    const directGeneral = ["greeting", "hours_location", "sunglasses", "frames", "contact_lenses", "payment_methods", "appointment", "support", "promotion", "general_product", "technical_question", "clinical_symptom"].includes(intent)
      || (intent === "other" && strongKnowledgeMatch && inferredOpticalCase == null);

    if (current.prescription_status === "awaiting_confirmation" && isAffirmative(message) && !directGeneral) {
      justConfirmed = true;
      current.prescription_status = "confirmed";
      current.prescription_confirmed_at = new Date().toISOString();
      current.stage = "needs";
      current.requires_human_review = false;
    } else if (current.prescription_status === "awaiting_confirmation" && isNegative(message) && !directGeneral) {
      const upserted = await persistContext(supabase, current, phone, {
        prescription_status: "needs_review", stage: "prescription", requires_human_review: true, last_patient_message_at: new Date().toISOString(),
        next_best_question_key: "correct_prescription", next_best_question_context: { ...(current.next_best_question_context || {}), build_id: BUILD_ID, last_message: message.slice(0, 500), reason: "patient_rejected_transcription" },
      });
      return json({ ok: true, build_id: BUILD_ID, state: upserted, reply: "Gracias por avisarme. Mandame otra foto de la receta más de frente y nítida y la vuelvo a leer.", route: "prescription_correction" });
    }

    if (directGeneral) {
      const routedIntent = intent === "other" && strongKnowledgeMatch ? "general_product" : intent;
      const fallback = generalFallback(routedIntent);
      const reply = await answerGeneralQuery({ message, intent: routedIntent, knowledge: knowledgeProbe, fallback, pendingPrescription: pendingPrescription && !justConfirmed, style });
      const upserted = await persistContext(supabase, current, phone, {
        prescription_status: current.prescription_status || "none",
        prescription_confirmed_at: current.prescription_confirmed_at || null,
        preferences: mergeCommercialPreferences(current.preferences, inferred.preferences),
        last_patient_message_at: new Date().toISOString(),
        next_best_question_context: { ...(current.next_best_question_context || {}), build_id: BUILD_ID, last_message: message.slice(0, 500), last_intent: routedIntent, knowledge_ids: knowledgeProbe.map((x: any) => x.id), knowledge_match: strongKnowledgeMatch, route: "general_query" },
      });
      return json({ ok: true, build_id: BUILD_ID, state: upserted, reply, intent: routedIntent, route: "general_query", knowledge_used: knowledgeProbe.map((x: any) => ({ id: x.id, title: x.title, category: x.category, score: x.score, data: x.data })) });
    }

    if (current.prescription_status === "awaiting_confirmation" && !justConfirmed) {
      return json({ ok: true, build_id: BUILD_ID, state: current, reply: "Antes de avanzar con la cotización, necesito que me confirmes si los valores que te leí de la receta están correctos.", route: "prescription_confirmation_gate" });
    }
    if (current.prescription_status === "needs_review") {
      return json({ ok: true, build_id: BUILD_ID, state: current, reply: "La receta quedó pendiente de revisión porque hay datos que no se pudieron confirmar. Mandame una foto nueva, completa y nítida, y la vuelvo a leer.", route: "prescription_review_gate" });
    }

    const priceRequest = String(inferred.price_request || "none");
    const prescription = body?.prescription && typeof body.prescription === "object" ? { ...(current.prescription || {}), ...body.prescription } : current.prescription || {};
    const opticalCaseChanged = Boolean(inferred.optical_case && current.optical_case && inferred.optical_case !== current.optical_case);
    const mergedPreferences = mergeCommercialPreferences(current.preferences, inferred.preferences, body?.preferences);
    const explicitDesign = detectDesignMention(message);
    const selectedDesign = explicitDesign || String(current?.next_best_question_context?.selected_design || "").trim().toUpperCase() || null;
    const featureQuestion = isFeatureAvailabilityQuestion(message);
    const upgradeQuestion = isUpgradeQuestion(message);

    const state: any = {
      phone,
      objective: body?.objective ?? inferred.objective ?? current.objective ?? null,
      stage: body?.stage ?? current.stage ?? "discovery",
      prescription,
      prescription_status: current.prescription_status || "none",
      prescription_confirmed_at: current.prescription_confirmed_at || null,
      prescription_source_message_id: current.prescription_source_message_id || null,
      prescription_analysis: current.prescription_analysis || {},
      prescription_updated_at: current.prescription_updated_at || null,
      conversation_started_at: current.conversation_started_at || new Date().toISOString(),
      last_patient_message_at: new Date().toISOString(),
      optical_case: body?.optical_case ?? inferred.optical_case ?? current.optical_case ?? null,
      technical_family_key: body?.technical_family_key ?? (opticalCaseChanged ? null : current.technical_family_key ?? null),
      main_use: body?.main_use ?? inferred.main_use ?? (opticalCaseChanged ? null : current.main_use ?? null),
      previous_lens_type: body?.previous_lens_type ?? inferred.previous_lens_type ?? (opticalCaseChanged ? null : current.previous_lens_type ?? null),
      budget_context: body?.budget_context ?? inferred.budget_context ?? current.budget_context ?? null,
      urgency: body?.urgency ?? inferred.urgency ?? current.urgency ?? null,
      preferences: mergedPreferences,
      technical_result: opticalCaseChanged ? {} : (current.technical_result || {}),
      candidate_products: opticalCaseChanged ? [] : (current.candidate_products || []),
      missing_data: opticalCaseChanged ? [] : (current.missing_data || []),
      requires_human_review: opticalCaseChanged ? false : Boolean(current.requires_human_review),
      last_inbox_id: body?.inbox_id ?? current.last_inbox_id ?? null,
      updated_at: new Date().toISOString(),
    };

    if (state.prescription_status === "confirmed" && state.technical_family_key && state.optical_case && state.prescription?.od && state.prescription?.oi) {
      const od = state.prescription.od || {};
      const oi = state.prescription.oi || {};
      const addition = state.prescription.addition ?? od.addition ?? oi.addition ?? null;
      const { data: evaluation, error: evaluationError } = await supabase.rpc("black_ai_evaluate_prescription_case", {
        p_family_key: state.technical_family_key, p_optical_case: state.optical_case,
        p_sphere_od: od.sphere ?? null, p_cylinder_od: od.cylinder ?? null, p_axis_od: od.axis ?? null,
        p_sphere_oi: oi.sphere ?? null, p_cylinder_oi: oi.cylinder ?? null, p_axis_oi: oi.axis ?? null, p_addition: addition,
      });
      if (evaluationError) throw evaluationError;
      if (evaluation) {
        state.technical_result = evaluation;
        state.missing_data = Array.isArray(evaluation?.missing_data) ? evaluation.missing_data : [];
        state.requires_human_review = Boolean(evaluation?.requires_human_review);
        if (evaluation?.status === "resolved") state.stage = "technical";
      }
    }

    let nextKey: string | null = null;
    if (["appointment", "support", "product_info"].includes(state.objective)) {
      nextKey = state.objective === "appointment" ? "appointment_details" : state.objective === "support" ? "support_details" : "product_details";
    } else {
      const prescriptionForDecision = state.prescription_status === "confirmed" ? state.prescription : {};
      const { data, error } = await supabase.rpc("black_ai_next_question_key", {
        p_objective: state.objective,
        p_prescription: prescriptionForDecision,
        p_optical_case: state.optical_case,
        p_main_use: state.main_use,
        p_previous_lens_type: state.previous_lens_type,
        p_technical_family_key: state.technical_family_key,
        p_technical_result: state.technical_result,
      });
      if (error) throw error;
      nextKey = data;
    }

    const knowledge = await getKnowledgeSnapshot(supabase, message, intent === "other" ? "prescription_lens_quote" : intent, {
      optical_case: state.optical_case,
      supply_mode: state.technical_result?.supply_mode || null,
      treatment: treatmentContext(state.preferences),
    });

    const hasConfiguredPreference = Boolean(
      treatmentContext(state.preferences)
      || state.preferences?.brand
      || state.preferences?.material
      || state.preferences?.high_index
    );
    const configuredProductPrice = priceRequest === "exact" && Boolean(selectedDesign) && hasConfiguredPreference;
    const allowPatientSpecificPrice = priceRequest === "exact" && state.prescription_status === "confirmed" && !["request_prescription", "complete_prescription", "request_axis_od", "request_axis_oi", "request_addition", "clarify_optical_case", "ask_main_use", "ask_previous_lens_experience", "choose_technical_family", "run_technical_evaluation"].includes(String(nextKey));
    const allowPrice = priceRequest === "general" || configuredProductPrice || allowPatientSpecificPrice;
    const needCatalogContext = allowPrice || featureQuestion || upgradeQuestion || Boolean(selectedDesign);
    const commercial = needCatalogContext && state.optical_case
      ? await getCommercialSnapshot(supabase, state, knowledge, { selectedDesign, strictPreferences: configuredProductPrice || featureQuestion })
      : null;
    if (commercial?.examples) state.candidate_products = commercial.examples.map((x: any) => x.id);

    const fallback = questionForKey(nextKey, state.objective);
    const previousKey = current.next_best_question_key || null;
    const previousContext = current.next_best_question_context || {};
    const repeated = Boolean(previousKey && nextKey && previousKey === nextKey);
    const previousReply = String(previousContext.generated_reply || "");
    const repeatCount = repeated ? Number(previousContext.repeat_count || 0) + 1 : 0;

    const reply = await writeContextualReply({ message, intent, state, nextKey, fallback, commercial, priceRequest, repeated, previousReply, knowledge, justConfirmed, style });

    state.next_best_question_key = nextKey;
    state.next_best_question_context = {
      ...previousContext,
      build_id: BUILD_ID,
      suggested_question: fallback,
      generated_reply: reply,
      last_message: message.slice(0, 500),
      last_intent: intent,
      inferred_facts: inferred,
      extraction_mode: extraction.mode,
      price_request: priceRequest,
      commercial_snapshot: commercial,
      knowledge_ids: knowledge.map((x: any) => x.id),
      previous_question_key: previousKey,
      repeat_count: repeatCount,
      reply_mode: reply === fallback ? "fallback" : "openai_contextual",
      commercial_selection_mode: commercial?.selection_mode || null,
      selected_design: selectedDesign,
      feature_question: featureQuestion,
      upgrade_question: upgradeQuestion,
    };

    const { data: upserted, error: upsertError } = await supabase.from("black_ai_case_state").upsert(state, { onConflict: "phone" }).select("*").single();
    if (upsertError) throw upsertError;

    return json({
      ok: true,
      build_id: BUILD_ID,
      state: upserted,
      next_question_key: nextKey,
      suggested_question: fallback,
      reply,
      intent,
      inferred_facts: inferred,
      extraction_mode: extraction.mode,
      price_request: priceRequest,
      commercial_snapshot: commercial,
      knowledge_used: knowledge.map((x: any) => ({ id: x.id, title: x.title, category: x.category, score: x.score, data: x.data })),
      loop_guard: { repeated, repeat_count: repeatCount },
      route: "prescription_flow",
      reply_mode: reply === fallback ? "fallback" : "openai_contextual",
    });
  } catch (error) {
    console.error("black-ai-case-orchestrator", error);
    return json({ error: String((error as any)?.message || "Error interno"), build_id: BUILD_ID }, 500);
  }
});
