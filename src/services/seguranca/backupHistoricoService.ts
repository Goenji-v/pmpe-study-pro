import { supabase } from "../../lib/supabase";

import type { EstadoAppNuvem } from "../sincronizacaoService";

export type TipoBackupHistorico =
  | "backup_incremental"
  | "backup_oficial_meio_dia"
  | "backup_oficial_fechamento";

export type BackupHistoricoNuvem = {
  id: string;
  nome: string;
  criadoEm: string;
  tipo: TipoBackupHistorico;
  diaLocal: string;
  janela?: string;
  syncRevision: number;
  resumo: ResumoEstadoBackup;
  alteracoes?: ResumoAlteracoesBackup;
};

export type ResumoEstadoBackup = {
  sessoes: number;
  questoes: number;
  revisoes: number;
  simulados: number;
  missoesConcluidas: number;
};

export type ResumoAlteracoesBackup = {
  sessoes: number;
  questoes: number;
  revisoes: number;
  simulados: number;
  missoesConcluidas: number;
};

type LinhaResumoBackup = {
  id: string;
  nome: string;
  created_at: string;
  tipo: unknown;
  diaLocal: unknown;
  janela: unknown;
  criadoEm: unknown;
  syncRevision: unknown;
  resumo: unknown;
  alteracoes: unknown;
};

export async function registrarBackupIncrementalNuvem(
  usuarioId: string,
  estado: EstadoAppNuvem
) {
  if (!usuarioId) return;

  const agora = new Date();
  const local = obterHorarioRecife(agora);
  const janela = obterJanela(local.hora);
  const nome = `Auto ${local.dia} ${janela}`;
  const resumo = resumirEstado(estado);

  // Os snapshots completos podem ter centenas de KB cada. Para calcular
  // diferenças buscamos apenas o resumo do checkpoint mais recente.
  const { data: recentes, error: erroConsulta } = await supabase
    .from("backups")
    .select("resumo:dados->resumo")
    .eq("user_id", usuarioId)
    .in("dados->>tipo", [
      "backup_incremental",
      "backup_oficial_meio_dia",
      "backup_oficial_fechamento",
    ])
    .order("created_at", { ascending: false })
    .limit(1);

  if (erroConsulta) {
    throw new Error(
      `Não foi possível consultar o histórico de backups: ${erroConsulta.message}`
    );
  }

  const resumoAnterior: unknown = recentes?.[0]?.resumo;
  const alteracoes = calcularAlteracoes(
    resumoAnterior && typeof resumoAnterior === "object"
      ? resumoAnterior as ResumoEstadoBackup
      : undefined,
    resumo
  );

  const criadoEm = agora.toISOString();
  const { error } = await supabase
    .from("backups")
    .upsert(
      {
        user_id: usuarioId,
        nome,
        versao: 18,
        created_at: criadoEm,
        dados: {
          tipo: "backup_incremental",
          diaLocal: local.dia,
          janela,
          criadoEm,
          syncRevision: obterRevisao(estado),
          estado,
          resumo,
          alteracoes,
        },
      },
      {
        onConflict: "user_id,nome",
      }
    );

  if (error) {
    throw new Error(
      `Não foi possível registrar o backup incremental: ${error.message}`
    );
  }
}

export async function listarBackupsHistoricoNuvem(
  usuarioId: string
): Promise<BackupHistoricoNuvem[]> {
  const limite = new Date();
  limite.setDate(limite.getDate() - 14);

  // A linha do tempo precisa apenas de metadados e contadores, nunca dos
  // snapshots completos (que podem totalizar dezenas de MB por conta).
  const { data, error } = await supabase
    .from("backups")
    .select(
      "id,nome,created_at,tipo:dados->>tipo,diaLocal:dados->>diaLocal,janela:dados->>janela,criadoEm:dados->>criadoEm,syncRevision:dados->syncRevision,resumo:dados->resumo,alteracoes:dados->alteracoes"
    )
    .eq("user_id", usuarioId)
    .in("dados->>tipo", [
      "backup_incremental",
      "backup_oficial_meio_dia",
      "backup_oficial_fechamento",
    ])
    .gte("created_at", limite.toISOString())
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    throw new Error(
      `Não foi possível carregar o histórico de backups: ${error.message}`
    );
  }

  return (data ?? [])
    .map((linha) => normalizarResumoLinha(linha as LinhaResumoBackup))
    .filter((backup): backup is BackupHistoricoNuvem => Boolean(backup));
}

