import assert from "node:assert/strict";
import test from "node:test";

import { calcularSequenciaAtividades } from "../src/utils/sequenciaAtividades.ts";
import type { RegistroQuestao, Revisao, SessaoEstudo, Simulado } from "../src/types/index.ts";
import { calcularConquistasPermanentes } from "../src/services/conquistasPermanentes.ts";
import { criarConfiguracoesIniciais } from "../src/utils/contaInicial.ts";

const sessao = (data: string, minutos = 20): SessaoEstudo => ({
  id: `sessao-${data}`, data, minutos, tipo: "estudo", materia: "Português", assunto: "Verbos",
});
const entradaVazia = { sessoes: [], questoes: [], revisoes: [], simulados: [] };

test("sequência converte timestamps para o dia local, preservando datas civis", () => {
  const anterior = process.env.TZ;
  process.env.TZ = "America/Sao_Paulo";
  try {
    // 20/10 01h UTC ainda é 19/10 no aparelho. A terça está em andamento.
    assert.deepEqual(calcularSequenciaAtividades({
      ...entradaVazia,
      sessoes: [sessao("2026-10-18"), sessao("2026-10-20T01:00:00Z")],
      agora: new Date("2026-10-20T15:00:00Z"),
    }), { atual: 2, melhor: 2 });
  } finally {
    if (anterior === undefined) delete process.env.TZ;
    else process.env.TZ = anterior;
  }
});

test("atividade curta, questões sem tempo e revisão concluída contam igualmente como estudo", () => {
  const questao = { id: "q", data: "2026-10-18", certas: 1, erradas: 0, minutos: 0 } as RegistroQuestao;
  const revisao = { id: "r", dataConclusao: "2026-10-19", concluida: true } as Revisao;
  const simulado = { id: "p", data: "2026-10-20", certas: 1, erradas: 0, minutos: 0 } as Simulado;
  assert.deepEqual(calcularSequenciaAtividades({
    sessoes: [sessao("2026-10-17", 1)], questoes: [questao], revisoes: [revisao], simulados: [simulado],
    agora: new Date(2026, 9, 20, 12),
  }), { atual: 4, melhor: 4 });
});

test("registros vazios, revisão pendente, datas inválidas e atividades futuras não criam sequência", () => {
  assert.deepEqual(calcularSequenciaAtividades({
    sessoes: [sessao("2026-10-19", 0), sessao("2026-10-19Tinválido"), sessao("2026-10-20T23:00:00"), sessao("2026-10-21")],
    questoes: [{ data: "2026-10-19", minutos: 0, certas: 0, erradas: 0, emBranco: 2 } as RegistroQuestao],
    revisoes: [{ concluida: false, dataConclusao: "2026-10-19" } as Revisao],
    simulados: [{ data: "2026-10-19", minutos: 0, certas: 0, erradas: 0 } as Simulado],
    agora: new Date(2026, 9, 20, 12),
  }), { atual: 0, melhor: 0 });
});

test("dia em andamento preserva ontem; um dia completo sem estudo zera apenas a sequência atual", () => {
  const entrada = { ...entradaVazia, sessoes: [sessao("2026-10-17"), sessao("2026-10-18"), sessao("2026-10-19")] };
  assert.deepEqual(calcularSequenciaAtividades({ ...entrada, agora: new Date(2026, 9, 20, 23, 59) }), { atual: 3, melhor: 3 });
  assert.deepEqual(calcularSequenciaAtividades({ ...entrada, agora: new Date(2026, 9, 21, 0, 0) }), { atual: 0, melhor: 3 });
});

test("múltiplas fontes no mesmo dia não aumentam a sequência", () => {
  assert.deepEqual(calcularSequenciaAtividades({
    ...entradaVazia, sessoes: [sessao("2026-10-19"), sessao("2026-10-19", 30)],
    questoes: [{ data: "2026-10-19", certas: 10, erradas: 0, minutos: 30 } as RegistroQuestao],
    agora: new Date(2026, 9, 20, 12),
  }), { atual: 1, melhor: 1 });
});

test("dias civis consecutivos continuam válidos ao atravessar horário de verão", () => {
  const anterior = process.env.TZ;
  process.env.TZ = "America/New_York";
  try {
    assert.deepEqual(calcularSequenciaAtividades({
      ...entradaVazia,
      sessoes: [sessao("2026-03-07"), sessao("2026-03-08"), sessao("2026-03-09")],
      agora: new Date(2026, 2, 10, 0, 1),
    }), { atual: 3, melhor: 3 });
  } finally {
    if (anterior === undefined) delete process.env.TZ;
    else process.env.TZ = anterior;
  }
});

test("conquista desbloqueada permanece histórica enquanto a sequência atual está zerada", () => {
  const entrada = { ...entradaVazia, agora: new Date(2026, 9, 20, 12) };
  const conquista = calcularConquistasPermanentes({
    ...entrada,
    materias: [], missoesConcluidas: [], configuracoes: criarConfiguracoesIniciais(),
    recompensasRecebidas: ["conquista-marco:sequencia-7"],
  }).find(item => item.id === "sequencia-7");
  assert.equal(calcularSequenciaAtividades(entrada).atual, 0);
  assert.equal(conquista?.desbloqueada, true);
  assert.equal(conquista?.atual, "0/7 dias");
});

test("conquista de sequência não é concedida por sete registros vazios ou sete dias futuros", () => {
  const vazias = Array.from({ length: 7 }, (_, indice) => sessao(`2026-10-${10 + indice}`, 0));
  const futuras = Array.from({ length: 7 }, (_, indice) => sessao(`2026-10-${21 + indice}`));
  for (const sessoes of [vazias, futuras]) {
    const entrada = { ...entradaVazia, sessoes, agora: new Date(2026, 9, 20, 12) };
    const conquista = calcularConquistasPermanentes({
      ...entrada, materias: [], missoesConcluidas: [], configuracoes: criarConfiguracoesIniciais(),
    }).find(item => item.id === "sequencia-7");
    assert.deepEqual(calcularSequenciaAtividades(entrada), { atual: 0, melhor: 0 });
    assert.equal(conquista?.desbloqueada, false);
    assert.equal(conquista?.atual, "0/7 dias");
  }
});

test("sequência histórica válida concede conquista mesmo após perder a sequência atual", () => {
  const entrada = {
    ...entradaVazia,
    sessoes: Array.from({ length: 7 }, (_, indice) => sessao(`2026-10-${10 + indice}`, 1)),
    agora: new Date(2026, 9, 20, 12),
  };
  const conquista = calcularConquistasPermanentes({
    ...entrada, materias: [], missoesConcluidas: [], configuracoes: criarConfiguracoesIniciais(),
  }).find(item => item.id === "sequencia-7");
  assert.deepEqual(calcularSequenciaAtividades(entrada), { atual: 0, melhor: 7 });
  assert.equal(conquista?.desbloqueada, true);
  assert.equal(conquista?.atual, "7/7 dias");
});
