import assert from "node:assert/strict";
import test from "node:test";
import { act, createElement, useEffect, type Dispatch, type SetStateAction } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { useLocalStorage } from "../src/hooks/useLocalStorage.ts";

import type { EstadoAppNuvem } from "../src/services/sincronizacaoService.ts";
import {
  limparEstadoPendenteSincronizacao,
  obterEstadoPendenteSincronizacao,
  registrarEstadoPendenteSincronizacao,
  registrarTentativaPendente,
  registrarSincronizacaoConfirmada,
  obterMetadadosSincronizacaoLocal,
  lerTextoLocalProtegido,
  salvarTextoComRecuperacaoDeCota,
  obterEstadoArmazenamentoLocal,
  observarArmazenamentoLocal,
  repetirGravacoesLocais,
} from "../src/services/seguranca/protecaoSincronizacaoService.ts";

class StorageComCota {
  private dados = new Map<string, string>();

  constructor(public limite: number) {}

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
    const proximoTotal = totalAtual - (this.dados.has(chave) ? chave.length + anterior.length : 0) + chave.length + valor.length;

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

test("configurações usam a recuperação de cota sem alterar outros dados ou contas", t => {
  const uid = "config-quota";
  const local = new StorageComCota(1700);
  instalarWindow(local, new StorageComCota(5000));
  t.after(removerWindow);
  const protegidos = ["pmpe:outra-conta:materias", `pmpe:seguranca:sync-pendente:${uid}`, `pmpe:${uid}:questoes`];
  for (const chave of protegidos) local.preload(chave, "conteudo-original");
  local.preload(`pmpe:seguranca:backups-automaticos:${uid}`, JSON.stringify([1, 2, 3].map(i => ({
    id: `b${i}`, criadoEm: `2026-09-0${i}`, dados: "x".repeat(500),
  }))));
  const chave = `pmpe:${uid}:configuracoes`;
  const valor = JSON.stringify({ cursos: [{ nome: "Português", notas: "y".repeat(500) }] });
  assert.equal(salvarTextoComRecuperacaoDeCota(uid, chave, valor), "local");
  assert.equal(lerTextoLocalProtegido(chave), valor);
  assert.equal(obterEstadoArmazenamentoLocal(uid), "local");
  for (const protegida of protegidos) assert.equal(local.getItem(protegida), "conteudo-original");
});

test("recupera da sessão o valor mais recente após remontar a tela", t => {
  const uid = "config-session";
  const local = new StorageComCota(80);
  const sessao = new StorageComCota(5000);
  instalarWindow(local, sessao);
  t.after(removerWindow);
  const chave = `pmpe:${uid}:configuracoes`;
  local.preload(chave, '{"antigo":true}');
  const valor = JSON.stringify({ notas: "novo".repeat(100) });
  assert.equal(salvarTextoComRecuperacaoDeCota(uid, chave, valor), "sessao");
  assert.equal(lerTextoLocalProtegido(chave), valor);
  // Simula uma cópia local antiga que não pôde ser removida.
  local.preload(chave, '{"antigo":true}');
  assert.equal(lerTextoLocalProtegido(chave), valor);
  assert.equal(obterEstadoArmazenamentoLocal(uid), "sessao");
  assert.equal(obterEstadoArmazenamentoLocal("outra-conta"), "local");
});

test("cota esgotada nos dois storages preserva a fila em memória e sua revisão-base", t => {
  const uid = "fila-memoria";
  instalarWindow(new StorageComCota(0), new StorageComCota(0));
  t.after(removerWindow);
  const estado = estadoGrande();
  assert.doesNotThrow(() => registrarEstadoPendenteSincronizacao(uid, estado, 12));
  registrarEstadoPendenteSincronizacao(uid, { ...estado, questoes: [] }, 99);
  registrarTentativaPendente(uid);
  const fila = obterEstadoPendenteSincronizacao(uid);
  assert.equal(fila?.baseRevision, 12);
  assert.equal(fila?.tentativas, 1);
  assert.deepEqual(fila?.estado, estado);
  assert.equal(obterEstadoArmazenamentoLocal(uid), "memoria");
  limparEstadoPendenteSincronizacao(uid);
  assert.equal(obterEstadoPendenteSincronizacao(uid), null);
  assert.equal(obterEstadoArmazenamentoLocal(uid), "local");
});

test("confirmar sincronização não lança erro por cota nem perde a revisão confirmada", t => {
  const uid = "meta-memoria";
  const local = new StorageComCota(0);
  instalarWindow(local, new StorageComCota(0));
  t.after(removerWindow);
  registrarSincronizacaoConfirmada(uid, { ...estadoGrande(), syncRevision: 675 });
  assert.equal(obterMetadadosSincronizacaoLocal(uid).ultimaRevisaoConfirmada, 675);
  local.limite = 2000;
  repetirGravacoesLocais(uid);
  assert.equal(obterEstadoArmazenamentoLocal(uid), "local");
  assert.equal(obterMetadadosSincronizacaoLocal(uid).ultimaRevisaoConfirmada, 675);
});

test("recupera memória e sessão para armazenamento persistente sem regravar dados antigos", t => {
  const uid = "retentativa-cache";
  const local = new StorageComCota(0);
  const sessao = new StorageComCota(0);
  instalarWindow(local, sessao);
  t.after(removerWindow);
  const chave = `pmpe:${uid}:configuracoes`;
  let notificacoes = 0;
  const desinscrever = observarArmazenamentoLocal(() => { notificacoes++; });
  t.after(desinscrever);
  assert.equal(salvarTextoComRecuperacaoDeCota(uid, chave, "v1"), "memoria");
  assert.equal(salvarTextoComRecuperacaoDeCota(uid, chave, "v2"), "memoria");
  assert.equal(notificacoes, 1);
  sessao.limite = 1000;
  repetirGravacoesLocais(uid);
  assert.equal(sessao.getItem(chave), "v2");
  assert.equal(obterEstadoArmazenamentoLocal(uid), "sessao");
  local.limite = 1000;
  repetirGravacoesLocais(uid);
  assert.equal(local.getItem(chave), "v2");
  assert.equal(sessao.getItem(chave), null);
  assert.equal(lerTextoLocalProtegido(chave), "v2");
  assert.equal(obterEstadoArmazenamentoLocal(uid), "local");
  assert.equal(notificacoes, 3);
});

test("acesso bloqueado ao storage não derruba a leitura nem a gravação protegida", t => {
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    get localStorage() { throw new DOMException("blocked", "SecurityError"); },
    get sessionStorage() { throw new DOMException("blocked", "SecurityError"); },
  } });
  t.after(removerWindow);
  assert.equal(lerTextoLocalProtegido("pmpe:bloqueado:configuracoes"), null);
  assert.equal(salvarTextoComRecuperacaoDeCota("bloqueado", "pmpe:bloqueado:configuracoes", "novo"), "memoria");
  assert.equal(lerTextoLocalProtegido("pmpe:bloqueado:configuracoes"), "novo");
});

