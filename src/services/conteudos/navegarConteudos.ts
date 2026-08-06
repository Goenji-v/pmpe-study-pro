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
  const total = modulo.assuntos.length;
  const concluidos = modulo.assuntos.filter(
    (assunto) => assunto.concluido
  ).length;

  return {
    total,
    concluidos,
    percentual:
      total === 0
        ? 0
        : Math.round((concluidos / total) * 100),
  };
}

export function calcularProgressoMateria(
  materia: Materia
) {
  const assuntos = listarAssuntosDaMateria(materia);
  const total = assuntos.length;
  const concluidos = assuntos.filter(
    (assunto) => assunto.concluido
  ).length;

  return {
    total,
    concluidos,
    percentual:
      total === 0
        ? 0
        : Math.round((concluidos / total) * 100),
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
