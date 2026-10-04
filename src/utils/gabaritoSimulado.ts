import type { CorrecaoQuestaoSimulado } from "./analiseSimuladoStudyPro";

export type ItemMeuGabarito = {
  numero: number;
  resposta: string | null;
};

export function montarMeuGabarito(
  correcao: CorrecaoQuestaoSimulado[] | undefined
): ItemMeuGabarito[] {
  if (!Array.isArray(correcao)) return [];

  return correcao
    .map((item) => ({
      numero: item.numero,
      resposta:
        typeof item.respostaAluno === "string" &&
        item.respostaAluno.trim().length > 0
          ? item.respostaAluno.trim().toUpperCase()
          : null,
    }))
    .sort((a, b) => a.numero - b.numero);
}

export function formatarMeuGabaritoTexto(
  correcao: CorrecaoQuestaoSimulado[] | undefined
) {
  return montarMeuGabarito(correcao)
    .map(
      (item) =>
        `${item.numero}-${item.resposta ?? "—"}`
    )
    .join(", ");
}
