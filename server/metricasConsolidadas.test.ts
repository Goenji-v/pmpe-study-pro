import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularAproveitamentoSimulado,
  calcularMetricasConsolidadas,
} from "../src/utils/metricasConsolidadas.ts";
import type {
  RegistroQuestao,
  SessaoEstudo,
  Simulado,
} from "../src/types/index.ts";

const data = "2026-08-24T12:00:00.000Z";

test("não duplica simulado IA já espelhado em registros de questões", () => {
  const questoes: RegistroQuestao[] = [{
    id: "q1",
    materia: "Português",
    assunto: "Crase",
    banca: "AOCP",
    certas: 7,
    erradas: 3,
    minutos: 0,
    data,
    origem: "simulado-ia",
    tentativaId: "tentativa-1",
  }];

  const simulados: Simulado[] = [{
    id: "s1",
    nome: "Simulado IA",
    banca: "AOCP",
    certas: 7,
    erradas: 3,
    anuladas: 0,
    minutos: 20,
    data,
    origem: "ia",
    tentativaId: "tentativa-1",
  }];

  const metricas = calcularMetricasConsolidadas({
    questoes,
    sessoes: [],
    simulados,
  });

  assert.equal(metricas.questoesRespondidas, 10);
  assert.equal(metricas.certas, 7);
  assert.equal(metricas.erradas, 3);
  assert.equal(metricas.aproveitamento, 70);
});

test("inclui questões de simulado manual sem espelho", () => {
  const simulados: Simulado[] = [{
    id: "s2",
    nome: "Prova manual",
    banca: "AOCP",
    certas: 45,
    erradas: 10,
    emBranco: 3,
    anuladas: 2,
    totalQuestoes: 60,
    minutos: 180,
    data,
    origem: "manual",
  }];

  const metricas = calcularMetricasConsolidadas({
    questoes: [],
    sessoes: [],
    simulados,
  });

  assert.equal(metricas.questoesRespondidas, 55);
  assert.equal(metricas.emBranco, 3);
  assert.equal(metricas.anuladas, 2);
  assert.equal(metricas.totalOriginal, 60);
  assert.equal(metricas.aproveitamento, 82);
  assert.equal(metricas.minutos, 180);
});

test("não duplica minutos quando sessão e registro automático representam o mesmo bloco", () => {
  const sessoes: SessaoEstudo[] = [{
    id: "sessao-1",
    tipo: "questoes",
    materia: "Direitos Humanos",
    assunto: "DUDH",
    minutos: 60,
    data,
  }];

  const questoes: RegistroQuestao[] = [{
    id: "q2",
    materia: "Direitos Humanos",
    assunto: "DUDH",
    banca: "AOCP",
    certas: 8,
    erradas: 2,
    minutos: 60,
    data: "2026-08-24T12:00:02.000Z",
  }];

  const metricas = calcularMetricasConsolidadas({
    questoes,
    sessoes,
    simulados: [],
  });

  assert.equal(metricas.minutos, 60);
});

test("anuladas não entram no denominador do aproveitamento", () => {
  const simulado: Simulado = {
    id: "s3",
    nome: "Simulado",
    banca: "AOCP",
    certas: 40,
    erradas: 10,
    anuladas: 10,
    minutos: 120,
    data,
  };

  assert.equal(calcularAproveitamentoSimulado(simulado), 80);
});
