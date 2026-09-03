import type { ConfiguracoesApp } from "../types/index";
import { lerTextoLocalProtegido, removerTextoLocalProtegido, salvarTextoComRecuperacaoDeCota } from "./seguranca/protecaoSincronizacaoService";

type Escopo = { usuarioId: string; isolado: boolean; reinicio: string };
let escopo: Escopo | null = null;

export function criarEscopoArmazenamento(usuarioId: string, config: Pick<ConfiguracoesApp, "armazenamentoPorConta" | "dadosReiniciadosEm">): Escopo {
  return { usuarioId, isolado: config.armazenamentoPorConta === true || Boolean(config.dadosReiniciadosEm), reinicio: config.dadosReiniciadosEm ?? "" };
}

export function chaveArmazenamentoConta(chave: string, conta: Escopo) {
  // As contas antigas conservam seus caches. Caches legados sem proprietário
  // nunca são atribuídos automaticamente a uma conta nova ou reiniciada.
  if (!conta.isolado) return chave;
  return `pmpe:${conta.usuarioId}:privado:${conta.reinicio || "inicial"}:${chave}`;
}

export function definirEscopoArmazenamento(conta: Escopo | null) { escopo = conta; }
export function obterEscopoArmazenamento() { return escopo; }
export function permiteMigracaoLegada() { return escopo !== null && !escopo.isolado; }

function armazenamento(tipo: "local" | "sessao") {
  return {
    getItem(chave: string): string | null {
      if (!escopo) return null;
      const key = chaveArmazenamentoConta(chave, escopo);
      if (tipo === "local") return lerTextoLocalProtegido(key);
      try { return window.sessionStorage.getItem(key); } catch { return null; }
    },
    setItem(chave: string, valor: string) {
      if (!escopo) return;
      const key = chaveArmazenamentoConta(chave, escopo);
      if (tipo === "local") salvarTextoComRecuperacaoDeCota(escopo.usuarioId, key, valor);
      else window.sessionStorage.setItem(key, valor);
    },
    removeItem(chave: string) {
      if (!escopo) return;
      const key = chaveArmazenamentoConta(chave, escopo);
      if (tipo === "local") removerTextoLocalProtegido(key);
      else { try { window.sessionStorage.removeItem(key); } catch { /* Sem cache acessível. */ } }
    },
  };
}

export const armazenamentoLocalDaConta = armazenamento("local");
export const armazenamentoSessaoDaConta = armazenamento("sessao");
