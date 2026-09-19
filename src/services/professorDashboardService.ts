import { supabase } from "../lib/supabase";

export type IndicadoresProfessor = {
  alunosAtivos: number;
  turmasAtivas: number;
  minutosMes: number;
  diasEstudoMes: number;
  questoesMes: number;
  acertosMes: number;
  acuraciaMes: number;
  revisoesConcluidasMes: number;
  revisoesAtrasadas: number;
  simuladosMes: number;
  mediaSimulados: number;
  sequenciaMedia: number;
  alunosAtivosHoje: number;
};

export type SaudeTurma = {
  emDia: number;
  atencao: number;
  risco: number;
};

export type TurmaResumoProfessor = {
  id: string;
  nome: string;
  alunosAtivos: number;
  minutosMes: number;
  questoesMes: number;
  acuracia: number;
  revisoesAtrasadas: number;
  simuladosMes: number;
};

export type AtividadeProfessor = {
  data: string;
  minutos: number;
  alunos: number;
};

export type DashboardProfessor = {
  parceiroId: string;
  parceiroNome: string;
  indicadores: IndicadoresProfessor;
  saude: SaudeTurma;
  turmas: TurmaResumoProfessor[];
  atividade7Dias: AtividadeProfessor[];
};

export async function carregarDashboardProfessor(): Promise<DashboardProfessor> {
  const { data, error } = await supabase.rpc("dashboard_meu_parceiro");
  if (error) throw new Error(`Não foi possível carregar o dashboard do professor: ${error.message}`);

  const valor = objeto(data);
  const indicadores = objeto(valor.indicadores);
  const saude = objeto(valor.saude);

  return {
    parceiroId: texto(valor.parceiro_id),
    parceiroNome: texto(valor.parceiro_nome),
    indicadores: {
      alunosAtivos: numero(indicadores.alunos_ativos),
      turmasAtivas: numero(indicadores.turmas_ativas),
      minutosMes: numero(indicadores.minutos_mes),
      diasEstudoMes: numero(indicadores.dias_estudo_mes),
      questoesMes: numero(indicadores.questoes_mes),
      acertosMes: numero(indicadores.acertos_mes),
      acuraciaMes: numero(indicadores.acuracia_mes),
      revisoesConcluidasMes: numero(indicadores.revisoes_concluidas_mes),
      revisoesAtrasadas: numero(indicadores.revisoes_atrasadas),
      simuladosMes: numero(indicadores.simulados_mes),
      mediaSimulados: numero(indicadores.media_simulados),
      sequenciaMedia: numero(indicadores.sequencia_media),
      alunosAtivosHoje: numero(indicadores.alunos_ativos_hoje),
    },
    saude: {
      emDia: numero(saude.em_dia),
      atencao: numero(saude.atencao),
      risco: numero(saude.risco),
    },
    turmas: lista(valor.turmas).map((item) => ({
      id: texto(item.id),
      nome: texto(item.nome) || "Turma",
      alunosAtivos: numero(item.alunos_ativos),
      minutosMes: numero(item.minutos_mes),
      questoesMes: numero(item.questoes_mes),
      acuracia: numero(item.acuracia),
      revisoesAtrasadas: numero(item.revisoes_atrasadas),
      simuladosMes: numero(item.simulados_mes),
    })),
    atividade7Dias: lista(valor.atividade_7_dias).map((item) => ({
      data: texto(item.data),
      minutos: numero(item.minutos),
      alunos: numero(item.alunos),
    })),
  };
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? (valor as Record<string, unknown>)
    : {};
}

function lista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is Record<string, unknown> => !!item && typeof item === "object")
    : [];
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function numero(valor: unknown) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}
