import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../../types";
import {
  calcularAproveitamentoSimulado,
  calcularMetricasConsolidadas,
} from "../../utils/metricasConsolidadas";

import type {
  DadosCentral,
  DesempenhoAssunto,
  DesempenhoBanca,
  DesempenhoMateria,
  MissaoDia,
} from "./types";

const DIA_MS = 86_400_000;

export function calcularCentralInteligencia({
  questoes,
  sessoes,
  revisoes,
  simulados,
  metaMinutos,
  metaQuestoes,
  metaRevisoes,
}: {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
  metaMinutos: number;
  metaQuestoes: number;
  metaRevisoes: number;
}): DadosCentral {
  const agora = new Date();
  const inicioHoje = inicioDoDia(agora);
  const fimHoje = fimDoDia(agora);
  const inicioSemana = adicionarDias(inicioHoje, -6);

  const hoje = calcularMetricasConsolidadas({
    questoes,
    sessoes,
    simulados,
    inicio: inicioHoje,
    fim: fimHoje,
  });
  const semana = calcularMetricasConsolidadas({
    questoes,
    sessoes,
    simulados,
    inicio: inicioSemana,
    fim: fimHoje,
  });
  const total = calcularMetricasConsolidadas({
    questoes,
    sessoes,
    simulados,
  });

  const revisoesConcluidasHoje = revisoes.filter(
    (revisao) =>
      revisao.concluida &&
      revisao.dataConclusao &&
      estaNoPeriodo(revisao.dataConclusao, inicioHoje, fimHoje)
  );

  const revisoesAtrasadas = revisoes
    .filter((revisao) => {
      const prevista = dataSegura(revisao.dataPrevista);
      return !revisao.concluida && Boolean(prevista && prevista < inicioHoje);
    })
    .sort(
      (a, b) =>
        tempoSeguro(a.dataPrevista) - tempoSeguro(b.dataPrevista)
    );

  const revisoesHoje = revisoes.filter(
    (revisao) =>
      !revisao.concluida &&
      estaNoPeriodo(revisao.dataPrevista, inicioHoje, fimHoje)
  );

  const materias = calcularDesempenhoMaterias(questoes, sessoes);
  const assuntos = calcularDesempenhoAssuntos(questoes);
  const bancas = calcularDesempenhoBancas(questoes);

  const materiasComBase = materias.filter((materia) => materia.total >= 5);
  const melhorMateria =
    [...materiasComBase].sort((a, b) => b.percentual - a.percentual)[0] ?? null;
  const piorMateria =
    [...materiasComBase].sort((a, b) => a.percentual - b.percentual)[0] ?? null;
  const materiaEsquecida =
    [...materias]
      .filter((materia) => materia.diasSemEstudar >= 7 && materia.diasSemEstudar < 999)
      .sort((a, b) => b.diasSemEstudar - a.diasSemEstudar)[0] ?? null;

  const assuntosCriticos = assuntos
    .filter((assunto) => assunto.total >= 5 && assunto.percentual < 70)
    .sort((a, b) => a.percentual - b.percentual || b.total - a.total)
    .slice(0, 5);

  const assuntosDominados = assuntos
    .filter((assunto) => assunto.total >= 5 && assunto.percentual >= 80)
    .sort((a, b) => b.percentual - a.percentual || b.total - a.total)
    .slice(0, 5);

  const diasAtivosSemana = calcularDiasAtivos(
    questoes,
    sessoes,
    simulados,
    inicioSemana,
    fimHoje
  );
  const desempenhoSimulados = calcularDesempenhoSimulados(simulados);

  const indiceProntidao = calcularIndiceProntidao({
    aproveitamentoQuestoes: total.aproveitamento,
    aproveitamentoSimulados: desempenhoSimulados.percentual,
    possuiSimulados: desempenhoSimulados.total > 0,
    minutosSemana: semana.minutos,
    diasAtivosSemana,
    revisoesAtrasadas: revisoesAtrasadas.length,
    totalQuestoes: total.questoesRespondidas,
    metaMinutos,
  });

  const previsaoNota = calcularPrevisaoNota({
    aproveitamentoQuestoes: total.aproveitamento,
    aproveitamentoSimulados: desempenhoSimulados.percentual,
    possuiSimulados: desempenhoSimulados.total > 0,
    totalQuestoes: total.questoesRespondidas,
  });

  // Campo legado chamado `chanceAprovacao` na interface. O valor abaixo é
  // apenas um índice heurístico de projeção, deliberadamente penalizado quando
  // a amostra de questões ainda é pequena. Não é probabilidade estatística.
  const chanceAprovacao = calcularIndiceProjecao({
    previsaoNota,
    indiceProntidao,
    totalQuestoes: total.questoesRespondidas,
    revisoesAtrasadas: revisoesAtrasadas.length,
  });

  const maiorRisco =
    piorMateria?.materia ||
    materiaEsquecida?.materia ||
    "Sem dados suficientes";

  const missoes = gerarMissoes({
    revisoesAtrasadas,
    revisoesHoje,
    assuntosCriticos,
    piorMateria,
    materiaEsquecida,
    metaMinutos,
    metaQuestoes,
    metaRevisoes,
  });

  return {
    indiceProntidao,
    classificacao: classificarProntidao(indiceProntidao),

    hoje: {
      minutos: hoje.minutos,
      questoes: hoje.questoesRespondidas,
      certas: hoje.certas,
      erradas: hoje.erradas,
      percentual: hoje.aproveitamento,
      revisoesConcluidas: revisoesConcluidasHoje.length,
    },

    semana: {
      minutos: semana.minutos,
      questoes: semana.questoesRespondidas,
      certas: semana.certas,
      erradas: semana.erradas,
      percentual: semana.aproveitamento,
      sessoes: semana.sessoes,
      diasAtivos: diasAtivosSemana,
    },

    total: {
      minutos: total.minutos,
      questoes: total.questoesRespondidas,
      percentual: total.aproveitamento,
      simulados: simulados.length,
      revisoesConcluidas: revisoes.filter((revisao) => revisao.concluida).length,
    },

    revisoesAtrasadas,
    revisoesHoje,
    materias,
    assuntosCriticos,
    assuntosDominados,
    bancas,
    melhorMateria,
    piorMateria,
    materiaEsquecida,
    previsaoNota,
    chanceAprovacao,
    maiorRisco,
    missoes,
    tempoMissao: missoes.reduce((soma, missao) => soma + missao.minutos, 0),
  };
}

