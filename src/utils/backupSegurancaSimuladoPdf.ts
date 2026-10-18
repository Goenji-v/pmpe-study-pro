import type { ProcessoSimuladoPdfPersistido } from "../services/simuladoPdfPersistencia";

export type BackupSegurancaSimuladoPdf = {
  formato: "pmpe-study-pro-simulado-pdf";
  versao: 1;
  exportadoEm: string;
  incluiArquivoPdf: false;
  processo: ProcessoSimuladoPdfPersistido;
  anotacoes: unknown | null;
};

/** O backup fica no aparelho, sem o PDF e sem enviar respostas ao servidor. */
export function criarBackupSegurancaSimuladoPdf(
  processo: ProcessoSimuladoPdfPersistido,
  anotacoes: unknown | null,
): BackupSegurancaSimuladoPdf {
  return {
    formato: "pmpe-study-pro-simulado-pdf",
    versao: 1,
    exportadoEm: new Date().toISOString(),
    incluiArquivoPdf: false,
    processo: {
      ...processo,
      respostas: { ...processo.respostas },
    },
    anotacoes,
  };
}

/** Apenas arquivos exportados da sala PDF, nunca backups gerais da conta. */
export function lerBackupSegurancaSimuladoPdf(texto: string): BackupSegurancaSimuladoPdf {
  if (texto.length > 2_000_000) {
    throw new Error("Backup grande demais para a restauração da sala PDF.");
  }

  let candidato: unknown;
  try {
    candidato = JSON.parse(texto);
  } catch {
    throw new Error("O backup não contém JSON válido.");
  }

  if (!ehRegistro(candidato) ||
      candidato.formato !== "pmpe-study-pro-simulado-pdf" ||
      candidato.versao !== 1 || candidato.incluiArquivoPdf !== false ||
      typeof candidato.exportadoEm !== "string" ||
      !Number.isFinite(Date.parse(candidato.exportadoEm))) {
    throw new Error("Arquivo incompatível com o backup do Simulado PDF.");
  }

  const p = candidato.processo;
  if (!ehRegistro(p) ||
      typeof p.id !== "string" || !/^[\w-]{8,128}$/.test(p.id) ||
      typeof p.nome !== "string" || p.nome.length < 1 || p.nome.length > 250 ||
      !ehInteiro(p.totalQuestoes) || p.totalQuestoes < 1 || p.totalQuestoes > 200 ||
      !ehInteiro(p.questaoAtual) || p.questaoAtual < 1 || p.questaoAtual > p.totalQuestoes ||
      !ehInteiroSeguro(p.segundos) || p.segundos < 0 ||
      typeof p.pausado !== "boolean" || typeof p.finalizado !== "boolean" ||
      typeof p.finalizarQuandoPronto !== "boolean" ||
      !["analisando", "concluida", "erro"].includes(String(p.estadoAnalise)) ||
      !ehNumeroFinito(p.progressoAnalise) || p.progressoAnalise < 0 || p.progressoAnalise > 100 ||
      typeof p.criadoEm !== "string" || !Number.isFinite(Date.parse(p.criadoEm)) ||
      typeof p.atualizadoEm !== "string" || !Number.isFinite(Date.parse(p.atualizadoEm)) ||
      !ehRegistro(p.respostas)) {
    throw new Error("O backup contém dados de uma tentativa inválida ou incompleta.");
  }

  for (const [numero, letra] of Object.entries(p.respostas)) {
    if (!/^[1-9]\d*$/.test(numero) || Number(numero) > p.totalQuestoes ||
        typeof letra !== "string" || !["A", "B", "C", "D", "E"].includes(letra)) {
      throw new Error("O backup contém marcações inválidas.");
    }
  }

  if (p.semana !== undefined && (!ehInteiro(p.semana) || p.semana < 0)) {
    throw new Error("Semana inválida no backup.");
  }
  if (p.dia !== undefined && (!ehInteiro(p.dia) || p.dia < 0)) {
    throw new Error("Dia inválido no backup.");
  }
  if (p.missaoId !== undefined && typeof p.missaoId !== "string") {
    throw new Error("Referência de missão inválida no backup.");
  }
  if (p.erroAnalise !== undefined && typeof p.erroAnalise !== "string") {
    throw new Error("Mensagem de erro inválida no backup.");
  }

  return {
    formato: "pmpe-study-pro-simulado-pdf",
    versao: 1,
    exportadoEm: candidato.exportadoEm,
    incluiArquivoPdf: false,
    processo: {
      id: p.id,
      nome: p.nome,
      totalQuestoes: p.totalQuestoes,
      semana: p.semana as number | undefined,
      dia: p.dia as number | undefined,
      missaoId: p.missaoId as string | undefined,
      respostas: { ...p.respostas } as Record<string, string>,
      questaoAtual: p.questaoAtual,
      segundos: p.segundos,
      pausado: p.pausado,
      finalizado: p.finalizado,
      finalizarQuandoPronto: p.finalizarQuandoPronto,
      estadoAnalise: p.estadoAnalise as ProcessoSimuladoPdfPersistido["estadoAnalise"],
      progressoAnalise: p.progressoAnalise,
      erroAnalise: p.erroAnalise as string | undefined,
      criadoEm: p.criadoEm,
      atualizadoEm: p.atualizadoEm,
    },
    anotacoes: candidato.anotacoes ?? null,
  };
}

function ehRegistro(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function ehInteiro(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v);
}

function ehInteiroSeguro(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v);
}

function ehNumeroFinito(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}
