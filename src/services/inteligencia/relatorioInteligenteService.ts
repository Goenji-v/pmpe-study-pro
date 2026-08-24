import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../../types";
import { calcularMetricasConsolidadas } from "../../utils/metricasConsolidadas";

export type Tendencia = "subindo" | "caindo" | "estavel";

export type ResumoPeriodo = {
  minutos: number;
  sessoes: number;
  diasAtivos: number;
  questoes: number;
  certas: number;
  erradas: number;
  aproveitamento: number;
  revisoesConcluidas: number;
  simulados: number;
};

export type ComparacaoIndicador = {
  atual: number;
  anterior: number;
  diferenca: number;
  variacaoPercentual: number;
  tendencia: Tendencia;
};

export type DesempenhoMateriaInteligente = {
  materia: string;
  questoes: number;
  certas: number;
  erradas: number;
  aproveitamento: number;
  minutos: number;
  ultimaAtividade: string | null;
  diasSemEstudar: number | null;
};

export type RecomendacaoInteligente = {
  id: string;
  prioridade: "alta" | "media" | "baixa";
  titulo: string;
  descricao: string;
  rota: string;
};

export type RelatorioInteligente = {
  semanaAtual: ResumoPeriodo;
  semanaAnterior: ResumoPeriodo;
  comparacoes: {
    minutos: ComparacaoIndicador;
    questoes: ComparacaoIndicador;
    aproveitamento: ComparacaoIndicador;
    diasAtivos: ComparacaoIndicador;
  };
  materias: DesempenhoMateriaInteligente[];
  melhorMateria: DesempenhoMateriaInteligente | null;
  materiaCritica: DesempenhoMateriaInteligente | null;
  materiaEsquecida: DesempenhoMateriaInteligente | null;
  revisoesAtrasadas: number;
  indiceConsistencia: number;
  recomendacoes: RecomendacaoInteligente[];
  resumoExecutivo: string;
};

type EntradaRelatorio = {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
  metaMinutosDiaria: number;
};

export function gerarRelatorioInteligente({
  questoes,
  sessoes,
  revisoes,
  simulados,
  metaMinutosDiaria,
}: EntradaRelatorio): RelatorioInteligente {
  const hoje = inicioDoDia(new Date());
  const inicioSemanaAtual = adicionarDias(hoje, -6);
  const fimSemanaAnterior = adicionarDias(inicioSemanaAtual, -1);
  const inicioSemanaAnterior = adicionarDias(fimSemanaAnterior, -6);

  const semanaAtual = resumirPeriodo({
    inicio: inicioSemanaAtual,
    fim: fimDoDia(hoje),
    questoes,
    sessoes,
    revisoes,
    simulados,
  });

  const semanaAnterior = resumirPeriodo({
    inicio: inicioSemanaAnterior,
    fim: fimDoDia(fimSemanaAnterior),
    questoes,
    sessoes,
    revisoes,
    simulados,
  });

  const materias = calcularMaterias(questoes, sessoes);
  const materiasComBase = materias.filter((item) => item.questoes >= 5);

  const melhorMateria =
    [...materiasComBase].sort((a, b) => b.aproveitamento - a.aproveitamento)[0] ?? null;
  const materiaCritica =
    [...materiasComBase].sort((a, b) => a.aproveitamento - b.aproveitamento)[0] ?? null;
  const materiaEsquecida =
    [...materias]
      .filter((item) => item.diasSemEstudar !== null)
      .sort((a, b) => (b.diasSemEstudar ?? 0) - (a.diasSemEstudar ?? 0))[0] ?? null;

  const revisoesAtrasadas = revisoes.filter((revisao) => {
    const prevista = dataSegura(revisao.dataPrevista);
    return !revisao.concluida && Boolean(prevista && prevista < hoje);
  }).length;

  const comparacoes = {
    minutos: comparar(semanaAtual.minutos, semanaAnterior.minutos),
    questoes: comparar(semanaAtual.questoes, semanaAnterior.questoes),
    aproveitamento: comparar(semanaAtual.aproveitamento, semanaAnterior.aproveitamento),
    diasAtivos: comparar(semanaAtual.diasAtivos, semanaAnterior.diasAtivos),
  };

  const metaSemanal = Math.max(metaMinutosDiaria * 6, 1);
  const notaTempo = limitar(Math.round((semanaAtual.minutos / metaSemanal) * 100), 0, 100);
  const notaFrequencia = limitar(Math.round((semanaAtual.diasAtivos / 6) * 100), 0, 100);
  const notaQuestoes = semanaAtual.questoes > 0 ? semanaAtual.aproveitamento : 0;
  const notaAmostra = limitar(Math.round((semanaAtual.questoes / 80) * 100), 0, 100);
  const penalidadeRevisoes = Math.min(revisoesAtrasadas * 3, 25);

  const indiceConsistencia = limitar(
    Math.round(
      notaTempo * 0.3 +
      notaFrequencia * 0.3 +
      notaQuestoes * 0.3 +
      notaAmostra * 0.1 -
      penalidadeRevisoes
    ),
    0,
    100
  );

  const recomendacoes = montarRecomendacoes({
    comparacoes,
    materiaCritica,
    materiaEsquecida,
    revisoesAtrasadas,
    semanaAtual,
    metaMinutosDiaria,
  });

  return {
    semanaAtual,
    semanaAnterior,
    comparacoes,
    materias,
    melhorMateria,
    materiaCritica,
    materiaEsquecida,
    revisoesAtrasadas,
    indiceConsistencia,
    recomendacoes,
    resumoExecutivo: gerarResumoExecutivo({
      comparacoes,
      materiaCritica,
      revisoesAtrasadas,
      indiceConsistencia,
      semanaAtual,
    }),
  };
}

