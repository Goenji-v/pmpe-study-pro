import type { SemanaPlano } from "../data/planoPMPE";

export type VinculoRedacaoPlano = {
  missaoId: string;
  semana: number;
  dia: number;
};

export function localizarMissaoRedacaoPendenteDoDia(
  plano: SemanaPlano[],
  concluidas: string[],
  semanaAtual: number,
  diaAtual: number
): VinculoRedacaoPlano | null {
  const concluidasSet = new Set(concluidas);
  const semana = plano.find((item) => item.numero === semanaAtual);
  const dia = semana?.dias.find((item) => item.numero === diaAtual);
  const missao = dia?.missoes.find(
    (item) => item.tipo === "redacao" && !concluidasSet.has(item.id)
  );

  if (!missao) return null;

  return {
    missaoId: missao.id,
    semana: semanaAtual,
    dia: diaAtual,
  };
}
