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
  estado: EstadoAppNuvem;
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

type LinhaBackup = {
  id: string;
  nome: string;
  dados: unknown;
  created_at: string;
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

  const { data: recentes, error: erroConsulta } = await supabase
    .from("backups")
    .select("id,nome,dados,created_at")
    .eq("user_id", usuarioId)
    .order("created_at", { ascending: false })
    .limit(30);

  if (erroConsulta) {
    throw new Error(
      `Não foi possível consultar o histórico de backups: ${erroConsulta.message}`
    );
  }

  const anterior = (recentes ?? [])
    .map((linha) => normalizarLinha(linha as LinhaBackup))
    .find(Boolean);

  const alteracoes = calcularAlteracoes(
    anterior?.resumo,
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

  const { data, error } = await supabase
    .from("backups")
    .select("id,nome,dados,created_at")
    .eq("user_id", usuarioId)
    .gte("created_at", limite.toISOString())
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    throw new Error(
      `Não foi possível carregar o histórico de backups: ${error.message}`
    );
  }

  return (data ?? [])
    .map((linha) => normalizarLinha(linha as LinhaBackup))
    .filter((backup): backup is BackupHistoricoNuvem => Boolean(backup));
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

function normalizarLinha(
  linha: LinhaBackup
): BackupHistoricoNuvem | null {
  if (!linha.dados || typeof linha.dados !== "object") {
    return null;
  }

  const dados = linha.dados as {
    tipo?: unknown;
    diaLocal?: unknown;
    janela?: unknown;
    criadoEm?: unknown;
    syncRevision?: unknown;
    estado?: unknown;
    resumo?: unknown;
    alteracoes?: unknown;
  };

  if (
    dados.tipo !== "backup_incremental" &&
    dados.tipo !== "backup_oficial_meio_dia" &&
    dados.tipo !== "backup_oficial_fechamento"
  ) {
    return null;
  }

  if (!dados.estado || typeof dados.estado !== "object") {
    return null;
  }

  const estado = dados.estado as EstadoAppNuvem;
  const resumo =
    dados.resumo && typeof dados.resumo === "object"
      ? (dados.resumo as ResumoEstadoBackup)
      : resumirEstado(estado);

  return {
    id: linha.id,
    nome: linha.nome,
    criadoEm:
      typeof dados.criadoEm === "string"
        ? dados.criadoEm
        : linha.created_at,
    tipo: dados.tipo,
    diaLocal:
      typeof dados.diaLocal === "string"
        ? dados.diaLocal
        : obterHorarioRecife(new Date(linha.created_at)).dia,
    janela:
      typeof dados.janela === "string"
        ? dados.janela
        : undefined,
    syncRevision:
      typeof dados.syncRevision === "number"
        ? dados.syncRevision
        : obterRevisao(estado),
    estado,
    resumo,
    alteracoes:
      dados.alteracoes && typeof dados.alteracoes === "object"
        ? (dados.alteracoes as ResumoAlteracoesBackup)
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
