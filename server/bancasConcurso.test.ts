import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizarBancaConcurso,
} from "../src/utils/bancasConcurso.ts";

test("agrupa variacoes de caixa e nome da AOCP", () => {
  assert.equal(normalizarBancaConcurso("AOCP"), "Instituto AOCP");
  assert.equal(normalizarBancaConcurso("aocp"), "Instituto AOCP");
  assert.equal(normalizarBancaConcurso("Aocp"), "Instituto AOCP");
  assert.equal(normalizarBancaConcurso("Instituto AOCP"), "Instituto AOCP");
});

test("agrupa aliases conhecidos das bancas predefinidas", () => {
  assert.equal(normalizarBancaConcurso("CEBRASPE"), "Cebraspe (Cespe)");
  assert.equal(normalizarBancaConcurso("Cespe"), "Cebraspe (Cespe)");
  assert.equal(normalizarBancaConcurso("VUNESP"), "Vunesp");
  assert.equal(normalizarBancaConcurso("ibfc"), "IBFC");
  assert.equal(normalizarBancaConcurso("Consulplan"), "Instituto Consulplan");
});

test("junta valores mistos, genericos ou nao predefinidos em nao informada", () => {
  const valores = [
    "",
    "Não informada",
    "Outra",
    "misto",
    "Mista",
    "misturada",
    "gpt",
    "VUNESP, IBFC",
    "Banca aleatória",
  ];

  valores.forEach((valor) => {
    assert.equal(normalizarBancaConcurso(valor), "Não informada");
  });
});
