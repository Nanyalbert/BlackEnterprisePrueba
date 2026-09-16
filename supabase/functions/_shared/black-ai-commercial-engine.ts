export type CommercialPreferences = {
  brand?: string | null;
  material?: string | null;
  treatment?: string | null;
  antireflective?: boolean | null;
  blue_filter?: boolean | null;
  photochromic?: boolean | null;
  high_index?: boolean | null;
  polarized?: boolean | null;
};

export type CatalogProduct = {
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

function normalizeText(value: unknown) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function bool(value: unknown) {
  return value === true ? true : value === false ? false : null;
}

function explicitString(value: unknown) {
  const s = String(value || "").trim();
  return s ? s.slice(0, 120) : null;
}

export function normalizeCommercialPreferences(value: any): CommercialPreferences {
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

export function mergeCommercialPreferences(...values: any[]): CommercialPreferences {
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

export function searchableProductText(row: CatalogProduct) {
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

export function productBrand(row: CatalogProduct) {
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

export function filterAndRankCatalogProducts(args: {
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

export function availableCatalogFeatures(products: CatalogProduct[]) {
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

  return {
    features: [...features],
    brands: [...brands].slice(0, 20),
    materials: [...materials].slice(0, 20),
  };
}

export function preferenceSummary(preferences: CommercialPreferences) {
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
