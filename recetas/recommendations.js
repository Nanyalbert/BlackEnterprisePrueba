import { asNumber } from "./parser.js";

const CASES = new Set(["monofocal", "multifocal", "bifocal"]);
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
  return `${format}Ambos ojos cumplen los rangos cargados para este diseño; responde al uso de ${use}. ${mode}${approved ? ` ${approved}` : ""}`;
}
