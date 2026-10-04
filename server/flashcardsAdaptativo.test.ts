import assert from "node:assert/strict";
import test from "node:test";

import { recomendarEstudoFlashcards } from "../src/utils/flashcardsAdaptativo";
import type { PacoteQuestoesFlashcard, ProgressoQuestaoFlashcard } from "../src/types/flashcards";

const pacote: PacoteQuestoesFlashcard = {
  materia: "Direitos Humanos",
  topico: "Gerações de direitos humanos",
  questoes: [{
    id: "dh-001",
    pergunta: "Pergunta",
    alternativas: [{ id: "a", texto: "A" }, { id: "b", texto: "B" }],
    correta: "a",
    explicacao: "Explicação"
  }]
};

function historico(acertos: number, erros: number): ProgressoQuestaoFlashcard[] {
  return [{
    questaoId: "dh-001",
    materia: pacote.materia,
    topico: pacote.topico,
    tentativas: acertos + erros,
    acertos,
    erros,
    ultimaAcertou: acertos >= erros,
    ultimaRespostaEm: "2026-10-04T03:00:00.000Z"
  }];
}

test("flashcards são sugeridos sem histórico ou com aproveitamento baixo", () => {
  assert.equal(recomendarEstudoFlashcards(pacote, []).modo, "flashcards");
  assert.equal(recomendarEstudoFlashcards(pacote, historico(2, 4)).nivel, "recuperacao");
});

test("quiz é sugerido com 80 por cento ou mais", () => {
  assert.equal(recomendarEstudoFlashcards(pacote, historico(8, 2)).modo, "quiz");
});
