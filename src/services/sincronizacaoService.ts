import {
  supabase,
} from "../lib/supabase";

import {
  migrarMateriasParaModulos,
} from "./conteudos/migrarEstruturaConteudos";

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

export const VERSAO_ESTADO_APP = 2 as const;

export type EstadoAppNuvem = {
  versao: typeof VERSAO_ESTADO_APP;
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

type EstadoAppNuvemLegado = Omit<
  EstadoAppNuvem,
  "versao" | "materias"
> & {
  versao?: 1;
  materias: unknown;
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

  return validarEMigrarEstado(estado);
}

export async function salvarEstadoNaNuvem(
  userId: string,
  estado: EstadoAppNuvem
): Promise<void> {
  const estadoNormalizado = normalizarEstadoParaSalvar(
    estado
  );

  const { error } = await supabase
    .from("configuracoes")
    .upsert(
      {
        user_id: userId,
        dados: {
          appState: estadoNormalizado,
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
  return normalizarEstadoParaSalvar({
    versao: VERSAO_ESTADO_APP,
    ...dados,
    salvoEm: new Date().toISOString(),
  });
}

export function validarEMigrarEstado(
  valor: unknown
): EstadoAppNuvem | null {
  if (!valor || typeof valor !== "object") {
    return null;
  }

  const estado = valor as Partial<
    EstadoAppNuvem | EstadoAppNuvemLegado
  >;

  if (
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

  const materias = migrarMateriasParaModulos(
    estado.materias
  );

  const missoesConcluidas =
    Array.isArray(estado.missoesConcluidas)
      ? estado.missoesConcluidas.filter(
          (item): item is string =>
            typeof item === "string"
        )
      : [];

  return {
    versao: VERSAO_ESTADO_APP,
    materias,
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

function normalizarEstadoParaSalvar(
  estado: EstadoAppNuvem
): EstadoAppNuvem {
  return {
    ...estado,
    versao: VERSAO_ESTADO_APP,
    materias: migrarMateriasParaModulos(
      estado.materias
    ),
    salvoEm:
      typeof estado.salvoEm === "string"
        ? estado.salvoEm
        : new Date().toISOString(),
  };
}
