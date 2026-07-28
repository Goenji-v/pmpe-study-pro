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

const CHAVE_MIGRACAO =
  "app_state_local_v2_plano";

const CHAVE_DONO_LOCAL =
  "pmpe_usuario_local_id";

const CHAVE_MISSOES_CONCLUIDAS =
  "pmpe_plano_missoes_concluidas";

export async function carregarEstadoDaNuvem(
  userId: string
): Promise<EstadoAppNuvem | null> {
  const {
    data,
    error,
  } = await supabase
    .from("configuracoes")
    .select("user_id, dados")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Erro ao carregar dados da nuvem: ${error.message}`
    );
  }

  const linha =
    data as LinhaConfiguracoes | null;

  const estado =
    linha?.dados?.appState;

  if (!estado) {
    return null;
  }

  return validarEstado(
    estado
  );
}

export async function salvarEstadoNaNuvem(
  userId: string,
  estado: EstadoAppNuvem
): Promise<void> {
  const {
    error,
  } = await supabase
    .from("configuracoes")
    .upsert(
      {
        user_id: userId,

        dados: {
          appState: estado,
        },
      },
      {
        onConflict:
          "user_id",
      }
    );

  if (error) {
    throw new Error(
      `Erro ao salvar dados na nuvem: ${error.message}`
    );
  }
}

export async function migracaoJaConcluida(
  userId: string
): Promise<boolean> {
  const {
    data,
    error,
  } = await supabase
    .from("migracoes_cliente")
    .select("id")
    .eq("user_id", userId)
    .eq("chave", CHAVE_MIGRACAO)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Erro ao consultar migração: ${error.message}`
    );
  }

  return Boolean(data);
}

export async function marcarMigracaoConcluida(
  userId: string
): Promise<void> {
  const {
    error,
  } = await supabase
    .from("migracoes_cliente")
    .upsert(
      {
        user_id: userId,
        chave: CHAVE_MIGRACAO,
        versao: 2,

        detalhes: {
          origem:
            "localStorage",

          incluiPlano:
            true,

          concluidaEm:
            new Date().toISOString(),
        },
      },
      {
        onConflict:
          "user_id,chave",
      }
    );

  if (error) {
    throw new Error(
      `Erro ao registrar migração: ${error.message}`
    );
  }

  localStorage.setItem(
    CHAVE_DONO_LOCAL,
    userId
  );
}

export function confirmarDonoDosDadosLocais(
  userId: string
): void {
  const donoAtual =
    localStorage.getItem(
      CHAVE_DONO_LOCAL
    );

  if (
    donoAtual &&
    donoAtual !== userId
  ) {
    throw new Error(
      "Este navegador possui dados locais vinculados a outra conta. " +
      "Não foi feita migração automática para evitar misturar dados."
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

    salvoEm:
      new Date().toISOString(),
  };
}

function validarEstado(
  valor: unknown
): EstadoAppNuvem | null {
  if (
    !valor ||
    typeof valor !== "object"
  ) {
    return null;
  }

  const estado =
    valor as Partial<EstadoAppNuvem>;

  if (
    !Array.isArray(
      estado.materias
    ) ||
    !Array.isArray(
      estado.questoes
    ) ||
    !Array.isArray(
      estado.sessoes
    ) ||
    !Array.isArray(
      estado.revisoes
    ) ||
    !Array.isArray(
      estado.simulados
    ) ||
    !Array.isArray(
      estado.bancoQuestoes
    ) ||
    !Array.isArray(
      estado.simuladosGerados
    ) ||
    !estado.configuracoes
  ) {
    return null;
  }

  /*
   * Compatibilidade com a versão anterior:
   * se a nuvem ainda não possui o progresso do plano,
   * usa temporariamente o progresso local deste navegador.
   * Instale primeiro no PC, aguarde sincronizar e depois
   * atualize o celular.
   */
  const missoesConcluidas =
    Array.isArray(
      estado.missoesConcluidas
    )
      ? estado.missoesConcluidas.filter(
          (item):
            item is string =>
            typeof item === "string"
        )
      : carregarMissoesConcluidasLocais();

  return {
    versao: 1,

    materias:
      estado.materias,

    questoes:
      estado.questoes,

    sessoes:
      estado.sessoes,

    revisoes:
      estado.revisoes,

    simulados:
      estado.simulados,

    bancoQuestoes:
      estado.bancoQuestoes,

    simuladosGerados:
      estado.simuladosGerados,

    configuracoes:
      estado.configuracoes,

    missoesConcluidas,

    salvoEm:
      typeof estado.salvoEm ===
      "string"
        ? estado.salvoEm
        : new Date().toISOString(),
  };
}

function carregarMissoesConcluidasLocais():
  string[] {
  const salvo =
    localStorage.getItem(
      CHAVE_MISSOES_CONCLUIDAS
    );

  if (!salvo) {
    return [];
  }

  try {
    const valor:
      unknown =
      JSON.parse(salvo);

    if (!Array.isArray(valor)) {
      return [];
    }

    return valor.filter(
      (item):
        item is string =>
        typeof item === "string"
    );
  } catch {
    return [];
  }
}