import type { Materia } from "../types/index";

function deduplicarIdenticosPorId<T extends { id?: string }>(
  itens: T[]
): T[] {
  const primeiraPorId = new Map<string, string>();
  const resultado: T[] = [];

  for (const item of itens) {
    const id = item.id;
    if (!id) {
      resultado.push(item);
      continue;
    }

    const serializado = JSON.stringify(item);
    const primeira = primeiraPorId.get(id);

    if (primeira === undefined) {
      primeiraPorId.set(id, serializado);
      resultado.push(item);
      continue;
    }

    // Só repara automaticamente a duplicata quando os objetos são idênticos.
    // Mesmo ID com conteúdo diferente continua duplicado para a validação barrar.
    if (primeira !== serializado) {
      resultado.push(item);
    }
  }

  return resultado;
}

export function normalizarMateriasSemDuplicatasIdenticas(
  materias: Materia[]
): Materia[] {
  return materias.map((materia) => {
    const modulos = (materia.modulos ?? []).map((modulo) => {
      const assuntosComAulas = modulo.assuntos.map((assunto) => ({
        ...assunto,
        aulas: deduplicarIdenticosPorId(assunto.aulas ?? []),
      }));

      return {
        ...modulo,
        assuntos: deduplicarIdenticosPorId(assuntosComAulas),
      };
    });

    const assuntos = modulos.length > 0
      ? modulos.flatMap((modulo) => modulo.assuntos)
      : deduplicarIdenticosPorId(
          (materia.assuntos ?? []).map((assunto) => ({
            ...assunto,
            aulas: deduplicarIdenticosPorId(assunto.aulas ?? []),
          }))
        );

    return {
      ...materia,
      modulos,
      assuntos,
    };
  });
}
