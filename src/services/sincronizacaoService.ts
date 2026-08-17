import {
  supabase,
} from "../lib/supabase";

import {
  migrarMateriasParaModulos,
} from "./conteudos/migrarEstruturaConteudos";

import {
  criarBackupAutomaticoLocal,
  type MotivoBackupAutomatico,
} from "./seguranca/backupAutomaticoService";

import {
  SCHEMA_VERSION_ATUAL,
} from "./seguranca/schemaVersion";

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

/**
 * `versao` é mantido por compatibilidade com as versões antigas do Study Pro.
 * `schemaVersion` é a referência oficial a partir da Etapa 18.
 */
export const VERSAO_ESTADO_APP = SCHEMA_VERSION_ATUAL;

export type MetadadosMigracaoEstado = {
  de: number;
  para: typeof SCHEMA_VERSION_ATUAL;
  em: string;
};

export type EstadoAppNuvem = {
  schemaVersion: typeof SCHEMA_VERSION_ATUAL;
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
  syncRevision?: number;
  atualizadoEm?: string;
  migracao?: MetadadosMigracaoEstado;
};

type EstadoAppNuvemLegado = Partial<
  Omit<
    EstadoAppNuvem,
    "schemaVersion" | "versao" | "materias"
  >
> & {
  schemaVersion?: number;
  versao?: number;
  materias?: unknown;
};

type LinhaConfiguracoes = {
  user_id: string;
  dados: {
    appState?: unknown;
  } | null;
};

export function obterSchemaVersionEstado(
  valor: unknown
): number {
  if (!valor || typeof valor !== "object") {
    return 0;
  }

  const estado = valor as {
    schemaVersion?: unknown;
    versao?: unknown;
  };

  if (
    typeof estado.schemaVersion === "number" &&
    Number.isFinite(estado.schemaVersion)
  ) {
    return estado.schemaVersion;
  }

  if (
    typeof estado.versao === "number" &&
    Number.isFinite(estado.versao)
  ) {
    return estado.versao;
  }

  // Estados anteriores ao primeiro versionamento explícito são tratados como V1.
  return 1;
}

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
  const estadoBruto = linha?.dados?.appState;

  if (!estadoBruto) {
    return null;
  }

  const versaoOrigem = obterSchemaVersionEstado(
    estadoBruto
  );

  if (versaoOrigem > SCHEMA_VERSION_ATUAL) {
    throw new Error(
      `Os dados da conta usam o schema ${versaoOrigem}, mais novo que o schema ${SCHEMA_VERSION_ATUAL} desta versão do site. Atualize o Study Pro antes de continuar.`
    );
  }

  let backupId: string | null = null;

  if (versaoOrigem < SCHEMA_VERSION_ATUAL) {
    try {
      const backup = criarBackupAutomaticoLocal(
        userId,
        estadoBruto,
        "antes_migracao_schema"
      );
      backupId = backup.id;
    } catch (erroBackup) {
      const detalhe =
        erroBackup instanceof Error
          ? erroBackup.message
          : "falha desconhecida";

      throw new Error(
        `Migração não iniciada: não foi possível criar o backup de segurança. Nenhum dado da nuvem foi alterado. Motivo: ${detalhe}`
      );
    }
  }

  try {
    const estadoMigrado = validarEMigrarEstado(
      estadoBruto
    );

    if (!estadoMigrado) {
      throw new Error(
        "O estado salvo existe, mas sua estrutura não passou na validação."
      );
    }

    validarIntegridadeEstado(estadoMigrado);

    // Persistimos a migração somente depois de backup + migração + validação.
    // Se o save falhar, o registro antigo do Supabase permanece como estava.
    if (versaoOrigem < SCHEMA_VERSION_ATUAL) {
      await salvarEstadoNaNuvem(
        userId,
        estadoMigrado
      );
    }

    return estadoMigrado;
  } catch (erro) {
    const detalhe =
      erro instanceof Error
        ? erro.message
        : "falha desconhecida";

    const referenciaBackup = backupId
      ? ` Backup local preservado: ${backupId}.`
      : "";

    throw new Error(
      `Migração cancelada por segurança. Os dados anteriores não foram substituídos.${referenciaBackup} Motivo: ${detalhe}`
    );
  }
}

