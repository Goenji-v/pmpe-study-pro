import type { Revisao } from "../types";

/**
 * Desativa apenas revisões com origem identificável de simulado.
 * Não usa nomes de matérias como heurística: isso poderia ocultar uma revisão legítima.
 * Registros antigos permanecem no armazenamento/sincronização, mas fora da agenda.
 */
export function revisaoOriginadaDeSimulado(revisao: Revisao): boolean {
  return Boolean(revisao.origemSimulado) || revisao.id.startsWith("ia-");
}

export function filtrarRevisoesRegulares(revisoes: Revisao[]): Revisao[] {
  return revisoes.some(revisaoOriginadaDeSimulado)
    ? revisoes.filter((item) => !revisaoOriginadaDeSimulado(item))
    : revisoes;
}

/** Mantém revisões desativadas intocadas ao editar apenas a agenda regular. */
export function mesclarRevisoesRegulares(
  anteriores: Revisao[],
  atualizadas: Revisao[]
): Revisao[] {
  const regulares = filtrarRevisoesRegulares(anteriores);
  if (regulares.length === atualizadas.length && regulares.every((item, i) => item === atualizadas[i])) return anteriores;

  const atualizadasPorId = new Map(atualizadas.map((item) => [item.id, item]));
  const idsAnteriores = new Set(regulares.map((item) => item.id));
  const existentes = anteriores.flatMap((item) => {
    if (revisaoOriginadaDeSimulado(item)) return [item];
    const alterada = atualizadasPorId.get(item.id);
    return alterada ? [alterada] : [];
  });
  const novas = atualizadas.filter(
    (item) => !idsAnteriores.has(item.id) && !revisaoOriginadaDeSimulado(item)
  );
  return [...novas, ...existentes];
}
