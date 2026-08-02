import type { Revisao } from "../../types";

export type DesempenhoMateria = {
  materia: string;
  certas: number;
  erradas: number;
  total: number;
  percentual: number;
  minutos: number;
  ultimaAtividade?: string;
  diasSemEstudar: number;
};

export type DesempenhoAssunto = {
  chave: string;
  materia: string;
  assunto: string;
  certas: number;
  erradas: number;
  total: number;
  percentual: number;
};

export type DesempenhoBanca = {
  banca: string;
  certas: number;
  erradas: number;
  total: number;
  percentual: number;
};

export type MissaoDia = {
  id: string;
  tipo:
    | "revisao"
    | "questoes"
    | "estudo"
    | "simulado";

  titulo: string;
  descricao: string;
  materia?: string;
  assunto?: string;
  minutos: number;
  quantidadeQuestoes?: number;
  prioridade:
    | "alta"
    | "media"
    | "baixa";

  rota: string;
};

export type DadosCentral = {
  indiceProntidao: number;
  classificacao: string;

  hoje: {
    minutos: number;
    questoes: number;
    certas: number;
    erradas: number;
    percentual: number;
    revisoesConcluidas: number;
  };

  semana: {
    minutos: number;
    questoes: number;
    certas: number;
    erradas: number;
    percentual: number;
    sessoes: number;
    diasAtivos: number;
  };

  total: {
    minutos: number;
    questoes: number;
    percentual: number;
    simulados: number;
    revisoesConcluidas: number;
  };

  revisoesAtrasadas: Revisao[];
  revisoesHoje: Revisao[];

  materias: DesempenhoMateria[];
  assuntosCriticos: DesempenhoAssunto[];
  assuntosDominados: DesempenhoAssunto[];
  bancas: DesempenhoBanca[];

  melhorMateria: DesempenhoMateria | null;
  piorMateria: DesempenhoMateria | null;
  materiaEsquecida: DesempenhoMateria | null;

  previsaoNota: number;
  chanceAprovacao: number;
  maiorRisco: string;

  missoes: MissaoDia[];
  tempoMissao: number;
};