function resumirPeriodo({
  inicio,
  fim,
  questoes,
  sessoes,
  revisoes,
  simulados,
}: {
  inicio: Date;
  fim: Date;
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
}): ResumoPeriodo {
  const metricas = calcularMetricasConsolidadas({
    questoes,
    sessoes,
    simulados,
    inicio,
    fim,
  });

  const revisoesConcluidas = revisoes.filter(
    (revisao) =>
      revisao.concluida &&
      revisao.dataConclusao &&
      estaNoPeriodo(revisao.dataConclusao, inicio, fim)
  ).length;

  return {
    minutos: metricas.minutos,
    sessoes: metricas.sessoes,
    diasAtivos: calcularDiasAtivos(questoes, sessoes, simulados, inicio, fim),
    questoes: metricas.questoesRespondidas,
    certas: metricas.certas,
    erradas: metricas.erradas,
    aproveitamento: metricas.aproveitamento,
    revisoesConcluidas,
    simulados: metricas.simulados,
  };
}

function calcularMaterias(
  questoes: RegistroQuestao[],
  sessoes: SessaoEstudo[]
): DesempenhoMateriaInteligente[] {
  const mapa = new Map<string, DesempenhoMateriaInteligente>();

  function obter(nomeOriginal: string) {
    const materia = nomeOriginal.trim() || "Sem matéria";
    const chave = normalizar(materia);
    const atual = mapa.get(chave) ?? {
      materia,
      questoes: 0,
      certas: 0,
      erradas: 0,
      aproveitamento: 0,
      minutos: 0,
      ultimaAtividade: null,
      diasSemEstudar: null,
    };
    mapa.set(chave, atual);
    return atual;
  }

  questoes.forEach((registro) => {
    const atual = obter(registro.materia);
    atual.certas += numeroSeguro(registro.certas);
    atual.erradas += numeroSeguro(registro.erradas);
    atual.questoes = atual.certas + atual.erradas;
    atual.aproveitamento = atual.questoes === 0
      ? 0
      : Math.round((atual.certas / atual.questoes) * 100);

    const duplicadoPorSessao = sessoes.some((sessao) =>
      sessao.tipo === "questoes" &&
      normalizar(sessao.materia) === normalizar(registro.materia) &&
      normalizar(sessao.assunto) === normalizar(registro.assunto) &&
      diferencaMs(sessao.data, registro.data) < 5000
    );
    if (!duplicadoPorSessao) atual.minutos += numeroSeguro(registro.minutos);
    atualizarUltimaAtividade(atual, registro.data);
  });

  sessoes.forEach((sessao) => {
    const atual = obter(sessao.materia);
    atual.minutos += numeroSeguro(sessao.minutos);
    atualizarUltimaAtividade(atual, sessao.data);
  });

  return Array.from(mapa.values())
    .map((item) => ({
      ...item,
      diasSemEstudar: item.ultimaAtividade
        ? diasDesde(item.ultimaAtividade)
        : null,
    }))
    .sort((a, b) => b.questoes - a.questoes || b.minutos - a.minutos);
}

