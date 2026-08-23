import assert from "node:assert/strict";
import test from "node:test";

import type {
  Materia,
  QuestaoIA,
  ResultadoQuestoesIAPersistido,
} from "../src/types";
import {
  aplicarRevisoesDoResultadoIA,
  calcularDiagnosticoQuestoesIA,
  criarRegistrosQuestoesIA,
  inferirTipoSessaoQuestoesIA,
  mesclarResultadosQuestoesIANoHistorico,
  type RespostasQuestoesIA,
} from "../src/utils/resultadoQuestoesIA";

const materias: Materia[] = [
  {
    id: "constitucional",
    nome: "Constitucional",
    assuntos: [],
    modulos: [
      {
        id: "geral",
        nome: "Geral",
        ordem: 1,
        assuntos: [
          {
            id: "vida-igualdade",
            nome: "Direito à vida e igualdade",
            concluido: false,
            prioridade: "media",
          },
          {
            id: "liberdade",
            nome: "Direito à liberdade",
            concluido: false,
            prioridade: "media",
          },
        ],
      },
    ],
  },
];

function criarQuestao(indice: number, assunto = "Direito à vida e igualdade"): QuestaoIA {
  return {
    id: `q-${indice}`,
    materia: "Constitucional",
    materiaId: "constitucional",
    modulo: "Geral",
    moduloId: "geral",
    assunto,
    assuntoId: assunto === "Direito à liberdade" ? "liberdade" : "vida-igualdade",
    banca: "AOCP",
    dificuldade: "Média",
    enunciado: `Questão ${indice}`,
    alternativas: { A: "A", B: "B", C: "C", D: "D", E: "E" },
    respostaCorreta: "A",
    explicacao: "Explicação",
  };
}

function responder(questoes: QuestaoIA[], acertos: number): RespostasQuestoesIA {
  return Object.fromEntries(
    questoes.map((questao, indice) => [questao.id, indice < acertos ? "A" : "B"])
  ) as RespostasQuestoesIA;
}

test("infere questões para um assunto e simulado para assuntos variados", () => {
  assert.equal(
    inferirTipoSessaoQuestoesIA([criarQuestao(1), criarQuestao(2)]),
    "questoes"
  );
  assert.equal(
    inferirTipoSessaoQuestoesIA([
      criarQuestao(1),
      criarQuestao(2, "Direito à liberdade"),
    ]),
    "simulado"
  );
});

test("registra apenas questões efetivamente respondidas e mantém o ID da tentativa", () => {
  const questoes = Array.from({ length: 10 }, (_, indice) => criarQuestao(indice));
  const respostas = responder(questoes.slice(0, 8), 6);
  const registros = criarRegistrosQuestoesIA({
    tentativaId: "tentativa-1",
    tipo: "simulado",
    questoes,
    respostas,
    materias,
    data: "2026-08-22T18:00:00.000Z",
  });

  assert.equal(registros.length, 1);
  assert.equal(registros[0].certas, 6);
  assert.equal(registros[0].erradas, 2);
  assert.equal(registros[0].emBranco, 2);
  assert.equal(registros[0].certas + registros[0].erradas, 8);
  assert.equal(registros[0].tentativaId, "tentativa-1");
  assert.equal(registros[0].origem, "simulado-ia");
});

