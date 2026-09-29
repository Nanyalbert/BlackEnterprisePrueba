import { asNumber, emptyPrescription, suggestAdd, validatePrescription } from "./parser.js";
import { normalizePair, nearFromAdd, validProduct, evaluateProduct, scoreProduct, explainOffer } from "./recommendations.js";

if (new URLSearchParams(location.search).has("embedded")) document.body.classList.add("embedded");
const supabaseClient = window.parent?.BlackPortal?.getSupabase?.() || window.BlackPortal?.getSupabase?.();
if (!supabaseClient) location.replace("../index.html");
else supabaseClient.auth.getSession().then(({ data }) => { if (!data.session) location.replace("../index.html"); });

const $ = id => document.getElementById(id);
const fileInputs = ["cameraInput", "fileInput", "cameraAgain", "fileAgain"].map($);
const fields = ["od-sphere", "od-cylinder", "od-axis", "oi-sphere", "oi-cylinder", "oi-axis", "add",
  "near-od-sphere", "near-od-cylinder", "near-od-axis", "near-oi-sphere", "near-oi-cylinder", "near-oi-axis"];
const state = { rx: emptyPrescription(), near: emptyPrescription(), nearEnabled: false, type: null, busy: false, confirmed: false, previewUrl: null, aiSource: null, aiDraft: false, options: [], recommendations: [], offerStatus: "", evaluating: false, offerRun: 0 };
const sample = {
  od: { sphere: "-2.00", cylinder: "-0.75", axis: "180" },
  oi: { sphere: "-1.75", cylinder: "-0.50", axis: "175" },
  add: "+1.75",
};

function setStatus(message) {
  $("scanStatus").textContent = message;
  $("scanStatus").hidden = !message;
}

function setBusy(value) {
  state.busy = value;
  fileInputs.forEach(input => { input.disabled = value; });
  $("dropZone").classList.toggle("disabled", value);
  render();
}

function syncInputs() {
  for (const eye of ["od", "oi"]) {
    for (const field of ["sphere", "cylinder", "axis"]) {
      $(`${eye}-${field}`).value = state.rx[eye][field];
      $(`near-${eye}-${field}`).value = state.near[eye][field];
    }
  }
  $("add").value = state.rx.add;
  $("nearToggle").checked = state.nearEnabled;
  document.querySelectorAll('input[name="rxType"]').forEach(input => {
    input.checked = input.value === state.type;
  });
}

function readInputs() {
  for (const eye of ["od", "oi"]) {
    for (const field of ["sphere", "cylinder", "axis"]) {
      state.rx[eye][field] = $(`${eye}-${field}`).value.trim();
      state.near[eye][field] = $(`near-${eye}-${field}`).value.trim();
    }
  }
  state.rx.add = $("add").value.trim();
}

