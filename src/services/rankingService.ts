import { supabase } from "../lib/supabase";
import type { EntradaRanking, ResumoGamificacao } from "./gamificacaoService";

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
