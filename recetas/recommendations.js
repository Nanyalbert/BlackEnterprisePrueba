import { asNumber } from "./parser.js";

const CASES = new Set(["monofocal", "multifocal", "bifocal", "occupational"]);
const isQuarter = value => Math.abs(value * 4 - Math.round(value * 4)) < 1e-8;

export function normalizeEye(eye) {
  const sphere = asNumber(eye?.sphere), cylinder = asNumber(eye?.cylinder), axis = eye?.axis === "" ? null : asNumber(eye?.axis);
  if (sphere === null || cylinder === null || (cylinder !== 0 && (axis === null || axis < 1 || axis > 180))) return null;
  if (cylinder > 0) return { sphere: sphere + cylinder, cylinder: -cylinder, axis: ((axis + 89) % 180) + 1, transposed: true };
  return { sphere, cylinder, axis, transposed: false };
}

export function normalizePair(rx) {
  const od = normalizeEye(rx?.od), oi = normalizeEye(rx?.oi);
  return od && oi ? { od, oi, transposed: od.transposed || oi.transposed } : null;
}

export function nearFromAdd(far, add) {
  const addition = asNumber(add);
  if (addition === null || addition <= 0) return null;
  return {
    od: { ...far.od, sphere: String(asNumber(far.od.sphere) + addition) },
    oi: { ...far.oi, sphere: String(asNumber(far.oi.sphere) + addition) },
  };
}

export function validProduct(product, today = new Date().toISOString().slice(0, 10)) {
  return product?.is_active && CASES.has(product.optical_case) &&
    (!product.valid_from || product.valid_from <= today) && (!product.valid_until || product.valid_until >= today);
}

export function evaluateProduct(product, pair, add, matrixResult = null) {
  if (!pair) return { status: "review", reason: "Faltan valores confirmados en uno de los ojos." };
  const needsAdd = product.optical_case === "multifocal" || product.optical_case === "bifocal" || product.requires_addition;
  const addition = asNumber(add);
  if (needsAdd && (addition === null || product.addition_min == null || product.addition_max == null))
    return { status: "review", reason: "Falta la ADD o su rango técnico en la ficha." };
  if (needsAdd && (addition < Number(product.addition_min) || addition > Number(product.addition_max)))
    return { status: "out", reason: "La ADD está fuera del rango configurado." };
  if (product.technical_family_key) {
    if (![pair.od.sphere, pair.od.cylinder, pair.oi.sphere, pair.oi.cylinder].every(isQuarter))
      return { status: "review", reason: "La matriz exige pasos de 0,25 D; consultar al laboratorio." };
    if (!matrixResult || matrixResult.status !== "resolved")
      return { status: "review", reason: "No se pudo comprobar la matriz técnica." };
    if (matrixResult.final_supply_mode === "laboratory")
      return { status: "review", reason: "La combinación requiere confirmación del laboratorio." };
    if (!["stock", "range_extended"].includes(matrixResult.final_supply_mode))
      return { status: "review", reason: "Modalidad técnica sin confirmar." };
    if (product.supply_mode === "stock" && matrixResult.final_supply_mode !== "stock")
      return { status: "review", reason: "La ficha indica solo stock y la receta requiere rango extendido." };
    return { status: "compatible", mode: matrixResult.final_supply_mode, reason: "Ambos ojos figuran en la matriz técnica." };
  }
  if (product.sphere_min == null || product.sphere_max == null ||
      (product.cylinder_abs_max == null && (product.cylinder_min == null || product.cylinder_max == null)))
    return { status: "review", reason: "La ficha no tiene rangos completos de esfera y cilindro." };
  const fits = eye => eye.sphere >= Number(product.sphere_min) && eye.sphere <= Number(product.sphere_max) &&
    (product.cylinder_abs_max != null
      ? Math.abs(eye.cylinder) <= Number(product.cylinder_abs_max)
      : eye.cylinder >= Number(product.cylinder_min) && eye.cylinder <= Number(product.cylinder_max));
  if (!fits(pair.od) || !fits(pair.oi)) return { status: "out", reason: "Un ojo queda fuera de los rangos cargados." };
  return { status: "compatible", mode: product.supply_mode || "laboratory", reason: "Ambos ojos están dentro de los rangos cargados." };
}

