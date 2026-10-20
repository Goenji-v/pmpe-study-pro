import { chaveDaMateria } from "./desempenhoMaterias";

export type ReferenciaMateriaHistorico = { materia: string; materiaId?: string };

/** Resolve todo o conjunto antes de agrupar: um ID sobrevive a renomeações,
 * enquanto nomes legados só apontam a um ID quando essa ligação é inequívoca. */
export function criarIdentificadorMateriaHistorico(registros: readonly ReferenciaMateriaHistorico[]) {
  const idsPorNome = new Map<string, Set<string>>();
  const nome = (registro: ReferenciaMateriaHistorico) => chaveDaMateria(registro.materia) || "sem materia";
  for (const registro of registros) {
    if (!registro.materiaId) continue;
    const chave = nome(registro);
    const ids = idsPorNome.get(chave) ?? new Set<string>();
    ids.add(registro.materiaId);
    idsPorNome.set(chave, ids);
  }
  return (registro: ReferenciaMateriaHistorico) => {
    if (registro.materiaId) return `id:${registro.materiaId}`;
    const chave = nome(registro);
    const ids = idsPorNome.get(chave);
    if (ids?.size === 1) return `id:${ids.values().next().value}`;
    return `nome:${chave}`;
  };
}
