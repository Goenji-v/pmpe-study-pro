import assert from "node:assert/strict";
import test from "node:test";

import { calcularMetricasConsolidadas } from "../src/utils/metricasConsolidadas.ts";

test("métricas globais usam aproveitamento ponderado e removem espelho de simulado IA", () => {
  const data = "2026-09-18T12:00:00.000Z";

  const metricas = calcularMetricasConsolidadas({
    questoes: [
      {
        id: "avulsa",
        materia: "Português",
        assunto: "Crase",
        banca: "Instituto AOCP",
        certas: 6,
        erradas: 4,
        minutos: 20,
        data,
      },
      {
        id: "espelho-simulado",
        materia: "Direito",
        assunto: "Direitos Humanos",
        banca: "AOCP",
        certas: 8,
        erradas: 1,
        emBranco: 1,
        minutos: 0,
        data,
        origem: "simulado-ia",
        tentativaId: "tentativa-ia-1",
      },
    ] as any,
    sessoes: [
      {
        id: "sessao-avulsa",
        tipo: "questoes",
        materia: "Português",
        assunto: "Crase",
        minutos: 20,
        data,
      },
    ] as any,
    simulados: [
      {
        id: "simulado-1",
        tentativaId: "tentativa-ia-1",
        nome: "Simulado IA",
        banca: "Instituto AOCP",
        certas: 8,
        erradas: 1,
        emBranco: 1,
        anuladas: 2,
        totalQuestoes: 12,
        minutos: 30,
        data,
        origem: "ia",
      },
    ] as any,
    revisoes: [
      {
        id: "revisao-1",
        materia: "Português",
        assunto: "Crase",
        etapa: 2,
        dataCriacao: data,
        dataPrevista: data,
        concluida: true,
        dataConclusao: data,
      },
    ] as any,
  });

  assert.equal(metricas.questoes, 22);
  assert.equal(metricas.certas, 14);
  assert.equal(metricas.erradas, 5);
  assert.equal(metricas.emBranco, 1);
  assert.equal(metricas.anuladas, 2);
  assert.equal(metricas.aproveitamento, 70);
  assert.equal(metricas.minutos, 50);
  assert.equal(metricas.revisoesConcluidas, 1);
  assert.equal(metricas.simulados, 1);
  assert.equal(metricas.diasAtivos, 1);
});
