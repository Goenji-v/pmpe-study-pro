import type {
  Assunto,
  Materia,
  Modulo,
} from "../../types";

import {
  criarIdModuloGeral,
  listarModulosDaMateria,
  NOME_MODULO_GERAL,
} from "./navegarConteudos";

export function migrarMateriasParaModulos(
  valor: unknown
): Materia[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor
    .map(migrarMateriaParaModulos)
    .filter((materia): materia is Materia =>
      Boolean(materia)
    );
}

export function migrarMateriaParaModulos(
  valor: unknown
): Materia | null {
  if (!valor || typeof valor !== "object") {
    return null;
  }

  const materia = valor as Partial<Materia>;

  if (
    typeof materia.id !== "string" ||
    typeof materia.nome !== "string"
  ) {
    return null;
  }

  const possuiEspelhoLegado = Array.isArray(
    materia.assuntos
  );

  const assuntosLegados = validarAssuntos(
    materia.assuntos
  );

  const modulosInformados = Array.isArray(
    materia.modulos
  )
    ? materia.modulos
        .map((modulo, indice) =>
          validarModulo(modulo, indice)
        )
        .filter((modulo): modulo is Modulo =>
          Boolean(modulo)
        )
    : [];

  const modulos = reconciliarModulosComEspelho({
    materiaId: materia.id,
    modulos: modulosInformados,
    assuntosLegados,
    possuiEspelhoLegado,
  });

  const assuntos = deduplicarAssuntos(
    modulos.flatMap((modulo) => modulo.assuntos)
  );

  return {
    id: materia.id,
    nome: materia.nome,
    modulos,
    // Compatibilidade temporária com telas antigas.
    assuntos,
  };
}

export function atualizarAssuntoNaArvore(
  materia: Materia,
  assuntoId: string,
  atualizar: (assunto: Assunto) => Assunto,
  moduloId?: string
): Materia {
  const modulos = listarModulosDaMateria(materia).map((modulo) => {
    if (moduloId && modulo.id !== moduloId) {
      return modulo;
    }

    return {
      ...modulo,
      assuntos: modulo.assuntos.map((assunto) =>
        assunto.id === assuntoId
          ? atualizar(assunto)
          : assunto
      ),
    };
  });

  const assuntos = deduplicarAssuntos(
    modulos.flatMap((modulo) => modulo.assuntos)
  );

  return {
    ...materia,
    modulos,
    assuntos,
  };
}

function reconciliarModulosComEspelho({
  materiaId,
  modulos,
  assuntosLegados,
  possuiEspelhoLegado,
}: {
  materiaId: string;
  modulos: Modulo[];
  assuntosLegados: Assunto[];
  possuiEspelhoLegado: boolean;
}): Modulo[] {
  if (modulos.length === 0) {
    return [
      {
        id: criarIdModuloGeral(materiaId),
        nome: NOME_MODULO_GERAL,
        ordem: 0,
        assuntos: assuntosLegados,
      },
    ];
  }

  // Durante a migração gradual, as telas antigas ainda alteram
  // `materia.assuntos`. Quando esse espelho existe, ele é usado
  // para refletir edições, inclusões e exclusões nos módulos.
  if (!possuiEspelhoLegado) {
    return modulos;
  }

  const assuntosPorId = new Map(
    assuntosLegados.map((assunto) => [
      assunto.id,
      assunto,
    ])
  );

  const idsDistribuidos = new Set<string>();

  const reconciliados = modulos.map((modulo) => ({
    ...modulo,
    assuntos: modulo.assuntos
      .filter((assunto) => assuntosPorId.has(assunto.id))
      .map((assunto) => {
        idsDistribuidos.add(assunto.id);
        return assuntosPorId.get(assunto.id) ?? assunto;
      }),
  }));

  const assuntosNovos = assuntosLegados.filter(
    (assunto) => !idsDistribuidos.has(assunto.id)
  );

  if (assuntosNovos.length === 0) {
    return reconciliados;
  }

  const indiceGeral = reconciliados.findIndex(
    (modulo) =>
      modulo.id === criarIdModuloGeral(materiaId) ||
      modulo.nome === NOME_MODULO_GERAL
  );

  if (indiceGeral >= 0) {
    return reconciliados.map((modulo, indice) =>
      indice === indiceGeral
        ? {
            ...modulo,
            assuntos: [
              ...modulo.assuntos,
              ...assuntosNovos,
            ],
          }
        : modulo
    );
  }

  return [
    ...reconciliados,
    {
      id: criarIdModuloGeral(materiaId),
      nome: NOME_MODULO_GERAL,
      ordem: reconciliados.length,
      assuntos: assuntosNovos,
    },
  ];
}

function validarModulo(
  valor: unknown,
  indice: number
): Modulo | null {
  if (!valor || typeof valor !== "object") {
    return null;
  }

  const modulo = valor as Partial<Modulo>;

  if (
    typeof modulo.id !== "string" ||
    typeof modulo.nome !== "string"
  ) {
    return null;
  }

  return {
    id: modulo.id,
    nome: modulo.nome,
    ordem:
      typeof modulo.ordem === "number" &&
      Number.isFinite(modulo.ordem)
        ? modulo.ordem
        : indice,
    assuntos: validarAssuntos(modulo.assuntos),
  };
}

function validarAssuntos(
  valor: unknown
): Assunto[] {
  if (!Array.isArray(valor)) {
    return [];
  }

  return valor.filter(
    (assunto): assunto is Assunto =>
      Boolean(assunto) &&
      typeof assunto === "object" &&
      typeof (assunto as Assunto).id === "string" &&
      typeof (assunto as Assunto).nome === "string"
  );
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
