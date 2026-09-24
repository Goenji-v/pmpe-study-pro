import assert from "node:assert/strict";
import test from "node:test";

import {
  adaptarMissaoFlexivel,
  calcularDiagnosticoSemanalPlano,
} from "../src/utils/adaptacaoPlano.ts";
import type {
  RegistroQuestao,
} from "../src/types/index.ts";

function questao(params: {
  assunto: string;
  certas: number;
  erradas: number;
  data?: string;
  assuntoId?: string;
}): RegistroQuestao {
  return {
    id: crypto.randomUUID(),
    materia: "Direitos humanos",
    materiaId: "direitos-humanos",
    modulo: "Geral",
    moduloId: "modulo-geral-direitos-humanos",
    assunto: params.assunto,
    assuntoId: params.assuntoId,
    banca: "Instituto AOCP",
    certas: params.certas,
    erradas: params.erradas,
    minutos: 0,
    data:
      params.data ??
      "2026-09-24T10:00:00.000Z",
  };
}

test("reforço automático usa o assunto real com pior desempenho", () => {
  const diagnostico =
    calcularDiagnosticoSemanalPlano({
      agora: new Date(
        "2026-09-24T12:00:00.000Z"
      ),
      materiasDisponiveis: [
        "Direitos humanos",
      ],
      sessoes: [],
      revisoes: [],
      questoes: [
        questao({
          assunto:
            "Teoria geral dos direitos humanos",
          assuntoId:
            "direitos-humanos-teoria-geral",
          certas: 8,
          erradas: 6,
        }),
        questao({
          assunto:
            "Características dos direitos humanos",
          assuntoId:
            "direitos-humanos-caracteristicas",
          certas: 9,
          erradas: 1,
        }),
      ],
    });

  const direitosHumanos =
    diagnostico.materias.find(
      (item) =>
        item.materia ===
        "Direitos humanos"
    );

  assert.ok(direitosHumanos);
  assert.equal(
    direitosHumanos.assuntoPrioritario,
    "Teoria geral dos direitos humanos"
  );
  assert.equal(
    direitosHumanos.percentualAssuntoPrioritario,
    57
  );
  assert.equal(
    direitosHumanos.questoesAssuntoPrioritario,
    14
  );

  const adaptada =
    adaptarMissaoFlexivel(
      {
        id: "s7-d4-m1",
        numero: 1,
        materia:
          "Matéria com maior dificuldade",
        assunto: "Reforço livre",
        tipo: "livre",
      },
      diagnostico
    );

  assert.equal(
    adaptada.materia,
    "Direitos humanos"
  );
  assert.equal(
    adaptada.assunto,
    "Teoria geral dos direitos humanos"
  );
  assert.equal(
    adaptada.reforco?.assunto,
    "Teoria geral dos direitos humanos"
  );
  assert.equal(
    adaptada.reforco?.percentualAcertos,
    57
  );
  assert.equal(
    adaptada.assunto.includes(
      "Reforço direcionado"
    ),
    false
  );
});

test("texto sintético antigo de reforço nunca vira assunto prioritário", () => {
  const diagnostico =
    calcularDiagnosticoSemanalPlano({
      agora: new Date(
        "2026-09-24T12:00:00.000Z"
      ),
      materiasDisponiveis: [
        "Direitos humanos",
      ],
      sessoes: [],
      revisoes: [],
      questoes: [
        questao({
          assunto:
            "Reforço direcionado · 57% de acertos em 14 questões",
          certas: 0,
          erradas: 10,
        }),
        questao({
          assunto:
            "Teoria geral dos direitos humanos",
          certas: 8,
          erradas: 6,
        }),
      ],
    });

  const item =
    diagnostico.materias[0];

  assert.equal(
    item.assuntoPrioritario,
    "Teoria geral dos direitos humanos"
  );
});
