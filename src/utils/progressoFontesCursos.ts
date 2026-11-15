import type { AulaAssunto } from "../types";

/** Preferir um curso não pode apagar o progresso das fontes alternativas.
 * Na ausência de escolha, preserva-se a regra original de conclusão.
 */
export function aulasDaFontePrincipal(
  aulas: readonly AulaAssunto[],
  cursoPreferido?: string,
): AulaAssunto[] {
  if (!cursoPreferido) return [...aulas];
  const aulasDoCurso = aulas.filter((aula) => aula.origemCurso?.cursoId === cursoPreferido);
  return aulasDoCurso.length > 0 ? aulasDoCurso : [...aulas];
}
