import assert from "node:assert/strict";
import test from "node:test";

import {
  diagnosticarRegressaoHistorico,
} from "../src/utils/sincronizacaoConflito";
import type { EstadoAppNuvem } from "../src/services/sincronizacaoService";

function estado(params: {
  sessoes: number;
  questoes: number;
  revisoes: number;
  simulados: number;
  missoes: number;
  reinicio?: string;
}): EstadoAppNuvem {
  return {
    schemaVersion: 18,
    versao: 18,
    materias: [],
    questoes: Array.from({ length: params.questoes }, () => ({})) as EstadoAppNuvem["questoes"],
    sessoes: Array.from({ length: params.sessoes }, () => ({})) as EstadoAppNuvem["sessoes"],
    revisoes: Array.from({ length: params.revisoes }, () => ({})) as EstadoAppNuvem["revisoes"],
    simulados: Array.from({ length: params.simulados }, () => ({})) as EstadoAppNuvem["simulados"],
    bancoQuestoes: [],
    simuladosGerados: [],
    configuracoes: {
      metaQuestoesDiaria: 30,
      metaMinutosDiaria: 120,
      metaRevisoesDiaria: 5,
      missoesPorDia: 1,
      ...(params.reinicio
        ? { dadosReiniciadosEm: params.reinicio }
        : {}),
    } as EstadoAppNuvem["configuracoes"],
    missoesConcluidas: Array.from(
      { length: params.missoes },
      (_, i) => `m-${i}`
    ),
    salvoEm: "2026-11-10T12:00:00.000Z",
    syncRevision: 10,
  };
}

test("bloqueia aparelho que tenta reduzir histórico cumulativo", () => {
  const nuvem = estado({
    sessoes: 315,
    questoes: 221,
    revisoes: 261,
    simulados: 11,
    missoes: 104,
  });
  const antigo = estado({
    sessoes: 298,
    questoes: 211,
    revisoes: 247,
    simulados: 9,
    missoes: 103,
  });

  const resultado = diagnosticarRegressaoHistorico(
    nuvem,
    antigo
  );

  assert.equal(resultado.bloqueada, true);
  assert.ok(resultado.perdas.some((item) => item.includes("sessões")));
  assert.ok(resultado.perdas.some((item) => item.includes("missões concluídas")));
});

test("permite histórico que cresce", () => {
  const nuvem = estado({
    sessoes: 315,
    questoes: 221,
    revisoes: 261,
    simulados: 11,
    missoes: 104,
  });
  const novo = estado({
    sessoes: 316,
    questoes: 222,
    revisoes: 261,
    simulados: 11,
    missoes: 105,
  });

  assert.equal(
    diagnosticarRegressaoHistorico(nuvem, novo).bloqueada,
    false
  );
});

test("reinício intencional da conta não é tratado como regressão", () => {
  const nuvem = estado({
    sessoes: 315,
    questoes: 221,
    revisoes: 261,
    simulados: 11,
    missoes: 104,
    reinicio: "2026-10-03T23:13:55.444Z",
  });
  const reiniciado = estado({
    sessoes: 0,
    questoes: 0,
    revisoes: 0,
    simulados: 0,
    missoes: 0,
    reinicio: "2026-11-10T12:00:00.000Z",
  });

  assert.equal(
    diagnosticarRegressaoHistorico(nuvem, reiniciado).bloqueada,
    false
  );
});
