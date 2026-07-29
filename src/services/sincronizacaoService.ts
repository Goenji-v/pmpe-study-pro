import {
  supabase,
} from "../lib/supabase";

import type {
  ConfiguracoesApp,
  Materia,
  QuestaoBanco,
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
  SimuladoGerado,
} from "../types/index";

export type EstadoAppNuvem = {
  versao: 1;
  materias: Materia[];
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
  bancoQuestoes: QuestaoBanco[];
  simuladosGerados: SimuladoGerado[];
  configuracoes: ConfiguracoesApp;
  missoesConcluidas: string[];
  salvoEm: string;
};

type LinhaConfiguracoes = {
  user_id: string;
  dados: {
    appState?: unknown;
  } | null;
};

export async function carregarEstadoDaNuvem(
  userId: string
): Promise<EstadoAppNuvem | null> {
  const { data, error } = await supabase
    .from("configuracoes")
    .select("user_id, dados")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Erro ao carregar dados da nuvem: ${error.message}`
    );
  }

  const linha = data as LinhaConfiguracoes | null;
  const estado = linha?.dados?.appState;

  if (!estado) {
    return null;
  }

  return validarEstado(estado);
}

export async function salvarEstadoNaNuvem(
  userId: string,
  estado: EstadoAppNuvem
): Promise<void> {
  const { error } = await supabase
    .from("configuracoes")
    .upsert(
      {
        user_id: userId,
        dados: {
          appState: estado,
        },
      },
      {
        onConflict: "user_id",
      }
    );

  if (error) {
    throw new Error(
      `Erro ao salvar dados na nuvem: ${error.message}`
    );
  }
}

export function montarEstadoNuvem(
  dados: Omit<
    EstadoAppNuvem,
    "versao" | "salvoEm"
  >
): EstadoAppNuvem {
  return {
    versao: 1,
    ...dados,
    salvoEm: new Date().toISOString(),
  };
}

function validarEstado(
  valor: unknown
): EstadoAppNuvem | null {
  if (!valor || typeof valor !== "object") {
    return null;
  }

  const estado = valor as Partial<EstadoAppNuvem>;

  if (
    !Array.isArray(estado.materias) ||
    !Array.isArray(estado.questoes) ||
    !Array.isArray(estado.sessoes) ||
    !Array.isArray(estado.revisoes) ||
    !Array.isArray(estado.simulados) ||
    !Array.isArray(estado.bancoQuestoes) ||
    !Array.isArray(estado.simuladosGerados) ||
    !estado.configuracoes
  ) {
    return null;
  }

  const missoesConcluidas =
    Array.isArray(estado.missoesConcluidas)
      ? estado.missoesConcluidas.filter(
          (item): item is string =>
            typeof item === "string"
        )
      : [];

  return {
    versao: 1,
    materias: estado.materias,
    questoes: estado.questoes,
    sessoes: estado.sessoes,
    revisoes: estado.revisoes,
    simulados: estado.simulados,
    bancoQuestoes: estado.bancoQuestoes,
    simuladosGerados: estado.simuladosGerados,
    configuracoes: estado.configuracoes,
    missoesConcluidas,
    salvoEm:
      typeof estado.salvoEm === "string"
        ? estado.salvoEm
        : new Date().toISOString(),
  };
}