import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../../types";
import { calcularMetricasConsolidadas, resumirSimulado } from "../../utils/metricasConsolidadas";
import type {
  DadosCentral,
  DesempenhoAssunto,
  DesempenhoBanca,
  DesempenhoMateria,
  MissaoDia,
} from "./types";

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

  const metricasHoje = calcularMetricasConsolidadas({
    questoes,
    sessoes,
    revisoes,
    simulados,
    inicio: inicioHoje,
    fim: fimHoje,
  });
  const metricasSemana = calcularMetricasConsolidadas({
    questoes,
    sessoes,
    revisoes,
    simulados,
    inicio: inicioSemana,
    fim: fimHoje,
  });
  const metricasTotal = calcularMetricasConsolidadas({
    questoes,
    sessoes,
    revisoes,
    simulados,
  });

  const revisoesAtrasadas = revisoes
    .filter(
      (revisao) =>
        !revisao.concluida &&
        dataSegura(revisao.dataPrevista).getTime() < inicioHoje.getTime()
    )
    .sort(
      (a, b) =>
        dataSegura(a.dataPrevista).getTime() - dataSegura(b.dataPrevista).getTime()
    );

  const revisoesHoje = revisoes.filter((revisao) => {
    if (revisao.concluida) return false;
    const data = dataSegura(revisao.dataPrevista);
    return data >= inicioHoje && data <= fimHoje;
  });

  const materias = calcularDesempenhoMaterias(questoes, sessoes);
  const assuntos = calcularDesempenhoAssuntos(questoes);
  const bancas = calcularDesempenhoBancas(questoes);
  const materiasComQuestoes = materias.filter((materia) => materia.total >= 3);
  const melhorMateria =
    [...materiasComQuestoes].sort((a, b) => b.percentual - a.percentual)[0] ?? null;
  const piorMateria =
    [...materiasComQuestoes].sort((a, b) => a.percentual - b.percentual)[0] ?? null;
  const materiaEsquecida =
    [...materias].sort((a, b) => b.diasSemEstudar - a.diasSemEstudar)[0] ?? null;

  const assuntosCriticos = assuntos
    .filter((assunto) => assunto.total >= 3 && assunto.percentual < 70)
    .sort((a, b) => a.percentual - b.percentual)
    .slice(0, 5);
  const assuntosDominados = assuntos
    .filter((assunto) => assunto.total >= 5 && assunto.percentual >= 80)
    .sort((a, b) => b.percentual - a.percentual)
    .slice(0, 5);

  const aproveitamentoSimulados = calcularAproveitamentoSimulados(simulados);
  const indiceProntidao = calcularIndiceProntidao({
    aproveitamentoQuestoes: metricasTotal.aproveitamento,
    aproveitamentoSimulados,
    minutosSemana: metricasSemana.minutos,
    diasAtivosSemana: metricasSemana.diasAtivos,
    revisoesAtrasadas: revisoesAtrasadas.length,
    totalQuestoes: metricasTotal.questoes,
    metaMinutos,
  });

  const previsaoNota = limitar(
    Math.round(
      metricasTotal.aproveitamento * 0.55 +
        aproveitamentoSimulados * 0.3 +
        indiceProntidao * 0.15
    ),
    0,
    100
  );

  const chanceAprovacao = limitar(
    Math.round(previsaoNota * 0.65 + indiceProntidao * 0.35 - revisoesAtrasadas.length * 1.5),
    0,
    100
  );

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
      minutos: metricasHoje.minutos,
      questoes: metricasHoje.questoes,
      certas: metricasHoje.certas,
      erradas: metricasHoje.erradas + metricasHoje.emBranco,
      percentual: metricasHoje.aproveitamento,
      revisoesConcluidas: metricasHoje.revisoesConcluidas,
    },
    semana: {
      minutos: metricasSemana.minutos,
      questoes: metricasSemana.questoes,
      certas: metricasSemana.certas,
      erradas: metricasSemana.erradas + metricasSemana.emBranco,
      percentual: metricasSemana.aproveitamento,
      sessoes: metricasSemana.sessoes,
      diasAtivos: metricasSemana.diasAtivos,
    },
    total: {
      minutos: metricasTotal.minutos,
      questoes: metricasTotal.questoes,
      percentual: metricasTotal.aproveitamento,
      simulados: metricasTotal.simulados,
      revisoesConcluidas: metricasTotal.revisoesConcluidas,
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
    maiorRisco: piorMateria?.materia || materiaEsquecida?.materia || "Sem dados suficientes",
    missoes,
    tempoMissao: missoes.reduce((total, missao) => total + missao.minutos, 0),
  };
}

