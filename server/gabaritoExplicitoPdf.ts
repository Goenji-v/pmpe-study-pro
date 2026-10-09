/**
 * Valida uma transcrição de GABARITO explicitamente impresso no caderno.
 * Não resolve questões e jamais preenche números ausentes por inferência.
 * A origem deve informar uma seção de gabarito; respostas isoladas entre
 * os enunciados não satisfazem esse requisito.
 */
export type ItemGabaritoDocumento = {
  numero: number;
  resposta: string;
  anulada: boolean;
  confianca: number;
};

export function validarGabaritoExplicitoDoCaderno(
  respostaIa: unknown,
  totalQuestoes: number
): ItemGabaritoDocumento[] {
  if (
    !Number.isInteger(totalQuestoes) ||
    totalQuestoes < 1 ||
    totalQuestoes > 200 ||
    !respostaIa ||
    typeof respostaIa !== "object" ||
    Array.isArray(respostaIa)
  ) return [];

  const raiz = respostaIa as Record<string, unknown>;
  if (
    raiz.secaoGabaritoEncontrada !== true ||
    typeof raiz.cabecalho !== "string" ||
    !/gabarito/i.test(raiz.cabecalho) ||
    !Array.isArray(raiz.itens)
  ) return [];

  const porNumero = new Map<number, ItemGabaritoDocumento>();
  const conflitos = new Set<number>();

  for (const bruto of raiz.itens) {
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) continue;
    const item = bruto as Record<string, unknown>;
    const numero = Number(item.numero);
    const anulada = item.anulada === true;
    const resposta = String(item.resposta ?? "").trim().toUpperCase();
    if (
      !Number.isInteger(numero) ||
      numero < 1 ||
      numero > totalQuestoes ||
      (!anulada && !/^[A-E]$/.test(resposta)) ||
      (anulada && resposta !== "")
    ) continue;

    const candidato = {
      numero,
      resposta: anulada ? "" : resposta,
      anulada,
      confianca: 90,
    };
    const anterior = porNumero.get(numero);
    if (
      anterior &&
      (anterior.resposta !== candidato.resposta ||
        anterior.anulada !== candidato.anulada)
    ) {
      conflitos.add(numero);
    } else {
      porNumero.set(numero, candidato);
    }
  }

  // Uma prova pode ter respostas isoladas nos enunciados (ex.: Q32).
  // Só confiar em um QUADRO quase completo, e jamais em um conjunto
  // de letras dispersas interpretadas pela IA.
  for (const numero of conflitos) porNumero.delete(numero);
  const minimoConfiavel = Math.min(
    totalQuestoes,
    Math.max(5, Math.ceil(totalQuestoes * 0.95))
  );
  if (conflitos.size > 0 || porNumero.size < minimoConfiavel) return [];

  return [...porNumero.values()].sort((a, b) => a.numero - b.numero);
}