function calcularDesempenhoMaterias(
  questoes: RegistroQuestao[],
  sessoes: SessaoEstudo[]
): DesempenhoMateria[] {
  const mapa = new Map<string, DesempenhoMateria>();

  function obter(nomeOriginal: string) {
    const materia = nomeOriginal.trim() || "Sem matéria";
    const chave = normalizarTexto(materia);
    const existente = mapa.get(chave);
    if (existente) return existente;

    const novo: DesempenhoMateria = {
      materia,
      certas: 0,
      erradas: 0,
      total: 0,
      percentual: 0,
      minutos: 0,
      ultimaAtividade: undefined,
      diasSemEstudar: 999,
    };
    mapa.set(chave, novo);
    return novo;
  }

  questoes.forEach((registro) => {
    const item = obter(registro.materia);
    item.certas += numeroSeguro(registro.certas);
    item.erradas += numeroSeguro(registro.erradas);
    item.total = item.certas + item.erradas;
    item.percentual = item.total === 0 ? 0 : Math.round((item.certas / item.total) * 100);

    const duplicadoPorSessao = sessoes.some((sessao) =>
      sessao.tipo === "questoes" &&
      normalizarTexto(sessao.materia) === normalizarTexto(registro.materia) &&
      normalizarTexto(sessao.assunto) === normalizarTexto(registro.assunto) &&
      diferencaMs(sessao.data, registro.data) < 5000
    );
    if (!duplicadoPorSessao) item.minutos += numeroSeguro(registro.minutos);
    item.ultimaAtividade = dataMaisRecente(item.ultimaAtividade, registro.data);
  });

  sessoes.forEach((sessao) => {
    const item = obter(sessao.materia);
    item.minutos += numeroSeguro(sessao.minutos);
    item.ultimaAtividade = dataMaisRecente(item.ultimaAtividade, sessao.data);
  });

  return Array.from(mapa.values())
    .map((materia) => ({
      ...materia,
      diasSemEstudar: materia.ultimaAtividade
        ? calcularDiasDesde(materia.ultimaAtividade)
        : 999,
    }))
    .sort((a, b) => b.total - a.total || b.minutos - a.minutos);
}

