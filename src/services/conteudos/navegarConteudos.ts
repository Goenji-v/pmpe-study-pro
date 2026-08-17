import type {
  Assunto,
  Materia,
  Modulo,
} from "../../types";

export const NOME_MODULO_GERAL = "Geral";

export function criarIdModuloGeral(
  materiaId: string
) {
  return `modulo-geral-${materiaId}`;
}

export function listarModulosDaMateria(
  materia: Materia
): Modulo[] {
  if (
    Array.isArray(materia.modulos) &&
    materia.modulos.length > 0
  ) {
    return materia.modulos;
  }

  return [
    {
      id: criarIdModuloGeral(materia.id),
      nome: NOME_MODULO_GERAL,
      ordem: 0,
      assuntos: Array.isArray(materia.assuntos)
        ? materia.assuntos
        : [],
    },
  ];
}

export function listarAssuntosDaMateria(
  materia: Materia
): Assunto[] {
  const assuntosDosModulos =
    listarModulosDaMateria(materia).flatMap(
      (modulo) => modulo.assuntos
    );

  return deduplicarAssuntos(
    assuntosDosModulos.length > 0
      ? assuntosDosModulos
      : materia.assuntos
  );
}

export function listarTodosAssuntos(
  materias: Materia[]
) {
  return materias.flatMap((materia) =>
    listarModulosDaMateria(materia).flatMap(
      (modulo) =>
        modulo.assuntos.map((assunto) => ({
          materia,
          modulo,
          assunto,
        }))
    )
  );
}

export function encontrarModulo(
  materia: Materia,
  moduloId: string
) {
  return listarModulosDaMateria(materia).find(
    (modulo) => modulo.id === moduloId
  );
}

export function encontrarAssunto(
  materia: Materia,
  assuntoId: string,
  moduloId?: string
) {
  const modulos = listarModulosDaMateria(materia);

  if (moduloId) {
    const modulo = modulos.find(
      (item) => item.id === moduloId
    );

    const assunto = modulo?.assuntos.find(
      (item) => item.id === assuntoId
    );

    return assunto && modulo
      ? { modulo, assunto }
      : null;
  }

  for (const modulo of modulos) {
    const assunto = modulo.assuntos.find(
      (item) => item.id === assuntoId
    );

    if (assunto) {
      return { modulo, assunto };
    }
  }

  return null;
}

export function calcularProgressoModulo(
  modulo: Modulo
) {
  return calcularProgressoAssuntos(modulo.assuntos);
}

export function calcularProgressoMateria(
  materia: Materia
) {
  const assuntos = listarAssuntosDaMateria(materia);
  return calcularProgressoAssuntos(assuntos);
}

/**
 * Mede o avanço real pelas aulas. Um assunto sem aulas vale uma unidade.
 * A conclusão do edital continua sendo controlada por `assunto.concluido`.
 */
export function calcularProgressoAssuntos(assuntos: Assunto[]) {
  const unidades = assuntos.reduce(
    (acumulado, assunto) => {
      const aulas = assunto.aulas ?? [];
      if (aulas.length > 0) {
        acumulado.total += aulas.length;
        acumulado.concluidos += aulas.filter((aula) => aula.concluida).length;
      } else {
        acumulado.total += 1;
        acumulado.concluidos += assunto.concluido ? 1 : 0;
      }
      return acumulado;
    },
    { total: 0, concluidos: 0 }
  );

  return {
    ...unidades,
    percentual: unidades.total === 0
      ? 0
      : Math.round((unidades.concluidos / unidades.total) * 100),
  };
}

export function sincronizarEspelhoAssuntos(
  materia: Materia
): Materia {
  return {
    ...materia,
    assuntos: listarAssuntosDaMateria(materia),
  };
}

function deduplicarAssuntos(
  assuntos: Assunto[]
) {
  const mapa = new Map<string, Assunto>();

  assuntos.forEach((assunto) => {
    if (!mapa.has(assunto.id)) {
      mapa.set(assunto.id, assunto);
    }
  });

  return Array.from(mapa.values());
}
