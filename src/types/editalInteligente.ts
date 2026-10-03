import type { ConfiguracoesApp } from "./index";

export type DiaSemanaId =
  | "seg"
  | "ter"
  | "qua"
  | "qui"
  | "sex"
  | "sab"
  | "dom";

export const DIAS_SEMANA: Array<{
  id: DiaSemanaId;
  curto: string;
  nome: string;
}> = [
  { id: "seg", curto: "SEG", nome: "Segunda" },
  { id: "ter", curto: "TER", nome: "Terça" },
  { id: "qua", curto: "QUA", nome: "Quarta" },
  { id: "qui", curto: "QUI", nome: "Quinta" },
  { id: "sex", curto: "SEX", nome: "Sexta" },
  { id: "sab", curto: "SÁB", nome: "Sábado" },
  { id: "dom", curto: "DOM", nome: "Domingo" },
];

export type PrioridadeEdital = "alta" | "media" | "baixa";

export type AssuntoEdital = {
  id: string;
  nome: string;
  prioridade: PrioridadeEdital;
  justificativaPrioridade?: string;
};

export type MateriaEdital = {
  id: string;
  nome: string;
  incidenciaEstimada: number;
  assuntos: AssuntoEdital[];
};

export type AnaliseEdital = {
  concursoDetectado: string;
  cargoDetectado?: string;
  bancaDetectada?: string;
  observacao?: string;
  materias: MateriaEdital[];
  analisadoEm: string;
};

export type MissaoPlanoEdital = {
  id: string;
  ordem: number;
  materiaId: string;
  materia: string;
  assuntoId: string;
  assunto: string;
  prioridade: PrioridadeEdital;
  duracaoMinutos: number;
  metaQuestoes: number;
};

export type DiaPlanoEdital = {
  id: string;
  semana: number;
  diaSemana: DiaSemanaId;
  nomeDia: string;
  minutosDisponiveis: number;
  revisoesPlanejadas: number;
  missoes: MissaoPlanoEdital[];
};

export type SemanaPlanoEdital = {
  numero: number;
  dias: DiaPlanoEdital[];
};

export type PlanoEdital = {
  versao?: number;
  id: string;
  titulo: string;
  geradoEm: string;
  totalAssuntos: number;
  totalSemanas: number;
  diasEstudo: DiaSemanaId[];
  materiasPorDia: number;
  minutosPorDia: number;
  revisoesPorDia: number;
  semanas: SemanaPlanoEdital[];
};

export type StatusCorrespondenciaMigracaoEdital =
  | "mantido"
  | "renomeado"
  | "novo"
  | "removido_preservado"
  | "ambiguo";

export type CorrespondenciaMigracaoEdital = {
  materiaAnteriorId?: string;
  materiaAnterior?: string;
  assuntoAnteriorId?: string;
  assuntoAnterior?: string;
  materiaNovaId: string;
  materiaNova: string;
  assuntoNovoId: string;
  assuntoNovo: string;
  status: StatusCorrespondenciaMigracaoEdital;
  score?: number;
  candidatos?: Array<{
    assuntoId: string;
    nome: string;
    score: number;
  }>;
};

export type RelatorioMigracaoEdital = {
  id: string;
  criadoEm: string;
  editalAnteriorId?: string;
  editalAnteriorNome?: string;
  editalNovoId: string;
  editalNovoNome: string;
  correspondencias: CorrespondenciaMigracaoEdital[];
  resumo: {
    mantidos: number;
    renomeados: number;
    novos: number;
    removidosPreservados: number;
    ambiguos: number;
    totalAnterior: number;
    totalNovo: number;
  };
  preservacao: {
    questoes: number;
    sessoes: number;
    revisoes: number;
    simulados: number;
    bancoQuestoes: number;
    simuladosGerados: number;
    missoesConcluidas: number;
    linksQuestoes: number;
    anotacoes: number;
    materiais: number;
  };
  bloqueios: string[];
};

export type HistoricoMigracaoEdital = {
  id: string;
  aplicadoEm: string;
  backupNuvemId?: string;
  editalAnteriorId?: string;
  editalAnteriorNome?: string;
  editalNovoId: string;
  editalNovoNome: string;
  planoAnteriorId?: string;
  planoNovoId?: string;
  relatorio: RelatorioMigracaoEdital;
};

export type EditalAtivo = {
  id: string;
  /** ID do edital global quando a origem é o catálogo administrado. */
  catalogoId?: string;
  nomeArquivo: string;
  /** Pode ficar vazio quando o catálogo usa apenas uma fonte oficial externa. */
  storagePath: string;
  /** Fonte oficial do edital pré-definido, quando disponível. */
  fonteUrl?: string;
  analise: AnaliseEdital;
  plano?: PlanoEdital;
  confirmadoEm?: string;
};

export type ConfiguracoesEditalExtras = {
  diasEstudo?: DiaSemanaId[];
  materiasPorDia?: number;
  diaRedacaoSemanal?: DiaSemanaId;
  diaSimuladoSemanal?: DiaSemanaId;
  editalOnboardingVisto?: boolean;
  editalAtivo?: EditalAtivo;
  /** Últimas migrações de edital aplicadas com backup e relatório. */
  historicoMigracoesEdital?: HistoricoMigracaoEdital[];
};

export type ConfiguracoesComEdital = ConfiguracoesApp & ConfiguracoesEditalExtras;
