import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularPercentil,
  classificarMetrica,
} from "../src/utils/performanceMetrics";

test("classifica limites dos Core Web Vitals", () => {
  assert.equal(classificarMetrica("LCP", 2500), "bom");
  assert.equal(classificarMetrica("LCP", 2501), "atencao");
  assert.equal(classificarMetrica("LCP", 4001), "ruim");
  assert.equal(classificarMetrica("INP", 200), "bom");
  assert.equal(classificarMetrica("CLS", 0.25), "atencao");
  assert.equal(classificarMetrica("TTFB", 1801), "ruim");
});

test("calcula percentil 75 sem ser distorcido pela ordem de entrada", () => {
  assert.equal(calcularPercentil([400, 100, 300, 200]), 300);
  assert.equal(calcularPercentil([]), null);
});
