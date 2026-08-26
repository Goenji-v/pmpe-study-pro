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

export type EditalAtivo = {
  id: string;
  nomeArquivo: string;
  storagePath: string;
  analise: AnaliseEdital;
  plano?: PlanoEdital;
  confirmadoEm?: string;
};

export type ConfiguracoesEditalExtras = {
  diasEstudo?: DiaSemanaId[];
  materiasPorDia?: number;
  editalOnboardingVisto?: boolean;
  editalAtivo?: EditalAtivo;
};

export type ConfiguracoesComEdital = ConfiguracoesApp & ConfiguracoesEditalExtras;
