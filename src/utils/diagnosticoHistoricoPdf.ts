import type {
  AnaliseAssuntoSimulado,
  CorrecaoQuestaoSimulado,
  StatusQuestaoAnaliseSimulado,
} from "./analiseSimuladoStudyPro";

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Usa a mesma chave matéria + módulo + assunto do diagnóstico original.
 * O subassunto pode mudar entre questões sem dividir artificialmente o assunto.
 */
export function questoesDoAssuntoSalvo(
  correcao: CorrecaoQuestaoSimulado[],
  assunto: Pick<AnaliseAssuntoSimulado, "chave">
) {
  return correcao
    .filter(
      (item) =>
        item.status !== "anulada" &&
        normalizar(
          [item.materia, item.modulo || "Geral", item.assunto].join("::")
        ) === assunto.chave
    )
    .sort((a, b) => a.numero - b.numero);
}

export function rotuloStatusQuestaoSalva(status: StatusQuestaoAnaliseSimulado) {
  switch (status) {
    case "acerto":
      return "Acerto";
    case "acerto_chute":
      return "Acerto por chute";
    case "erro":
      return "Erro";
    case "nao_respondida":
      return "Em branco";
    case "nao_estudado":
      return "Não estudada";
    case "anulada":
      return "Anulada";
  }
}
