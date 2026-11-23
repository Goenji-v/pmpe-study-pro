import type { SemanaPlano } from "../data/planoPMPE";

export type VinculoRedacaoPlano = {
  missaoId: string;
  semana: number;
  dia: number;
};

export type SituacaoRedacaoPlano =
  | { status: "pendente"; vinculo: VinculoRedacaoPlano }
  | { status: "concluida"; vinculo: VinculoRedacaoPlano }
  | { status: "sem_missao"; vinculo: null };

/**
 * The session must be linked to the EXACT visible operational mission.
 * A completed Sunday mission cannot be credited again by an unrelated
 * writing exercise; this also prevents a stale draft from relinking it.
 */
export function obterSituacaoRedacaoDoDia(
  plano: SemanaPlano[],
  concluidas: readonly string[],
  semanaAtual: number,
  diaAtual: number
): SituacaoRedacaoPlano {
  const semana = plano.find((item) => item.numero === semanaAtual);
  const dia = semana?.dias.find((item) => item.numero === diaAtual);
  const missao = dia?.missoes.find((item) => item.tipo === "redacao");
  if (!missao) return { status: "sem_missao", vinculo: null };

  const vinculo = { missaoId: missao.id, semana: semanaAtual, dia: diaAtual };
  if (concluidas.includes(missao.id)) {
    return { status: "concluida", vinculo };
  }

  return { status: "pendente", vinculo };
}

export function localizarMissaoRedacaoPendenteDoDia(
  plano: SemanaPlano[],
  concluidas: string[],
  semanaAtual: number,
  diaAtual: number
): VinculoRedacaoPlano | null {
  const situacao = obterSituacaoRedacaoDoDia(
    plano, concluidas, semanaAtual, diaAtual
  );
  return situacao.status === "pendente" ? situacao.vinculo : null;
}

