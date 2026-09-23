import assert from "node:assert/strict";
import test from "node:test";
import type { EstadoAppNuvem } from "../src/services/sincronizacaoService.ts";
import {
  assinaturaConteudoSincronizacao,
  estadosEquivalentesParaSincronizacao,
} from "../src/utils/sincronizacaoConflito.ts";

function estado(): EstadoAppNuvem {
  return {
    schemaVersion: 18,
    versao: 18,
    materias: [],
    questoes: [],
    sessoes: [],
    revisoes: [],
    simulados: [],
    bancoQuestoes: [],
    simuladosGerados: [],
    configuracoes: {
      nomeUsuario: "Teste",
      concurso: "PMPE",
      bancaPadrao: "AOCP",
      metaQuestoesDiaria: 20,
      metaMinutosDiaria: 120,
      metaRevisoesDiaria: 1,
      tema: "escuro",
    } as EstadoAppNuvem["configuracoes"],
    missoesConcluidas: ["s1-d1-m1"],
    salvoEm: "2026-09-23T08:00:00.000Z",
    atualizadoEm: "2026-09-23T08:00:00.000Z",
    syncRevision: 10,
  };
}

test("ignora apenas metadados de sincronização ao comparar estados", () => {
  const a = estado();
  const b = {
    ...estado(),
    salvoEm: "2026-09-23T09:00:00.000Z",
    atualizadoEm: "2026-09-23T09:00:00.000Z",
    syncRevision: 99,
  };

  assert.equal(estadosEquivalentesParaSincronizacao(a, b), true);
  assert.equal(
    assinaturaConteudoSincronizacao(a),
    assinaturaConteudoSincronizacao(b)
  );
});

test("não trata perda de progresso como conflito equivalente", () => {
  const a = estado();
  const b = {
    ...estado(),
    missoesConcluidas: [],
    syncRevision: 11,
  };

  assert.equal(estadosEquivalentesParaSincronizacao(a, b), false);
});

test("não trata sessão nova como metadado descartável", () => {
  const a = estado();
  const b = {
    ...estado(),
    sessoes: [{
      id: "sessao-1",
      data: "2026-09-23T09:20:00.000Z",
      tipo: "aula",
      materia: "Constitucional",
      assunto: "Direitos sociais",
      minutos: 45,
    }],
  };

  assert.equal(estadosEquivalentesParaSincronizacao(a, b), false);
});
