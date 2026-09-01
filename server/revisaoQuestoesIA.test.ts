import assert from "node:assert/strict";
import test from "node:test";

import {
  montarPromptRevisaoQuestoesIA,
  validarLoteRevisado,
} from "../src/services/revisaoQuestoesIAUtils.ts";

test("prompt exige uma única alternativa correta e revisão independente", () => {
  const prompt = montarPromptRevisaoQuestoesIA({
    contextoOriginal: "Português → Fonologia",
    banca: "AOCP",
    questoes: [
      {
        enunciado: "Questão exemplo",
        respostaCorreta: "A",
      },
    ],
  });

  assert.match(prompt, /EXATAMENTE UMA alternativa correta/);
  assert.match(prompt, /resolva cada questão novamente/);
  assert.match(prompt, /duas puderem ser defendidas/);
  assert.match(prompt, /Português → Fonologia/);
  assert.match(prompt, /AOCP/);
});

test("lote revisado precisa manter a quantidade exata", () => {
  assert.equal(validarLoteRevisado([{}, {}], 2).length, 2);

  assert.throws(
    () => validarLoteRevisado([{}], 2),
    /lote não foi liberado/
  );
});
