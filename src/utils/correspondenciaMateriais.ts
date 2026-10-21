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
  const materiaCompativel = material.materiaId && referencia.materiaId
    ? material.materiaId === referencia.materiaId
    : chaveDaMateria(material.materia) === chaveDaMateria(referencia.materia);
  if (!materiaCompativel) return false;

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
