import { supabase } from "../lib/supabase";
import type {
  AuditoriaResultadoIA,
  ResultadoQuestoesIAPersistido,
  Simulado,
} from "../types";

type LinhaResultadoQuestoesIA = {
  id: string;
  local_id: string | null;
  nome: string;
  certas: number;
  erradas: number;
  em_branco: number;
  percentual: number;
  data: string;
  dados: {
    tipo?: unknown;
    total?: unknown;
    registros?: unknown;
    simulado?: unknown;
    auditoria?: AuditoriaResultadoIA;
  } | null;
};

export async function salvarResultadoQuestoesIA(
  resultado: ResultadoQuestoesIAPersistido
) {
  const {
    data: { user },
    error: erroUsuario,
  } = await supabase.auth.getUser();

  if (erroUsuario || !user) {
    throw new Error(
      "Sua sessão expirou antes de salvar o histórico da tentativa."
    );
  }

  const { error } = await supabase
    .from("resultados_simulados_ia")
    .upsert(
      {
        user_id: user.id,
        local_id: resultado.id,
        nome: resultado.nome,
        certas: resultado.certas,
        erradas: resultado.erradas,
        em_branco: resultado.emBranco,
        percentual: resultado.percentual,
        data: resultado.data,
        dados: {
          versao: 1,
          tipo: resultado.tipo,
          total: resultado.total,
          registros: resultado.registros,
          simulado: resultado.simulado ?? null,
        },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,local_id" }
    );

  if (error) {
    throw new Error(
      `Não foi possível salvar a tentativa no histórico online: ${error.message}`
    );
  }
}

export async function listarResultadosQuestoesIA(): Promise<
  ResultadoQuestoesIAPersistido[]
> {
  const { data, error } = await supabase
    .from("resultados_simulados_ia")
    .select(
      "id,local_id,nome,certas,erradas,em_branco,percentual,data,dados"
    )
    .order("data", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(
      `Não foi possível recuperar o histórico das tentativas: ${error.message}`
    );
  }

  return ((data ?? []) as LinhaResultadoQuestoesIA[])
    .map(converterLinha)
    .filter(
      (
        resultado
      ): resultado is ResultadoQuestoesIAPersistido => Boolean(resultado)
    );
}

function converterLinha(
  linha: LinhaResultadoQuestoesIA
): ResultadoQuestoesIAPersistido | null {
  const tipo = linha.dados?.tipo;
  const registros = linha.dados?.registros;

  if (
    (tipo !== "questoes" && tipo !== "simulado") ||
    !Array.isArray(registros)
  ) {
    return null;
  }

  const id = linha.local_id || linha.id;
  const simulado =
    tipo === "simulado" &&
    linha.dados?.simulado &&
    typeof linha.dados.simulado === "object"
      ? (linha.dados.simulado as Simulado)
      : undefined;

  return {
    id,
    nome: linha.nome,
    data: linha.data,
    tipo,
    total: numeroSeguro(
      linha.dados?.total,
      linha.certas + linha.erradas + linha.em_branco
    ),
    certas: numeroSeguro(linha.certas),
    erradas: numeroSeguro(linha.erradas),
    emBranco: numeroSeguro(linha.em_branco),
    percentual: numeroSeguro(linha.percentual),
    registros: (registros as ResultadoQuestoesIAPersistido["registros"]).map((registro, indice) => ({
      ...registro,
      id: registro.id || `${id}:assunto:${indice}`,
      tentativaId: id,
      origem: tipo === "simulado" ? "simulado-ia" : "questoes-ia",
    })),
    auditoria: linha.dados?.auditoria,
    simulado: simulado
      ? {
          ...simulado,
          id,
          tentativaId: id,
          origem: "ia",
        }
      : undefined,
  };
}

function numeroSeguro(valor: unknown, fallback = 0) {
  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : fallback;
}
