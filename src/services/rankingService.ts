import { supabase } from "../lib/supabase";
import type { EntradaRanking, ResumoGamificacao } from "./gamificacaoService";

export async function publicarResumoRanking(params: {
  userId: string;
  nome: string;
  resumo: ResumoGamificacao;
}) {
  const { error } = await supabase.from("ranking_mensal").upsert(
    {
      user_id: params.userId,
      nome_publico: params.nome,
      mes: params.resumo.mes,
      minutos: params.resumo.minutos,
      questoes: params.resumo.questoes,
      acertos: params.resumo.acertos,
      revisoes: params.resumo.revisoes,
      simulados: params.resumo.simulados,
      xp: params.resumo.xp,
      nivel: params.resumo.nivel,
      atualizado_em: new Date().toISOString(),
    },
    { onConflict: "user_id,mes" }
  );

  if (error) throw error;
}

export async function carregarRankingMensal(mes: string): Promise<EntradaRanking[]> {
  const { data, error } = await supabase
    .from("ranking_mensal")
    .select("user_id,nome_publico,mes,minutos,questoes,acertos,revisoes,simulados,xp,nivel")
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
