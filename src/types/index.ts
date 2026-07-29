export type Prioridade =
  | "baixa"
  | "media"
  | "alta";

export type Dificuldade =
  | "facil"
  | "media"
  | "dificil";

export type Tema =
  | "escuro"
  | "claro";

export type EtapaRevisao =
  | 1
  | 2
  | 3
  | 4;

export type Assunto = {
  id: string;
  nome: string;
  concluido: boolean;
  prioridade: Prioridade;
  aula?: string;
  questoes?: string;
  pdf?: string;
};

export type Materia = {
  id: string;
  nome: string;
  assuntos: Assunto[];
};

export type RegistroQuestao = {
  id: string;
  materia: string;
  assunto: string;
  banca: string;
  certas: number;
  erradas: number;
  minutos: number;
  data: string;
  observacao?: string;
};

export type TipoSessao =
  | "aula"
  | "revisao"
  | "questoes"
  | "simulado"
  | "estudo"
  | "leitura"
  | "videoaula";

export type SessaoEstudo = {
  id: string;
  data: string;

  tipo: TipoSessao;

  materia: string;
  assunto: string;

  objetivo?: string;
  observacao?: string;

  minutos: number;

  iniciadaEm?: string;
  finalizadaEm?: string;

  missaoId?: string;
  semana?: number;
  dia?: number;

  quantidadeQuestoes?: number;
  quantidadeAcertos?: number;
  quantidadeErros?: number;
  banca?: string;
  dificuldade?: Dificuldade;

  avaliacaoRevisao?:
    | "facil"
    | "media"
    | "dificil";
};

export type Simulado = {
  id: string;
  nome: string;
  banca: string;
  certas: number;
  erradas: number;
  anuladas: number;
  minutos: number;
  data: string;
  observacao?: string;
};

export type AlternativaQuestao = {
  id: string;
  texto: string;
};

export type QuestaoBanco = {
  id: string;
  materiaId: string;
  materia: string;
  assuntoId: string;
  assunto: string;
  banca: string;
  dificuldade: Dificuldade;
  enunciado: string;
  alternativas: AlternativaQuestao[];
  respostaCorretaId: string;
  explicacao?: string;
  dataCriacao: string;
};

export type RespostaSimulado = {
  questaoId: string;
  alternativaSelecionadaId?: string;
  correta: boolean;
};

export type SimuladoGerado = {
  id: string;
  nome: string;
  questoesIds: string[];
  respostas: RespostaSimulado[];
  iniciadoEm: string;
  finalizadoEm?: string;
  minutos?: number;
  certas?: number;
  erradas?: number;
};

export type ConfiguracoesApp = {
  nomeUsuario: string;
  concurso: string;
  bancaPadrao: string;
  metaQuestoesDiaria: number;
  metaMinutosDiaria: number;
  metaRevisoesDiaria: number;
  tema: Tema;
};

export type Revisao = {
  id: string;
  materiaId: string;
  assuntoId: string;
  materia: string;
  assunto: string;
  etapa: EtapaRevisao;
  dataCriacao: string;
  dataPrevista: string;
  concluida: boolean;
  dataConclusao?: string;
};

export interface QuestaoIA {
  id: string;
  materia: string;
  assunto: string;
  banca: string;
  dificuldade:
    | "Fácil"
    | "Média"
    | "Difícil";

  enunciado: string;

  alternativas: {
    A: string;
    B: string;
    C: string;
    D: string;
    E: string;
  };

  respostaCorreta:
    | "A"
    | "B"
    | "C"
    | "D"
    | "E";

  explicacao: string;
}