import type {
  ConfiguracoesApp,
  Materia,
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../types";
import {
  calcularMetricasConsolidadas,
  resumirSimulado,
} from "../utils/metricasConsolidadas";

export type RaridadeConquistaPermanente =
  | "bronze"
  | "prata"
  | "ouro"
  | "lendaria";

export type CategoriaConquistaPermanente =
  | "inicio"
  | "questoes"
  | "foco"
  | "constancia"
  | "revisao"
  | "simulado"
  | "missao"
  | "dominio";

export type ConquistaPermanente = {
  id: string;
  icone: string;
  titulo: string;
  descricao: string;
  raridade: RaridadeConquistaPermanente;
  categoria: CategoriaConquistaPermanente;
  moedas: number;
  desbloqueada: boolean;
  progresso: number;
  atual: string;
};

type EntradaConquistas = {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
  materias: Materia[];
  missoesConcluidas: string[];
  configuracoes: ConfiguracoesApp;
  recompensasRecebidas?: string[];
};

export const PREFIXO_RECOMPENSA_CONQUISTA = "conquista-marco:";

export function idRecompensaConquista(id: string) {
  return `${PREFIXO_RECOMPENSA_CONQUISTA}${id}`;
}

export function calcularConquistasPermanentes(
  entrada: EntradaConquistas
): ConquistaPermanente[] {
  const totalQuestoes = entrada.questoes.reduce(
    (total, item) => total + item.certas + item.erradas,
    0
  );
  const minutos = entrada.sessoes.reduce(
    (total, item) => total + Math.max(0, item.minutos || 0),
    0
  );
  const revisoesConcluidas = entrada.revisoes.filter(
    (item) => item.concluida
  ).length;
  const missoes = new Set(entrada.missoesConcluidas).size;
  const recebidas = new Set(entrada.recompensasRecebidas ?? []);
  const melhorSequencia = calcularMelhorSequencia(entrada);
  const melhorSimulado = entrada.simulados.reduce(
    (melhor, simulado) => Math.max(melhor, resumirSimulado(simulado).aproveitamento),
    0
  );
  const gabaritou = teveTreinoPerfeito(entrada);
  const materiasEstudadas = contarMateriasEstudadas(entrada);
  const totalMaterias = entrada.materias.length;
  const polivalente = totalMaterias > 0 && materiasEstudadas >= totalMaterias;
  const diasMetaDupla = contarDiasMetaDupla(entrada);

  const criarMeta = (config: {
    id: string;
    icone: string;
    titulo: string;
    descricao: string;
    raridade: RaridadeConquistaPermanente;
    categoria: CategoriaConquistaPermanente;
    moedas: number;
    valor: number;
    meta: number;
    atual: string;
  }): ConquistaPermanente => {
    const permanente = recebidas.has(idRecompensaConquista(config.id));
    const atingida = config.valor >= config.meta;
    return {
      id: config.id,
      icone: config.icone,
      titulo: config.titulo,
      descricao: config.descricao,
      raridade: config.raridade,
      categoria: config.categoria,
      moedas: config.moedas,
      desbloqueada: permanente || atingida,
      progresso: permanente
        ? 100
        : percentual(config.valor, config.meta),
      atual: config.atual,
    };
  };

  const criarCondicao = (config: {
    id: string;
    icone: string;
    titulo: string;
    descricao: string;
    raridade: RaridadeConquistaPermanente;
    categoria: CategoriaConquistaPermanente;
    moedas: number;
    atingida: boolean;
    progresso: number;
    atual: string;
  }): ConquistaPermanente => {
    const permanente = recebidas.has(idRecompensaConquista(config.id));
    return {
      id: config.id,
      icone: config.icone,
      titulo: config.titulo,
      descricao: config.descricao,
      raridade: config.raridade,
      categoria: config.categoria,
      moedas: config.moedas,
      desbloqueada: permanente || config.atingida,
      progresso: permanente ? 100 : Math.min(100, Math.max(0, config.progresso)),
      atual: config.atual,
    };
  };

  return [
    criarMeta({
      id: "primeiro-passo",
      icone: "🚀",
      titulo: "Primeiro Passo",
      descricao: "Conclua sua primeira sessão de estudo.",
      raridade: "bronze",
      categoria: "inicio",
      moedas: 5,
      valor: entrada.sessoes.length,
      meta: 1,
      atual: entrada.sessoes.length > 0 ? "Primeira sessão concluída" : "0/1 sessão",
    }),
    criarMeta({
      id: "questoes-100",
      icone: "🎯",
      titulo: "Aquecimento",
      descricao: "Resolva 100 questões.",
      raridade: "bronze",
      categoria: "questoes",
      moedas: 5,
      valor: totalQuestoes,
      meta: 100,
      atual: `${formatarNumero(totalQuestoes)}/100 questões`,
    }),
    criarMeta({
      id: "questoes-500",
      icone: "⚡",
      titulo: "Ritmo Forte",
      descricao: "Resolva 500 questões.",
      raridade: "prata",
      categoria: "questoes",
      moedas: 10,
      valor: totalQuestoes,
      meta: 500,
      atual: `${formatarNumero(totalQuestoes)}/500 questões`,
    }),
    criarMeta({
      id: "questoes-1000",
      icone: "🏹",
      titulo: "Mil Questões",
      descricao: "Alcance 1.000 questões resolvidas.",
      raridade: "ouro",
      categoria: "questoes",
      moedas: 20,
      valor: totalQuestoes,
      meta: 1000,
      atual: `${formatarNumero(totalQuestoes)}/1.000 questões`,
    }),
    criarMeta({
      id: "questoes-5000",
      icone: "👑",
      titulo: "Máquina de Questões",
      descricao: "Alcance 5.000 questões resolvidas.",
      raridade: "lendaria",
      categoria: "questoes",
      moedas: 40,
      valor: totalQuestoes,
      meta: 5000,
      atual: `${formatarNumero(totalQuestoes)}/5.000 questões`,
    }),
    criarMeta({
      id: "foco-10h",
      icone: "⏱️",
      titulo: "10 Horas de Foco",
      descricao: "Acumule 10 horas de estudo registradas.",
      raridade: "bronze",
      categoria: "foco",
      moedas: 5,
      valor: minutos,
      meta: 600,
      atual: `${formatarHoras(minutos)}/10h`,
    }),
    criarMeta({
      id: "foco-50h",
      icone: "🔥",
      titulo: "50 Horas de Foco",
      descricao: "Acumule 50 horas de estudo registradas.",
      raridade: "prata",
      categoria: "foco",
      moedas: 10,
      valor: minutos,
      meta: 3000,
      atual: `${formatarHoras(minutos)}/50h`,
    }),
    criarMeta({
      id: "foco-100h",
      icone: "💠",
      titulo: "Centurião do Foco",
      descricao: "Acumule 100 horas de estudo registradas.",
      raridade: "ouro",
      categoria: "foco",
      moedas: 20,
      valor: minutos,
      meta: 6000,
      atual: `${formatarHoras(minutos)}/100h`,
    }),
    criarMeta({
      id: "sequencia-7",
      icone: "🔥",
      titulo: "Sem Desculpas",
      descricao: "Registre atividade de estudo por 7 dias consecutivos.",
      raridade: "prata",
      categoria: "constancia",
      moedas: 10,
      valor: melhorSequencia,
      meta: 7,
      atual: `${melhorSequencia}/7 dias`,
    }),
    criarMeta({
      id: "sequencia-30",
      icone: "💎",
      titulo: "Disciplina de Ferro",
      descricao: "Registre atividade de estudo por 30 dias consecutivos.",
      raridade: "lendaria",
      categoria: "constancia",
      moedas: 40,
      valor: melhorSequencia,
      meta: 30,
      atual: `${melhorSequencia}/30 dias`,
    }),
    criarMeta({
      id: "revisoes-10",
      icone: "🔁",
      titulo: "Revisor",
      descricao: "Conclua 10 revisões.",
      raridade: "bronze",
      categoria: "revisao",
      moedas: 5,
      valor: revisoesConcluidas,
      meta: 10,
      atual: `${revisoesConcluidas}/10 revisões`,
    }),
    criarMeta({
      id: "revisoes-50",
      icone: "🧠",
      titulo: "Memória Afiada",
      descricao: "Conclua 50 revisões.",
      raridade: "prata",
      categoria: "revisao",
      moedas: 10,
      valor: revisoesConcluidas,
      meta: 50,
      atual: `${revisoesConcluidas}/50 revisões`,
    }),
    criarMeta({
      id: "revisoes-100",
      icone: "🧬",
      titulo: "Revisor Nato",
      descricao: "Conclua 100 revisões.",
      raridade: "ouro",
      categoria: "revisao",
      moedas: 20,
      valor: revisoesConcluidas,
      meta: 100,
      atual: `${revisoesConcluidas}/100 revisões`,
    }),
    criarMeta({
      id: "simulado-80",
      icone: "🥈",
      titulo: "Simulado de Elite",
      descricao: "Alcance pelo menos 80% em um simulado.",
      raridade: "prata",
      categoria: "simulado",
      moedas: 10,
      valor: melhorSimulado,
      meta: 80,
      atual: `Melhor resultado: ${Math.round(melhorSimulado)}%`,
    }),
    criarMeta({
      id: "simulado-90",
      icone: "🏆",
      titulo: "Precisão Cirúrgica",
      descricao: "Alcance pelo menos 90% em um simulado.",
      raridade: "ouro",
      categoria: "simulado",
      moedas: 20,
      valor: melhorSimulado,
      meta: 90,
      atual: `Melhor resultado: ${Math.round(melhorSimulado)}%`,
    }),
    criarCondicao({
      id: "gabaritou",
      icone: "💯",
      titulo: "Gabaritou",
      descricao: "Feche um treino ou simulado de pelo menos 10 questões com 100% de acerto.",
      raridade: "ouro",
      categoria: "dominio",
      moedas: 20,
      atingida: gabaritou,
      progresso: gabaritou ? 100 : Math.min(99, melhorPrecisaoTreino(entrada)),
      atual: gabaritou ? "100% em bloco de 10+ questões" : "Buscando um bloco perfeito",
    }),
    criarMeta({
      id: "missoes-10",
      icone: "✅",
      titulo: "Missão Cumprida",
      descricao: "Conclua 10 missões do plano de estudos.",
      raridade: "bronze",
      categoria: "missao",
      moedas: 5,
      valor: missoes,
      meta: 10,
      atual: `${missoes}/10 missões`,
    }),
    criarMeta({
      id: "missoes-50",
      icone: "🛡️",
      titulo: "Operação Cinquenta",
      descricao: "Conclua 50 missões do plano de estudos.",
      raridade: "ouro",
      categoria: "missao",
      moedas: 20,
      valor: missoes,
      meta: 50,
      atual: `${missoes}/50 missões`,
    }),
    criarCondicao({
      id: "polivalente",
      icone: "🧭",
      titulo: "Polivalente",
      descricao: "Estude todas as matérias atualmente cadastradas pelo menos uma vez.",
      raridade: "prata",
      categoria: "dominio",
      moedas: 10,
      atingida: polivalente,
      progresso: totalMaterias ? percentual(materiasEstudadas, totalMaterias) : 0,
      atual: totalMaterias
        ? `${Math.min(materiasEstudadas, totalMaterias)}/${totalMaterias} matérias`
        : "Cadastre matérias para iniciar",
    }),
    criarMeta({
      id: "imparavel",
      icone: "🚨",
      titulo: "Imparável",
      descricao: "Bata a meta diária de tempo e de questões no mesmo dia.",
      raridade: "ouro",
      categoria: "constancia",
      moedas: 20,
      valor: diasMetaDupla,
      meta: 1,
      atual: diasMetaDupla > 0 ? "Meta dupla concluída" : "0 dias com meta dupla",
    }),
  ];
}

function calcularMelhorSequencia(entrada: EntradaConquistas) {
  const datas = listarDatasAtividade(entrada);
  if (datas.length === 0) return 0;

  let melhor = 1;
  let atual = 1;
  for (let indice = 1; indice < datas.length; indice += 1) {
    if (diferencaEmDias(datas[indice - 1], datas[indice]) === 1) {
      atual += 1;
      melhor = Math.max(melhor, atual);
    } else {
      atual = 1;
    }
  }
  return melhor;
}

function listarDatasAtividade(entrada: EntradaConquistas) {
  const datas = new Set<string>();
  entrada.sessoes.forEach((item) => adicionarData(datas, item.data));
  entrada.questoes.forEach((item) => adicionarData(datas, item.data));
  entrada.simulados.forEach((item) => adicionarData(datas, item.data));
  entrada.revisoes.forEach((item) => {
    if (item.concluida && item.dataConclusao) adicionarData(datas, item.dataConclusao);
  });
  return [...datas].sort();
}

function contarDiasMetaDupla(entrada: EntradaConquistas) {
  const metaMinutos = Math.max(
    1,
    Math.floor(Number(entrada.configuracoes.metaMinutosDiaria) || 0)
  );
  const metaQuestoes = Math.max(
    1,
    Math.floor(Number(entrada.configuracoes.metaQuestoesDiaria) || 0)
  );

  return listarDatasAtividade(entrada).filter((chave) => {
    const inicio = inicioDaChave(chave);
    const fim = new Date(inicio);
    fim.setHours(23, 59, 59, 999);
    const metricas = calcularMetricasConsolidadas({
      sessoes: entrada.sessoes,
      questoes: entrada.questoes,
      revisoes: entrada.revisoes,
      simulados: entrada.simulados,
      inicio,
      fim,
    });
    return metricas.minutos >= metaMinutos && metricas.questoes >= metaQuestoes;
  }).length;
}

function teveTreinoPerfeito(entrada: EntradaConquistas) {
  const registroPerfeito = entrada.questoes.some((item) => {
    const total = item.certas + item.erradas + (item.emBranco ?? 0);
    return total >= 10 && item.certas === total;
  });
  if (registroPerfeito) return true;

  return entrada.simulados.some((item) => {
    const total = item.certas + item.erradas + (item.emBranco ?? 0);
    return total >= 10 && item.certas === total;
  });
}

function melhorPrecisaoTreino(entrada: EntradaConquistas) {
  let melhor = 0;
  entrada.questoes.forEach((item) => {
    const total = item.certas + item.erradas + (item.emBranco ?? 0);
    if (total < 10) return;
    melhor = Math.max(melhor, (item.certas / total) * 100);
  });
  entrada.simulados.forEach((item) => {
    const total = item.certas + item.erradas + (item.emBranco ?? 0);
    if (total < 10) return;
    melhor = Math.max(melhor, (item.certas / total) * 100);
  });
  return Math.round(melhor);
}

function contarMateriasEstudadas(entrada: EntradaConquistas) {
  const materiasAtivas = new Set(
    entrada.materias.map((item) => normalizar(item.nome)).filter(Boolean)
  );
  const estudadas = new Set<string>();

  entrada.sessoes.forEach((item) => estudadas.add(normalizar(item.materia)));
  entrada.questoes.forEach((item) => estudadas.add(normalizar(item.materia)));
  entrada.revisoes.forEach((item) => {
    if (item.concluida) estudadas.add(normalizar(item.materia));
  });

  return [...materiasAtivas].filter((nome) => estudadas.has(nome)).length;
}

function adicionarData(destino: Set<string>, valor?: string) {
  if (!valor) return;
  const direta = valor.match(/^(\d{4}-\d{2}-\d{2})/);
  if (direta) {
    destino.add(direta[1]);
    return;
  }

  const data = new Date(valor);
  if (!Number.isNaN(data.getTime())) {
    destino.add(
      `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`
    );
  }
}

function diferencaEmDias(inicio: string, fim: string) {
  const a = inicioDaChave(inicio).getTime();
  const b = inicioDaChave(fim).getTime();
  return Math.round((b - a) / 86_400_000);
}

function inicioDaChave(chave: string) {
  const [ano, mes, dia] = chave.split("-").map(Number);
  return new Date(ano, mes - 1, dia, 0, 0, 0, 0);
}

function percentual(valor: number, meta: number) {
  if (meta <= 0) return 100;
  return Math.min(100, Math.max(0, Math.round((valor / meta) * 100)));
}

function formatarNumero(valor: number) {
  return new Intl.NumberFormat("pt-BR").format(Math.max(0, Math.floor(valor)));
}

function formatarHoras(minutos: number) {
  const horas = Math.floor(Math.max(0, minutos) / 60);
  const resto = Math.max(0, minutos) % 60;
  return resto ? `${horas}h${String(resto).padStart(2, "0")}` : `${horas}h`;
}

function normalizar(valor?: string) {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
