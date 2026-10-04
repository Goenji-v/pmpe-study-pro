import type {
  PacoteQuestoesFlashcard,
  ProgressoQuestaoFlashcard,
} from "../types/flashcards";

export type RecomendacaoFlashcards = {
  modo: "flashcards" | "quiz";
  nivel: "inicio" | "recuperacao" | "fixacao" | "consolidacao";
  titulo: string;
  descricao: string;
  percentual?: number;
  tentativas: number;
};

export function calcularDesempenhoPacote(
  pacote: PacoteQuestoesFlashcard,
  progresso: ProgressoQuestaoFlashcard[]
) {
  const ids = new Set(
    pacote.questoes.map((questao) => questao.id)
  );
  const registros = progresso.filter((item) =>
    ids.has(item.questaoId)
  );
  const tentativas = registros.reduce(
    (total, item) => total + item.tentativas,
    0
  );
  const acertos = registros.reduce(
    (total, item) => total + item.acertos,
    0
  );
  const erros = registros.reduce(
    (total, item) => total + item.erros,
    0
  );
  const respondidas = registros.filter(
    (item) => item.tentativas > 0
  ).length;
  const percentual = tentativas
    ? Math.round((acertos / tentativas) * 100)
    : undefined;

  return {
    tentativas,
    acertos,
    erros,
    respondidas,
    percentual,
  };
}

export function recomendarEstudoFlashcards(
  pacote: PacoteQuestoesFlashcard,
  progresso: ProgressoQuestaoFlashcard[]
): RecomendacaoFlashcards {
  const desempenho = calcularDesempenhoPacote(
    pacote,
    progresso
  );

  if (desempenho.tentativas === 0) {
    return {
      modo: "flashcards",
      nivel: "inicio",
      titulo: "Começar por Flashcards",
      descricao:
        "Use os cartões para fixar os pontos-chave antes de testar as alternativas.",
      tentativas: 0,
    };
  }

  const percentual = desempenho.percentual ?? 0;

  if (percentual < 50) {
    return {
      modo: "flashcards",
      nivel: "recuperacao",
      titulo: "Rever teoria + Flashcards",
      descricao:
        "Seu aproveitamento ainda está baixo. Releia o ponto mais fraco e use os cartões antes de voltar ao Quiz.",
      percentual,
      tentativas: desempenho.tentativas,
    };
  }

  if (percentual < 80) {
    return {
      modo: "flashcards",
      nivel: "fixacao",
      titulo: "Fixar com Flashcards",
      descricao:
        "Você já reconhece parte do conteúdo. Use os cartões para fechar as lacunas e depois confirme no Quiz.",
      percentual,
      tentativas: desempenho.tentativas,
    };
  }

  return {
    modo: "quiz",
    nivel: "consolidacao",
    titulo: "Confirmar no Quiz",
    descricao:
      "O conteúdo está bem consolidado. Use o Quiz para confirmar o domínio e manter a revisão ativa.",
    percentual,
    tentativas: desempenho.tentativas,
  };
}
