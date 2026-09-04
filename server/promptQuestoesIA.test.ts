import assert from "node:assert/strict";
import test from "node:test";

import { montarPromptGeracaoQuestoesIA } from "./promptQuestoesIA.ts";

test("geração segue a matriz AOCP sem copiar a prova oficial", () => {
  const prompt = montarPromptGeracaoQuestoesIA({
    assunto: "Constitucional → direitos fundamentais",
    quantidade: 10,
    banca: "Instituto AOCP",
    dataReferencia: "2026-09-04",
    enunciadosEvitar: ["Questão já usada"],
  });

  assert.match(prompt, /PMPE, Instituto AOCP, aplicado em 2024/);
  assert.match(prompt, /80% a 90% é de estrutura/);
  assert.match(prompt, /semelhança textual deve ser zero/);
  assert.match(prompt, /11, 16, 19, 37, 40 e 53, anuladas/);
  assert.match(prompt, /redação consolidada vigente/);
  assert.match(prompt, /Questão já usada/);
  assert.match(prompt, /"auditoria"/);
});
