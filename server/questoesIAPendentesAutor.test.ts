import assert from "node:assert/strict";
import test from "node:test";

import type { QuestaoIA } from "../src/types/index.ts";
import {
  reconciliarQuestoesComCatalogo,
} from "../src/services/catalogoQuestoesIAUtils.ts";

function questao(id: string, respostaCorreta: QuestaoIA["respostaCorreta"] = "A"): QuestaoIA {
  return {
    id,
    materia: "Português",
    modulo: "Módulo 0 - Fonologia",
    assunto: "Sílaba",
    banca: "AOCP",
    dificuldade: "Média",
    enunciado: `Questão ${id}`,
    alternativas: {
      A: "Alternativa A",
      B: "Alternativa B",
      C: "Alternativa C",
      D: "Alternativa D",
      E: "Alternativa E",
    },
    respostaCorreta,
    explicacao: "Explicação",
  };
}

test("caderno mantém a ordem e recebe a versão atual das questões autorizadas", () => {
  const local = [questao("q1"), questao("q2")];
  const autorizadas = [questao("q1", "B"), questao("q2", "C")];

  const resultado = reconciliarQuestoesComCatalogo(local, autorizadas);

  assert.deepEqual(resultado.map((item) => item.id), ["q1", "q2"]);
  assert.deepEqual(resultado.map((item) => item.respostaCorreta), ["B", "C"]);
});

test("questão que não é retornada pelo catálogo continua sendo removida", () => {
  const resultado = reconciliarQuestoesComCatalogo(
    [questao("q1"), questao("q2")],
    [questao("q1")]
  );

  assert.deepEqual(resultado.map((item) => item.id), ["q1"]);
});
