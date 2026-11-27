import { chaveEvento } from "../conteudos/eventoAprendizagem";
import { comparar } from "./eventos";
import type { EntradaPlano, PlanoAdaptativo } from "./plano";

export type EscopoFsrs = { usuarioId: string; epoca: string };
export function chaveEscopoFsrs(escopo: EscopoFsrs) {
  if (!escopo.usuarioId.trim() || !escopo.epoca.trim()) throw new Error("Escopo FSRS inválido.");
  return JSON.stringify([escopo.usuarioId, escopo.epoca]);
}

export function jsonOrdenado(valor: unknown): string {
  return JSON.stringify(valor, (_chave, item: unknown) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return item;
    return Object.fromEntries(Object.entries(item).sort(([a], [b]) => comparar(a, b)));
  });
}

export function prepararCheckpoint(escopo: EscopoFsrs, entrada: EntradaPlano, plano: PlanoAdaptativo, revisaoLegado?: number) {
  chaveEscopoFsrs(escopo);
  if (revisaoLegado !== undefined && (!Number.isSafeInteger(revisaoLegado) || revisaoLegado < 0))
    throw new Error("Revisão legada inválida.");
  const observacoes = new Map<string, EntradaPlano["diario"]["observacoes"][number]>();
  for (const observacao of entrada.diario.observacoes) {
    if (observacao.evento.usuarioId !== escopo.usuarioId) throw new Error("Diário de outra conta.");
    // Preserva variantes conflitantes, inclusive quando têm a mesma chave de evento.
    observacoes.set(jsonOrdenado(observacao), observacao);
  }
  const diario = { ...entrada.diario, observacoes: [...observacoes].sort(([a], [b]) => comparar(a, b)).map(([, o]) => o) };
  const estados = [...plano.estadosMemoria.values()].sort((a, b) => comparar(a.unidadeId, b.unidadeId));
  if (estados.some(estado => estado.usuarioId !== escopo.usuarioId)) throw new Error("Estado de outra conta.");
  const agendamentos = plano.agenda.map(({ unidadeId, ideal, dueAt, agendada, agendadaEm, limite, minutos, horarioSugerido }) =>
    ({ unidadeId, ideal, dueAt, agendada, agendadaEm, limite, minutos, horarioSugerido })).sort((a, b) => comparar(a.unidadeId, b.unidadeId));
  return {
    esquema: 1 as const, escopo, revisaoLegado, diario,
    calculadoPara: plano.dias[0].dia,
    avaliados: estados.flatMap(estado => estado.historico.filter(item => item.log).map(({ chave }) => chave)),
    pendentes: [...new Set(plano.reconciliacao.pendentes.map(item => chaveEvento(item.observacao.evento)))].sort(comparar),
    estados, agendamentos,
  };
}

export type CheckpointFsrs = ReturnType<typeof prepararCheckpoint>;
export type RegistroFsrs = { revisao: number; assinatura: string; checkpoint: CheckpointFsrs };
type Resultado = { status: "gravado" | "repetido"; registro: RegistroFsrs } |
  { status: "conflito"; registro: RegistroFsrs | undefined };

/** O transporte deve comparar e gravar na mesma transação, autenticada para o escopo solicitado. */
export interface TransporteFsrs {
  ler(escopo: EscopoFsrs): Promise<RegistroFsrs | undefined>;
  confirmar(checkpoint: CheckpointFsrs, revisaoEsperada: number): Promise<Resultado>;
}

export function decidirGravacao(atual: RegistroFsrs | undefined, proposta: CheckpointFsrs, revisaoEsperada: number): Resultado {
  if (!Number.isSafeInteger(revisaoEsperada) || revisaoEsperada < 0) throw new Error("Revisão FSRS inválida.");
  if (atual && chaveEscopoFsrs(atual.checkpoint.escopo) !== chaveEscopoFsrs(proposta.escopo))
    throw new Error("Escopo de gravação incompatível.");
  const assinatura = jsonOrdenado(proposta);
  if (atual?.assinatura === assinatura) return { status: "repetido", registro: atual };
  const base = atual?.checkpoint.revisaoLegado;
  const originais = new Set(proposta.diario.observacoes.map(jsonOrdenado));
  const perdeuHistorico = atual?.checkpoint.diario.observacoes.some(o => !originais.has(jsonOrdenado(o)));
  if ((atual?.revisao ?? 0) !== revisaoEsperada || perdeuHistorico ||
      (atual && proposta.calculadoPara < atual.checkpoint.calculadoPara) ||
      (base !== undefined && (proposta.revisaoLegado === undefined || proposta.revisaoLegado < base)))
    return { status: "conflito", registro: atual };
  return { status: "gravado", registro: { revisao: revisaoEsperada + 1, assinatura, checkpoint: proposta } };
}
