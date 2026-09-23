import { supabase } from "../../lib/supabase";
import type { EstadoAppNuvem } from "../sincronizacaoService";
import {
  listarBackupsAutomaticosLocais,
} from "./backupAutomaticoService";

export type BackupConflitoNuvem = {
  tipo: "conflito_sincronizacao";
  criadoEm: string;
  revisaoLocal: number;
  revisaoNuvem: number;
  estadoLocal: EstadoAppNuvem;
  estadoNuvem: EstadoAppNuvem;
};

export async function registrarBackupConflitoNaNuvem(params: {
  usuarioId: string;
  estadoLocal: EstadoAppNuvem;
  estadoNuvem: EstadoAppNuvem;
}) {
  const criadoEm = new Date().toISOString();
  const dados: BackupConflitoNuvem = {
    tipo: "conflito_sincronizacao",
    criadoEm,
    revisaoLocal: Math.max(
      0,
      Math.floor(params.estadoLocal.syncRevision ?? 0)
    ),
    revisaoNuvem: Math.max(
      0,
      Math.floor(params.estadoNuvem.syncRevision ?? 0)
    ),
    estadoLocal: params.estadoLocal,
    estadoNuvem: params.estadoNuvem,
  };

  const { error } = await supabase
    .from("backups")
    .insert({
      user_id: params.usuarioId,
      nome: `Conflito de sincronização — ${criadoEm}`,
      versao: 18,
      dados,
    });

  if (error) {
    throw new Error(
      `Não foi possível preservar as duas versões do conflito na nuvem: ${error.message}`
    );
  }
}


export async function sincronizarBackupsConflitoLocaisNaNuvem(
  usuarioId: string
) {
  const locais =
    listarBackupsAutomaticosLocais(
      usuarioId
    ).filter(
      (backup) =>
        backup.motivo ===
        "antes_resolucao_conflito"
    );

  if (locais.length === 0) {
    return 0;
  }

  const nomes = locais.map(
    (backup) =>
      `Conflito local — ${backup.id}`
  );

  const { data: existentes, error: erroConsulta } =
    await supabase
      .from("backups")
      .select("nome")
      .eq("user_id", usuarioId)
      .in("nome", nomes);

  if (erroConsulta) {
    throw new Error(
      `Não foi possível consultar backups de conflito já enviados: ${erroConsulta.message}`
    );
  }

  const nomesExistentes = new Set(
    (existentes ?? []).map(
      (item) => item.nome
    )
  );

  const novos = locais.filter(
    (backup) =>
      !nomesExistentes.has(
        `Conflito local — ${backup.id}`
      )
  );

  if (novos.length === 0) {
    return 0;
  }

  const { error } = await supabase
    .from("backups")
    .insert(
      novos.map((backup) => ({
        user_id: usuarioId,
        nome: `Conflito local — ${backup.id}`,
        versao: 18,
        dados: {
          tipo: "conflito_local_recuperado",
          backupLocalId: backup.id,
          criadoEm: backup.criadoEm,
          motivo: backup.motivo,
          schemaVersionOrigem:
            backup.schemaVersionOrigem,
          checksum: backup.checksum,
          estadoLocal: backup.dados,
        },
      }))
    );

  if (error) {
    throw new Error(
      `Não foi possível enviar os backups locais de conflito: ${error.message}`
    );
  }

  return novos.length;
}
