import {
  SCHEMA_VERSION_ATUAL,
} from "./schemaVersion";

export type MotivoBackupAutomatico =
  | "antes_migracao_schema"
  | "antes_reconciliacao_estrutural"
  | "antes_rollback"
  | "antes_restauracao_manual"
  | "antes_resolucao_conflito";

export type BackupAutomaticoLocal = {
  id: string;
  usuarioId: string;
  criadoEm: string;
  motivo: MotivoBackupAutomatico;
  schemaVersionOrigem: number;
  schemaVersionDestino: typeof SCHEMA_VERSION_ATUAL;
  checksum: string;
  dados: unknown;
};

const LIMITE_BACKUPS_AUTOMATICOS = 10;
const PREFIXO_CHAVE = "pmpe:seguranca:backups-automaticos";

function chaveDoUsuario(usuarioId: string) {
  return `${PREFIXO_CHAVE}:${usuarioId}`;
}

function obterSchemaVersion(valor: unknown): number {
  if (!valor || typeof valor !== "object") return 0;

  const objeto = valor as {
    schemaVersion?: unknown;
    versao?: unknown;
  };

  if (
    typeof objeto.schemaVersion === "number" &&
    Number.isFinite(objeto.schemaVersion)
  ) {
    return objeto.schemaVersion;
  }

  if (
    typeof objeto.versao === "number" &&
    Number.isFinite(objeto.versao)
  ) {
    return objeto.versao;
  }

  return 1;
}

function checksumTexto(texto: string) {
  // FNV-1a de 32 bits: suficiente para detectar cópias idênticas no cache
  // local sem depender de APIs assíncronas do navegador.
  let hash = 0x811c9dc5;

  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function clonarSerializavel(valor: unknown) {
  const serializado = JSON.stringify(valor);

  if (typeof serializado !== "string") {
    throw new Error("O estado atual não pôde ser serializado para backup.");
  }

  return {
    serializado,
    copia: JSON.parse(serializado) as unknown,
  };
}

export function listarBackupsAutomaticosLocais(
  usuarioId: string
): BackupAutomaticoLocal[] {
  if (typeof window === "undefined") return [];

  const bruto = window.localStorage.getItem(
    chaveDoUsuario(usuarioId)
  );

  if (!bruto) return [];

  try {
    const dados = JSON.parse(bruto) as unknown;
    if (!Array.isArray(dados)) return [];

    return dados.filter(
      (item): item is BackupAutomaticoLocal =>
        Boolean(item) &&
        typeof item === "object" &&
        typeof (item as BackupAutomaticoLocal).id === "string" &&
        typeof (item as BackupAutomaticoLocal).criadoEm === "string"
    );
  } catch {
    return [];
  }
}

export function criarBackupAutomaticoLocal(
  usuarioId: string,
  estado: unknown,
  motivo: MotivoBackupAutomatico
): BackupAutomaticoLocal {
  const { serializado, copia } = clonarSerializavel(estado);
  const checksum = checksumTexto(serializado);
  const existentes = listarBackupsAutomaticosLocais(usuarioId);

  // Evita criar várias cópias exatamente iguais durante o mesmo processo de
  // inicialização/migração.
  const existenteIgual = existentes.find(
    (backup) =>
      backup.checksum === checksum &&
      backup.motivo === motivo
  );

  if (existenteIgual) {
    return existenteIgual;
  }

  const agora = new Date().toISOString();
  const backup: BackupAutomaticoLocal = {
    id: `auto-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    usuarioId,
    criadoEm: agora,
    motivo,
    schemaVersionOrigem: obterSchemaVersion(estado),
    schemaVersionDestino: SCHEMA_VERSION_ATUAL,
    checksum,
    dados: copia,
  };

  if (typeof window !== "undefined") {
    const proximos = [backup, ...existentes]
      .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
      .slice(0, LIMITE_BACKUPS_AUTOMATICOS);

    const chave = chaveDoUsuario(usuarioId);
    let salvou = false;
    let ultimoErro: unknown = null;

    // localStorage tem cota limitada. Tentamos manter até 10 cópias; se não
    // couber, descartamos apenas as mais antigas até que o backup novo caiba.
    for (
      let quantidade = proximos.length;
      quantidade >= 1;
      quantidade -= 1
    ) {
      try {
        window.localStorage.setItem(
          chave,
          JSON.stringify(proximos.slice(0, quantidade))
        );
        salvou = true;
        break;
      } catch (erro) {
        ultimoErro = erro;
      }
    }

    if (!salvou) {
      throw new Error(
        `Não foi possível reservar espaço local para o backup automático. ${
          ultimoErro instanceof Error ? ultimoErro.message : ""
        }`.trim()
      );
    }

    window.dispatchEvent(new Event("pmpe-backup-atualizado"));
  }

  return backup;
}

export function obterBackupAutomaticoLocal(
  usuarioId: string,
  backupId: string
) {
  return listarBackupsAutomaticosLocais(usuarioId).find(
    (backup) => backup.id === backupId
  ) ?? null;
}
