import type { AnaliseSimuladoPdf } from "../services/simuladoPdfAnaliseService";

/** Gabaritos de baixa confiança e questões anuladas nunca viram erros.
 * Em branco é uma categoria separada do erro respondido.
 */
export function contarResultadoSimuladoPdf(
  analise: Pick<AnaliseSimuladoPdf, "totalQuestoes" | "questoes">,
  respostas: Record<string, string | undefined>
) {
  const validas = analise.questoes.filter(
    (item) =>
      item.status === "valida" &&
      Boolean(item.gabarito) &&
      item.confianca >= 50
  );
  const certas = validas.filter(
    (item) => respostas[String(item.numero)] === item.gabarito
  ).length;
  const emBranco = validas.filter(
    (item) => !respostas[String(item.numero)]
  ).length;

  return {
    certas,
    erradas: validas.length - certas - emBranco,
    emBranco,
    anuladas: Math.max(0, analise.totalQuestoes - validas.length),
    totalQuestoes: analise.totalQuestoes,
  };
}