function calcularDesempenhoAssuntos(
  questoes: RegistroQuestao[]
): DesempenhoAssunto[] {
  const mapa = new Map<string, DesempenhoAssunto>();

  questoes.forEach((registro) => {
    const materia = registro.materia.trim() || "Sem matéria";
    const assunto = registro.assunto.trim() || "Sem assunto";
    const chave = `${normalizarTexto(materia)}::${normalizarTexto(assunto)}`;
    const item = mapa.get(chave) ?? {
      chave,
      materia,
      assunto,
      certas: 0,
      erradas: 0,
      total: 0,
      percentual: 0,
    };

    item.certas += numeroSeguro(registro.certas);
    item.erradas += numeroSeguro(registro.erradas);
    item.total = item.certas + item.erradas;
    item.percentual = item.total === 0 ? 0 : Math.round((item.certas / item.total) * 100);
    mapa.set(chave, item);
  });

  return Array.from(mapa.values());
}

function calcularDesempenhoBancas(
  questoes: RegistroQuestao[]
): DesempenhoBanca[] {
  const mapa = new Map<string, DesempenhoBanca>();

  questoes.forEach((registro) => {
    const banca = registro.banca.trim() || "Não informada";
    const chave = normalizarTexto(banca);
    const item = mapa.get(chave) ?? {
      banca,
      certas: 0,
      erradas: 0,
      total: 0,
      percentual: 0,
    };

    item.certas += numeroSeguro(registro.certas);
    item.erradas += numeroSeguro(registro.erradas);
    item.total = item.certas + item.erradas;
    item.percentual = item.total === 0 ? 0 : Math.round((item.certas / item.total) * 100);
    mapa.set(chave, item);
  });

  return Array.from(mapa.values())
    .sort((a, b) => a.percentual - b.percentual || b.total - a.total);
}

function calcularDesempenhoSimulados(simulados: Simulado[]) {
  if (simulados.length === 0) {
    return { total: 0, percentual: 0 };
  }

  const certas = simulados.reduce(
    (total, simulado) => total + numeroSeguro(simulado.certas),
    0
  );
  const erradas = simulados.reduce(
    (total, simulado) => total + numeroSeguro(simulado.erradas),
    0
  );
  const respondidas = certas + erradas;

  return {
    total: simulados.length,
    percentual: respondidas === 0
      ? Math.round(
          simulados.reduce((soma, item) => soma + calcularAproveitamentoSimulado(item), 0) /
          simulados.length
        )
      : Math.round((certas / respondidas) * 100),
  };
}