/** Carrega o estado pesado somente quando o usuário escolhe restaurar. */
export async function carregarEstadoBackupHistoricoNuvem(
  usuarioId: string,
  backupId: string
): Promise<unknown> {
  const { data, error } = await supabase
    .from("backups")
    .select("dados")
    .eq("user_id", usuarioId)
    .eq("id", backupId)
    .maybeSingle();

  if (error) {
    throw new Error(`Não foi possível carregar este backup: ${error.message}`);
  }

  const dados: unknown = data?.dados;
  if (!dados || typeof dados !== "object" || !("estado" in dados)) {
    throw new Error("O backup solicitado não possui um estado recuperável.");
  }

  return (dados as { estado: unknown }).estado;
}

export function resumirEstado(
  estado: EstadoAppNuvem
): ResumoEstadoBackup {
  return {
    sessoes: estado.sessoes.length,
    questoes: estado.questoes.length,
    revisoes: estado.revisoes.length,
    simulados: estado.simulados.length,
    missoesConcluidas: estado.missoesConcluidas.length,
  };
}

function normalizarResumoLinha(
  linha: LinhaResumoBackup
): BackupHistoricoNuvem | null {
  if (
    linha.tipo !== "backup_incremental" &&
    linha.tipo !== "backup_oficial_meio_dia" &&
    linha.tipo !== "backup_oficial_fechamento"
  ) {
    return null;
  }

  // Todos os checkpoints do Schema 18 gravam um resumo independente.
  if (!linha.resumo || typeof linha.resumo !== "object") {
    return null;
  }

  const resumo = linha.resumo as ResumoEstadoBackup;
  if (
    !["sessoes", "questoes", "revisoes", "simulados", "missoesConcluidas"]
      .every((chave) => typeof resumo[chave as keyof ResumoEstadoBackup] === "number")
  ) {
    return null;
  }

  return {
    id: linha.id,
    nome: linha.nome,
    criadoEm:
      typeof linha.criadoEm === "string"
        ? linha.criadoEm
        : linha.created_at,
    tipo: linha.tipo,
    diaLocal:
      typeof linha.diaLocal === "string"
        ? linha.diaLocal
        : obterHorarioRecife(new Date(linha.created_at)).dia,
    janela:
      typeof linha.janela === "string"
        ? linha.janela
        : undefined,
    syncRevision:
      typeof linha.syncRevision === "number" ? linha.syncRevision : 0,
    resumo,
    alteracoes:
      linha.alteracoes && typeof linha.alteracoes === "object"
        ? linha.alteracoes as ResumoAlteracoesBackup
        : undefined,
  };
}

function calcularAlteracoes(
  anterior: ResumoEstadoBackup | undefined,
  atual: ResumoEstadoBackup
): ResumoAlteracoesBackup {
  if (!anterior) {
    return { ...atual };
  }

  return {
    sessoes: atual.sessoes - anterior.sessoes,
    questoes: atual.questoes - anterior.questoes,
    revisoes: atual.revisoes - anterior.revisoes,
    simulados: atual.simulados - anterior.simulados,
    missoesConcluidas:
      atual.missoesConcluidas - anterior.missoesConcluidas,
  };
}

function obterRevisao(estado: EstadoAppNuvem) {
  return typeof estado.syncRevision === "number" &&
    Number.isFinite(estado.syncRevision)
    ? Math.max(0, Math.floor(estado.syncRevision))
    : 0;
}

function obterHorarioRecife(data: Date) {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Recife",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(data);

  const mapa = Object.fromEntries(
    partes.map((parte) => [parte.type, parte.value])
  );

  return {
    dia: `${mapa.year}-${mapa.month}-${mapa.day}`,
    hora: Number(mapa.hour),
  };
}

function obterJanela(hora: number) {
  if (hora >= 5 && hora < 11) return "manhã";
  if (hora >= 11 && hora < 17) return "tarde";
  if (hora >= 17 && hora < 23) return "noite";
  return "madrugada";
}