test("hook React não desmonta a tela ao atualizar configurações com armazenamento cheio", async t => {
  const uid = "react-quota";
  const local = new StorageComCota(0);
  const sessao = new StorageComCota(0);
  const { document } = parseHTML("<html><body><main id='root'></main></body></html>");
  instalarWindow(local, sessao);
  Object.defineProperty(globalThis, "document", { configurable: true, value: document });
  Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", { configurable: true, value: true });
  t.after(() => {
    removerWindow();
    Reflect.deleteProperty(globalThis, "document");
    Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  });
  const erros: unknown[] = [];
  let alterar: Dispatch<SetStateAction<{ nota: string }>>;
  function Tela() {
    const [valor, setValor] = useLocalStorage(`pmpe:${uid}:configuracoes`, { nota: "original" });
    useEffect(() => { alterar = setValor; }, [setValor]);
    return createElement("output", null, valor.nota);
  }
  const container = document.getElementById("root")!;
  let root = createRoot(container, { onUncaughtError: error => { erros.push(error); } });
  await act(() => root.render(createElement(Tela)));
  await act(() => alterar({ nota: "anotação preservada" }));
  assert.equal(container.textContent, "anotação preservada");
  assert.deepEqual(erros, []);
  assert.equal(obterEstadoArmazenamentoLocal(uid), "memoria");
  await act(() => root.unmount());
  root = createRoot(container, { onUncaughtError: error => { erros.push(error); } });
  await act(() => root.render(createElement(Tela)));
  assert.equal(container.textContent, "anotação preservada");
  local.limite = 1000;
  repetirGravacoesLocais(uid);
  assert.deepEqual(JSON.parse(local.getItem(`pmpe:${uid}:configuracoes`)!), { nota: "anotação preservada" });
  await act(() => root.unmount());
});
