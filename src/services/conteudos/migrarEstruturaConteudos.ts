import type {
  Assunto,
  Materia,
  Modulo,
} from "../../types";

import {
  criarIdModuloGeral,
  ehAssuntoVisaoCurso,
  ehModuloVisaoCurso,
  listarModulosDaMateria,
  NOME_MODULO_GERAL,
  obterModuloOriginalDoAssuntoVisaoCurso,
  obterOrigemDaAulaVisaoCurso,
} from "./navegarConteudos";
import { registrarMateriasPlanoRuntime } from "../../utils/planoMateriasRuntime";

export function migrarMateriasParaModulos(
  valor: unknown
): Materia[] {
  if (!Array.isArray(valor)) {
    registrarMateriasPlanoRuntime([]);
    return [];
  }

  const materias = valor
    .map(migrarMateriaParaModulos)
    .filter((materia): materia is Materia =>
      Boolean(materia)
    );

  registrarMateriasPlanoRuntime(materias);
  return materias;
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
  const modulosVisiveis = listarModulosDaMateria(materia);
  const moduloVisivel = moduloId
    ? modulosVisiveis.find((modulo) => modulo.id === moduloId)
    : modulosVisiveis.find((modulo) =>
        modulo.assuntos.some((assunto) => assunto.id === assuntoId)
      );

  if (
    moduloVisivel &&
    ehModuloVisaoCurso(moduloVisivel.id) &&
    ehAssuntoVisaoCurso(assuntoId)
  ) {
    const assuntoVisivel = moduloVisivel.assuntos.find(
      (assunto) => assunto.id === assuntoId
    );
    if (!assuntoVisivel) return materia;
    return aplicarAtualizacaoDaVisaoCurso(
      materia,
      assuntoId,
      atualizar(assuntoVisivel)
    );
  }

  const modulos = modulosVisiveis.map((modulo) => {
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

function aplicarAtualizacaoDaVisaoCurso(
  materia: Materia,
  assuntoIdVisao: string,
  assuntoAtualizado: Assunto
): Materia {
  const moduloOriginalId =
    obterModuloOriginalDoAssuntoVisaoCurso(assuntoIdVisao);
  if (!moduloOriginalId || !Array.isArray(materia.modulos)) {
    return materia;
  }

  const modulos = materia.modulos.map((modulo) => {
    if (modulo.id !== moduloOriginalId) return modulo;

    return {
      ...modulo,
      assuntos: modulo.assuntos.map((assuntoOriginal) => {
        const aulasDaEntrada = (assuntoAtualizado.aulas ?? [])
          .map((aula) => ({
            aula,
            origem: obterOrigemDaAulaVisaoCurso(aula.id),
          }))
          .filter((item) =>
            item.origem?.assuntoId === assuntoOriginal.id
          );

        if (aulasDaEntrada.length === 0) return assuntoOriginal;

        const concluido = aulasDaEntrada.every(
          ({ aula }) => aula.concluida
        );
        const concluidoEm = concluido
          ? aulasDaEntrada
              .map(({ aula }) => aula.concluidaEm)
              .filter((valor): valor is string => Boolean(valor))
              .sort()
              .at(-1)
          : undefined;

        const aulas = (assuntoOriginal.aulas ?? []).map((aulaOriginal) => {
          const atualizada = aulasDaEntrada.find(
            ({ origem }) => origem?.aulaId === aulaOriginal.id
          )?.aula;
          return atualizada
            ? {
                ...aulaOriginal,
                concluida: atualizada.concluida,
                concluidaEm: atualizada.concluidaEm,
              }
            : aulaOriginal;
        });

        return {
          ...assuntoOriginal,
          concluido,
          concluidoEm,
          prioridade: assuntoAtualizado.prioridade ?? assuntoOriginal.prioridade,
          aulas,
          atualizadoEm:
            assuntoAtualizado.atualizadoEm ?? assuntoOriginal.atualizadoEm,
        };
      }),
    };
  });

  return {
    ...materia,
    modulos,
    assuntos: deduplicarAssuntos(
      modulos.flatMap((modulo) => modulo.assuntos)
    ),
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

  return valor
    .map(normalizarAssunto)
    .filter((assunto): assunto is Assunto => Boolean(assunto));
}

function normalizarAssunto(valor: unknown): Assunto | null {
  if (!valor || typeof valor !== "object") return null;
  const assunto = valor as Assunto;
  if (typeof assunto.id !== "string" || typeof assunto.nome !== "string") return null;

  const aulasInformadas = Array.isArray(assunto.aulas)
    ? assunto.aulas
        .filter((aula) => aula && typeof aula.id === "string" && typeof aula.nome === "string")
        .map((aula, ordem) => ({
          ...aula,
          ordem: Number.isFinite(aula.ordem) ? aula.ordem : ordem,
          concluida: Boolean(aula.concluida),
        }))
    : [];

  // Qualquer matéria antiga com link único passa a usar a mesma estrutura
  // de checklist criada para Português.
  const aulas = aulasInformadas.length > 0
    ? aulasInformadas
    : assunto.aula
      ? [{
          id: `${assunto.id}-aula-1`,
          nome: assunto.nome,
          url: assunto.aula,
          ordem: 0,
          concluida: Boolean(assunto.concluido),
          concluidaEm: assunto.concluidoEm,
        }]
      : [];

  return {
    ...assunto,
    aulas,
    tarefas: Array.isArray(assunto.tarefas) ? assunto.tarefas : [],
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
