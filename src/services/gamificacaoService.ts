import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../types";

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

  const sessoesMes = params.sessoes.filter((item) => chaveMes(dataSegura(item.data)) === mes);
  const questoesMes = params.questoes.filter((item) => chaveMes(dataSegura(item.data)) === mes);
  const revisoesMes = params.revisoes.filter(
    (item) => item.concluida && item.dataConclusao && chaveMes(dataSegura(item.dataConclusao)) === mes
  );
  const simuladosMes = params.simulados.filter((item) => chaveMes(dataSegura(item.data)) === mes);

  const minutos = sessoesMes.reduce((total, item) => total + numeroSeguro(item.minutos), 0);
  const questoes = questoesMes.reduce(
    (total, item) => total + numeroSeguro(item.certas) + numeroSeguro(item.erradas),
    0
  );
  const acertos = questoesMes.reduce((total, item) => total + numeroSeguro(item.certas), 0);
  const revisoes = revisoesMes.length;
  const simulados = simuladosMes.length;

  const xpTempo = Math.floor(minutos / 10);
  const xpQuestoes = Math.floor(questoes / 10) * 2;
  const xpAcertos = Math.floor(acertos / 10) * 2;
  const xpRevisoes = revisoes * 5;
  const xpSimulados = simuladosMes.reduce((total, simulado) => {
    const totalValidas = numeroSeguro(simulado.certas) + numeroSeguro(simulado.erradas);
    const percentual = totalValidas === 0 ? 0 : (numeroSeguro(simulado.certas) / totalValidas) * 100;
    return total + 10 + (percentual >= 80 ? 10 : percentual >= 60 ? 5 : 0);
  }, 0);

  const xp = xpTempo + xpQuestoes + xpAcertos + xpRevisoes + xpSimulados;
  const nivel = Math.max(1, Math.floor(xp / 250) + 1);

  return {
    mes,
    minutos,
    horas: Math.round((minutos / 60) * 10) / 10,
    questoes,
    acertos,
    revisoes,
    simulados,
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

function numeroSeguro(valor: number) {
  return Number.isFinite(valor) ? valor : 0;
}
