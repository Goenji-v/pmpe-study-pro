import { DefaultScheduler, Rating, type DefaultSchedulerCard, type DefaultSchedulerRevlog } from "ts-fsrs";
import { avaliar, type Avaliacao } from "./avaliacao";
import { reconciliar, type Observacao } from "./eventos";
import type { Materia } from "../../types";

export const versaoMemoria = "ts-fsrs@6.0.0/FSRS-7/v1";
export type DiarioMemoria = { versao: typeof versaoMemoria; retencao: number; observacoes: Observacao[] };
export type EstadoMemoria = {
  usuarioId: string;
  unidadeId: string;
  primeiraAprendizagem?: string;
  cartao?: DefaultSchedulerCard;
  historico: Array<{ chave: string; ocorridoEm: string; avaliacao: Avaliacao; log?: DefaultSchedulerRevlog; motivoSemAtualizacao?: string }>;
};
export type MotorMemoria = Awaited<ReturnType<typeof carregarMemoria>>;

export async function carregarMemoria(materias: readonly Materia[], diario: DiarioMemoria, agora: Date) {
  if (diario.versao !== versaoMemoria || !Number.isFinite(+agora) ||
      !Number.isFinite(diario.retencao) || diario.retencao < 0.7 || diario.retencao > 0.97) {
    throw new Error("Versão, retenção ou relógio incompatível.");
  }
  const scheduler = await DefaultScheduler({
    version: "FSRS-7", desiredRetention: diario.retencao, enableFuzz: false, enableShortTerm: false,
  });
  const reconciliacao = reconciliar(materias, diario.observacoes);
  const estados = new Map<string, EstadoMemoria>();
  const ultimasNotas = new Map<string, number[]>();
  for (const item of reconciliacao.aceitos) {
    const { evento, unidadeId, chave, evidencia } = item;
    const realizado = new Date(evento.ocorridoEm);
    if (realizado > agora) {
      reconciliacao.pendentes.push({ observacao: item, motivo: "Ocorrência futura" });
      continue;
    }
    const id = JSON.stringify([evento.usuarioId, unidadeId]);
    const estado = estados.get(id) ?? {
      usuarioId: evento.usuarioId, unidadeId, historico: [],
    };
    const recentes = ultimasNotas.get(id) ?? [];
    const avaliacao = avaliar(evidencia, recentes);
    if (evidencia.modo === "passivo" || avaliacao.nota)
      estado.primeiraAprendizagem ??= evento.ocorridoEm;
    let log: DefaultSchedulerRevlog | undefined;
    if (avaliacao.nota && (!estado.cartao?.lastReviewAt || realizado > estado.cartao.lastReviewAt)) {
      const resultado = scheduler.review({
        card: estado.cartao ?? scheduler.newCard({ now: realizado, cardId: id }), grade: Rating[avaliacao.nota], now: realizado,
      });
      estado.cartao = resultado.card;
      log = resultado.revlog;
      if (avaliacao.percentual !== undefined) ultimasNotas.set(id, [...recentes, avaliacao.percentual].slice(-3));
    }
    estado.historico.push({ chave, ocorridoEm: evento.ocorridoEm, avaliacao, log,
      motivoSemAtualizacao: avaliacao.nota && !log ? "Já existe uma avaliação desta unidade no mesmo instante." : undefined });
    estados.set(id, estado);
  }

  return {
    estados, reconciliacao,
    recuperar(estado: EstadoMemoria) {
      const cartao = estado.cartao;
      if (!cartao?.lastReviewAt) return undefined;
      return scheduler.model.forgettingCurve(cartao, scheduler.chrono.difference(cartao.lastReviewAt, agora));
    },
    estimarSeguinte(estado: EstadoMemoria, data: Date) {
      const cartao = estado.cartao ?? scheduler.newCard({ now: data, cardId: JSON.stringify([estado.usuarioId, estado.unidadeId]) });
      return scheduler.review({ card: cartao, grade: Rating.Good, now: data }).card.dueAt;
    },
  };
}
