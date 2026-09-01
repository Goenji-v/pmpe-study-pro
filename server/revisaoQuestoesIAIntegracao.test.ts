import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fonte = readFileSync(
  new URL("../src/services/gemini.ts", import.meta.url),
  "utf8"
);

test("gerador submete o lote a uma segunda revisão semântica", () => {
  assert.match(fonte, /montarPromptRevisaoQuestoesIA/);
  assert.match(fonte, /validarLoteRevisado/);
  assert.match(fonte, /etapa: "revisão"/);
});

test("falha da revisão não libera o lote inicial", () => {
  assert.match(fonte, /Nenhuma questão não revisada foi liberada/);
  assert.match(fonte, /O lote não foi liberado/);
});
