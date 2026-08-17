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

export type MaterialAssunto = {
  id: string;
  tipo: "pdf" | "imagem" | "link";
  nome: string;
  url: string;
  criadoEm: string;
};

export type AulaAssunto = {
  id: string;
  nome: string;
  url?: string;
  ordem: number;
  concluida: boolean;
  concluidaEm?: string;
};

export type TipoTarefaAssunto =
  | "teoria"
  | "leitura"
  | "questoes"
  | "revisao"
  | "redacao"
  | "outra";

export type TarefaAssunto = {
  id: string;
  nome: string;
  tipo: TipoTarefaAssunto;
  ordem: number;
  concluida: boolean;
  concluidaEm?: string;
};

export type Assunto = {
  id: string;
  nome: string;
  concluido: boolean;
  prioridade: Prioridade;
  /** Partes internas do assunto. Não contam isoladamente no edital. */
  aulas?: AulaAssunto[];
  /** Atividades de apoio. Não contam como conteúdo concluído do edital. */
  tarefas?: TarefaAssunto[];
  /** Link legado mantido enquanto as outras telas migram para `aulas`. */
  aula?: string;
  questoes?: string;
  pdf?: string;
  resumo?: string;
  anotacoes?: string;
  materiais?: MaterialAssunto[];
  atualizadoEm?: string;
  conclusaoOrigem?: "estudo" | "importado";
  concluidoEm?: string;
};

export type Modulo = {
  id: string;
  nome: string;
  ordem: number;
  assuntos: Assunto[];
};

export type Materia = {
  id: string;
  nome: string;
  /** Estrutura canônica a partir da versão 2. */
  modulos?: Modulo[];
  /**
   * Espelho temporário para compatibilidade com páginas ainda não migradas.
   * Novas implementações devem usar `modulos`.
   */
  assuntos: Assunto[];
};

export type RegistroQuestao = {
  id: string;
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
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
  | "videoaula"
  | "redacao";

export type SessaoEstudo = {
  id: string;
  data: string;

  tipo: TipoSessao;

  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;

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
  formatoRevisao?: "teoria" | "questoes";
  notaRedacao?: number;
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
  totalQuestoes?: number;
  cadernoUrl?: string;
  comentadoUrl?: string;
};

export type AlternativaQuestao = {
  id: string;
  texto: string;
};

export type QuestaoBanco = {
  id: string;
  materiaId: string;
  materia: string;
  moduloId?: string;
  modulo?: string;
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
  /** Quantidade de missões distribuídas em cada dia de segunda a sábado. */
  missoesPorDia?: number;
  tema: Tema;
};

export type Revisao = {
  id: string;
  materiaId: string;
  moduloId?: string;
  assuntoId: string;
  materia: string;
  modulo?: string;
  assunto: string;
  etapa: EtapaRevisao;
  dataCriacao: string;
  dataPrevista: string;
  concluida: boolean;
  dataConclusao?: string;
  desempenho?: "facil" | "media" | "dificil";
  certas?: number;
  erradas?: number;
  reagendadaEm?: string;
};

export interface QuestaoIA {
  id: string;
  materia: string;
  modulo?: string;
  moduloId?: string;
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