test("reconcilia tentativa persistida no histórico sem contabilizar duas vezes", () => {
  const questoes = Array.from({ length: 10 }, (_, indice) => criarQuestao(indice));
  const registros = criarRegistrosQuestoesIA({
    tentativaId: "tentativa-1",
    tipo: "questoes",
    questoes,
    respostas: responder(questoes, 9),
    materias,
    data: "2026-08-23T18:34:32.000Z",
  });
  const resultado: ResultadoQuestoesIAPersistido = {
    id: "tentativa-1",
    nome: "Questões por assunto geradas por IA",
    data: "2026-08-23T18:34:32.000Z",
    tipo: "questoes",
    total: 10,
    certas: 9,
    erradas: 1,
    emBranco: 0,
    percentual: 90,
    registros,
  };

  const primeiraMesclagem = mesclarResultadosQuestoesIANoHistorico({
    questoes: [],
    simulados: [],
    resultados: [resultado],
  });
  const segundaMesclagem = mesclarResultadosQuestoesIANoHistorico({
    questoes: primeiraMesclagem.questoes,
    simulados: primeiraMesclagem.simulados,
    resultados: [resultado],
  });

  assert.equal(primeiraMesclagem.questoes.length, 1);
  assert.equal(primeiraMesclagem.questoes[0].certas, 9);
  assert.equal(primeiraMesclagem.questoes[0].erradas, 1);
  assert.equal(segundaMesclagem.questoes.length, 1);
  assert.equal(segundaMesclagem.questoes, primeiraMesclagem.questoes);
});

test("simulado persistido soma as questões e apenas um simulado", () => {
  const questoes = [
    ...Array.from({ length: 5 }, (_, indice) => criarQuestao(indice)),
    ...Array.from({ length: 5 }, (_, indice) =>
      criarQuestao(indice + 5, "Direito à liberdade")
    ),
  ];
  const respostas = responder(questoes, 8);
  const registros = criarRegistrosQuestoesIA({
    tentativaId: "simulado-1",
    tipo: "simulado",
    questoes,
    respostas,
    materias,
    data: "2026-08-23T19:00:00.000Z",
  });
  const resultado: ResultadoQuestoesIAPersistido = {
    id: "simulado-1",
    nome: "Simulado gerado por IA",
    data: "2026-08-23T19:00:00.000Z",
    tipo: "simulado",
    total: 10,
    certas: 8,
    erradas: 2,
    emBranco: 0,
    percentual: 80,
    registros,
    simulado: {
      id: "simulado-1",
      tentativaId: "simulado-1",
      nome: "Simulado gerado por IA",
      banca: "AOCP",
      certas: 8,
      erradas: 2,
      emBranco: 0,
      anuladas: 0,
      minutos: 0,
      data: "2026-08-23T19:00:00.000Z",
      totalQuestoes: 10,
      origem: "ia",
    },
  };

  const mesclado = mesclarResultadosQuestoesIANoHistorico({
    questoes: [],
    simulados: [],
    resultados: [resultado],
  });

  assert.equal(
    mesclado.questoes.reduce(
      (total, registro) => total + registro.certas + registro.erradas,
      0
    ),
    10
  );
  assert.equal(mesclado.simulados.length, 1);
  assert.equal(mesclado.simulados[0].certas, 8);
  assert.equal(mesclado.simulados[0].erradas, 2);
});

test("80% não cria revisão automática", () => {
  const questoes = Array.from({ length: 10 }, (_, indice) => criarQuestao(indice));
  const diagnostico = calcularDiagnosticoQuestoesIA(
    questoes,
    responder(questoes, 8)
  );
  const resultado = aplicarRevisoesDoResultadoIA({
    revisoes: [],
    diagnostico,
    materias,
    agora: new Date("2026-08-22T12:00:00.000Z"),
  });

  assert.equal(resultado.criadas, 0);
  assert.equal(resultado.revisoes.length, 0);
});

test("20% cria revisão urgente para o mesmo dia", () => {
  const questoes = Array.from({ length: 10 }, (_, indice) => criarQuestao(indice));
  const diagnostico = calcularDiagnosticoQuestoesIA(
    questoes,
    responder(questoes, 2)
  );
  const resultado = aplicarRevisoesDoResultadoIA({
    revisoes: [],
    diagnostico,
    materias,
    agora: new Date("2026-08-22T12:00:00.000Z"),
  });

  assert.equal(resultado.criadas, 1);
  assert.equal(resultado.revisoes.length, 1);
  assert.equal(
    resultado.revisoes[0].dataPrevista.slice(0, 10),
    "2026-08-22"
  );
});
