import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../types";
import {
  calcularMetricasConsolidadas,
  resumirSimulado,
} from "../utils/metricasConsolidadas";

export type ResumoGamificacao = {
  mes: string;
  minutos: number;
  horas: number;
  questoes: number;
  acertos: number;
  revisoes: number;
  simulados: number;
  xp: number;
  nivel: number;
  tituloNivel: string;
};

export type EntradaRanking = ResumoGamificacao & {
  userId: string;
  nome: string;
  posicao?: number;
};

export function calcularGamificacao(params: {
  sessoes: SessaoEstudo[];
  questoes: RegistroQuestao[];
  revisoes: Revisao[];
  simulados: Simulado[];
  agora?: Date;
}): ResumoGamificacao {
  const agora = params.agora ?? new Date();
  const mes = chaveMes(agora);
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1, 0, 0, 0, 0);
  const fim = new Date(agora.getFullYear(), agora.getMonth() + 1, 0, 23, 59, 59, 999);

  const metricas = calcularMetricasConsolidadas({
    sessoes: params.sessoes,
    questoes: params.questoes,
    revisoes: params.revisoes,
    simulados: params.simulados,
    inicio,
    fim,
  });

  const simuladosMes = params.simulados.filter((item) => {
    const data = dataSegura(item.data);
    return data >= inicio && data <= fim;
  });

  const xpTempo = Math.floor(metricas.minutos / 10);
  const xpQuestoes = Math.floor(metricas.questoes / 10) * 2;
  const xpAcertos = Math.floor(metricas.certas / 10) * 2;
  const xpRevisoes = metricas.revisoesConcluidas * 5;
  const xpSimulados = simuladosMes.reduce((total, simulado) => {
    const percentual = resumirSimulado(simulado).aproveitamento;
    return total + 10 + (percentual >= 80 ? 10 : percentual >= 60 ? 5 : 0);
  }, 0);

  const xp = xpTempo + xpQuestoes + xpAcertos + xpRevisoes + xpSimulados;
  const nivel = Math.max(1, Math.floor(xp / 250) + 1);

  return {
    mes,
    minutos: metricas.minutos,
    horas: Math.round((metricas.minutos / 60) * 10) / 10,
    questoes: metricas.questoes,
    acertos: metricas.certas,
    revisoes: metricas.revisoesConcluidas,
    simulados: metricas.simulados,
    xp,
    nivel,
    tituloNivel: tituloDoNivel(nivel),
  };
}

export function tituloDoNivel(nivel: number) {
  if (nivel >= 20) return "Elite";
  if (nivel >= 12) return "Operacional";
  if (nivel >= 7) return "Preparado";
  if (nivel >= 3) return "Aluno";
  return "Recruta";
}

function chaveMes(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

function dataSegura(valor: string) {
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? new Date(0) : data;
}
