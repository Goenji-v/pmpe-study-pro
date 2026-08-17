import {
  montarEstadoNuvem,
  validarEMigrarEstado,
  validarIntegridadeEstado,
  type EstadoAppNuvem,
} from "../sincronizacaoService";
import { SCHEMA_VERSION_ATUAL } from "./schemaVersion";

export type ResumoBackupManual = {
  materias: number;
  questoesRegistradas: number;
  sessoes: number;
  revisoes: number;
  simulados: number;
  bancoQuestoes: number;
  missoesConcluidas: number;
};

export type ArquivoBackupStudyPro = {
  tipo: "pmpe-study-pro-backup";
  schemaVersion: typeof SCHEMA_VERSION_ATUAL;
  exportadoEm: string;
  checksum: string;
  resumo: ResumoBackupManual;
  estado: EstadoAppNuvem;
};

type BackupLegado = {
  versao?: unknown;
  exportadoEm?: unknown;
  dados?: unknown;
};

function serializar(valor: unknown) {
  return JSON.stringify(valor);
}

function checksumTexto(texto: string) {
  let hash = 0x811c9dc5;

  for (let indice = 0; indice < texto.length; indice += 1) {
    hash ^= texto.charCodeAt(indice);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}

function resumoDoEstado(estado: EstadoAppNuvem): ResumoBackupManual {
  return {
    materias: estado.materias.length,
    questoesRegistradas: estado.questoes.length,
    sessoes: estado.sessoes.length,
    revisoes: estado.revisoes.length,
    simulados: estado.simulados.length + estado.simuladosGerados.length,
    bancoQuestoes: estado.bancoQuestoes.length,
    missoesConcluidas: estado.missoesConcluidas.length,
  };
}

export function criarArquivoBackupStudyPro(
  estado: EstadoAppNuvem
): ArquivoBackupStudyPro {
  validarIntegridadeEstado(estado);

  const copia = JSON.parse(JSON.stringify(estado)) as EstadoAppNuvem;
  const exportadoEm = new Date().toISOString();
  const checksum = checksumTexto(serializar(copia));

  return {
    tipo: "pmpe-study-pro-backup",
    schemaVersion: SCHEMA_VERSION_ATUAL,
    exportadoEm,
    checksum,
    resumo: resumoDoEstado(copia),
    estado: copia,
  };
}

export function baixarArquivoBackupStudyPro(
  backup: ArquivoBackupStudyPro
) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const data = new Date(backup.exportadoEm);
  const nomeData = [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
    "-",
    String(data.getHours()).padStart(2, "0"),
    String(data.getMinutes()).padStart(2, "0"),
  ].join("");

  link.href = url;
  link.download = `pmpe-study-pro-backup-schema18-${nomeData}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function converterBackupLegado(valor: BackupLegado): EstadoAppNuvem {
  if (!valor.dados || typeof valor.dados !== "object") {
    throw new Error("O backup antigo está incompleto.");
  }

  const dados = valor.dados as Record<string, unknown>;
  const exportadoEm =
    typeof valor.exportadoEm === "string"
      ? valor.exportadoEm
      : new Date().toISOString();

  const candidato = {
    schemaVersion:
      typeof valor.versao === "number" ? valor.versao : 1,
    versao:
      typeof valor.versao === "number" ? valor.versao : 1,
    materias: dados.materias,
    questoes: dados.questoes,
    sessoes: dados.sessoes,
    revisoes: dados.revisoes,
    simulados: dados.simulados,
    bancoQuestoes: dados.bancoQuestoes,
    simuladosGerados: dados.simuladosGerados,
    configuracoes: dados.configuracoes,
    missoesConcluidas: Array.isArray(dados.missoesConcluidas)
      ? dados.missoesConcluidas
      : [],
    salvoEm: exportadoEm,
  };

  const migrado = validarEMigrarEstado(candidato);
  if (!migrado) {
    throw new Error("O backup antigo não pôde ser migrado com segurança.");
  }

  validarIntegridadeEstado(migrado);
  return migrado;
}

export function lerArquivoBackupStudyPro(texto: string): ArquivoBackupStudyPro {
  let valor: unknown;

  try {
    valor = JSON.parse(texto) as unknown;
  } catch {
    throw new Error("O arquivo selecionado não contém JSON válido.");
  }

  if (!valor || typeof valor !== "object") {
    throw new Error("O arquivo selecionado não contém um backup válido.");
  }

  const objeto = valor as Record<string, unknown>;

  if (objeto.tipo === "pmpe-study-pro-backup") {
    if (
      objeto.schemaVersion !== SCHEMA_VERSION_ATUAL ||
      typeof objeto.exportadoEm !== "string" ||
      typeof objeto.checksum !== "string" ||
      !objeto.estado ||
      typeof objeto.estado !== "object"
    ) {
      throw new Error("Formato de backup incompatível ou incompleto.");
    }

    const migrado = validarEMigrarEstado(objeto.estado);
    if (!migrado) {
      throw new Error("O estado do backup não passou na validação.");
    }

    const checksumAtual = checksumTexto(serializar(objeto.estado));
    if (checksumAtual !== objeto.checksum) {
      throw new Error("O backup parece ter sido alterado ou corrompido (checksum inválido).");
    }

    validarIntegridadeEstado(migrado);

    return {
      tipo: "pmpe-study-pro-backup",
      schemaVersion: SCHEMA_VERSION_ATUAL,
      exportadoEm: objeto.exportadoEm,
      checksum: checksumTexto(serializar(migrado)),
      resumo: resumoDoEstado(migrado),
      estado: migrado,
    };
  }

  // Compatibilidade com a tela de Backup antiga (V1/V2).
  const estadoLegado = converterBackupLegado(valor as BackupLegado);
  return criarArquivoBackupStudyPro(
    montarEstadoNuvem({
      materias: estadoLegado.materias,
      questoes: estadoLegado.questoes,
      sessoes: estadoLegado.sessoes,
      revisoes: estadoLegado.revisoes,
      simulados: estadoLegado.simulados,
      bancoQuestoes: estadoLegado.bancoQuestoes,
      simuladosGerados: estadoLegado.simuladosGerados,
      configuracoes: estadoLegado.configuracoes,
      missoesConcluidas: estadoLegado.missoesConcluidas,
    })
  );
}
