import assert from "node:assert/strict";
import test from "node:test";
import { normalizePair, nearFromAdd, evaluateProduct, validProduct, selectThreeOffers, explainOffer } from "../recommendations.js";

const source = { od: { sphere: "+1.50", cylinder: "+0.25", axis: "10" }, oi: { sphere: "+1.50", cylinder: "+0.25", axis: "170" } };
const pair = normalizePair(source);
const minmax = { is_active: true, optical_case: "multifocal", sphere_min: 0, sphere_max: 5, cylinder_min: -2, cylinder_max: 0, addition_min: 1, addition_max: 3 };

test("cilindro positivo se transpone para cotejo, sin alterar la receta original", () => {
  assert.deepEqual([pair.od.sphere, pair.od.cylinder, pair.od.axis], [1.75, -0.25, 100]);
  assert.deepEqual([pair.oi.sphere, pair.oi.cylinder, pair.oi.axis], [1.75, -0.25, 80]);
  assert.equal(source.od.sphere, "+1.50");
  assert.equal(nearFromAdd(source, "+2.00").od.sphere, "3.5");
});

test("ADD y ambos ojos deben entrar en la ficha", () => {
  assert.equal(evaluateProduct(minmax, pair, "+2.00").status, "compatible");
  assert.equal(evaluateProduct(minmax, pair, "+4.00").status, "out");
  assert.equal(evaluateProduct({ ...minmax, cylinder_max: null }, pair, "+2.00").status, "review");
  assert.equal(evaluateProduct(minmax, { ...pair, oi: { ...pair.oi, sphere: 6 } }, "+2.00").status, "out");
});

test("un multifocal sin rango de ADD nunca se declara compatible", () => {
  assert.equal(evaluateProduct({ ...minmax, addition_min: null, addition_max: null }, pair, "+2.00").status, "review");
});

test("la matriz no redondea una graduación intermedia ni considera laboratorio como apto", () => {
  const product = { ...minmax, technical_family_key: "organic_standard_149_156" };
  const matrix = { status: "resolved", final_supply_mode: "stock" };
  assert.equal(evaluateProduct(product, pair, 2, matrix).status, "compatible");
  assert.equal(evaluateProduct(product, { ...pair, od: { ...pair.od, sphere: 1.62 } }, 2, matrix).status, "review");
  assert.equal(evaluateProduct(product, pair, 2, { status: "resolved", final_supply_mode: "laboratory" }).status, "review");
});

test("artículos vencidos o inactivos no se ofrecen", () => {
  assert.equal(validProduct(minmax, "2026-09-29"), true);
  assert.equal(validProduct({ ...minmax, valid_until: "2026-09-28" }, "2026-09-29"), false);
  assert.equal(validProduct({ ...minmax, is_active: false }, "2026-09-29"), false);
});

const item = (name, kind = "far", extra = {}) => ({ name, sku: name, kind, product: { name, treatment: "antirreflejo", optical_case: kind === "both" ? "multifocal" : "monofocal", ...extra } });

test("la opción central es la mejor coincidencia y se mantienen premium y acceso", () => {
  const offers = [item("Orgánico blanco"), item("Orgánico antirreflejo"), item("Blue antirreflejo 1.56"), item("Super Blue antirreflejo"), item("Black Blue 1.67")];
  const selection = selectThreeOffers(offers, "far", { use: "driving", priority: "comfort" });
  assert.deepEqual(selection.slots.map(slot => slot.tier), ["Premium", "Mejor opción", "Acceso"]);
  assert.equal(selection.slots[1].offer.name, "Black Blue 1.67");
  assert.equal(selection.slots.filter(slot => slot.offer).length, 3);
  assert.equal(selection.alternatives.length, 2);
});

test("presupuesto modifica la mejor opción usando el precio cargado", () => {
  const offers = [
    item("Super Blue antirreflejo", "far", { base_price: 300000 }),
    item("Blue antirreflejo 1.56", "far", { base_price: 70000 }),
    item("Orgánico antirreflejo", "far", { base_price: 45000 }),
  ];
  const selection = selectThreeOffers(offers, "far", { use: "driving", priority: "budget" });
  assert.equal(selection.slots[1].offer.name, "Blue antirreflejo 1.56");
});

test("cerca con pantallas ubica el ocupacional como mejor opción si ya fue validado", () => {
  const offers = [item("Blue antirreflejo"), item("Super Blue antirreflejo"), item("Ocupacional digital", "near")];
  assert.equal(selectThreeOffers(offers, "near", { use: "screen" }).slots[1].offer.name, "Ocupacional digital");
  assert.equal(selectThreeOffers(offers, "near", { use: "reading" }).slots[2].offer.name, "Ocupacional digital");
});

test("multifocal ubica la familia de mayor ajuste en el centro; rank del administrador puede reordenar", () => {
  const offers = [item("Multifocal ONE", "both"), item("Multifocal NEW", "both"), item("Multifocal FREE", "both")];
  assert.equal(selectThreeOffers(offers, "both").slots[1].offer.name, "Multifocal FREE");
  offers[0].product.metadata = { scanner: { rank: 99 } };
  assert.equal(selectThreeOffers(offers, "both").slots[1].offer.name, "Multifocal ONE");
});

test("sin tres fichas se mantienen tres lugares sin inventar artículos", () => {
  const selection = selectThreeOffers([item("Super Blue antirreflejo")], "far");
  assert.equal(selection.slots.length, 3);
  assert.equal(selection.slots.filter(slot => slot.offer).length, 1);
  assert.equal(selection.slots[1].offer.name, "Super Blue antirreflejo");
});

test("matriz extendida no habilita artículo marcado solo stock", () => {
  const product = { ...minmax, technical_family_key: "organic_standard_149_156", supply_mode: "stock" };
  assert.equal(evaluateProduct(product, pair, 2, { status: "resolved", final_supply_mode: "range_extended" }).status, "review");
});

test("el argumento de venta usa rasgos comprobables sin prometer efectos médicos", () => {
  const message = explainOffer({ name: "Black Blue 1.67", treatment: "antireflective", optical_case: "monofocal" }, { use: "screen" }, { mode: "stock" }, "near");
  assert.match(message, /índice 1\.67 puede reducir espesor/);
  assert.match(message, /tratamiento antirreflejo reduce reflejos/);
  assert.doesNotMatch(message, /fatiga|protege|salud/i);
});
