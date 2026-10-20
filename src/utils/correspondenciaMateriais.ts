import { chaveDaMateria } from "./desempenhoMaterias";

type MaterialReferenciavel = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
};

export type ReferenciaAssuntoMaterial = {
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  assuntoIdsLegados?: readonly string[];
};

function nomeExatoNormalizado(valor: string | undefined): string {
  return (valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ");
}

/**
 * IDs têm prioridade quando ambos os lados estão identificados.
 * Nomes antigos da matéria usam equivalências EXATAS e conhecidas; assuntos
 * sem ID precisam do mesmo nome, sem heurísticas por substring.
 */
export function materialCorrespondeAoAssunto(
  material: MaterialReferenciavel,
  referencia: ReferenciaAssuntoMaterial
): boolean {
  if (!materialPertenceAMateria(material, referencia)) return false;

  if (referencia.modulo?.trim()) {
    if (material.moduloId && referencia.moduloId) {
      if (material.moduloId !== referencia.moduloId) return false;
    } else if (
      material.modulo &&
      nomeExatoNormalizado(material.modulo) !== nomeExatoNormalizado(referencia.modulo)
    ) {
      return false;
    } else if (!material.modulo && nomeExatoNormalizado(referencia.modulo) !== "geral") {
      return false;
    }
  }

  if (material.assuntoId && referencia.assuntoId) {
    return [referencia.assuntoId, ...(referencia.assuntoIdsLegados ?? [])].includes(material.assuntoId);
  }

  return nomeExatoNormalizado(material.assunto) === nomeExatoNormalizado(referencia.assunto);
}

/** Os materiais de outra matéria nunca aparecem como "não vinculados". */
export function materialPertenceAMateria(
  material: Pick<MaterialReferenciavel, "materia" | "materiaId">,
  referencia: Pick<ReferenciaAssuntoMaterial, "materia" | "materiaId">
): boolean {
  if (material.materiaId && referencia.materiaId) {
    return material.materiaId === referencia.materiaId;
  }
  return chaveDaMateria(material.materia) === chaveDaMateria(referencia.materia);
}

/**
 * Não inventa vínculo com um assunto parecido: materiais fora da seleção
 * permanecem separados, com o assunto de cadastro visível para conferência.
 */
export function agruparMateriaisDaDisciplina<T extends MaterialReferenciavel>(
  materiais: readonly T[],
  referencia: ReferenciaAssuntoMaterial
): { vinculados: T[]; outrosDaDisciplina: T[] } {
  const vinculados: T[] = [];
  const outrosDaDisciplina: T[] = [];
  for (const material of materiais) {
    if (!materialPertenceAMateria(material, referencia)) continue;
    if (materialCorrespondeAoAssunto(material, referencia)) vinculados.push(material);
    else outrosDaDisciplina.push(material);
  }
  return { vinculados, outrosDaDisciplina };
}