function atualizarUltimaAtividade(
  item: DesempenhoMateriaInteligente,
  data: string
) {
  if (!item.ultimaAtividade || tempoSeguro(data) > tempoSeguro(item.ultimaAtividade)) {
    item.ultimaAtividade = data;
  }
}

function comparar(atual: number, anterior: number): ComparacaoIndicador {
  const diferenca = atual - anterior;
  const variacaoPercentual = anterior === 0
    ? atual === 0
      ? 0
      : 100
    : Math.round((diferenca / anterior) * 100);

  return {
    atual,
    anterior,
    diferenca,
    variacaoPercentual,
    tendencia: diferenca > 0 ? "subindo" : diferenca < 0 ? "caindo" : "estavel",
  };
}

function montarRecomendacoes({
  comparacoes,
  materiaCritica,
  materiaEsquecida,
  revisoesAtrasadas,
  semanaAtual,
  metaMinutosDiaria,
}: {
  comparacoes: RelatorioInteligente["comparacoes"];
  materiaCritica: DesempenhoMateriaInteligente | null;
  materiaEsquecida: DesempenhoMateriaInteligente | null;
  revisoesAtrasadas: number;
  semanaAtual: ResumoPeriodo;
  metaMinutosDiaria: number;
}): RecomendacaoInteligente[] {
  const recomendacoes: RecomendacaoInteligente[] = [];

  if (revisoesAtrasadas > 0) {
    recomendacoes.push({
      id: "revisoes-atrasadas",
      prioridade: "alta",
      titulo: `Regularizar ${revisoesAtrasadas} revisão(ões) atrasada(s)`,
      descricao: "Revisões vencidas reduzem retenção e penalizam o índice de consistência.",
      rota: "/revisoes",
    });
  }

  if (materiaCritica && materiaCritica.aproveitamento < 70) {
    recomendacoes.push({
      id: `materia-critica-${normalizar(materiaCritica.materia)}`,
      prioridade: "alta",
      titulo: `Reforçar ${materiaCritica.materia}`,
      descricao: `Aproveitamento de ${materiaCritica.aproveitamento}% após ${materiaCritica.questoes} questões. Faça revisão curta e um novo bloco de questões.`,
      rota: "/questoes",
    });
  }

  if (materiaEsquecida && (materiaEsquecida.diasSemEstudar ?? 0) >= 7) {
    recomendacoes.push({
      id: `materia-esquecida-${normalizar(materiaEsquecida.materia)}`,
      prioridade: "media",
      titulo: `Retomar ${materiaEsquecida.materia}`,
      descricao: `A matéria está sem atividade há ${materiaEsquecida.diasSemEstudar} dias.`,
      rota: "/central-estudos",
    });
  }

  const metaSemanal = metaMinutosDiaria * 6;
  if (semanaAtual.minutos < metaSemanal * 0.7) {
    recomendacoes.push({
      id: "tempo-semanal",
      prioridade: "media",
      titulo: "Aumentar constância semanal",
      descricao: `Foram acumulados ${formatarMinutos(semanaAtual.minutos)} nesta semana para uma meta proporcional de ${formatarMinutos(metaSemanal)}.`,
      rota: "/central-estudos",
    });
  }

  if (comparacoes.aproveitamento.tendencia === "caindo") {
    recomendacoes.push({
      id: "queda-aproveitamento",
      prioridade: "alta",
      titulo: "Interromper queda no aproveitamento",
      descricao: `O aproveitamento caiu ${Math.abs(comparacoes.aproveitamento.diferenca)} ponto(s) em relação à semana anterior. Corrija os erros antes de aumentar o volume.`,
      rota: "/historico",
    });
  }

  if (recomendacoes.length === 0) {
    recomendacoes.push({
      id: "manter-ritmo",
      prioridade: "baixa",
      titulo: "Manter o ritmo atual",
      descricao: "Não há alerta crítico. Preserve frequência, revisões e volume de questões.",
      rota: "/plano",
    });
  }

  return recomendacoes.slice(0, 5);
}

