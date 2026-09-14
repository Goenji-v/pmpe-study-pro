import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../../types";
import { calcularMetricasConsolidadas } from "../../utils/metricasConsolidadas";

export type NivelConfiancaCoach = "baixa" | "media" | "alta";

export type ComparativoCoach = {
  atual: number;
  anterior: number;
  variacaoPercentual: number | null;
};

export type ComparativoPontosCoach = {
  atual: number;
  anterior: number;
  diferenca: number;
};

export type MetaSemanalCoach = {
  atual: number;
  meta: number;
  percentual: number;
};

export type InsightsCoach = {
  periodoAtual: {
    inicio: string;
    fim: string;
  };
  periodoAnterior: {
    inicio: string;
    fim: string;
  };
  tempo: ComparativoCoach;
  questoes: ComparativoCoach;
  aproveitamento: ComparativoPontosCoach;
  diasAtivos: ComparativoPontosCoach;
  revisoesConcluidas: ComparativoCoach;
  metas: {
    minutos: MetaSemanalCoach;
    questoes: MetaSemanalCoach;
    revisoes: MetaSemanalCoach;
  };
  confianca: NivelConfiancaCoach;
  confiancaDescricao: string;
  leituraMomento: string;
  atividadeMaisRecenteEm: string | null;
};

type EntradaInsightsCoach = {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
  metaMinutosDia: number;
  metaQuestoesDia: number;
  metaRevisoesDia: number;
  revisoesAtrasadas?: number;
};

const DIAS_META_SEMANAL = 6;

export function calcularInsightsCoach({
  questoes,
  sessoes,
  revisoes,
  simulados,
  metaMinutosDia,
  metaQuestoesDia,
  metaRevisoesDia,
  revisoesAtrasadas = 0,
}: EntradaInsightsCoach): InsightsCoach {
  const agora = new Date();
  const fimAtual = fimDoDia(agora);
  const inicioAtual = inicioDoDia(adicionarDias(agora, -6));
  const fimAnterior = fimDoDia(adicionarDias(agora, -7));
  const inicioAnterior = inicioDoDia(adicionarDias(agora, -13));

  const atual = calcularMetricasConsolidadas({
    questoes,
    sessoes,
    revisoes,
    simulados,
    inicio: inicioAtual,
    fim: fimAtual,
  });
  const anterior = calcularMetricasConsolidadas({
    questoes,
    sessoes,
    revisoes,
    simulados,
    inicio: inicioAnterior,
    fim: fimAnterior,
  });
  const total = calcularMetricasConsolidadas({
    questoes,
    sessoes,
    revisoes,
    simulados,
  });

  const confianca = calcularConfianca(total.questoes, atual.diasAtivos, atual.questoes);
  const metas = {
    minutos: calcularMeta(atual.minutos, metaMinutosDia * DIAS_META_SEMANAL),
    questoes: calcularMeta(atual.questoes, metaQuestoesDia * DIAS_META_SEMANAL),
    revisoes: calcularMeta(
      atual.revisoesConcluidas,
      metaRevisoesDia * DIAS_META_SEMANAL
    ),
  };

  return {
    periodoAtual: {
      inicio: inicioAtual.toISOString(),
      fim: fimAtual.toISOString(),
    },
    periodoAnterior: {
      inicio: inicioAnterior.toISOString(),
      fim: fimAnterior.toISOString(),
    },
    tempo: comparativo(atual.minutos, anterior.minutos),
    questoes: comparativo(atual.questoes, anterior.questoes),
    aproveitamento: {
      atual: atual.aproveitamento,
      anterior: anterior.aproveitamento,
      diferenca: atual.aproveitamento - anterior.aproveitamento,
    },
    diasAtivos: {
      atual: atual.diasAtivos,
      anterior: anterior.diasAtivos,
      diferenca: atual.diasAtivos - anterior.diasAtivos,
    },
    revisoesConcluidas: comparativo(
      atual.revisoesConcluidas,
      anterior.revisoesConcluidas
    ),
    metas,
    confianca,
    confiancaDescricao: descricaoConfianca(confianca, total.questoes, atual.diasAtivos),
    leituraMomento: montarLeituraMomento({
      atual,
      anterior,
      revisoesAtrasadas,
    }),
    atividadeMaisRecenteEm: obterAtividadeMaisRecente({
      questoes,
      sessoes,
      revisoes,
      simulados,
    }),
  };
}

function comparativo(atual: number, anterior: number): ComparativoCoach {
  return {
    atual,
    anterior,
    variacaoPercentual: variacaoPercentual(atual, anterior),
  };
}

function variacaoPercentual(atual: number, anterior: number) {
  if (anterior <= 0) return atual > 0 ? null : 0;
  return Math.round(((atual - anterior) / anterior) * 100);
}