function calcularDesempenhoMaterias(
  questoes: RegistroQuestao[],
  sessoes: SessaoEstudo[]
): DesempenhoMateria[] {
  const mapa = new Map<string, DesempenhoMateria>();
  const obter = (materiaOriginal: string) => {
    const materia = materiaOriginal.trim() || "Sem matéria";
    const chave = normalizar(materia);
    const atual = mapa.get(chave) ?? {
      materia,
      certas: 0,
      erradas: 0,
      total: 0,
      percentual: 0,
      minutos: 0,
      ultimaAtividade: undefined,
      diasSemEstudar: 999,
    };
    mapa.set(chave, atual);
    return atual;
  };

  questoes.forEach((registro) => {
    const atual = obter(registro.materia);
    atual.certas += numeroSeguro(registro.certas);
    atual.erradas += numeroSeguro(registro.erradas) + numeroSeguro(registro.emBranco);
    atual.total = atual.certas + atual.erradas;
    atual.percentual = atual.total === 0 ? 0 : Math.round((atual.certas / atual.total) * 100);
    atual.minutos += numeroSeguro(registro.minutos);
    atualizarUltimaAtividade(atual, registro.data);
  });

  sessoes.forEach((sessao) => {
    const atual = obter(sessao.materia);
    atual.minutos += numeroSeguro(sessao.minutos);
    atualizarUltimaAtividade(atual, sessao.data);
  });

  return Array.from(mapa.values())
    .map((materia) => ({
      ...materia,
      diasSemEstudar: materia.ultimaAtividade ? diasDesde(materia.ultimaAtividade) : 999,
    }))
    .sort((a, b) => b.total - a.total || b.minutos - a.minutos);
}

function calcularDesempenhoAssuntos(questoes: RegistroQuestao[]): DesempenhoAssunto[] {
  const mapa = new Map<string, DesempenhoAssunto>();
  questoes.forEach((registro) => {
    const materia = registro.materia.trim() || "Sem matéria";
    const assunto = registro.assunto.trim() || "Sem assunto";
    const chave = `${normalizar(materia)}::${normalizar(assunto)}`;
    const atual = mapa.get(chave) ?? {
      chave,
      materia,
      assunto,
      certas: 0,
      erradas: 0,
      total: 0,
      percentual: 0,
    };
    atual.certas += numeroSeguro(registro.certas);
    atual.erradas += numeroSeguro(registro.erradas) + numeroSeguro(registro.emBranco);
    atual.total = atual.certas + atual.erradas;
    atual.percentual = atual.total === 0 ? 0 : Math.round((atual.certas / atual.total) * 100);
    mapa.set(chave, atual);
  });
  return Array.from(mapa.values());
}

function calcularDesempenhoBancas(questoes: RegistroQuestao[]): DesempenhoBanca[] {
  const mapa = new Map<string, DesempenhoBanca>();
  questoes.forEach((registro) => {
    const banca = registro.banca.trim() || "Não informada";
    const chave = normalizar(banca);
    const atual = mapa.get(chave) ?? {
      banca,
      certas: 0,
      erradas: 0,
      total: 0,
      percentual: 0,
    };
    atual.certas += numeroSeguro(registro.certas);
    atual.erradas += numeroSeguro(registro.erradas) + numeroSeguro(registro.emBranco);
    atual.total = atual.certas + atual.erradas;
    atual.percentual = atual.total === 0 ? 0 : Math.round((atual.certas / atual.total) * 100);
    mapa.set(chave, atual);
  });
  return Array.from(mapa.values()).sort((a, b) => b.total - a.total);
}

function calcularAproveitamentoSimulados(simulados: Simulado[]) {
  if (simulados.length === 0) return 0;
  let certas = 0;
  let validas = 0;
  simulados.forEach((simulado) => {
    const resumo = resumirSimulado(simulado);
    certas += resumo.certas;
    validas += resumo.validas;
  });
  return validas === 0 ? 0 : Math.round((certas / validas) * 100);
}

