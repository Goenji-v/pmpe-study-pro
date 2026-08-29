import assert from "node:assert/strict";
import test from "node:test";

import type { EstadoAppNuvem } from "../src/services/sincronizacaoService.ts";
import {
  limparEstadoPendenteSincronizacao,
  obterEstadoPendenteSincronizacao,
  registrarEstadoPendenteSincronizacao,
} from "../src/services/seguranca/protecaoSincronizacaoService.ts";

class StorageComCota {
  private dados = new Map<string, string>();

  constructor(private limite: number) {}

  get length() {
    return this.dados.size;
  }

  key(indice: number) {
    return [...this.dados.keys()][indice] ?? null;
  }

  getItem(chave: string) {
    return this.dados.get(chave) ?? null;
  }

  setItem(chave: string, valor: string) {
    const anterior = this.dados.get(chave) ?? "";
    const totalAtual = [...this.dados.entries()].reduce(
      (total, [itemChave, itemValor]) => total + itemChave.length + itemValor.length,
      0
    );
    const proximoTotal = totalAtual - chave.length - anterior.length + chave.length + valor.length;

    if (proximoTotal > this.limite) {
      const erro = new Error("exceeded the quota");
      erro.name = "QuotaExceededError";
      throw erro;
    }

    this.dados.set(chave, valor);
  }

  removeItem(chave: string) {
    this.dados.delete(chave);
  }

  clear() {
    this.dados.clear();
  }

  preload(chave: string, valor: string) {
    this.dados.set(chave, valor);
  }
}

function instalarWindow(localStorage: StorageComCota, sessionStorage: StorageComCota) {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      localStorage,
      sessionStorage,
      dispatchEvent: () => true,
    },
  });
}

function removerWindow() {
  Reflect.deleteProperty(globalThis, "window");
}

function estadoGrande(): EstadoAppNuvem {
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
      metaQuestoesDiaria: 30,
      metaMinutosDiaria: 120,
      metaRevisoesDiaria: 2,
      tema: "escuro",
      observacao: "x".repeat(450),
    } as EstadoAppNuvem["configuracoes"],
    missoesConcluidas: [],
    salvoEm: "2026-08-28T20:00:00.000Z",
    syncRevision: 3,
  };
}

test("libera backups automáticos antigos antes de falhar por cota do localStorage", () => {
  const usuarioId = "usuario-quota";
  const local = new StorageComCota(1800);
  const sessao = new StorageComCota(5000);
  instalarWindow(local, sessao);

  const chaveBackups = `pmpe:seguranca:backups-automaticos:${usuarioId}`;
  const backups = [1, 2, 3].map((indice) => ({
    id: `b${indice}`,
    usuarioId,
    criadoEm: `2026-08-2${indice}T20:00:00.000Z`,
    motivo: "antes_rollback",
    schemaVersionOrigem: 18,
    schemaVersionDestino: 18,
    checksum: String(indice),
    dados: { carga: "y".repeat(350) },
  }));
  local.preload(chaveBackups, JSON.stringify(backups));

  const pendente = registrarEstadoPendenteSincronizacao(
    usuarioId,
    estadoGrande(),
    3
  );

  assert.equal(pendente.usuarioId, usuarioId);
  assert.ok(local.getItem(`pmpe:seguranca:sync-pendente:${usuarioId}`));
  assert.equal(sessao.getItem(`pmpe:seguranca:sync-pendente:${usuarioId}`), null);

  const backupsRestantes = JSON.parse(local.getItem(chaveBackups) ?? "[]") as unknown[];
  assert.ok(backupsRestantes.length <= 1);

  removerWindow();
});

test("usa sessionStorage como última defesa quando o snapshot não cabe no localStorage", () => {
  const usuarioId = "usuario-session";
  const local = new StorageComCota(120);
  const sessao = new StorageComCota(5000);
  instalarWindow(local, sessao);

  registrarEstadoPendenteSincronizacao(
    usuarioId,
    estadoGrande(),
    4
  );

  const chave = `pmpe:seguranca:sync-pendente:${usuarioId}`;
  assert.equal(local.getItem(chave), null);
  assert.ok(sessao.getItem(chave));
  assert.equal(obterEstadoPendenteSincronizacao(usuarioId)?.baseRevision, 4);

  limparEstadoPendenteSincronizacao(usuarioId);
  assert.equal(sessao.getItem(chave), null);

  removerWindow();
});
