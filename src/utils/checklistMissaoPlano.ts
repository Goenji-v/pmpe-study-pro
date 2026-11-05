import { armazenamentoLocalDaConta as localStorage } from "../services/armazenamentoConta";

/**
 * Checklist auxiliar e privado: nunca cria sessão, nunca marca missão concluída.
 * Chave individual por usuário e por geração de reinício de dados.
 */
export type ChecklistMissoes = Record<string, boolean[]>;
const PREFIXO = "pmpe:plano-tatico:checklist:v1";

export function chaveChecklistPlano(usuarioId: string, reiniciadoEm = ""): string {
  return `${PREFIXO}:${usuarioId}:${reiniciadoEm || "inicial"}`;
}

export function normalizarChecklistPlano(valor: unknown): ChecklistMissoes {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const resultado: ChecklistMissoes = {};
  for (const [id, etapas] of Object.entries(valor)) {
    if (!id || id.length > 200 || !Array.isArray(etapas) || etapas.length !== 4) continue;
    if (!etapas.every((etapa) => typeof etapa === "boolean")) continue;
    resultado[id] = etapas.slice();
  }
  return resultado;
}

export function carregarChecklistPlano(usuarioId: string | undefined, reiniciadoEm?: string): ChecklistMissoes {
  if (!usuarioId) return {};
  try {
    const bruto = localStorage.getItem(chaveChecklistPlano(usuarioId, reiniciadoEm));
    return bruto ? normalizarChecklistPlano(JSON.parse(bruto) as unknown) : {};
  } catch {
    return {};
  }
}

export function salvarChecklistPlano(
  usuarioId: string | undefined,
  reiniciadoEm: string | undefined,
  dados: ChecklistMissoes,
): void {
  if (!usuarioId) return;
  localStorage.setItem(chaveChecklistPlano(usuarioId, reiniciadoEm), JSON.stringify(dados));
}

export function atualizarEtapaChecklist(
  atual: ChecklistMissoes, missaoId: string, indice: number, marcado: boolean,
): ChecklistMissoes {
  if (!missaoId || indice < 0 || indice > 3 || !Number.isInteger(indice)) return atual;
  const etapas = [...(atual[missaoId] ?? [false, false, false, false])];
  etapas[indice] = marcado;
  return { ...atual, [missaoId]: etapas };
}
