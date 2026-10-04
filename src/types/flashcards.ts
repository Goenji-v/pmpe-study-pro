export type AlternativaFlashcard = {
  id: string;
  texto: string;
};

export type QuestaoFlashcard = {
  id: string;
  pergunta: string;
  alternativas: AlternativaFlashcard[];
  correta: string;
  explicacao: string;
  dica?: string;
};

export type PacoteQuestoesFlashcard = {
  materia: string;
  topico: string;
  /** Nomes alternativos aceitos para vincular o deck ao assunto real do edital/curso. */
  aliases?: string[];
  questoes: QuestaoFlashcard[];
};

export type ArquivoQuestoesFlashcard =
  | PacoteQuestoesFlashcard
  | {
      materia: string;
      topicos: Array<{
        topico: string;
        aliases?: string[];
        questoes: QuestaoFlashcard[];
      }>;
    };

export type ModoEstudoFlashcard =
  | "flashcards"
  | "quiz";

export type ProgressoQuestaoFlashcard = {
  questaoId: string;
  materia: string;
  topico: string;
  tentativas: number;
  acertos: number;
  erros: number;
  ultimaAcertou: boolean;
  ultimaModalidade?: ModoEstudoFlashcard;
  ultimaRespostaEm: string;
};

export type ResultadoQuestaoFlashcard = {
  questao: QuestaoFlashcard;
  acertou: boolean;
};

export type EstatisticasFlashcards = {
  totalRespondidas: number;
  totalTentativas: number;
  totalAcertos: number;
  totalErros: number;
  percentualAcertos: number;
};
