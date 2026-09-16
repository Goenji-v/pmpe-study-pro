import { supabase } from "../lib/supabase";
import type { EntradaRanking, ResumoGamificacao } from "./gamificacaoService";

export type PeriodoRanking = "semana" | "mes";
export type EscopoRanking = "geral" | "turma";

export type LinhaRankingEstudo = {
  userId: string;
  nome: string;
  turma: string;
  parceiro: string;
  minutos: number;
  horas: number;
  questoes: number;
  acertos: number;
  erradas: number;
  emBranco: number;
  revisoes: number;
  simulados: number;
  xp: number;
  posicao: number;
  top5: boolean;
};

export type PainelRankingEstudo = {
  periodo: PeriodoRanking;
  escopo: EscopoRanking;
  inicio: string;
  fim: string;
  turma: string;
  parceiro: string;
  participantes: number;
  minhaPosicao: number | null;
  ranking: LinhaRankingEstudo[];
};

export type LinhaRankingSimulado = {
  userId: string;
  nome: string;
  turma: string;
  parceiro: string;
  certas: number;
  erradas: number;
  emBranco: number;
  minutos: number;
  posicao: number;
  premio: string;
  top5: boolean;
};

export type PainelRankingSimulado = {
  simuladoId: string;
  simulado: string;
  participantes: number;
  minhaPosicao: number | null;
  meuPremio: string;
  ranking: LinhaRankingSimulado[];
};

export type HistoricoRanking = {
  mes: string;
  posicao: number;
  participantes: number;
  xp: number;
  minutos: number;
  questoes: number;
  acertos: number;
  revisoes: number;
  simulados: number;
};

export async function publicarResumoRanking(params: {
  userId: string;
  nome: string;
  resumo: ResumoGamificacao;
}) {
  // `userId` e `resumo` continuam no contrato para compatibilidade com a tela,
  // mas os números não são mais confiados ao navegador. O PostgreSQL recalcula
  // tudo a partir do estado sincronizado do usuário autenticado.
  void params.userId;
  void params.resumo;

  const { error } = await supabase.rpc("recalcular_meu_ranking", {
    p_nome_publico: params.nome.trim() || "Usuário",
  });

  if (error) {
    throw new Error(`Não foi possível recalcular o ranking: ${error.message}`);
  }
}

export async function carregarRankingEstudo(
  periodo: PeriodoRanking,
  escopo: EscopoRanking
): Promise<PainelRankingEstudo> {
  const { data, error } = await supabase.rpc("ranking_estudo", {
    p_periodo: periodo,
    p_escopo: escopo,
  });
  if (error) throw new Error(error.message);

  const valor = objeto(data);
  return {
    periodo: valor.periodo === "semana" ? "semana" : "mes",
    escopo: valor.escopo === "turma" ? "turma" : "geral",
    inicio: texto(valor.inicio),
    fim: texto(valor.fim),
    turma: texto(valor.turma),
    parceiro: texto(valor.parceiro),
    participantes: numero(valor.participantes),
    minhaPosicao: numeroOuNulo(valor.minha_posicao),
    ranking: lista(valor.ranking).map((item) => ({
      userId: texto(item.user_id),
      nome: texto(item.nome) || "Usuário",
      turma: texto(item.turma) || "Study Pro",
      parceiro: texto(item.parceiro) || "Study Pro",
      minutos: numero(item.minutos),
      horas: Math.round((numero(item.minutos) / 60) * 10) / 10,
      questoes: numero(item.questoes),
      acertos: numero(item.acertos),
      erradas: numero(item.erradas),
      emBranco: numero(item.em_branco),
      revisoes: numero(item.revisoes),
      simulados: numero(item.simulados),
      xp: numero(item.xp),
      posicao: numero(item.posicao),
      top5: item.top5 === true,
    })),
  };
}

export async function carregarRankingSimulado(simuladoId: string): Promise<PainelRankingSimulado> {
  const { data, error } = await supabase.rpc("ranking_simulado_aluno", {
    p_simulado_id: simuladoId,
  });
  if (error) throw new Error(error.message);

  const valor = objeto(data);
  return {
    simuladoId: texto(valor.simulado_id) || simuladoId,
    simulado: texto(valor.simulado) || "Simulado",
    participantes: numero(valor.participantes),
    minhaPosicao: numeroOuNulo(valor.minha_posicao),
    meuPremio: texto(valor.meu_premio),
    ranking: lista(valor.ranking).map((item) => ({
      userId: texto(item.user_id),
      nome: texto(item.nome) || "Aluno",
      turma: texto(item.turma) || "Sem turma",
      parceiro: texto(item.parceiro) || "Study Pro",
      certas: numero(item.certas),
      erradas: numero(item.erradas),
      emBranco: numero(item.em_branco),
      minutos: numero(item.minutos),
      posicao: numero(item.posicao),
      premio: texto(item.premio),
      top5: item.top5 === true,
    })),
  };
}

export async function carregarHistoricoMeuRanking(limite = 6): Promise<HistoricoRanking[]> {
  const { data, error } = await supabase.rpc("historico_meu_ranking", {
    p_limite: Math.max(1, Math.min(24, Math.round(limite))),
  });
  if (error) throw new Error(error.message);

  return lista(data).map((item) => ({
    mes: texto(item.mes),
    posicao: numero(item.posicao),
    participantes: numero(item.participantes),
    xp: numero(item.xp),
    minutos: numero(item.minutos),
    questoes: numero(item.questoes),
    acertos: numero(item.acertos),
    revisoes: numero(item.revisoes),
    simulados: numero(item.simulados),
  }));
}

export async function carregarRankingMensal(
  mes: string
): Promise<EntradaRanking[]> {
  const { data, error } = await supabase
    .from("ranking_mensal")
    .select(
      "user_id,nome_publico,mes,minutos,questoes,acertos,revisoes,simulados,xp,nivel"
    )
    .eq("mes", mes)
    .order("xp", { ascending: false })
    .order("minutos", { ascending: false })
    .order("acertos", { ascending: false })
    .limit(100);

  if (error) throw error;

  return (data ?? []).map((item, indice) => ({
    userId: String(item.user_id),
    nome: String(item.nome_publico || "Usuário"),
    mes: String(item.mes),
    minutos: Number(item.minutos || 0),
    horas: Math.round((Number(item.minutos || 0) / 60) * 10) / 10,
    questoes: Number(item.questoes || 0),
    acertos: Number(item.acertos || 0),
    revisoes: Number(item.revisoes || 0),
    simulados: Number(item.simulados || 0),
    xp: Number(item.xp || 0),
    nivel: Number(item.nivel || 1),
    tituloNivel: "",
    posicao: indice + 1,
  }));
}

function objeto(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor)
    ? valor as Record<string, unknown>
    : {};
}

function lista(valor: unknown): Record<string, unknown>[] {
  return Array.isArray(valor)
    ? valor.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
}

function texto(valor: unknown) {
  return typeof valor === "string" ? valor : "";
}

function numero(valor: unknown) {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function numeroOuNulo(valor: unknown) {
  if (valor === null || valor === undefined || valor === "") return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}
