import { supabase } from "../lib/supabase";

export type ResultadoOficialHistorico = {
  id: string;
  simuladoId: string;
  nome: string;
  banca: string;
  finalizadaEm: string | null;
  contaRanking: boolean;
  resultado: {
    total: number;
    certas: number;
    erradas: number;
    emBranco: number;
    anuladas: number;
    percentual: number;
    porMateria?: Array<{ materia: string; total: number; certas: number; erradas: number; emBranco: number; percentual: number }>;
    porAssunto?: Array<{ materia: string; assunto: string; total: number; certas: number; erradas: number; emBranco: number; percentual: number }>;
  } | null;
};

export async function listarResultadosOficiaisDoAluno(): Promise<ResultadoOficialHistorico[]> {
  const { data, error } = await supabase
    .from("simulados_oficiais_tentativas")
    .select("id,simulado_id,conta_ranking,finalizada_em,resultado,simulado:simulados_oficiais(nome,banca)")
    .eq("finalizada", true)
    .not("resultado", "is", null)
    .order("finalizada_em", { ascending: false })
    .limit(30);

  if (error) throw new Error(error.message);

  return ((data || []) as Array<Record<string, unknown>>).map((item) => {
    const simulado = (item.simulado && typeof item.simulado === "object" ? item.simulado : {}) as Record<string, unknown>;
    const resultado = (item.resultado && typeof item.resultado === "object" ? item.resultado : null) as ResultadoOficialHistorico["resultado"];
    return {
      id: String(item.id),
      simuladoId: String(item.simulado_id),
      nome: String(simulado.nome || "Simulado oficial"),
      banca: String(simulado.banca || ""),
      finalizadaEm: typeof item.finalizada_em === "string" ? item.finalizada_em : null,
      contaRanking: item.conta_ranking === true,
      resultado,
    };
  });
}
