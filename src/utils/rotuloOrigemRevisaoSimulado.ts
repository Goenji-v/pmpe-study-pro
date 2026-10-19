import type { Revisao } from "../types";

/** O nome da prova é exibido apenas se a origem tiver identificador verificável. */
export function rotuloOrigemRevisaoSimulado(
  revisao: Revisao,
  nomesPorTentativa: Record<string, string> = {}
): string | null {
  const origem = revisao.origemSimulado;
  if (!origem?.tentativaId) return null;
  const nome = (origem.nome || nomesPorTentativa[origem.tentativaId] || "").trim();
  return nome ? `Revisão de erros · ${nome}` : "Revisão de erros · Simulado";
}
