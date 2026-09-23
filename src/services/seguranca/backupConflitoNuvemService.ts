import { supabase } from "../../lib/supabase";
import type { EstadoAppNuvem } from "../sincronizacaoService";

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
