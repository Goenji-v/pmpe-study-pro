import type { Dificuldade } from "../../types";

export const versaoAvaliacao = "estude-pro-1";
export type NotaMemoria = "Again" | "Hard" | "Good" | "Easy";
export type Evidencia = {
  modo: "passivo" | "recuperacao";
  certas?: number;
  erradas?: number;
  anuladas?: number;
  dificuldade?: Dificuldade;
};
export type Avaliacao = {
  versao: typeof versaoAvaliacao;
  recorrente: boolean;
  motivo: string;
  validas?: number;
  percentual?: number;
  anuladas?: number;
  nota?: NotaMemoria;
  qualidade?: "alta" | "moderada";
};

export function avaliar(e: Evidencia, historico: readonly number[] = []): Avaliacao {
  const { certas = 0, erradas = 0, anuladas = 0 } = e;
  const recorrente = historico.slice(-3).filter(p => p < 60).length >= 2;
  const base = { versao: versaoAvaliacao, recorrente } as const;
  if (e.modo === "passivo") return { ...base, motivo: "Estudo passivo. Faça recuperação ativa para medir retenção." };
  if (e.certas === undefined || e.erradas === undefined ||
      ![certas, erradas, anuladas, certas + erradas].every(n => Number.isSafeInteger(n) && n >= 0))
    return { ...base, motivo: "Resultado ausente ou inválido." };

  // Os totais de acerto e erro já excluem as questões anuladas.
  const validas = certas + erradas;
  const percentual = validas ? (100 * certas) / validas : 0;
  const dados = { ...base, validas, percentual, anuladas };
  if (validas < 5) return { ...dados, motivo: "Amostra insuficiente. Use pelo menos cinco respostas válidas." };
  let nota: NotaMemoria = percentual < 60 ? "Again" : percentual < 80 ? "Hard" : "Good";
  const consistente = historico.slice(-2).length === 2 && historico.slice(-2).every(p => p >= 80);
  if (percentual >= 90 && validas >= 10 && consistente && e.dificuldade !== "facil") nota = "Easy";
  if (nota === "Good" && percentual < 90 && recorrente && validas < 10) nota = "Hard";
  return { ...dados, nota, qualidade: validas >= 10 ? "alta" as const : "moderada" as const,
    motivo: `${percentual.toFixed(1)}% em ${validas} respostas válidas${recorrente ? " com dificuldade recorrente" : ""}.` };
}

export function orientar(avaliacao?: Avaliacao) {
  if (!avaliacao?.nota) return { modo: "Recuperação ativa", acao: "Responda questões inéditas sem consultar o material." };
  if (avaliacao.nota === "Again" || avaliacao.recorrente)
    return { modo: "Reaprendizagem", acao: "Releia os pontos errados, consulte o resumo e refaça as questões erradas." };
  if (avaliacao.nota === "Hard")
    return { modo: "Revisão mista", acao: "Recupere os conceitos de memória, consulte o material e faça novo treino." };
  return { modo: avaliacao.nota === "Easy" ? "Manutenção" : "Prática",
    acao: "Use questões inéditas para verificar se consegue aplicar o conteúdo." };
}

/** Entrada futura para complemento pedagógico, sem credenciais ou chamadas externas. */
export type ContextoOrientacaoIA = { objetivo: string; materia: string; assunto: string; avaliacao: Avaliacao };
