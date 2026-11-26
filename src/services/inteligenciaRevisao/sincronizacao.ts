import { jsonOrdenado, type CheckpointFsrs, type EscopoFsrs } from "./checkpoint";
import type { Observacao } from "./eventos";

export type EstadoCompartilhado = {
  revisao: number; revisaoEventos: number; revisaoLegado: number;
  eventos: Observacao[]; checkpoint: CheckpointFsrs | null;
};
export type FilaFsrs = { pendentes: Observacao[]; confirmado?: EstadoCompartilhado };
export type PropostaFsrs = { revisao: number; revisaoEventos: number; checkpoint: CheckpointFsrs };
export type RespostaFsrs = EstadoCompartilhado & { resultado: "ok" | "conflito" };
export interface DiarioCompartilhado {
  trocar(escopo: EscopoFsrs, lote: Observacao[], proposta?: PropostaFsrs): Promise<RespostaFsrs>;
}
export interface RepositorioFilaFsrs {
  ler(escopo: EscopoFsrs): Promise<FilaFsrs>;
  atualizar(escopo: EscopoFsrs, aplicar: (atual: FilaFsrs) => FilaFsrs): Promise<FilaFsrs>;
}
export const filaVazia = (): FilaFsrs => ({ pendentes: [] });

export function combinarObservacoes(...lotes: readonly Observacao[][]) {
  return [...new Map(lotes.flat().map(evento => [jsonOrdenado(evento), evento])).values()];
}

export async function enfileirar(repo: RepositorioFilaFsrs, escopo: EscopoFsrs, eventos: Observacao[]) {
  if (eventos.some(o => o.evento.usuarioId !== escopo.usuarioId)) throw new Error("Evento de outra conta.");
  return repo.atualizar(escopo, atual => {
    const confirmados = new Set(atual.confirmado?.eventos.map(jsonOrdenado));
    const pendentes = combinarObservacoes(atual.pendentes, eventos).filter(e => !confirmados.has(jsonOrdenado(e)));
    return { ...atual, pendentes };
  });
}

export async function sincronizarFsrs(repo: RepositorioFilaFsrs, transporte: DiarioCompartilhado, escopo: EscopoFsrs,
  proposta?: PropostaFsrs) {
  const { pendentes } = await repo.ler(escopo);
  const lote = pendentes.slice(0, 250);
  const resposta = await transporte.trocar(escopo, lote, proposta);
  if (resposta.eventos.some(o => o.evento.usuarioId !== escopo.usuarioId) ||
      (resposta.checkpoint && (resposta.checkpoint.escopo.usuarioId !== escopo.usuarioId ||
        resposta.checkpoint.escopo.epoca !== escopo.epoca))) throw new Error("Resposta FSRS de outro escopo.");
  const identificadores = new Set(resposta.eventos.map(jsonOrdenado));
  if (lote.some(evento => !identificadores.has(jsonOrdenado(evento)))) throw new Error("Lote FSRS sem confirmação integral.");
  const { resultado, ...confirmado } = resposta;
  const fila = await repo.atualizar(escopo, atual => {
    if (atual.confirmado && (atual.confirmado.revisao > confirmado.revisao || atual.confirmado.revisaoLegado > confirmado.revisaoLegado)) return atual;
    return { confirmado, pendentes: atual.pendentes.filter(evento => !identificadores.has(jsonOrdenado(evento))) };
  });
  return { fila, resultado };
}
