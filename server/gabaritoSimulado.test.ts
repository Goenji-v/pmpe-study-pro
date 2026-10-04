import assert from "node:assert/strict";
import test from "node:test";

import {
  formatarMeuGabaritoTexto,
  montarMeuGabarito,
} from "../src/utils/gabaritoSimulado";
import type { CorrecaoQuestaoSimulado } from "../src/utils/analiseSimuladoStudyPro";

function item(
  numero: number,
  respostaAluno: string | null
): CorrecaoQuestaoSimulado {
  return {
    id: `q-${numero}`,
    numero,
    materia: "Teste",
    assunto: "Teste",
    assuntoEspecifico: "Teste",
    dificuldade: "Média",
    respostaAluno,
    gabarito: "A",
    marcacao: "normal",
    status: respostaAluno ? "erro" : "nao_respondida",
  };
}

test("monta o gabarito do aluno na ordem das questões", () => {
  const gabarito = montarMeuGabarito([
    item(3, "c"),
    item(1, "b"),
    item(2, null),
  ]);

  assert.deepEqual(gabarito, [
    { numero: 1, resposta: "B" },
    { numero: 2, resposta: null },
    { numero: 3, resposta: "C" },
  ]);
});

test("formata o gabarito do aluno sem misturar com o gabarito da correção", () => {
  assert.equal(
    formatarMeuGabaritoTexto([
      item(1, "B"),
      item(2, "A"),
      item(3, null),
    ]),
    "1-B, 2-A, 3-—"
  );
});
