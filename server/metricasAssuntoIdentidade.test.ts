import assert from "node:assert/strict";
import test from "node:test";
import type { Assunto, Materia, Modulo, RegistroQuestao, Revisao, SessaoEstudo } from "../src/types";
import { calcularMetricasAssunto, historicoPertenceAoAssunto } from "../src/utils/metricasAssunto";

const assunto: Assunto = { id: "principios", nome: "Dos princípios fundamentais", concluido: false, prioridade: "media", idsLegados: ["principios-antigo"], referenciasEdital: ["edital-antigo"], origemEditalId: "edital-atual" };
const modulo: Modulo = { id: "novo-modulo", nome: "Constituição", ordem: 1, assuntos: [assunto] };
const materia: Materia = { id: "direito-constitucional", nome: "Direito Constitucional", idsLegados: ["constitucional-antigo"], assuntos: [assunto], modulos: [modulo] };
const alvo = { materia, modulo, assunto };
const legado = { materia: " Constitucional ", assunto: " Dos principios fundamentais " };
const data = "2026-10-17T12:00:00Z";

test("identidade do histórico aceita aliases exatos e IDs legados após renomear ou mover", () => {
  assert.equal(historicoPertenceAoAssunto(legado, alvo), true);
  for (const id of [assunto.id, "principios-antigo", "edital-antigo", "edital-atual"]) {
    assert.equal(historicoPertenceAoAssunto({ ...legado, assunto: "Título anterior", assuntoId: id, materiaId: "constitucional-antigo", moduloId: "modulo-anterior" }, alvo), true);
  }
  assert.equal(historicoPertenceAoAssunto({ ...legado, materia: "Nome antigo sem alias", materiaId: materia.id }, alvo), true);
});

test("IDs conflitantes, módulos distintos e nomes apenas parecidos não se misturam", () => {
  for (const registro of [
    { ...legado, assuntoId: "outro-assunto" },
    { ...legado, materiaId: "outra-materia", assuntoId: assunto.id },
    { ...legado, moduloId: "outro-modulo" },
    { ...legado, modulo: "Outro módulo" },
    { ...legado, materia: "Direito Penal" },
    { ...legado, assunto: "Dos princípios fundamentais da administração" },
  ]) assert.equal(historicoPertenceAoAssunto(registro, alvo), false, JSON.stringify(registro));
  const duplicado: Modulo = { ...modulo, id: "outro-modulo", assuntos: [{ ...assunto, id: "outro-assunto", idsLegados: [], referenciasEdital: [] }] };
  const ambiguo = { ...alvo, materia: { ...materia, modulos: [modulo, duplicado] } };
  assert.equal(historicoPertenceAoAssunto(legado, ambiguo), false);
  assert.equal(historicoPertenceAoAssunto({ ...legado, modulo: modulo.nome }, ambiguo), false);
  assert.equal(historicoPertenceAoAssunto({ ...legado, moduloId: modulo.id }, ambiguo), true);
});

test("métricas compartilham escopo, deduplicam renomeados e contam estados de revisão", () => {
  const ref = { ...legado, data, materiaId: "constitucional-antigo", assuntoId: "principios-antigo", moduloId: "modulo-anterior" };
  const sessoes = [{ ...ref, id: "s1", tipo: "questoes", minutos: 30 }] as SessaoEstudo[];
  const questoes = [
    { ...ref, materia: materia.nome, materiaId: materia.id, assuntoId: assunto.id, assunto: assunto.nome, moduloId: modulo.id, id: "q1", certas: 8, erradas: 2, emBranco: 1, minutos: 30 },
    { ...ref, id: "q-outra", assuntoId: "outro", certas: 900, erradas: 0, minutos: 900 },
  ] as RegistroQuestao[];
  const revisoes = [
    { ...ref, id: "r1", concluida: false },
    { ...ref, id: "r2", concluida: true, dataConclusao: data },
    { ...ref, id: "r3", concluida: true },
    { ...ref, id: "r-outro", assuntoId: "outro", concluida: false },
  ] as Revisao[];
  const anterior = structuredClone({ sessoes, questoes, revisoes });
  const m = calcularMetricasAssunto({ ...alvo, sessoes, questoes, revisoes });
  assert.equal(m.minutos, 30);
  assert.equal(m.questoes, 11);
  assert.equal(m.emBranco, 1);
  assert.equal(m.revisoesPendentes, 1);
  assert.equal(m.revisoesConcluidas, 2);
  assert.deepEqual({ sessoes, questoes, revisoes }, anterior);
});
