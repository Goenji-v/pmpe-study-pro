import { supabase } from "../../lib/supabase";
import type { RelatorioMigracaoEdital } from "../../types/editalInteligente";
import type { EstadoAppNuvem } from "../sincronizacaoService";
import { SCHEMA_VERSION_ATUAL } from "./schemaVersion";

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
  id: string;
  nome: string;
  criadoEm: string;
  estado: EstadoAppNuvem;
  relatorio: RelatorioMigracaoEdital;
};

type LinhaBackup = {
  id: string;
  nome: string;
  created_at: string;
  dados: {
    tipo?: string;
    estadoAnterior?: unknown;
    relatorio?: unknown;
  };
};

export async function registrarBackupMigracaoEditalNaNuvem(params: {
  usuarioId: string;
  estadoAnterior: EstadoAppNuvem;
  relatorio: RelatorioMigracaoEdital;
}) {
  const criadoEm = new Date().toISOString();
  const nome =
    `Antes da migração de edital — ${params.relatorio.editalAnteriorNome ?? "sem edital"} → ${params.relatorio.editalNovoNome}`;

  const { data, error } = await comTimeout(
    supabase
      .from("backups")
      .insert({
        user_id: params.usuarioId,
        nome,
        versao: SCHEMA_VERSION_ATUAL,
        dados: {
          tipo: "antes_migracao_edital",
          criadoEm,
          relatorio: params.relatorio,
          estadoAnterior: params.estadoAnterior,
        },
      })
      .select("id")
      .single(),
    TIMEOUT_BACKUP_MIGRACAO_MS,
    "O backup pré-migração no Supabase demorou demais. A migração não foi iniciada."
  );

  if (error || !data?.id) {
    throw new Error(
      `Não foi possível criar o backup pré-migração no Supabase. Nenhum dado foi alterado. ${error?.message ?? ""}`.trim()
    );
  }

  return String(data.id);
}

export async function listarBackupsMigracaoEditalNaNuvem(
  usuarioId: string
): Promise<BackupMigracaoEditalNuvem[]> {
  const { data, error } = await supabase
    .from("backups")
    .select("id, nome, created_at, dados")
    .eq("user_id", usuarioId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(
      `Não foi possível carregar os backups de migração: ${error.message}`
    );
  }

  return (data ?? [])
    .flatMap((linhaBruta) => {
      const linha = linhaBruta as LinhaBackup;
      if (linha.dados?.tipo !== "antes_migracao_edital") return [];

      const estado =
        linha.dados?.estadoAnterior as EstadoAppNuvem | undefined;
      const relatorio =
        linha.dados?.relatorio as RelatorioMigracaoEdital | undefined;

      if (!estado || !relatorio) return [];

      return [{
        id: linha.id,
        nome: linha.nome,
        criadoEm: linha.created_at,
        estado,
        relatorio,
      }];
    })
    .slice(0, 10);
}