function render() {
  const issues = validatePrescription(state.rx, state.type);
  if (state.aiDraft && state.type && (!state.rx.od.cylinder || !state.rx.oi.cylinder)) {
    issues.push("La IA no pudo confirmar un cilindro. Revisalo y escribí 0 si la receta indica que no hay cilindro.");
  }
  const hasNear = state.type === "both" && state.nearEnabled;
  const suggestedAdd = hasNear ? suggestAdd(state.rx, state.near) : null;
  if (hasNear) {
    if (state.aiDraft && (!state.near.od.cylinder || !state.near.oi.cylinder)) {
      issues.push("Revisá los cilindros de cerca; la IA dejó un valor sin confirmar.");
    }
    issues.push(...validatePrescription(state.near, "near").map(issue => `Cerca ${issue}`));
    if (!suggestedAdd && !validatePrescription(state.near, "near").length) {
      issues.push("Lejos y cerca no coinciden en cilindro/eje o ADD entre ojos. Revisá la receta antes de ofrecer un multifocal.");
    }
    if (suggestedAdd && state.rx.add && Math.abs(asNumber(state.rx.add) - asNumber(suggestedAdd)) > .01) {
      issues.push("La ADD no coincide con la diferencia entre cerca y lejos.");
    }
  }
  document.querySelectorAll(".usage-choices label").forEach(label => {
    label.classList.toggle("selected", label.querySelector("input").checked);
  });
  $("addRow").hidden = state.type !== "both";
  $("nearToggleRow").hidden = state.type !== "both";
  $("nearSection").hidden = !hasNear;
  $("addSuggestion").hidden = !suggestedAdd;
  $("useAddButton").hidden = !suggestedAdd;
  if (suggestedAdd) $("addSuggestion").textContent = `ADD calculada a partir de las esferas: ${suggestedAdd}. Confirmala con la receta.`;
  const typeNote = state.type === "near"
    ? "OD y OI son valores para cerca. La app no suma una ADD."
    : state.type === "distance" ? "OD y OI son valores para lejos." : "";
  $("typeNote").textContent = typeNote;
  $("typeNote").hidden = !typeNote;
  $("confirmButton").disabled = state.busy || issues.length > 0;
  const hasAnyValue = Boolean(state.rx.od.sphere || state.rx.oi.sphere);
  $("issues").hidden = !hasAnyValue || issues.length === 0;
  $("issues").replaceChildren(...issues.map(issue => {
    const li = document.createElement("li");
    li.textContent = issue;
    return li;
  }));
  $("sourceActions").hidden = !state.previewUrl;
  $("aiPanel").hidden = !state.previewUrl;
  $("aiButton").disabled = state.busy;
  $("uploadEmpty").hidden = Boolean(state.previewUrl);
  $("preview").hidden = !state.previewUrl;
  $("sellerQuestions").hidden = !state.confirmed;
  $("formatQuestion").hidden = state.type !== "both";
  $("evaluateButton").disabled = state.evaluating || !$("mainUse").value || !$("mainPriority").value || (state.type === "both" && !$("glassesFormat").value);
  $("evaluateButton").textContent = state.evaluating ? "Buscando en el catálogo…" : "Buscar artículos compatibles";
  if (!state.evaluating) $("evaluateButton").insertAdjacentHTML("beforeend", ' <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6"/></svg>');
  $("copyButton").hidden = !state.recommendations.length;
  $("resultContext").hidden = !state.confirmed;
  $("offerStatus").hidden = !state.offerStatus;
  $("offerStatus").textContent = state.offerStatus;
  $("optionGrid").hidden = !state.recommendations.length;
  $("resultFoot").hidden = !state.recommendations.length;
  $("emptyResults").hidden = state.confirmed;
  if (state.confirmed) {
    const typeLabel = state.type === "near" ? "solo cerca" : state.type === "both" ? "lejos y cerca" : "solo lejos";
    $("resultContext").textContent = `Receta: ${typeLabel}`;
    $("optionGrid").replaceChildren(...state.recommendations.map((option, index) => {
      const article = document.createElement("article");
      article.className = "option";
      article.innerHTML = `<div class="option-top"><span>${String(index + 1).padStart(2, "0")}</span><span class="tier"></span></div><h3></h3><strong></strong><p></p><div class="product-meta"></div><a class="catalog-link" target="_top">Encontrar en catálogo ↗</a>`;
      article.querySelector(".tier").textContent = index ? "Alternativa compatible" : "Ofrecé primero";
      article.querySelector("h3").textContent = option.name;
      article.querySelector("strong").textContent = option.benefit;
      article.querySelector("p").textContent = option.reason;
      article.querySelector(".catalog-link").href = `../black-ai.html?catalogo=${encodeURIComponent(option.search || option.sku || option.name)}`;
      for (const detail of [option.sku ? `Código: ${option.sku}` : "Buscar por nombre", option.material, option.supplier, option.mode]) {
        if (!detail) continue;
        const span = document.createElement("span"); span.textContent = detail; article.querySelector(".product-meta").append(span);
      }
      return article;
    }));
  }
}

function invalidate() {
  state.offerRun++;
  state.evaluating = false;
  state.confirmed = false;
  state.options = [];
  state.recommendations = [];
  state.offerStatus = "";
  render();
}

async function readPdf(file) {
  const pdfjs = await import("https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.mjs");
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdn.jsdelivr.net/npm/pdfjs-dist@6.3.289/build/pdf.worker.mjs";
  const loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const pdf = await loading.promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1 });
    const scale = Math.min(2, 2200 / Math.max(viewport.width, viewport.height));
    const canvas = document.createElement("canvas");
    const scaled = page.getViewport({ scale });
    canvas.width = Math.round(scaled.width);
    canvas.height = Math.round(scaled.height);
    await page.render({ canvas, canvasContext: canvas.getContext("2d"), viewport: scaled }).promise;
    return { preview: canvas.toDataURL("image/png"), pages: pdf.numPages };
  } finally {
    await loading.destroy();
  }
}

