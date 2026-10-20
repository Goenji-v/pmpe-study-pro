import assert from "node:assert/strict";
import test from "node:test";
import type { RegistroQuestao, SessaoEstudo } from "../src/types";
import { calcularCentralInteligencia } from "../src/services/inteligencia/calcularCentralInteligencia";
import { gerarRelatorioInteligente } from "../src/services/inteligencia/relatorioInteligenteService";
import { calcularMetricasConsolidadas } from "../src/utils/metricasConsolidadas";

const data = "2026-10-01T15:00:00.000Z";
const questao: RegistroQuestao = {
  id: "questoes-sinteticas", materia: "Direito Constitucional", assunto: "Princípios fundamentais",
  certas: 8, erradas: 2, banca: "AOCP", minutos: 30, data,
};
const sessao: SessaoEstudo = {
  id: "sessao-sintetica", tipo: "questoes", materia: questao.materia,
  assunto: questao.assunto, minutos: 30, data,
};

function calcular(questoes: RegistroQuestao[], sessoes: SessaoEstudo[]) {
  const entrada = { questoes, sessoes, revisoes: [], simulados: [], metaMinutos: 60, metaQuestoes: 10, metaRevisoes: 1, metaMinutosDiaria: 60 };
  return {
    central: calcularCentralInteligencia(entrada),
    relatorio: gerarRelatorioInteligente(entrada),
    consolidado: calcularMetricasConsolidadas(entrada),
  };
}

test("Inteligência contabiliza uma atividade de 30 minutos uma vez no total e por matéria", () => {
  const { central, relatorio, consolidado } = calcular([questao], [sessao]);
  assert.equal(consolidado.minutos, 30);
  assert.equal(central.total.minutos, 30);
  assert.equal(central.materias[0].minutos, 30);
  assert.equal(relatorio.materias[0].minutos, 30);
  assert.equal(central.materias[0].total, 10);
});

test("deduplicação de minutos usa aliases exatos de matéria na central e no consolidado", () => {
  const { central, relatorio, consolidado } = calcular([questao], [{ ...sessao, materia: "Constitucional" }]);
  assert.equal(consolidado.minutos, 30);
  assert.equal(central.materias.length, 1);
  assert.equal(central.materias[0].minutos, 30);
  assert.equal(relatorio.materias[0].minutos, 30);
});

test("atividades em horários, assuntos ou tipos distintos continuam somando minutos", () => {
  for (const outraSessao of [
    { ...sessao, data: "2026-10-01T15:00:06.000Z" },
    { ...sessao, assunto: "Direitos sociais" },
    { ...sessao, tipo: "estudo" as const },
    { ...sessao, materia: "Direito Penal Militar" },
  ]) {
    const { central, consolidado } = calcular([questao], [outraSessao]);
    assert.equal(consolidado.minutos, 60);
    assert.equal(central.materias.reduce((soma, item) => soma + item.minutos, 0), 60);
  }
});

test("IDs diferentes de conteúdo impedem deduplicar atividades homônimas simultâneas", () => {
  for (const identificadores of [
    { materiaId: "outra-materia", assuntoId: "assunto" },
    { materiaId: "materia", assuntoId: "outro-assunto" },
    { materiaId: "materia", assuntoId: "assunto", moduloId: "outro-modulo" },
  ]) {
    const registro = { ...questao, materiaId: "materia", assuntoId: "assunto", moduloId: "modulo" };
    const { central, consolidado } = calcular([registro], [{ ...sessao, ...identificadores }]);
    assert.equal(consolidado.minutos, 60);
    assert.equal(central.materias.reduce((soma, item) => soma + item.minutos, 0), 60);
  }
});

test("IDs de conteúdo iguais deduplicam uma atividade apesar da renomeação do assunto", () => {
  const { central, consolidado } = calcular(
    [{ ...questao, materiaId: "materia", assuntoId: "assunto" }],
    [{ ...sessao, materiaId: "materia", assuntoId: "assunto", assunto: "Dos princípios fundamentais" }]
  );
  assert.equal(consolidado.minutos, 30);
  assert.equal(central.materias[0].minutos, 30);
});

test("registros sem nome de matéria conservam os minutos no grupo Sem matéria", () => {
  const { central, relatorio, consolidado } = calcular([{ ...questao, materia: "" }], []);
  assert.equal(consolidado.minutos, 30);
  assert.equal(central.materias[0].materia, "Sem matéria");
  assert.equal(central.materias[0].minutos, 30);
  assert.equal(relatorio.materias[0].minutos, 30);
});

test("o mesmo ID de matéria mantém uma única linha após renomeação fora dos aliases", () => {
  const { central, relatorio, consolidado } = calcular(
    [{ ...questao, materia: "Redação", materiaId: "m1", assuntoId: "a1" }],
    [{ ...sessao, materia: "Expressão Escrita", materiaId: "m1", assuntoId: "a1" }]
  );
  assert.equal(consolidado.minutos, 30);
  for (const materias of [central.materias, relatorio.materias]) {
    assert.equal(materias.length, 1);
    assert.equal(materias[0].minutos, 30);
  }
});

test("IDs de matéria conflitantes preservam linhas distintas mesmo com aliases iguais", () => {
  const { central, relatorio, consolidado } = calcular(
    [{ ...questao, materia: "Constitucional", materiaId: "m1" }],
    [{ ...sessao, materiaId: "m2" }]
  );
  assert.equal(consolidado.minutos, 60);
  for (const materias of [central.materias, relatorio.materias]) {
    assert.equal(materias.length, 2);
    assert.equal(new Set(materias.map(item => item.chave)).size, 2);
    assert.equal(materias.reduce((soma, item) => soma + item.minutos, 0), 60);
  }
});

test("nome legado sem ID só se vincula a matéria conhecida quando não há ambiguidade", () => {
  const univoco = calcular([questao], [{ ...sessao, materia: "Constitucional", materiaId: "m1" }]);
  assert.equal(univoco.central.materias.length, 1);
  assert.equal(univoco.central.materias[0].minutos, 30);

  const ambiguo = calcular([questao], [
    { ...sessao, materiaId: "m1" },
    { ...sessao, id: "outra-sessao", materiaId: "m2" },
  ]);
  assert.equal(ambiguo.consolidado.minutos, 90);
  for (const materias of [ambiguo.central.materias, ambiguo.relatorio.materias]) {
    assert.equal(materias.length, 3);
    assert.equal(materias.reduce((soma, item) => soma + item.minutos, 0), 90);
  }
});
