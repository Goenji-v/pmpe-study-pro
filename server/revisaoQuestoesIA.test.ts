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
  assert.match(prompt, /caderno Tipo 01 da PMPE/);
  assert.match(prompt, /fonteNome, norma, dispositivo e auditoria/);
});

test("lote revisado precisa manter a quantidade exata", () => {
  const questao = (enunciado: string) => ({
    materia: "Português",
    enunciado,
    respostaCorreta: "A",
    fonteNome: "Acordo Ortográfico",
    auditoria: {
      veredito: "APROVADA",
      confianca: "alta",
      alternativasCorretas: ["A"],
      fontePrimaria: "Acordo Ortográfico da Língua Portuguesa",
      justificativaUnicidade: "Somente A atende integralmente ao comando.",
      dataReferencia: "2026-09-04",
    },
  });

  assert.equal(validarLoteRevisado([
    questao("Enunciado sobre regra de acentuação"),
    questao("Enunciado diferente sobre divisão silábica"),
  ], 2).length, 2);

  assert.throws(
    () => validarLoteRevisado([{}], 2),
    /lote não foi liberado/
  );
});

test("lote sem comprovação de resposta única é bloqueado", () => {
  assert.throws(
    () => validarLoteRevisado([{
      materia: "Constitucional",
      enunciado: "Questão sem auditoria",
      respostaCorreta: "B",
      fonteNome: "Constituição Federal",
      norma: "CF/88",
      dispositivo: "art. 5º",
    }], 1, "Constitucional"),
    /auditoria independente/
  );
});

test("lote jurídico sem norma e dispositivo é bloqueado", () => {
  assert.throws(
    () => validarLoteRevisado([{
      materia: "Constitucional",
      enunciado: "Questão constitucional verificável",
      respostaCorreta: "A",
      fonteNome: "Constituição Federal",
      auditoria: {
        veredito: "APROVADA",
        confianca: "alta",
        alternativasCorretas: ["A"],
        fontePrimaria: "Constituição da República Federativa do Brasil",
        justificativaUnicidade: "Somente A reproduz integralmente a norma vigente.",
        dataReferencia: "2026-09-04",
      },
    }], 1, "Constitucional"),
    /norma ou dispositivo jurídico ausente/
  );
});

test("lote com enunciados semanticamente repetidos é bloqueado", () => {
  const base = (enunciado: string) => ({
    materia: "RLM",
    enunciado,
    respostaCorreta: "A",
    fonteNome: "Resolução matemática",
    auditoria: {
      veredito: "APROVADA",
      confianca: "alta",
      alternativasCorretas: ["A"],
      fontePrimaria: "Cálculo demonstrado na explicação",
      justificativaUnicidade: "Somente A corresponde ao resultado calculado.",
      dataReferencia: "2026-09-04",
    },
  });

  assert.throws(
    () => validarLoteRevisado([
      base("Calcule o total de caixas usadas pelo policial no depósito central"),
      base("Calcule o total de caixas usadas pelo agente no depósito central"),
    ], 2, "RLM"),
    /repetição semântica/
  );
});
