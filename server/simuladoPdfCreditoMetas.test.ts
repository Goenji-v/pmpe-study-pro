import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  criarCreditoSimuladoPdf,
  jaExisteCreditoSimuladoPdf,
} from "../src/utils/creditoSimuladoPdf.ts";
import { calcularMetricasConsolidadas } from "../src/utils/metricasConsolidadas.ts";
import { calcularSequenciaAtividades } from "../src/utils/sequenciaAtividades.ts";
import type { AnaliseSimuladoSalva } from "../src/services/analisesSimuladosService.ts";

function relatorio(): AnaliseSimuladoSalva {
  return {
    id: "relatorio-teste",
    origem: "pdf",
    tentativaId: "tentativa-20261018",
    simuladoId: "tentativa-20261018",
    nome: "SIMULADO 4",
    atualizadoEm: "2026-10-18T14:32:00.000Z",
    criadoEm: "2026-10-18T14:32:00.000Z",
    analise: {
      versao: 1,
      tentativaId: "tentativa-20261018",
      nome: "SIMULADO 4",
      data: "2026-10-18T11:47:05.960Z",
      resumo: {
        totalQuestoes: 60,
        totalValidas: 60,
        totalAcertos: 22,
        totalErros: 37,
        totalNaoRespondidas: 1,
      },
    },
  } as AnaliseSimuladoSalva;
}

test("simulado PDF recuperado soma 60 questões (22/37/1) e duas horas sem apagar branco", () => {
  const registro = relatorio();
  const credito = criarCreditoSimuladoPdf(registro, 121);
  assert.equal(credito.id, "pdf-tentativa-20261018");
  assert.equal(credito.tentativaId, registro.tentativaId);
  assert.equal(credito.data, registro.analise.data);
  assert.equal(credito.certas, 22);
  assert.equal(credito.erradas, 37);
  assert.equal(credito.emBranco, 1);
  assert.equal(credito.anuladas, 0);
  assert.equal(credito.minutos, 121);

  const metricas = calcularMetricasConsolidadas({
    questoes: [],
    sessoes: [],
    simulados: [credito],
    revisoes: [],
    inicio: new Date("2026-10-18T00:00:00Z"),
    fim: new Date("2026-10-18T23:59:59Z"),
  });
  assert.equal(metricas.questoes, 60);
  assert.equal(metricas.certas, 22);
  assert.equal(metricas.erradas, 37);
  assert.equal(metricas.emBranco, 1);
  assert.equal(metricas.minutos, 121);
  assert.equal(metricas.revisoesConcluidas, 0);
});

test("prova do dia anterior mantém sequência ao abrir no dia seguinte", () => {
  const credito = criarCreditoSimuladoPdf(relatorio(), 121);
  const sequencia = calcularSequenciaAtividades({
    sessoes: [],
    questoes: [],
    revisoes: [],
    simulados: [credito],
    agora: new Date("2026-10-19T09:00:00Z"),
  });
  assert.equal(sequencia.atual, 1);
});

test("segunda sincronização não duplica o simulado PDF", () => {
  const original = relatorio();
  const credito = criarCreditoSimuladoPdf(original, 121);
  assert.equal(jaExisteCreditoSimuladoPdf([], original), false);
  assert.equal(jaExisteCreditoSimuladoPdf([credito], original), true);
  assert.equal(jaExisteCreditoSimuladoPdf([{ ...credito, id: "outro" }], original), true);
});

test("recuperação recusa tempo inventado e relatório com totais inválidos", () => {
  assert.throws(() => criarCreditoSimuladoPdf(relatorio(), 0), /tempo efetivo/i);
  assert.throws(() => criarCreditoSimuladoPdf(relatorio(), 121.5), /tempo efetivo/i);
  const invalido = relatorio();
  invalido.analise.resumo.totalAcertos = 60;
  assert.throws(() => criarCreditoSimuladoPdf(invalido, 121), /totais incompatíveis/);
});

test("histórico exige ação explícita e guarda duração futura junto ao relatório", async () => {
  const [historico, prova, tipo] = await Promise.all([
    readFile("src/pages/Simulados/Simulados.tsx", "utf8"),
    readFile("src/pages/SimuladoPdf/SimuladoPdf.tsx", "utf8"),
    readFile("src/utils/analiseSimuladoStudyPro.ts", "utf8"),
  ]);
  assert.match(historico, /Contabilizar nas metas e sequência/);
  assert.match(historico, /jaExisteCreditoSimuladoPdf\(anteriores, registro\)/);
  assert.match(historico, /Confirmar lançamento da prova original/);
  assert.match(prova, /diagnostico\.duracaoMinutos = Math\.max\(1, Math\.ceil\(segundos \/ 60\)\)/);
  assert.match(tipo, /duracaoMinutos\?: number/);
});
