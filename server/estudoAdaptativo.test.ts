import assert from "node:assert/strict";
import test from "node:test";

import type { SessaoEstudo } from "../src/types/index.ts";
import { calcularProximaRevisaoSRS } from "../src/utils/repeticaoEspacada.ts";
import { calcularSequenciaAtividades } from "../src/utils/sequenciaAtividades.ts";

test("SRS: difícil volta no dia seguinte e reduz facilidade", () => {
  const agora = new Date("2026-10-06T12:00:00.000Z");
  const resultado = calcularProximaRevisaoSRS(
    { repeticoes: 4, intervaloDias: 10, fatorFacilidade: 2.5 },
    "dificil",
    agora
  );

  assert.equal(resultado.repeticoes, 0);
  assert.equal(resultado.intervaloDias, 1);
  assert.equal(resultado.fatorFacilidade, 2.3);
  assert.equal(resultado.proximaRevisaoEm, "2026-10-07T12:00:00.000Z");
});

test("SRS: fácil amplia o intervalo", () => {
  const agora = new Date("2026-10-06T12:00:00.000Z");
  const resultado = calcularProximaRevisaoSRS(
    { repeticoes: 2, intervaloDias: 7, fatorFacilidade: 2.5 },
    "facil",
    agora
  );

  assert.equal(resultado.repeticoes, 3);
  assert.ok(resultado.intervaloDias >= 18);
  assert.ok(resultado.fatorFacilidade > 2.5);
});

test("streak: aceita atividade hoje ou ontem e preserva recorde", () => {
  const sessoes: SessaoEstudo[] = [
    { id: "1", tipo: "estudo", materia: "RLM", assunto: "A", minutos: 20, data: "2026-10-03" },
    { id: "2", tipo: "estudo", materia: "RLM", assunto: "A", minutos: 20, data: "2026-10-04" },
    { id: "3", tipo: "estudo", materia: "RLM", assunto: "A", minutos: 20, data: "2026-10-05" },
  ];

  const resultado = calcularSequenciaAtividades({
    sessoes,
    questoes: [],
    revisoes: [],
    simulados: [],
    agora: new Date(2026, 9, 6, 12, 0, 0),
  });

  assert.equal(resultado.atual, 3);
  assert.equal(resultado.melhor, 3);
});

test("streak: sequência atual zera quando atividade ficou antiga", () => {
  const sessoes: SessaoEstudo[] = [
    { id: "1", tipo: "estudo", materia: "RLM", assunto: "A", minutos: 20, data: "2026-09-01" },
    { id: "2", tipo: "estudo", materia: "RLM", assunto: "A", minutos: 20, data: "2026-09-02" },
  ];

  const resultado = calcularSequenciaAtividades({
    sessoes,
    questoes: [],
    revisoes: [],
    simulados: [],
    agora: new Date(2026, 9, 6, 12, 0, 0),
  });

  assert.equal(resultado.atual, 0);
  assert.equal(resultado.melhor, 2);
});