function calcularIndiceProntidao({
  aproveitamentoQuestoes,
  aproveitamentoSimulados,
  possuiSimulados,
  minutosSemana,
  diasAtivosSemana,
  revisoesAtrasadas,
  totalQuestoes,
  metaMinutos,
}: {
  aproveitamentoQuestoes: number;
  aproveitamentoSimulados: number;
  possuiSimulados: boolean;
  minutosSemana: number;
  diasAtivosSemana: number;
  revisoesAtrasadas: number;
  totalQuestoes: number;
  metaMinutos: number;
}) {
  const metaSemanal = Math.max(numeroSeguro(metaMinutos) * 6, 1);
  const notaTempo = limitar((minutosSemana / metaSemanal) * 100, 0, 100);
  const notaFrequencia = limitar((diasAtivosSemana / 6) * 100, 0, 100);
  const notaAmostra = limitar((totalQuestoes / 100) * 100, 0, 100);
  const desempenho = possuiSimulados
    ? aproveitamentoQuestoes * 0.65 + aproveitamentoSimulados * 0.35
    : aproveitamentoQuestoes;
  const penalidadeRevisoes = Math.min(revisoesAtrasadas * 3, 24);

  return Math.round(limitar(
    desempenho * 0.5 +
    notaTempo * 0.2 +
    notaFrequencia * 0.2 +
    notaAmostra * 0.1 -
    penalidadeRevisoes,
    0,
    100
  ));
}

function calcularPrevisaoNota({
  aproveitamentoQuestoes,
  aproveitamentoSimulados,
  possuiSimulados,
  totalQuestoes,
}: {
  aproveitamentoQuestoes: number;
  aproveitamentoSimulados: number;
  possuiSimulados: boolean;
  totalQuestoes: number;
}) {
  if (totalQuestoes === 0 && !possuiSimulados) return 0;
  const base = possuiSimulados
    ? aproveitamentoQuestoes * 0.55 + aproveitamentoSimulados * 0.45
    : aproveitamentoQuestoes;
  return Math.round(limitar(base, 0, 100));
}

function calcularIndiceProjecao({
  previsaoNota,
  indiceProntidao,
  totalQuestoes,
  revisoesAtrasadas,
}: {
  previsaoNota: number;
  indiceProntidao: number;
  totalQuestoes: number;
  revisoesAtrasadas: number;
}) {
  const confiancaAmostra = limitar((totalQuestoes / 200) * 100, 0, 100);
  const bruto =
    previsaoNota * 0.5 +
    indiceProntidao * 0.35 +
    confiancaAmostra * 0.15 -
    Math.min(revisoesAtrasadas * 2, 16);

  return Math.round(limitar(bruto, 0, 95));
}