function showPreview(url) {
  if (state.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = url;
  $("preview").src = url;
  render();
}

async function handleFile(file) {
  if (!file || state.busy) return;
  if (file.size > 15 * 1024 * 1024) {
    setStatus("El archivo supera 15 MB. Reducí su tamaño y probá otra vez.");
    return;
  }
  const pdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
  const image = /^(image\/(jpeg|png|webp|bmp))$/.test(file.type) || /\.(jpe?g|png|webp|bmp)$/i.test(file.name);
  if (!pdf && !image) {
    setStatus("Elegí una imagen JPG, PNG o WEBP, o un PDF.");
    return;
  }
  setBusy(true);
  if (state.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = null;
  state.aiSource = null;
  state.aiDraft = false;
  $("preview").removeAttribute("src");
  state.confirmed = false;
  state.type = null;
  state.rx = emptyPrescription();
  state.near = emptyPrescription();
  state.nearEnabled = false;
  syncInputs();
  setStatus("Preparando el archivo…");
  try {
    let pages = 1;
    if (pdf) {
      const pdfResult = await readPdf(file);
      showPreview(pdfResult.preview);
      state.aiSource = pdfResult.preview;
      pages = pdfResult.pages;
    } else {
      showPreview(URL.createObjectURL(file));
      state.aiSource = file;
    }
    setStatus("Receta cargada. Tocá «Interpretar receta» para leerla con Black AI, o completá los valores a mano." + (pages > 1 ? " Se usará solo la primera página del PDF." : ""));
  } catch (error) {
    console.error("Lectura de receta:", error);
    setStatus("No se pudo abrir este archivo. Elegí otra imagen o un PDF válido.");
  } finally {
    setBusy(false);
  }
}

async function imageForAI() {
  const image = new Image();
  image.src = state.previewUrl;
  await image.decode();
  const scale = Math.min(1, 2400 / Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.naturalWidth * scale);
  canvas.height = Math.round(image.naturalHeight * scale);
  canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", .88);
}

async function interpretWithAI() {
  if (!supabaseClient || !state.aiSource || state.busy) return;
  setBusy(true);
  setStatus("Interpretando la receta con IA…");
  try {
    const image = await imageForAI();
    const { data, error } = await supabaseClient.functions.invoke("black-recetas-analyze", { body: { image_data_url: image } });
    if (error || !data?.ok) throw new Error(data?.error || error?.message || "No se pudo interpretar la receta");
    const result = data.prescription;
    const nearHasData = Boolean(result.near?.od?.sphere || result.near?.oi?.sphere);
    state.type = result.type === "unknown" ? null : result.type;
    state.rx = result.type === "near" ? { ...result.near, add: "" } : { ...result.far, add: result.add || "" };
    state.near = nearHasData && result.type === "both" ? { ...result.near, add: "" } : emptyPrescription();
    state.nearEnabled = nearHasData && result.type === "both";
    state.aiDraft = true;
    syncInputs();
    invalidate();
    const warnings = result.uncertain?.length ? ` Revisá especialmente: ${result.uncertain.join(", ")}.` : "";
    setStatus(`Lectura con IA cargada como borrador. Confirmá cada signo, cilindro y eje con la foto.${warnings}`);
  } catch (error) {
    setStatus(error.message || "No se pudo interpretar con IA. Podés completar la receta manualmente.");
  } finally {
    setBusy(false);
  }
}

async function findOffers() {
  if (!state.confirmed || state.evaluating || !$("mainUse").value || !$("mainPriority").value ||
      (state.type === "both" && !$("glassesFormat").value)) return;
  const run = ++state.offerRun;
  const answers = { use: $("mainUse").value, priority: $("mainPriority").value, format: $("glassesFormat").value };
  state.evaluating = true;
  state.recommendations = [];
  state.offerStatus = "Consultando las fichas técnicas de Black AI…";
  render();
  try {
    const { data, error } = await supabaseClient.from("black_ai_products").select("*").eq("is_active", true).limit(1000);
    if (error) throw new Error(error.message);
    if (run !== state.offerRun) return;
    const dateParts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()).map(part => [part.type, part.value]));
    const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
    const products = (data || []).filter(product => validProduct(product, today));
    if (!products.length) throw new Error("No hay artículos activos y vigentes en el catálogo de Black AI.");
    const matrixCache = new Map();
    const compatible = async (opticalCase, rx, kind, add = null) => {
      const pair = normalizePair(rx);
      if (!pair) return [];
      const rows = products.filter(p => p.optical_case === opticalCase);
      const results = await Promise.all(rows.map(async product => {
        let matrix = null;
        if (product.technical_family_key) {
          const key = JSON.stringify([product.technical_family_key, pair.od.sphere, pair.od.cylinder, pair.oi.sphere, pair.oi.cylinder]);
          if (!matrixCache.has(key)) matrixCache.set(key, supabaseClient.rpc("black_ai_resolve_pair_supply_mode", {
            p_family_key: product.technical_family_key,
            p_sphere_od: pair.od.sphere, p_cylinder_od: pair.od.cylinder,
            p_sphere_oi: pair.oi.sphere, p_cylinder_oi: pair.oi.cylinder,
          }).then(result => result.error ? null : result.data).catch(() => null));
          matrix = await matrixCache.get(key);
        }
        const evaluation = evaluateProduct(product, pair, add, matrix);
        if (evaluation.status !== "compatible") return null;
        return { product, evaluation, kind, transposed: pair.transposed, score: scoreProduct(product, answers),
          name: product.name, sku: product.sku, supplier: product.supplier, material: product.material,
          mode: evaluation.mode === "range_extended" ? "Rango extendido" : evaluation.mode === "stock" ? "Stock técnico" : "Confirmar fabricación",
          benefit: kind === "both" ? "Un anteojo para lejos y cerca" : `Monofocal para ${kind === "near" ? "cerca" : "lejos"}`,
          reason: explainOffer(product, answers, evaluation, kind) };
      }));
      return results.filter(Boolean).sort((a, b) => a.score - b.score || Number(a.product.base_price || Infinity) - Number(b.product.base_price || Infinity));
    };
    let offers = [];
    if (state.type === "both") {
      if (answers.format !== "two") {
        const groups = await Promise.all([compatible("multifocal", state.rx, "both", state.rx.add), compatible("bifocal", state.rx, "both", state.rx.add)]);
        offers.push(...groups.flat());
      }
      if (answers.format !== "one") {
        const nearRx = state.nearEnabled ? state.near : nearFromAdd(state.rx, state.rx.add);
        const [far, near] = await Promise.all([compatible("monofocal", state.rx, "far"), compatible("monofocal", nearRx, "near")]);
        if (far[0] && near[0]) offers.push({
          name: "Dos monofocales", benefit: `${far[0].name} (lejos) + ${near[0].name} (cerca)`,
          reason: `Ambos artículos cumplen los rangos cargados para sus respectivos usos. Permiten separar el anteojo de lejos del de cerca. Confirmá las dos fichas antes de cotizar.`,
          sku: [far[0].sku, near[0].sku].filter(Boolean).join(" + "), material: "Dos artículos", mode: "Confirmar ambos", score: Math.min(far[0].score, near[0].score) + (answers.format === "two" ? -100 : 15),
          transposed: far[0].transposed || near[0].transposed, search: far[0].sku || far[0].name,
        });
      }
    } else {
      offers = await compatible("monofocal", state.rx, state.type === "near" ? "near" : "far");
    }
    if (run !== state.offerRun) return;
    offers.sort((a, b) => a.score - b.score);
    state.recommendations = offers.slice(0, 3);
    state.options = state.recommendations.map(item => ({ name: item.name, benefit: item.benefit }));
    const transposed = state.recommendations.some(item => item.transposed);
    state.offerStatus = offers.length
      ? `${offers.length} propuesta${offers.length === 1 ? "" : "s"} técnicamente compatible${offers.length === 1 ? "" : "s"}. ${transposed ? "Se convirtió el cilindro positivo para cotejar la matriz en cilindro negativo; revisá la equivalencia antes de cotizar. " : ""}Verificá stock, diámetro y precio vigente en el sistema.`
      : "No hay un artículo verificablemente compatible con las fichas actuales. Consultá al laboratorio o completá los rangos técnicos; no ofrezcas un producto por suposición.";
  } catch (error) {
    if (run === state.offerRun) state.offerStatus = `No se pudo consultar el catálogo: ${error.message || "error de conexión"}. No se puede indicar un artículo hasta verificarlo.`;
  } finally {
    if (run === state.offerRun) { state.evaluating = false; render(); }
  }
}