export async function salvarEstadoNaNuvem(
  userId: string,
  estado: EstadoAppNuvem
): Promise<void> {
  const estadoNormalizado = normalizarEstadoParaSalvar(
    estado
  );

  validarIntegridadeEstado(estadoNormalizado);

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

/**
 * Usado apenas para mudanças automáticas de estrutura, nunca para um autosave
 * comum de estudo. A sequência é: backup -> validação -> save. Em caso de erro
 * de gravação, tenta restaurar imediatamente o estado anterior e mantém o
 * backup local como última linha de defesa.
 */
export async function salvarEstadoEstruturalComSeguranca(
  userId: string,
  estadoAnterior: EstadoAppNuvem,
  estadoNovo: EstadoAppNuvem,
  motivo: MotivoBackupAutomatico = "antes_reconciliacao_estrutural"
): Promise<void> {
  const backup = criarBackupAutomaticoLocal(
    userId,
    estadoAnterior,
    motivo
  );

  const novoNormalizado = normalizarEstadoParaSalvar(
    estadoNovo
  );

  validarIntegridadeEstado(novoNormalizado);

  try {
    await salvarEstadoNaNuvem(
      userId,
      novoNormalizado
    );
  } catch (erroSalvar) {
    let rollbackConcluido = false;

    try {
      criarBackupAutomaticoLocal(
        userId,
        estadoAnterior,
        "antes_rollback"
      );

      await salvarEstadoNaNuvem(
        userId,
        normalizarEstadoParaSalvar(
          estadoAnterior
        )
      );

      rollbackConcluido = true;
    } catch (erroRollback) {
      console.error(
        "Falha ao restaurar o estado anterior após erro de migração:",
        erroRollback
      );
    }

    const detalhe =
      erroSalvar instanceof Error
        ? erroSalvar.message
        : "falha desconhecida";

    throw new Error(
      `Alteração estrutural cancelada. Backup ${backup.id} preservado. ${
        rollbackConcluido
          ? "O estado anterior foi restaurado na nuvem."
          : "O rollback automático não pôde ser confirmado; o backup local continua disponível."
      } Motivo: ${detalhe}`
    );
  }
}


export class ConflitoSincronizacaoError extends Error {
  revisaoNuvem: number;
  revisaoBase: number;

  constructor(revisaoNuvem: number, revisaoBase: number) {
    super(
      `Conflito de sincronização: a nuvem está na revisão ${revisaoNuvem}, mas este aparelho partiu da revisão ${revisaoBase}. Nenhum dado foi sobrescrito.`
    );
    this.name = "ConflitoSincronizacaoError";
    this.revisaoNuvem = revisaoNuvem;
    this.revisaoBase = revisaoBase;
  }
}

export function obterRevisaoSincronizacao(estado: EstadoAppNuvem | null) {
  if (!estado) return 0;
  return typeof estado.syncRevision === "number" && Number.isFinite(estado.syncRevision)
    ? Math.max(0, Math.floor(estado.syncRevision))
    : 0;
}

/**
 * Autosave protegido da Etapa 18.3. Antes de gravar, confirma a revisão atual
 * da nuvem. Se outro aparelho já avançou o estado, a escrita é recusada e os
 * dois lados permanecem preservados para resolução explícita.
 */
export async function salvarEstadoComControleDeRevisao(
  userId: string,
  estadoLocal: EstadoAppNuvem,
  revisaoBase: number
): Promise<EstadoAppNuvem> {
  const estadoNuvem = await carregarEstadoDaNuvem(userId);
  const revisaoNuvem = obterRevisaoSincronizacao(estadoNuvem);

  if (estadoNuvem && revisaoNuvem !== Math.max(0, Math.floor(revisaoBase))) {
    throw new ConflitoSincronizacaoError(revisaoNuvem, revisaoBase);
  }

  const agora = new Date().toISOString();
  const proximaRevisao = revisaoNuvem + 1;
  const estadoParaSalvar = normalizarEstadoParaSalvar({
    ...estadoLocal,
    syncRevision: proximaRevisao,
    atualizadoEm: agora,
    salvoEm: agora,
  });

  validarIntegridadeEstado(estadoParaSalvar);
  await salvarEstadoNaNuvem(userId, estadoParaSalvar);
  return estadoParaSalvar;
}

export function montarEstadoNuvem(
  dados: Omit<
    EstadoAppNuvem,
    | "schemaVersion"
    | "versao"
    | "salvoEm"
    | "migracao"
  >
): EstadoAppNuvem {
  return normalizarEstadoParaSalvar({
    schemaVersion: SCHEMA_VERSION_ATUAL,
    versao: VERSAO_ESTADO_APP,
    ...dados,
    salvoEm: new Date().toISOString(),
  });
}

function normalizarConfiguracoesApp(
  configuracoes: ConfiguracoesApp
): ConfiguracoesApp {
  const missoesPorDia =
    typeof configuracoes.missoesPorDia === "number" &&
    Number.isFinite(configuracoes.missoesPorDia)
      ? Math.max(1, Math.min(6, Math.floor(configuracoes.missoesPorDia)))
      : 1;

  return {
    ...configuracoes,
    missoesPorDia,
  };
}

export function validarEMigrarEstado(
  valor: unknown
): EstadoAppNuvem | null {
  if (!valor || typeof valor !== "object") {
    return null;
  }

  const versaoOrigem = obterSchemaVersionEstado(
    valor
  );

  if (versaoOrigem > SCHEMA_VERSION_ATUAL) {
    return null;
  }

  const estado = valor as EstadoAppNuvemLegado;

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

  const agora = new Date().toISOString();
  const foiMigrado =
    versaoOrigem < SCHEMA_VERSION_ATUAL;

  return {
    schemaVersion: SCHEMA_VERSION_ATUAL,
    versao: VERSAO_ESTADO_APP,
    materias,
    questoes: estado.questoes,
    sessoes: estado.sessoes,
    revisoes: estado.revisoes,
    simulados: estado.simulados,
    bancoQuestoes: estado.bancoQuestoes,
    simuladosGerados: estado.simuladosGerados,
    configuracoes: normalizarConfiguracoesApp(estado.configuracoes),
    missoesConcluidas,
    salvoEm: foiMigrado
      ? agora
      : (
          typeof estado.salvoEm === "string"
            ? estado.salvoEm
            : agora
        ),
    syncRevision:
      typeof (estado as { syncRevision?: unknown }).syncRevision === "number" &&
      Number.isFinite((estado as { syncRevision?: number }).syncRevision)
        ? Math.max(0, Math.floor((estado as { syncRevision: number }).syncRevision))
        : 0,
    atualizadoEm:
      typeof (estado as { atualizadoEm?: unknown }).atualizadoEm === "string"
        ? (estado as { atualizadoEm: string }).atualizadoEm
        : (
            typeof estado.salvoEm === "string"
              ? estado.salvoEm
              : agora
          ),
    migracao: foiMigrado
      ? {
          de: versaoOrigem,
          para: SCHEMA_VERSION_ATUAL,
          em: agora,
        }
      : estado.migracao,
  };
}

export function validarIntegridadeEstado(
  estado: EstadoAppNuvem
): void {
  const erros: string[] = [];

  if (
    estado.schemaVersion !== SCHEMA_VERSION_ATUAL ||
    estado.versao !== VERSAO_ESTADO_APP
  ) {
    erros.push(
      `schema inválido (${estado.schemaVersion}/${estado.versao})`
    );
  }

  const colecoes: Array<[
    string,
    unknown
  ]> = [
    ["materias", estado.materias],
    ["questoes", estado.questoes],
    ["sessoes", estado.sessoes],
    ["revisoes", estado.revisoes],
    ["simulados", estado.simulados],
    ["bancoQuestoes", estado.bancoQuestoes],
    ["simuladosGerados", estado.simuladosGerados],
    ["missoesConcluidas", estado.missoesConcluidas],
  ];

  colecoes.forEach(([nome, valor]) => {
    if (!Array.isArray(valor)) {
      erros.push(`${nome} não é uma lista`);
    }
  });

  const idsMaterias = new Set<string>();

  estado.materias.forEach((materia, indiceMateria) => {
    if (!materia?.id || !materia.nome) {
      erros.push(`matéria inválida na posição ${indiceMateria}`);
      return;
    }

    if (idsMaterias.has(materia.id)) {
      erros.push(`ID de matéria duplicado: ${materia.id}`);
    }
    idsMaterias.add(materia.id);

    const modulos = materia.modulos ?? [];
    const idsModulos = new Set<string>();

    modulos.forEach((modulo) => {
      if (!modulo.id || !modulo.nome || !Array.isArray(modulo.assuntos)) {
        erros.push(`módulo inválido em ${materia.nome}`);
        return;
      }

      if (idsModulos.has(modulo.id)) {
        erros.push(`ID de módulo duplicado em ${materia.nome}: ${modulo.id}`);
      }
      idsModulos.add(modulo.id);

      const idsAssuntos = new Set<string>();

      modulo.assuntos.forEach((assunto) => {
        if (!assunto.id || !assunto.nome) {
          erros.push(`assunto inválido em ${materia.nome}/${modulo.nome}`);
          return;
        }

        if (idsAssuntos.has(assunto.id)) {
          erros.push(`ID de assunto duplicado em ${materia.nome}/${modulo.nome}: ${assunto.id}`);
        }
        idsAssuntos.add(assunto.id);

        const idsAulas = new Set<string>();
        (assunto.aulas ?? []).forEach((aula) => {
          if (!aula.id || !aula.nome) {
            erros.push(`aula inválida em ${materia.nome}/${assunto.nome}`);
            return;
          }

          if (idsAulas.has(aula.id)) {
            erros.push(`ID de aula duplicado em ${materia.nome}/${assunto.nome}: ${aula.id}`);
          }
          idsAulas.add(aula.id);
        });
      });
    });
  });

  if (
    !estado.configuracoes ||
    typeof estado.configuracoes !== "object"
  ) {
    erros.push("configurações ausentes");
  } else {
    const metas = [
      estado.configuracoes.metaQuestoesDiaria,
      estado.configuracoes.metaMinutosDiaria,
      estado.configuracoes.metaRevisoesDiaria,
    ];

    const missoesPorDia = estado.configuracoes.missoesPorDia ?? 1;

    if (
      metas.some(
        (valor) =>
          typeof valor !== "number" ||
          !Number.isFinite(valor) ||
          valor < 0
      )
    ) {
      erros.push("metas das configurações são inválidas");
    }

    if (
      typeof missoesPorDia !== "number" ||
      !Number.isFinite(missoesPorDia) ||
      missoesPorDia < 1 ||
      missoesPorDia > 6
    ) {
      erros.push("quantidade de missões por dia é inválida");
    }
  }

  if (
    estado.missoesConcluidas.some(
      (id) => typeof id !== "string"
    )
  ) {
    erros.push("há IDs inválidos em missões concluídas");
  }

  try {
    JSON.stringify(estado);
  } catch {
    erros.push("estado não é serializável em JSON");
  }

  if (erros.length > 0) {
    throw new Error(
      `Validação de integridade falhou: ${erros.join("; ")}`
    );
  }
}

function normalizarEstadoParaSalvar(
  estado: EstadoAppNuvem
): EstadoAppNuvem {
  return {
    ...estado,
    schemaVersion: SCHEMA_VERSION_ATUAL,
    versao: VERSAO_ESTADO_APP,
    materias: migrarMateriasParaModulos(
      estado.materias
    ),
    configuracoes: normalizarConfiguracoesApp(estado.configuracoes),
    salvoEm:
      typeof estado.salvoEm === "string"
        ? estado.salvoEm
        : new Date().toISOString(),
    syncRevision:
      typeof estado.syncRevision === "number" && Number.isFinite(estado.syncRevision)
        ? Math.max(0, Math.floor(estado.syncRevision))
        : 0,
    atualizadoEm:
      typeof estado.atualizadoEm === "string"
        ? estado.atualizadoEm
        : (
            typeof estado.salvoEm === "string"
              ? estado.salvoEm
              : new Date().toISOString()
          ),
  };
}
