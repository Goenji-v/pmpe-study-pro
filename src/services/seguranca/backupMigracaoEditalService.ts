import { supabase } from "../../lib/supabase";
import type { EstadoAppNuvem } from "../sincronizacaoService";

const TIMEOUT_BACKUP_MIGRACAO_MS = 15000;

function comTimeout<T>(
  promessa: PromiseLike<T>,
  milissegundos: number,
  mensagem: string
): Promise<T> {
  return Promise.race([
    Promise.resolve(promessa),
    new Promise<T>((_, rejeitar) => {
      window.setTimeout(
        () => rejeitar(new Error(mensagem)),
        milissegundos
      );
    }),
  ]);
}

export type BackupMigracaoEditalNuvem = {
  tipo: "pre_migracao_edital";
  criadoEm: string;
  editalAnteriorId?: string;
  editalNovoId?: string;
  estadoAnterior: EstadoAppNuvem;
};

export async function registrarBackupMigracaoEditalNaNuvem(params: {
  usuarioId: string;
  estadoAnterior: EstadoAppNuvem;
  editalAnteriorId?: string;
  editalNovoId?: string;
}) {
  const criadoEm = new Date().toISOString();
  const dados: BackupMigracaoEditalNuvem = {
    tipo: "pre_migracao_edital",
    criadoEm,
    editalAnteriorId: params.editalAnteriorId,
    editalNovoId: params.editalNovoId,
    estadoAnterior: params.estadoAnterior,
  };

  const { data, error } = await comTimeout(
    supabase
      .from("backups")
      .insert({
        user_id: params.usuarioId,
        nome: `Pré-migração de edital — ${criadoEm}`,
        versao: params.estadoAnterior.versao,
        dados,
      })
      .select("id")
      .single(),
    TIMEOUT_BACKUP_MIGRACAO_MS,
    "O backup pré-migração no Supabase demorou demais. A migração foi cancelada."
  );

  if (error) {
    throw new Error(
      `Não foi possível criar o backup pré-migração no Supabase: ${error.message}`
    );
  }

  return {
    id: String(data?.id ?? ""),
    criadoEm,
  };
}
