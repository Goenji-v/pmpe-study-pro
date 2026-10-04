import type {
  ArquivoQuestoesFlashcard,
  PacoteQuestoesFlashcard,
  QuestaoFlashcard,
} from "../../types/flashcards";

const arquivos = import.meta.glob("./*.json", {
  eager: true,
  import: "default",
}) as Record<string, unknown>;

function ehQuestao(valor: unknown): valor is QuestaoFlashcard {
  if (!valor || typeof valor !== "object") return false;

  const questao = valor as Partial<QuestaoFlashcard>;
  return (
    typeof questao.id === "string" &&
    typeof questao.pergunta === "string" &&
    Array.isArray(questao.alternativas) &&
    questao.alternativas.length >= 2 &&
    questao.alternativas.every(
      (alternativa) =>
        alternativa &&
        typeof alternativa.id === "string" &&
        typeof alternativa.texto === "string"
    ) &&
    typeof questao.correta === "string" &&
    typeof questao.explicacao === "string"
  );
}

function converterArquivo(
  valor: unknown
): PacoteQuestoesFlashcard[] {
  if (!valor || typeof valor !== "object") return [];

  const arquivo =
    valor as Partial<ArquivoQuestoesFlashcard> & {
      materia?: string;
      topico?: string;
      questoes?: unknown[];
      topicos?: Array<{
        topico?: string;
        questoes?: unknown[];
      }>;
    };

  if (typeof arquivo.materia !== "string") return [];

  if (
    typeof arquivo.topico === "string" &&
    Array.isArray(arquivo.questoes)
  ) {
    const questoes = arquivo.questoes.filter(ehQuestao);
    return questoes.length > 0
      ? [
          {
            materia: arquivo.materia,
            topico: arquivo.topico,
            questoes,
          },
        ]
      : [];
  }

  if (Array.isArray(arquivo.topicos)) {
    return arquivo.topicos.flatMap((topico) => {
      if (
        typeof topico.topico !== "string" ||
        !Array.isArray(topico.questoes)
      ) {
        return [];
      }

      const questoes = topico.questoes.filter(ehQuestao);
      return questoes.length > 0
        ? [
            {
              materia: arquivo.materia as string,
              topico: topico.topico,
              questoes,
            },
          ]
        : [];
    });
  }

  return [];
}

export function normalizarChaveFlashcards(
  valor: string
) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export const pacotesQuestoesFlashcards =
  Object.values(arquivos)
    .flatMap(converterArquivo)
    .sort((a, b) => {
      const materia = a.materia.localeCompare(
        b.materia,
        "pt-BR"
      );
      return materia !== 0
        ? materia
        : a.topico.localeCompare(b.topico, "pt-BR");
    });

export function buscarPacoteQuestoesFlashcards(
  materia: string,
  topico: string
) {
  const materiaNormalizada =
    normalizarChaveFlashcards(materia);
  const topicoNormalizado =
    normalizarChaveFlashcards(topico);

  return pacotesQuestoesFlashcards.find(
    (pacote) =>
      normalizarChaveFlashcards(pacote.materia) ===
        materiaNormalizada &&
      normalizarChaveFlashcards(pacote.topico) ===
        topicoNormalizado
  );
}
