import type { AnaliseSimuladoSalva } from "../services/analisesSimuladosService";
import type { Simulado } from "../types";

/** A análise é um relatório; a atividade das metas precisa do registro Simulado.
 * Usa o ID da tentativa original para não contar a mesma prova duas vezes.
 */
export function jaExisteCreditoSimuladoPdf(
  existentes: Simulado[],
  analise: Pick<AnaliseSimuladoSalva, "tentativaId" | "simuladoId">
): boolean {
  return existentes.some((item) =>
    item.id === `pdf-${analise.tentativaId}` ||
    item.tentativaId === analise.tentativaId ||
    (Boolean(analise.simuladoId) &&
      item.id === analise.simuladoId &&
      item.observacao?.includes("PDF") === true)
  );
}

export function criarCreditoSimuladoPdf(
  analise: AnaliseSimuladoSalva,
  minutos: number
): Simulado {
  if (analise.origem !== "pdf" || !analise.tentativaId) {
    throw new Error("O relatório não pertence a uma tentativa PDF.");
  }

  const resumo = analise.analise.resumo;
  const { totalQuestoes, totalAcertos, totalErros, totalNaoRespondidas } = resumo;
  if (![totalQuestoes, totalAcertos, totalErros, totalNaoRespondidas].every(
    (valor) => Number.isInteger(valor) && valor >= 0
  ) || totalQuestoes < 1 || totalAcertos + totalErros + totalNaoRespondidas > totalQuestoes) {
    throw new Error("O relatório possui totais incompatíveis.");
  }

  if (!Number.isInteger(minutos) || minutos < 1 || minutos > 1440) {
    throw new Error("Informe o tempo efetivo da prova entre 1 e 1440 minutos.");
  }

  const data = analise.analise.data;
  if (!Number.isFinite(Date.parse(data)) ||
      Date.parse(data) > Date.now() + 60_000) {
    throw new Error("A data da tentativa original não é válida.");
  }

  return {
    id: `pdf-${analise.tentativaId}`,
    tentativaId: analise.tentativaId,
    nome: analise.nome,
    banca: "PDF Study Pro",
    certas: totalAcertos,
    erradas: totalErros,
    emBranco: totalNaoRespondidas,
    anuladas: totalQuestoes - totalAcertos - totalErros - totalNaoRespondidas,
    totalQuestoes,
    minutos,
    data,
    observacao: "Atividade recuperada do relatório original do Simulado PDF (sem duplicar a tentativa).",
  };
}