function gerarMissoes({
  revisoesAtrasadas,
  revisoesHoje,
  assuntosCriticos,
  piorMateria,
  materiaEsquecida,
  metaMinutos,
  metaQuestoes,
  metaRevisoes,
}: {
  revisoesAtrasadas: Revisao[];
  revisoesHoje: Revisao[];
  assuntosCriticos: DesempenhoAssunto[];
  piorMateria: DesempenhoMateria | null;
  materiaEsquecida: DesempenhoMateria | null;
  metaMinutos: number;
  metaQuestoes: number;
  metaRevisoes: number;
}): MissaoDia[] {
  const candidatas: MissaoDia[] = [];
  const revisoesPrioritarias = [...revisoesAtrasadas, ...revisoesHoje];

  if (revisoesPrioritarias.length > 0) {
    const primeira = revisoesPrioritarias[0];
    candidatas.push({
      id: "missao-revisoes",
      tipo: "revisao",
      titulo: "Regularizar revisões prioritárias",
      descricao: `${revisoesPrioritarias.length} revisão(ões) aguardando execução. Comece por ${primeira.materia} — ${primeira.assunto}.`,
      materia: primeira.materia,
      assunto: primeira.assunto,
      minutos: Math.max(15, Math.min(30, Math.round(numeroSeguro(metaMinutos) * 0.25) || 20)),
      prioridade: "alta",
      rota: "/revisoes",
    });
  }

  const critico = assuntosCriticos[0];
  if (critico) {
    candidatas.push({
      id: `missao-questoes-${critico.chave}`,
      tipo: "questoes",
      titulo: `Reforçar ${critico.assunto}`,
      descricao: `Aproveitamento de ${critico.percentual}% em ${critico.total} questões. Faça um novo bloco após revisar os erros.`,
      materia: critico.materia,
      assunto: critico.assunto,
      minutos: 30,
      quantidadeQuestoes: Math.max(5, Math.min(20, numeroSeguro(metaQuestoes) || 10)),
      prioridade: "alta",
      rota: "/gerar-simulado-ia",
    });
  } else if (piorMateria && piorMateria.percentual < 75) {
    candidatas.push({
      id: `missao-materia-${normalizarTexto(piorMateria.materia)}`,
      tipo: "questoes",
      titulo: `Consolidar ${piorMateria.materia}`,
      descricao: `Aproveitamento acumulado de ${piorMateria.percentual}%. Priorize correção de erros antes de aumentar o volume.`,
      materia: piorMateria.materia,
      minutos: 30,
      quantidadeQuestoes: Math.max(5, Math.min(20, numeroSeguro(metaQuestoes) || 10)),
      prioridade: "media",
      rota: "/questoes",
    });
  }

  if (materiaEsquecida) {
    candidatas.push({
      id: `missao-retomar-${normalizarTexto(materiaEsquecida.materia)}`,
      tipo: "estudo",
      titulo: `Retomar ${materiaEsquecida.materia}`,
      descricao: `Sem atividade registrada há ${materiaEsquecida.diasSemEstudar} dias.`,
      materia: materiaEsquecida.materia,
      minutos: 30,
      prioridade: "media",
      rota: "/central-estudos",
    });
  }

  if (candidatas.length === 0) {
    candidatas.push({
      id: "missao-manter-ritmo",
      tipo: "questoes",
      titulo: "Manter ritmo com questões",
      descricao: "Não há alerta crítico. Use um bloco curto de questões para manter frequência e gerar novos dados.",
      minutos: 30,
      quantidadeQuestoes: Math.max(5, Math.min(20, numeroSeguro(metaQuestoes) || 10)),
      prioridade: "baixa",
      rota: "/questoes",
    });
  }

  const maxRevisoes = Math.max(1, Math.min(5, numeroSeguro(metaRevisoes) || 1));
  void maxRevisoes;

  return encaixarNoTempo(candidatas, Math.max(20, numeroSeguro(metaMinutos) || 60));
}

function encaixarNoTempo(missoes: MissaoDia[], limite: number) {
  const resultado: MissaoDia[] = [];
  let usado = 0;

  for (const missao of missoes) {
    if (usado >= limite) break;
    const restante = limite - usado;
    if (restante < 10) break;

    const minutos = Math.min(missao.minutos, restante);
    resultado.push({ ...missao, minutos });
    usado += minutos;
  }

  return resultado;
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
    if (estaNoPeriodo(item.data, inicio, fim)) {
      dias.add(chaveData(item.data));
    }
  });

  return dias.size;
}

function classificarProntidao(indice: number) {
  if (indice >= 85) return "Prontidão muito alta";
  if (indice >= 70) return "Boa prontidão";
  if (indice >= 50) return "Prontidão intermediária";
  return "Prontidão insuficiente";
}

function dataMaisRecente(atual: string | undefined, candidata: string) {
  if (!atual) return candidata;
  return tempoSeguro(candidata) > tempoSeguro(atual) ? candidata : atual;
}

function calcularDiasDesde(valor: string) {
  const data = dataSegura(valor);
  if (!data) return 999;
  return Math.max(
    0,
    Math.floor((inicioDoDia(new Date()).getTime() - inicioDoDia(data).getTime()) / DIA_MS)
  );
}

function estaNoPeriodo(valor: string, inicio: Date, fim: Date) {
  const tempo = tempoSeguro(valor);
  return Number.isFinite(tempo) && tempo >= inicio.getTime() && tempo <= fim.getTime();
}

function dataSegura(valor: string | undefined) {
  if (!valor) return null;
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? null : data;
}

function tempoSeguro(valor: string | undefined) {
  return dataSegura(valor)?.getTime() ?? Number.NEGATIVE_INFINITY;
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

function normalizarTexto(valor: string) {
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
