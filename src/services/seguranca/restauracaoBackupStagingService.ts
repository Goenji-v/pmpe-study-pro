import { supabase } from "../../lib/supabase";
import {
  ConflitoSincronizacaoError,
  obterRevisaoSincronizacao,
  validarEMigrarEstado,
  validarIntegridadeEstado,
  type EstadoAppNuvem,
} from "../sincronizacaoService";

// The upload is kept as a user-owned cloud checkpoint. Its RLS policy
// requires auth.uid() = user_id; restoring it then uses the same atomic
// CAS transaction as a timeline backup. Never delete it automatically
// after uncertain network failures.
export async function arquivarBackupParaRestauracaoStaging(
  usuarioId: string,
  estado: EstadoAppNuvem
): Promise<string> {
  if (
    import.meta.env.VITE_STUDY_PRO_STAGING_GUARD !== "true" ||
    import.meta.env.VITE_SUPABASE_URL !== "https://isjzyyoqvftrltkctanw.supabase.co"
  ) {
    throw new Error("Importação experimental disponível somente no staging.");
  }
  if (!usuarioId || !estado) {
    throw new Error("Não foi possível identificar a conta ou o backup.");
  }
  validarIntegridadeEstado(estado);

  const criadoEm = new Date().toISOString();
  const { data, error } = await supabase.from("backups")
    .insert({
      user_id: usuarioId,
      nome: `Importado para restauração ${criadoEm} ${crypto.randomUUID()}`,
      versao: 18,
      dados: {
        tipo: "backup_incremental",
        criadoEm,
        syncRevision: obterRevisaoSincronizacao(estado),
        estado,
      },
    })
    .select("id")
    .single();

  if (error || !data?.id) {
    throw new Error(
      `Não foi possível preservar o backup importado na nuvem. Nada foi restaurado. ${error?.message ?? ""}`
    );
  }
  return data.id;
}

// This privileged RPC exists ONLY in the isolated staging database.
// Keep it out of production builds until the SQL is independently audited.
export async function restaurarBackupHistoricoStaging(
  backupId: string,
  revisaoEsperada: number
): Promise<EstadoAppNuvem> {
  if (
    import.meta.env.VITE_STUDY_PRO_STAGING_GUARD !== "true" ||
    import.meta.env.VITE_SUPABASE_URL !== "https://isjzyyoqvftrltkctanw.supabase.co"
  ) {
    throw new Error("Restauração experimental disponível somente na prévia isolada.");
  }

  if (
    !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(backupId) ||
    !Number.isSafeInteger(revisaoEsperada) ||
    revisaoEsperada < 0
  ) {
    throw new Error("Identificação do backup ou revisão inválida.");
  }

  const { data, error } = await supabase.rpc("restaurar_backup_cas", {
    p_backup_id: backupId,
    p_expected_revision: revisaoEsperada,
    p_confirmacao: "CONFIRMO_RESTAURACAO",
  });

  if (error) {
    // A network failure may happen after the server has committed. Never
    // retry automatically or overwrite the cloud with the old local state.
    throw new Error(
      `Não foi possível confirmar a restauração na nuvem. Verifique o estado remoto antes de tentar novamente. Detalhe: ${error.message}`
    );
  }

  const resultado = Array.isArray(data) ? data[0] : data;
  if (!resultado?.ok) {
    throw new ConflitoSincronizacaoError(
      Number(resultado?.revisao_atual ?? revisaoEsperada),
      revisaoEsperada,
      "O estado foi alterado por outro dispositivo. Nada foi restaurado. Atualize os dados antes de tentar novamente."
    );
  }

  const estado = validarEMigrarEstado(resultado.estado_restaurado);
  if (!estado) {
    throw new Error(
      "A nuvem confirmou a restauração, mas o estado não pôde ser validado. Recarregue os dados da nuvem; não repita a operação."
    );
  }
  validarIntegridadeEstado(estado);
  if (obterRevisaoSincronizacao(estado) !== Number(resultado.revisao_atual)) {
    throw new Error(
      "A revisão retornada pela nuvem não corresponde ao estado restaurado. Recarregue os dados antes de continuar."
    );
  }

  return estado;
}