function signed(value) {
  const n = asNumber(value);
  return n === null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(2)}`;
}

async function copySummary() {
  const type = state.type === "near" ? "Solo cerca" : state.type === "both" ? "Lejos y cerca" : "Solo lejos";
  const lines = ["Categorías a evaluar en Black Óptica", `Receta: ${type}`];
  for (const key of ["od", "oi"]) {
    const eye = state.rx[key];
    lines.push(`${key.toUpperCase()}: ESF ${signed(eye.sphere)} / CIL ${signed(eye.cylinder || "0")} / EJE ${eye.axis || "—"}°`);
  }
  if (state.type === "both") lines.push(`ADD: ${signed(state.rx.add)}`);
  if (state.type === "both" && state.nearEnabled) {
    for (const key of ["od", "oi"]) {
      const eye = state.near[key];
      lines.push(`Cerca ${key.toUpperCase()}: ESF ${signed(eye.sphere)} / CIL ${signed(eye.cylinder || "0")} / EJE ${eye.axis || "—"}°`);
    }
  }
  lines.push("", ...state.options.map(option => `• ${option.name}: ${option.benefit}.`), "", "Categorías orientativas; no representan artículos compatibles ni una cotización. Verificar rangos, medidas, stock y laboratorio.");
  try {
    await navigator.clipboard.writeText(lines.join("\n"));
    $("copyButton").textContent = "Copiado";
    setTimeout(() => { $("copyButton").textContent = "Copiar resumen"; }, 2200);
  } catch {
    setStatus("No se pudo copiar desde este navegador.");
  }
}

for (const input of fileInputs) {
  input.addEventListener("change", event => {
    void handleFile(event.target.files?.[0]);
    event.target.value = "";
  });
}
$("dropZone").addEventListener("dragover", event => { event.preventDefault(); $("dropZone").classList.add("dragging"); });
$("dropZone").addEventListener("dragleave", () => $("dropZone").classList.remove("dragging"));
$("dropZone").addEventListener("drop", event => {
  event.preventDefault();
  $("dropZone").classList.remove("dragging");
  void handleFile(event.dataTransfer.files?.[0]);
});
for (const id of fields) {
  $(id).addEventListener("input", () => { readInputs(); invalidate(); });
}
$("nearToggle").addEventListener("change", event => {
  state.nearEnabled = event.target.checked;
  invalidate();
});
$("useAddButton").addEventListener("click", () => {
  const add = suggestAdd(state.rx, state.near);
  if (!add) return;
  state.rx.add = add;
  $("add").value = add;
  invalidate();
});
$("zoomButton").addEventListener("click", () => {
  $("dialogImage").src = state.previewUrl;
  $("imageDialog").showModal();
});
$("closeDialog").addEventListener("click", () => $("imageDialog").close());
$("aiButton").addEventListener("click", interpretWithAI);
document.querySelectorAll('input[name="rxType"]').forEach(input => input.addEventListener("change", () => {
  state.type = input.value;
  invalidate();
}));
$("confirmButton").addEventListener("click", () => {
  readInputs();
  if (validatePrescription(state.rx, state.type).length) return;
  state.offerRun++;
  state.recommendations = [];
  state.options = [];
  state.offerStatus = "Respondé las preguntas para ver qué artículo ofrecer y por qué.";
  state.confirmed = true;
  render();
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
});
for (const id of ["mainUse", "mainPriority", "glassesFormat"]) $(id).addEventListener("change", () => {
  state.offerRun++;
  state.evaluating = false;
  state.recommendations = [];
  state.options = [];
  state.offerStatus = state.confirmed ? "Actualizaste las respuestas. Volvé a buscar artículos compatibles." : "";
  render();
});
$("evaluateButton").addEventListener("click", findOffers);
$("copyButton").addEventListener("click", copySummary);
$("manualButton").addEventListener("click", () => $("od-sphere").focus());
$("exampleButton").addEventListener("click", () => {
  state.rx = structuredClone(sample);
  state.near = emptyPrescription();
  state.nearEnabled = false;
  state.aiDraft = false;
  state.type = "both";
  syncInputs();
  invalidate();
  setStatus("Ejemplo cargado. Podés reemplazar los valores.");
});
$("clearButton").addEventListener("click", () => {
  if (state.previewUrl?.startsWith("blob:")) URL.revokeObjectURL(state.previewUrl);
  state.previewUrl = null;
  state.aiSource = null;
  state.aiDraft = false;
  $("preview").removeAttribute("src");
  state.rx = emptyPrescription();
  state.near = emptyPrescription();
  state.nearEnabled = false;
  state.type = null;
  syncInputs();
  invalidate();
  setStatus("");
});
render();
