import { supabase } from "../lib/supabase";
import type {
  AnaliseSimuladoStudyPro,
  HistoricoAnaliseSimulado,
} from "../utils/analiseSimuladoStudyPro";
import { resumirAnaliseParaHistorico } from "../utils/analiseSimuladoStudyPro";

export type OrigemAnaliseSimulado = "ia" | "oficial" | "pdf";

type LinhaAnaliseSimulado = {
  id: string;
  origem: OrigemAnaliseSimulado;
  tentativa_id: string;
  simulado_id: string | null;
  nome: string;
  dados: AnaliseSimuladoStudyPro;
  criado_em: string;
  atualizado_em: string;
};

export async function salvarAnaliseSimulado(args: {
  origem: OrigemAnaliseSimulado;
  tentativaId: string;
  simuladoId?: string;
  nome: string;
  analise: AnaliseSimuladoStudyPro;
}) {
  const {
    data: { user },
    error: erroUsuario,
  } = await supabase.auth.getUser();

  if (erroUsuario || !user) {
    throw new Error("Sua sessão expirou antes de salvar a análise do simulado.");
  }

  const { error } = await supabase
    .from("analises_simulados")
    .upsert(
      {
        user_id: user.id,
        origem: args.origem,
        tentativa_id: args.tentativaId,
        simulado_id: args.simuladoId ?? null,
        nome: args.nome,
        dados: args.analise,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "user_id,origem,tentativa_id" }
    );

  if (error) {
    throw new Error(
      `Não foi possível salvar a análise do simulado: ${error.message}`
    );
  }
}

export async function listarAnalisesSimulados(
  limite = 100
): Promise<
  Array<{
    id: string;
    origem: OrigemAnaliseSimulado;
    tentativaId: string;
    simuladoId: string | null;
    nome: string;
    analise: AnaliseSimuladoStudyPro;
    criadoEm: string;
    atualizadoEm: string;
  }>
> {
  const { data, error } = await supabase
    .from("analises_simulados")
    .select(
      "id,origem,tentativa_id,simulado_id,nome,dados,criado_em,atualizado_em"
    )
    .order("atualizado_em", { ascending: false })
    .limit(Math.max(1, Math.min(500, limite)));

  if (error) {
    throw new Error(
      `Não foi possível recuperar o histórico de análises: ${error.message}`
    );
  }

  return ((data ?? []) as LinhaAnaliseSimulado[]).flatMap((linha) => {
    if (!analiseValida(linha.dados)) return [];

    return [
      {
        id: linha.id,
        origem: linha.origem,
        tentativaId: linha.tentativa_id,
        simuladoId: linha.simulado_id,
        nome: linha.nome,
        analise: linha.dados,
        criadoEm: linha.criado_em,
        atualizadoEm: linha.atualizado_em,
      },
    ];
  });
}

export async function carregarHistoricoAnalisesSimulados(
  ignorarTentativaId?: string
): Promise<HistoricoAnaliseSimulado[]> {
  const analises = await listarAnalisesSimulados(100);

  return analises
    .filter((item) => item.tentativaId !== ignorarTentativaId)
    .map((item) => resumirAnaliseParaHistorico(item.analise));
}

function analiseValida(valor: unknown): valor is AnaliseSimuladoStudyPro {
  if (!valor || typeof valor !== "object") return false;
  const item = valor as Partial<AnaliseSimuladoStudyPro>;
  return (
    item.versao === 1 &&
    typeof item.tentativaId === "string" &&
    typeof item.data === "string" &&
    Array.isArray(item.materias) &&
    Array.isArray(item.assuntos)
  );
}
