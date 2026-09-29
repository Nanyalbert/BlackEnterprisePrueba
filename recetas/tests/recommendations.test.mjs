import assert from "node:assert/strict";
import test from "node:test";
import { normalizePair, nearFromAdd, evaluateProduct, validProduct } from "../recommendations.js";

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
