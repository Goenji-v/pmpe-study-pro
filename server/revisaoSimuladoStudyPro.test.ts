import assert from "node:assert/strict";
import test from "node:test";

import type { Materia, Revisao } from "../src/types";
import { analisarSimuladoStudyPro } from "../src/utils/analiseSimuladoStudyPro";
import { adicionarErrosSimuladoARevisao } from "../src/utils/revisaoSimuladoStudyPro";

const materias: Materia[] = [
  {
    id: "portugues",
    nome: "Português",
    modulos: [
      {
        id: "gramatica",
        nome: "Gramática",
        ordem: 1,
        assuntos: [
          {
            id: "crase",
            nome: "Crase",
            concluido: true,
            prioridade: "media",
          },
        ],
      },
    ],
    assuntos: [
      {
        id: "crase",
        nome: "Crase",
        concluido: true,
        prioridade: "media",
      },
    ],
  },
];

function criarAnalise() {
  const questoes = Array.from({ length: 5 }, (_, indice) => ({
    id: `q${indice + 1}`,
    numero: indice + 1,
    materia: "Português",
    materiaId: "portugues",
    modulo: "Gramática",
    moduloId: "gramatica",
    assunto: "Crase",
    assuntoId: "crase",
    dificuldade: "Média" as const,
    enunciado: `Questão ${indice + 1}`,
    alternativas: [
      { id: "A", texto: "A" },
      { id: "B", texto: "B" },
      { id: "C", texto: "C" },
      { id: "D", texto: "D" },
      { id: "E", texto: "E" },
    ],
    gabarito: "A",
  }));

  return analisarSimuladoStudyPro({
    tentativaId: "tentativa-1",
    nome: "Simulado",
    data: "2026-09-28T10:00:00.000Z",
    questoes,
    respostas: Object.fromEntries(questoes.map((item) => [item.id, "A"])),
    marcacoes: { q1: "chutei" },
  });
}

test("acerto por chute entra automaticamente como fraqueza na revisão", () => {
  const analise = criarAnalise();
  const agora = new Date("2026-09-28T10:00:00.000Z");

  const resultado = adicionarErrosSimuladoARevisao({
    revisoes: [],
    materias,
    analise,
    agora,
    criarId: () => "revisao-crase",
  });

  assert.equal(resultado.criadas, 1);
  assert.equal(resultado.revisoes.length, 1);
  assert.equal(resultado.revisoes[0]?.id, "revisao-crase");
  assert.equal(resultado.revisoes[0]?.certas, 4);
  assert.equal(resultado.revisoes[0]?.erradas, 1);
  assert.equal(resultado.revisoes[0]?.etapa, 1);
  assert.equal(
    resultado.revisoes[0]?.dataPrevista,
    "2026-09-29T12:00:00.000Z"
  );
});

test("não duplica assunto que já possui revisão pendente", () => {
  const analise = criarAnalise();
  const existente: Revisao = {
    id: "existente",
    materiaId: "portugues",
    moduloId: "gramatica",
    assuntoId: "crase",
    materia: "Português",
    modulo: "Gramática",
    assunto: "Crase",
    etapa: 1,
    dataCriacao: "2026-09-20T12:00:00.000Z",
    dataPrevista: "2026-10-10T12:00:00.000Z",
    concluida: false,
  };

  const resultado = adicionarErrosSimuladoARevisao({
    revisoes: [existente],
    materias,
    analise,
    agora: new Date("2026-09-28T10:00:00.000Z"),
  });

  assert.equal(resultado.criadas, 0);
  assert.equal(resultado.atualizadas, 1);
  assert.equal(resultado.revisoes.length, 1);
  assert.equal(resultado.revisoes[0]?.id, "existente");
  assert.equal(
    resultado.revisoes[0]?.dataPrevista,
    "2026-09-29T12:00:00.000Z"
  );
});