function calcularIndiceProntidao({
  aproveitamentoQuestoes,
  aproveitamentoSimulados,
  minutosSemana,
  diasAtivosSemana,
  revisoesAtrasadas,
  totalQuestoes,
  metaMinutos,
}: {
  aproveitamentoQuestoes: number;
  aproveitamentoSimulados: number;
  minutosSemana: number;
  diasAtivosSemana: number;
  revisoesAtrasadas: number;
  totalQuestoes: number;
  metaMinutos: number;
}) {
  const notaQuestoes = totalQuestoes > 0 ? aproveitamentoQuestoes : 0;
  const notaSimulado = aproveitamentoSimulados || notaQuestoes;
  const metaSemanal = Math.max(metaMinutos * 6, 1);
  const notaTempo = limitar(Math.round((minutosSemana / metaSemanal) * 100), 0, 100);
  const notaFrequencia = limitar(Math.round((diasAtivosSemana / 6) * 100), 0, 100);
  const confiancaAmostra = limitar(Math.round((totalQuestoes / 100) * 100), 15, 100);
  const base =
    notaQuestoes * 0.35 +
    notaSimulado * 0.2 +
    notaTempo * 0.2 +
    notaFrequencia * 0.15 +
    confiancaAmostra * 0.1;
  return limitar(Math.round(base - Math.min(revisoesAtrasadas * 2, 20)), 0, 100);
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
  const missoes: MissaoDia[] = [];
  const limiteTempo = Math.max(20, metaMinutos || 60);
  let usado = 0;
  const adicionar = (missao: MissaoDia) => {
    if (missoes.length >= 4 || usado + missao.minutos > limiteTempo) return;
    missoes.push(missao);
    usado += missao.minutos;
  };

  const revisao = revisoesAtrasadas[0] ?? revisoesHoje[0];
  if (revisao) {
    adicionar({
      id: `inteligencia-revisao-${revisao.id}`,
      tipo: "revisao",
      titulo: revisoesAtrasadas.length ? "Regularizar revisão atrasada" : "Executar revisão de hoje",
      descricao: `${revisao.materia} — ${revisao.assunto}`,
      materia: revisao.materia,
      assunto: revisao.assunto,
      minutos: Math.min(25, limiteTempo),
      quantidadeQuestoes: Math.min(Math.max(metaRevisoes, 0), 10),
      prioridade: "alta",
      rota: "/revisoes",
    });
  }

  const critico = assuntosCriticos[0];
  if (critico) {
    adicionar({
      id: `inteligencia-questoes-${critico.chave}`,
      tipo: "questoes",
      titulo: `Reforçar ${critico.assunto}`,
      descricao: `${critico.materia}: ${critico.percentual}% de aproveitamento.`,
      materia: critico.materia,
      assunto: critico.assunto,
      minutos: Math.min(30, limiteTempo),
      quantidadeQuestoes: Math.max(5, Math.min(metaQuestoes || 10, 20)),
      prioridade: "alta",
      rota: "/gerar-simulado-ia",
    });
  } else if (piorMateria) {
    adicionar({
      id: `inteligencia-materia-${normalizar(piorMateria.materia)}`,
      tipo: "questoes",
      titulo: `Consolidar ${piorMateria.materia}`,
      descricao: `Aproveitamento atual de ${piorMateria.percentual}%.`,
      materia: piorMateria.materia,
      minutos: Math.min(30, limiteTempo),
      quantidadeQuestoes: Math.max(5, Math.min(metaQuestoes || 10, 20)),
      prioridade: "media",
      rota: "/questoes",
    });
  }

  if (materiaEsquecida && materiaEsquecida.diasSemEstudar >= 7) {
    adicionar({
      id: `inteligencia-retomar-${normalizar(materiaEsquecida.materia)}`,
      tipo: "estudo",
      titulo: `Retomar ${materiaEsquecida.materia}`,
      descricao: `Sem atividade registrada há ${materiaEsquecida.diasSemEstudar} dias.`,
      materia: materiaEsquecida.materia,
      minutos: Math.min(25, limiteTempo),
      prioridade: "media",
      rota: "/central-estudos",
    });
  }

  return missoes;
}

function classificarProntidao(indice: number) {
  if (indice >= 85) return "Preparação muito consistente";
  if (indice >= 70) return "Boa preparação";
  if (indice >= 50) return "Preparação intermediária";
  return "Base ainda em construção";
}
function atualizarUltimaAtividade(item: DesempenhoMateria, data: string) {
  if (!item.ultimaAtividade || dataSegura(data) > dataSegura(item.ultimaAtividade)) item.ultimaAtividade = data;
}
function dataSegura(valor?: string) {
  if (!valor) return new Date(0);
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? new Date(0) : data;
}
function inicioDoDia(data: Date) {
  const copia = new Date(data); copia.setHours(0, 0, 0, 0); return copia;
}
function fimDoDia(data: Date) {
  const copia = new Date(data); copia.setHours(23, 59, 59, 999); return copia;
}
function adicionarDias(data: Date, dias: number) {
  const copia = new Date(data); copia.setDate(copia.getDate() + dias); return copia;
}
function diasDesde(valor: string) {
  return Math.max(0, Math.floor((inicioDoDia(new Date()).getTime() - inicioDoDia(dataSegura(valor)).getTime()) / 86400000));
}
function numeroSeguro(valor: unknown) {
  const numero = Number(valor); return Number.isFinite(numero) && numero > 0 ? numero : 0;
}
function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase().replace(/\s+/g, " ");
}
function limitar(valor: number, minimo: number, maximo: number) {
  return Math.min(maximo, Math.max(minimo, valor));
}
