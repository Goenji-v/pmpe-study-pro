import type { ProcessoSimuladoPdfPersistido } from "../services/simuladoPdfPersistencia";

/** Backup local, sem enviar respostas ou anotacoes para nenhum servidor. */
export function criarBackupSegurancaSimuladoPdf(
  processo: ProcessoSimuladoPdfPersistido,
  anotacoes: unknown | null,
) {
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