const labels = ["Premium", "Recomendado", "Acceso"];
const plain = value => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// El administrador puede fijar la familia comercial y el orden en metadata.scanner.
// Esas preferencias nunca reemplazan el filtro previo de compatibilidad técnica.
export function commercialFamily(offer, context) {
  const product = offer.product || {};
  const configured = plain(product.metadata?.scanner?.family);
  if (configured) return configured;
  const name = plain(`${product.name} ${product.design} ${product.treatment}`);
  if (offer.kind === "two") return "dos anteojos";
  if (context === "both") {
    if (product.optical_case === "bifocal") return "bifocal";
    if (/ailens|free|premium|personaliz/.test(name)) return "multifocal premium";
    if (/new|intermedi|digital/.test(name)) return "multifocal intermedio";
    return "multifocal base";
  }
  if (context === "near" && (product.optical_case === "occupational" || /ocupacional|occupational|office|intermedia/.test(name))) return "ocupacional";
  if (/black[\s_-]*blue|1[.,]67/.test(name)) return "black blue 1.67";
  if (/super[\s_-]*blue/.test(name)) return "super blue";
  if (/blue/.test(name) && /antirreflejo|antireflective|anti.?refle|\bar\b/.test(name)) return "blue ar";
  if (/antirreflejo|antireflective|anti.?refle|\bar\b/.test(name)) return "organico ar";
  return "organico blanco";
}

function commercialValue(offer, context, answers) {
  const product = offer.product || {};
  const rawRank = product.metadata?.scanner?.rank;
  const configured = Number(rawRank);
  if (rawRank !== null && rawRank !== undefined && rawRank !== "" && Number.isFinite(configured) && configured >= 0 && configured <= 100) return configured;
  const family = commercialFamily(offer, context);
  const values = context === "both"
    ? { "multifocal premium": 95, "multifocal intermedio": 75, "multifocal base": 55, bifocal: 35, "dos anteojos": 45 }
    : { "black blue 1.67": 95, "super blue": 75, "blue ar": 55, "organico ar": 30, "organico blanco": 10, ocupacional: answers.use === "screen" ? 88 : 25 };
  return values[family] ?? 40;
}

export function selectThreeOffers(offers, context, answers = {}) {
  const ranked = [...offers].sort((a, b) => commercialValue(b, context, answers) - commercialValue(a, context, answers) ||
    Number(a.product?.technical_priority ?? 100) - Number(b.product?.technical_priority ?? 100) ||
    String(a.sku || a.name).localeCompare(String(b.sku || b.name)));
  const chosen = [], families = new Set();
  for (const offer of ranked) {
    const family = commercialFamily(offer, context);
    if (families.has(family)) continue;
    chosen.push(offer); families.add(family);
    if (chosen.length === 3) break;
  }
  for (const offer of ranked) {
    if (chosen.length === 3) break;
    if (!chosen.includes(offer)) chosen.push(offer);
  }
  return {
    slots: labels.map((tier, index) => ({ tier, offer: chosen[index] || null })),
    alternatives: ranked.filter(offer => !chosen.includes(offer)),
  };
}

export function scoreProduct(product, answers) {
  const priority = Number.isFinite(Number(product.technical_priority)) ? Number(product.technical_priority) : 100;
  const price = Number(product.base_price);
  let score = priority;
  if (answers.priority === "budget" && price > 0) score += price / 100000;
  if (answers.priority === "comfort" && /premium|free|ailens|personaliz/i.test(`${product.design || ""} ${product.name || ""}`)) score -= 12;
  if (answers.use === "screen" && /ocupacional|office|intermedia/i.test(`${product.design || ""} ${product.name || ""}`)) score -= 5;
  return score;
}

export function explainOffer(product, answers, evaluation, kind) {
  const use = { driving: "visión de lejos", reading: "lectura", screen: "pantallas", mixed: "distintas distancias" }[answers.use] || "uso indicado";
  const format = kind === "both" ? "Cubre lejos y cerca en un anteojo. " : kind === "two" ? "Se propone como anteojo separado. " : "";
  const mode = evaluation.mode === "stock" ? "Figura en stock técnico." : evaluation.mode === "range_extended" ? "Figura en rango extendido." : "Requiere confirmar fabricación y disponibilidad.";
  const approved = typeof product.metadata?.sales_reason === "string" ? product.metadata.sales_reason.trim().slice(0, 180) : "";
  const features = plain(`${product.name} ${product.design} ${product.treatment} ${product.material}`);
  const details = [];
  if (product.optical_case === "occupational") details.push("Diseño para distancias próximas e intermedias; explicá que no reemplaza un anteojo de lejos.");
  if (/antirreflejo|antireflective|anti.?refle/.test(features)) details.push("Su tratamiento antirreflejo reduce reflejos de la superficie del cristal.");
  if (/1[.,]67/.test(features)) details.push("El índice 1.67 puede reducir espesor según la graduación y el armazón.");
  if (/blue/.test(features)) details.push("Incluye filtro de luz azul como característica del producto.");
  return `${format}Ambos ojos cumplen los rangos cargados para ${use}. ${details.join(" ")} ${mode}${approved ? ` ${approved}` : ""}`.replace(/\s+/g, " ").trim();
}
