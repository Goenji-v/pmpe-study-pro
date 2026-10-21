import assert from "node:assert/strict";
import test from "node:test";

import { materialCorrespondeAoAssunto } from "../src/utils/correspondenciaMateriais.ts";
import { calcularMetricasDoAssunto } from "../src/utils/metricasAssunto.ts";
import { calcularSequenciaAtividades } from "../src/utils/sequenciaAtividades.ts";

test("materiais legados: Constitucional e Direito Constitucional se referem à mesma matéria", () => {
  assert.equal(materialCorrespondeAoAssunto(
    { materia: "Constitucional", assunto: "Dos princípios fundamentais" },
    { materia: "Direito Constitucional", assunto: "Dos princípios fundamentais" }
  ), true);
  assert.equal(materialCorrespondeAoAssunto(
    { materia: "Direito Penal Militar", assunto: "Dos princípios fundamentais" },
    { materia: "Direito Penal", assunto: "Dos princípios fundamentais" }
  ), false);
  assert.equal(materialCorrespondeAoAssunto(
    { materia: "Constitucional", assunto: "Dos princípios fundamentais" },
    { materia: "Direito Constitucional", assunto: "Princípios constitucionais" }
  ), false);
});

test("materiais: IDs estáveis evitam mesclar assuntos distintos após renomear", () => {
  const atual = {
    materia: "Direito Constitucional", materiaId: "materia-1",
    modulo: "Módulo 1", moduloId: "modulo-1",
    assunto: "Princípios fundamentais", assuntoId: "assunto-atual",
    assuntoIdsLegados: ["assunto-antigo"],
  };
  assert.equal(materialCorrespondeAoAssunto({
    materia: "Constitucional", materiaId: "materia-1",
    modulo: "Módulo anterior", moduloId: "modulo-1",
    assunto: "Nome antigo", assuntoId: "assunto-antigo",
  }, atual), true);
  assert.equal(materialCorrespondeAoAssunto({
    materia: "Constitucional", materiaId: "outra-materia",
    assunto: "Princípios fundamentais", assuntoId: "assunto-atual",
  }, atual), false);
  assert.equal(materialCorrespondeAoAssunto({
    materia: "Constitucional", materiaId: "materia-1",
    moduloId: "modulo-1", assunto: "Nome igual", assuntoId: "outro-assunto",
  }, atual), false);
});

test("cartão e perfil do assunto compartilham minutos deduplicados e revisões distinguíveis", () => {
  const data = "2026-10-18T12:00:00.000Z";
  const materia = { id: "m1", nome: "Direito Constitucional" };
  const modulo = { id: "mod1", nome: "Módulo 1" };
  const assunto = { id: "a1", idsLegados: ["legado-a1"], nome: "Dos princípios fundamentais" };
  const metricas = calcularMetricasDoAssunto({
    materia: materia as any, modulo: modulo as any, assunto: assunto as any,
    sessoes: [{ id: "sessao", materia: "Constitucional", assunto: assunto.nome, tipo: "questoes", minutos: 30, data }] as any,
    questoes: [{ id: "registro", materia: "Direito Constitucional", assunto: assunto.nome, certas: 4, erradas: 2, minutos: 30, data }] as any,
    revisoes: [
      { id: "r1", materia: "Constitucional", assunto: assunto.nome, concluida: true, dataConclusao: data },
      { id: "r2", materia: "Constitucional", assunto: assunto.nome, concluida: false },
    ] as any,
  });
  assert.equal(metricas.minutos, 30);
  assert.equal(metricas.questoes, 6);
  assert.equal(metricas.certas, 4);
  assert.equal(metricas.erradas, 2);
  assert.equal(metricas.revisoesConcluidas, 1);
  assert.equal(metricas.revisoesPendentes, 1);
});

test("sequência: timestamps UTC próximos à meia-noite obedecem ao dia do aluno", () => {
  const timezoneAnterior = process.env.TZ;
  process.env.TZ = "America/Recife";
  try {
    const entrada = {
      sessoes: [{ id: "s1", data: "2026-10-19T01:30:00.000Z" }] as any,
      questoes: [], revisoes: [], simulados: [],
    };
    assert.deepEqual(calcularSequenciaAtividades({
      ...entrada, agora: new Date("2026-10-19T13:00:00.000Z"),
    }), { atual: 1, melhor: 1 });
    assert.deepEqual(calcularSequenciaAtividades({
      ...entrada, agora: new Date("2026-10-20T13:00:00.000Z"),
    }), { atual: 0, melhor: 1 });
    assert.equal(calcularSequenciaAtividades({
      sessoes: [{ id: "s2", data: "2026-10-18" }] as any,
      questoes: [], revisoes: [], simulados: [],
      agora: new Date("2026-10-19T13:00:00.000Z"),
    }).atual, 1);
  } finally {
    if (timezoneAnterior === undefined) delete process.env.TZ;
    else process.env.TZ = timezoneAnterior;
  }
});