function gerarResumoExecutivo({
  comparacoes,
  materiaCritica,
  revisoesAtrasadas,
  indiceConsistencia,
  semanaAtual,
}: {
  comparacoes: RelatorioInteligente["comparacoes"];
  materiaCritica: DesempenhoMateriaInteligente | null;
  revisoesAtrasadas: number;
  indiceConsistencia: number;
  semanaAtual: ResumoPeriodo;
}) {
  const partes: string[] = [];

  partes.push(`Índice de consistência em ${indiceConsistencia}/100.`);

  if (semanaAtual.questoes > 0) {
    partes.push(`Foram contabilizadas ${semanaAtual.questoes} questões com ${semanaAtual.aproveitamento}% de aproveitamento nos últimos 7 dias.`);
  } else {
    partes.push("Ainda não há questões suficientes na semana atual para medir o aproveitamento.");
  }

  if (comparacoes.minutos.tendencia === "subindo") {
    partes.push(`O tempo de estudo aumentou ${Math.abs(comparacoes.minutos.variacaoPercentual)}% em relação à semana anterior.`);
  } else if (comparacoes.minutos.tendencia === "caindo") {
    partes.push(`O tempo de estudo caiu ${Math.abs(comparacoes.minutos.variacaoPercentual)}% em relação à semana anterior.`);
  }

  if (materiaCritica && materiaCritica.aproveitamento < 70) {
    partes.push(`${materiaCritica.materia} é o principal ponto de atenção, com ${materiaCritica.aproveitamento}% de aproveitamento.`);
  }

  if (revisoesAtrasadas > 0) {
    partes.push(`Existem ${revisoesAtrasadas} revisão(ões) atrasada(s).`);
  }

  return partes.join(" ");
}

function calcularDiasAtivos(
  questoes: RegistroQuestao[],
  sessoes: SessaoEstudo[],
  simulados: Simulado[],
  inicio: Date,
  fim: Date
) {
  const dias = new Set<string>();
  [...questoes, ...sessoes, ...simulados].forEach((item) => {
    if (estaNoPeriodo(item.data, inicio, fim)) dias.add(chaveData(item.data));
  });
  return dias.size;
}

function estaNoPeriodo(valor: string, inicio: Date, fim: Date) {
  const tempo = tempoSeguro(valor);
  return Number.isFinite(tempo) && tempo >= inicio.getTime() && tempo <= fim.getTime();
}

function diferencaMs(a: string, b: string) {
  const ta = tempoSeguro(a);
  const tb = tempoSeguro(b);
  return Number.isFinite(ta) && Number.isFinite(tb)
    ? Math.abs(ta - tb)
    : Number.POSITIVE_INFINITY;
}

function chaveData(valor: string) {
  const data = dataSegura(valor) ?? new Date();
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function diasDesde(valor: string) {
  const data = dataSegura(valor);
  if (!data) return null;
  return Math.max(0, Math.floor((inicioDoDia(new Date()).getTime() - inicioDoDia(data).getTime()) / 86_400_000));
}

function dataSegura(valor: string | undefined) {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function tempoSeguro(valor: string | undefined) {
  return dataSegura(valor)?.getTime() ?? Number.NEGATIVE_INFINITY;
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

function adicionarDias(data: Date, dias: number) {
  const copia = new Date(data);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function numeroSeguro(valor: unknown) {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.max(minimo, Math.min(maximo, valor));
}

export function formatarMinutos(minutos: number) {
  const total = Math.max(0, Math.round(minutos));
  const horas = Math.floor(total / 60);
  const restantes = total % 60;
  if (horas === 0) return `${restantes}min`;
  if (restantes === 0) return `${horas}h`;
  return `${horas}h ${restantes}min`;
}
