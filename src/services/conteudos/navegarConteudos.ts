import type {
  Assunto,
  AulaAssunto,
  Materia,
  Modulo,
} from "../../types";

export const NOME_MODULO_GERAL = "Geral";

const PREFIXO_MODULO_CURSO = "curso:";
const PREFIXO_MODULO_CURSO_VISAO = "curso-visao:";
const PREFIXO_ASSUNTO_CURSO_VISAO = "curso-visao-assunto:";
const PREFIXO_AULA_CURSO_VISAO = "curso-visao-aula:";

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
    return agruparModulosImportadosDoCurso(
      materia,
      materia.modulos
    );
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

export function ehModuloVisaoCurso(moduloId?: string) {
  return Boolean(moduloId?.startsWith(PREFIXO_MODULO_CURSO_VISAO));
}

export function ehAssuntoVisaoCurso(assuntoId?: string) {
  return Boolean(assuntoId?.startsWith(PREFIXO_ASSUNTO_CURSO_VISAO));
}

export function obterModuloOriginalDoAssuntoVisaoCurso(
  assuntoId: string
) {
  if (!ehAssuntoVisaoCurso(assuntoId)) return undefined;
  return decodificar(
    assuntoId.slice(PREFIXO_ASSUNTO_CURSO_VISAO.length)
  );
}

export function obterOrigemDaAulaVisaoCurso(
  aulaId: string
): { assuntoId: string; aulaId?: string } | undefined {
  if (!aulaId.startsWith(PREFIXO_AULA_CURSO_VISAO)) return undefined;
  const partes = aulaId
    .slice(PREFIXO_AULA_CURSO_VISAO.length)
    .split("::");
  if (!partes[0]) return undefined;
  return {
    assuntoId: decodificar(partes[0]),
    aulaId: partes[1] ? decodificar(partes[1]) : undefined,
  };
}

function agruparModulosImportadosDoCurso(
  materia: Materia,
  modulos: Modulo[]
): Modulo[] {
  const comuns: Modulo[] = [];
  const porCurso = new Map<string, Modulo[]>();

  modulos.forEach((modulo) => {
    const cursoId = extrairCursoId(modulo.id);
    if (!cursoId) {
      comuns.push(modulo);
      return;
    }

    const atuais = porCurso.get(cursoId) ?? [];
    atuais.push(modulo);
    porCurso.set(cursoId, atuais);
  });

  if (porCurso.size === 0) return modulos;

  const gruposCurso = Array.from(porCurso.entries()).map(
    ([cursoId, modulosCurso], indice) => {
      const nomeCurso = extrairNomeCurso(modulosCurso[0]?.nome ?? "");
      const assuntos = modulosCurso
        .sort((a, b) => a.ordem - b.ordem)
        .map(criarAssuntoDeModuloImportado);

      return {
        id: `${PREFIXO_MODULO_CURSO_VISAO}${codificar(cursoId)}::${codificar(materia.id)}`,
        nome: porCurso.size === 1
          ? NOME_MODULO_GERAL
          : nomeCurso || `Curso ${indice + 1}`,
        ordem: comuns.length + indice,
        assuntos,
      } satisfies Modulo;
    }
  );

  return [...comuns, ...gruposCurso];
}

function criarAssuntoDeModuloImportado(
  modulo: Modulo
): Assunto {
  const aulas = modulo.assuntos.flatMap((assunto) =>
    criarAulasDaEntradaImportada(assunto)
  );
  const concluido =
    aulas.length > 0
      ? aulas.every((aula) => aula.concluida)
      : modulo.assuntos.length > 0 &&
        modulo.assuntos.every((assunto) => assunto.concluido);
  const prioridades = modulo.assuntos.map((assunto) => assunto.prioridade);
  const prioridade = prioridades.includes("alta")
    ? "alta"
    : prioridades.includes("media")
      ? "media"
      : "baixa";
  const primeiro = modulo.assuntos[0];
  const materiais = modulo.assuntos.flatMap(
    (assunto) => assunto.materiais ?? []
  );

  return {
    id: `${PREFIXO_ASSUNTO_CURSO_VISAO}${codificar(modulo.id)}`,
    nome: removerPrefixoDoCurso(modulo.nome),
    concluido,
    prioridade,
    aulas,
    aula: aulas.find((aula) => aula.url)?.url,
    questoes: modulo.assuntos.find((assunto) => assunto.questoes)?.questoes,
    pdf: modulo.assuntos.find((assunto) => assunto.pdf)?.pdf,
    resumo: modulo.assuntos.find((assunto) => assunto.resumo)?.resumo,
    anotacoes: modulo.assuntos
      .map((assunto) => assunto.anotacoes?.trim())
      .filter(Boolean)
      .join("\n\n") || undefined,
    materiais: materiais.length > 0 ? materiais : undefined,
    atualizadoEm: primeiro?.atualizadoEm,
    conclusaoOrigem: concluido ? primeiro?.conclusaoOrigem : undefined,
    concluidoEm: concluido
      ? aulas.map((aula) => aula.concluidaEm).filter(Boolean).sort().at(-1)
      : undefined,
  };
}

function criarAulasDaEntradaImportada(
  assunto: Assunto
): AulaAssunto[] {
  const informadas = assunto.aulas ?? [];

  if (informadas.length > 0) {
    return informadas.map((aula, indice) => ({
      ...aula,
      id: `${PREFIXO_AULA_CURSO_VISAO}${codificar(assunto.id)}::${codificar(aula.id)}`,
      nome: informadas.length === 1
        ? assunto.nome
        : aula.nome,
      ordem: indice + 1,
      concluida: Boolean(aula.concluida || assunto.concluido),
      concluidaEm: aula.concluidaEm ?? assunto.concluidoEm,
    }));
  }

  return [{
    id: `${PREFIXO_AULA_CURSO_VISAO}${codificar(assunto.id)}`,
    nome: assunto.nome,
    url: assunto.aula,
    ordem: 1,
    concluida: Boolean(assunto.concluido),
    concluidaEm: assunto.concluidoEm,
  }];
}

function extrairCursoId(moduloId: string) {
  if (!moduloId.startsWith(PREFIXO_MODULO_CURSO)) return undefined;
  const match = moduloId.match(/^curso:(.+?):modulo:/);
  return match?.[1];
}

function extrairNomeCurso(nomeModulo: string) {
  const indice = nomeModulo.indexOf(" · ");
  return indice > 0 ? nomeModulo.slice(0, indice).trim() : "";
}

function removerPrefixoDoCurso(nomeModulo: string) {
  const indice = nomeModulo.indexOf(" · ");
  const nome = indice >= 0
    ? nomeModulo.slice(indice + 3)
    : nomeModulo;
  return nome.trim() || "Conteúdo";
}

function codificar(valor: string) {
  return encodeURIComponent(valor);
}

function decodificar(valor: string) {
  try {
    return decodeURIComponent(valor);
  } catch {
    return valor;
  }
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
