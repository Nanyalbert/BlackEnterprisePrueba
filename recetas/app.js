import { asNumber, emptyPrescription, suggestAdd, validatePrescription } from "./parser.js";

if (new URLSearchParams(location.search).has("embedded")) document.body.classList.add("embedded");
const supabaseClient = window.parent?.BlackPortal?.getSupabase?.() || window.BlackPortal?.getSupabase?.();
if (!supabaseClient) location.replace("../index.html");
else supabaseClient.auth.getSession().then(({ data }) => { if (!data.session) location.replace("../index.html"); });

const $ = id => document.getElementById(id);
const fileInputs = ["cameraInput", "fileInput", "cameraAgain", "fileAgain"].map($);
const fields = ["od-sphere", "od-cylinder", "od-axis", "oi-sphere", "oi-cylinder", "oi-axis", "add",
  "near-od-sphere", "near-od-cylinder", "near-od-axis", "near-oi-sphere", "near-oi-cylinder", "near-oi-axis"];
const state = { rx: emptyPrescription(), near: emptyPrescription(), nearEnabled: false, type: null, busy: false, confirmed: false, previewUrl: null, aiSource: null, aiDraft: false, options: [] };
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
  $("copyButton").hidden = !state.confirmed;
  $("resultContext").hidden = !state.confirmed;
  $("optionGrid").hidden = !state.confirmed;
  $("resultFoot").hidden = !state.confirmed;
  $("emptyResults").hidden = state.confirmed;
  if (state.confirmed) {
    const typeLabel = state.type === "near" ? "solo cerca" : state.type === "both" ? "lejos y cerca" : "solo lejos";
    $("resultContext").textContent = `Receta: ${typeLabel}`;
    $("optionGrid").replaceChildren(...state.options.map((option, index) => {
      const article = document.createElement("article");
      article.className = "option";
      article.innerHTML = `<div class="option-top"><span>${String(index + 1).padStart(2, "0")}</span><span class="tier"></span></div><h3></h3><strong></strong><p></p>`;
      article.querySelector(".tier").textContent = option.tier;
      article.querySelector("h3").textContent = option.name;
      article.querySelector("strong").textContent = option.benefit;
      article.querySelector("p").textContent = option.reason;
      return article;
    }));
  }
}

function invalidate() {
  state.confirmed = false;
  state.options = [];
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

function optionsFor(_rx, type) {
  if (type === "both") return [
    { name: "Multifocal", tier: "Diseño a evaluar", benefit: "Un anteojo para varias distancias", reason: "La elección depende de las tareas, la adaptación y los rangos del producto." },
    { name: "Bifocal", tier: "Diseño a evaluar", benefit: "Zonas de lejos y cerca", reason: "Comparar preferencia del paciente y disponibilidad antes de cotizar." },
    { name: "Dos monofocales", tier: "Alternativa", benefit: "Un anteojo para lejos y otro para cerca", reason: "Evaluar si prefiere separar usos y cambios de anteojo." },
  ];
  const location = type === "near" ? "cerca" : "lejos";
  return [{ name: `Monofocal para ${location}`, tier: "Diseño a evaluar", benefit: `Corrección para ${location}`, reason: "El material, tratamiento y artículo se eligen con el catálogo y la graduación verificada." }];
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
  state.options = optionsFor(state.rx, state.type);
  state.confirmed = true;
  render();
  $("results").scrollIntoView({ behavior: "smooth", block: "start" });
});
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