function calcularMeta(atual: number, meta: number): MetaSemanalCoach {
  const metaSegura = Math.max(0, Math.round(meta));
  const atualSeguro = Math.max(0, Math.round(atual));
  return {
    atual: atualSeguro,
    meta: metaSegura,
    percentual:
      metaSegura <= 0 ? 0 : Math.max(0, Math.round((atualSeguro / metaSegura) * 100)),
  };
}

function calcularConfianca(
  totalQuestoes: number,
  diasAtivosSemana: number,
  questoesSemana: number
): NivelConfiancaCoach {
  if (totalQuestoes >= 100 && diasAtivosSemana >= 3 && questoesSemana >= 30) {
    return "alta";
  }
  if (totalQuestoes >= 30 && diasAtivosSemana >= 1) return "media";
  return "baixa";
}

function descricaoConfianca(
  nivel: NivelConfiancaCoach,
  totalQuestoes: number,
  diasAtivosSemana: number
) {
  if (nivel === "alta") {
    return `Boa amostra: ${totalQuestoes} questões no histórico e ${diasAtivosSemana} dias ativos nos últimos 7 dias.`;
  }
  if (nivel === "media") {
    return `Amostra intermediária: ${totalQuestoes} questões registradas. A leitura melhora com mais dias e questões.`;
  }
  return `Amostra pequena: ${totalQuestoes} questões registradas. Use o diagnóstico como direção inicial, não como conclusão definitiva.`;
}

function montarLeituraMomento({
  atual,
  anterior,
  revisoesAtrasadas,
}: {
  atual: ReturnType<typeof calcularMetricasConsolidadas>;
  anterior: ReturnType<typeof calcularMetricasConsolidadas>;
  revisoesAtrasadas: number;
}) {
  if (
    atual.minutos === 0 &&
    atual.questoes === 0 &&
    atual.diasAtivos === 0
  ) {
    return "Ainda faltam atividades recentes para comparar sua evolução. Registre estudo e questões para o Coach ganhar precisão.";
  }

  const deltaTempo = variacaoPercentual(atual.minutos, anterior.minutos);
  const deltaQuestoes = variacaoPercentual(atual.questoes, anterior.questoes);
  const deltaAcerto = atual.aproveitamento - anterior.aproveitamento;

  if (revisoesAtrasadas > 0) {
    return `Seu ritmo recente tem ${atual.diasAtivos} dias ativos, mas há ${revisoesAtrasadas} revisão${revisoesAtrasadas === 1 ? "" : "ões"} atrasada${revisoesAtrasadas === 1 ? "" : "s"}. Regularizar a fila deve vir antes de aumentar o volume.`;
  }

  if (deltaAcerto <= -5 && (deltaTempo ?? 0) > 0) {
    return `Você aumentou o volume de estudo, mas o aproveitamento caiu ${Math.abs(deltaAcerto)} p.p. O próximo ajuste deve priorizar qualidade, correção de erros e revisão.`;
  }

  if (deltaAcerto >= 5 && (deltaQuestoes ?? 0) >= 0) {
    return `O aproveitamento subiu ${deltaAcerto} p.p. sem perda de volume. O momento é favorável para consolidar os pontos fortes e atacar o próximo conteúdo crítico.`;
  }

  if (atual.diasAtivos <= 2) {
    return `Seu principal risco agora é consistência: foram ${atual.diasAtivos} dias ativos nos últimos 7 dias. Distribuir o estudo ao longo da semana tende a dar uma base mais estável.`;
  }

  if ((deltaTempo ?? 0) >= 15 || (deltaQuestoes ?? 0) >= 15) {
    return "Seu volume cresceu em relação aos 7 dias anteriores. Mantenha o ritmo e observe se o aproveitamento acompanha esse crescimento.";
  }

  return "Seu ritmo está relativamente estável. A melhor próxima decisão é usar os assuntos críticos e as revisões para direcionar o tempo, em vez de apenas aumentar volume.";
}

function obterAtividadeMaisRecente({
  questoes,
  sessoes,
  revisoes,
  simulados,
}: Pick<EntradaInsightsCoach, "questoes" | "sessoes" | "revisoes" | "simulados">) {
  const datas = [
    ...questoes.map((item) => item.data),
    ...sessoes.map((item) => item.data),
    ...simulados.map((item) => item.data),
    ...revisoes
      .filter((item) => item.concluida && item.dataConclusao)
      .map((item) => item.dataConclusao as string),
  ]
    .map((valor) => new Date(valor))
    .filter((data) => Number.isFinite(data.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  return datas[0]?.toISOString() ?? null;
}

function adicionarDias(data: Date, dias: number) {
  const copia = new Date(data);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function inicioDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function fimDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(23, 59, 59, 999);
  return copia;
}
