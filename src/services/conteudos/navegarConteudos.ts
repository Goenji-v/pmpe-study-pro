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

export type AssuntoComModulo = {
  modulo: Modulo;
  assunto: Assunto;
};

export function listarAssuntosUnificadosComModulo(
  materia: Materia
): AssuntoComModulo[] {
  const modulos = listarModulosDaMateria(materia);
  const resultado: AssuntoComModulo[] = [];

  for (const modulo of modulos) {
    for (const assunto of modulo.assuntos) {
      const indice = resultado.findIndex(({ assunto: existente }) =>
        existente.id === assunto.id ||
        assuntosEquivalentesParaNavegacao(existente.nome, assunto.nome)
      );

      if (indice < 0) {
        resultado.push({ modulo, assunto });
        continue;
      }

      const atual = resultado[indice];
      resultado[indice] = {
        modulo: atual.modulo,
        assunto: mesclarAssuntosParaNavegacao(atual.assunto, assunto),
      };
    }
  }

  return resultado;
}

export function listarAssuntosDaMateria(
  materia: Materia
): Assunto[] {
  const unificados = listarAssuntosUnificadosComModulo(materia);
  if (unificados.length > 0) {
    return unificados.map(({ assunto }) => assunto);
  }

  return deduplicarAssuntos(materia.assuntos);
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
  const [moduloCodificado] = assuntoId
    .slice(PREFIXO_ASSUNTO_CURSO_VISAO.length)
    .split("::");
  return moduloCodificado
    ? decodificar(moduloCodificado)
    : undefined;
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
      const ordenados = modulosCurso
        .slice()
        .sort((a, b) => a.ordem - b.ordem);
      const assuntos = ordenados.flatMap((modulo) =>
        moduloRepeteMateria(materia.nome, modulo.nome)
          ? modulo.assuntos.map((assunto) =>
              criarAssuntoDeEntradaImportada(modulo, assunto)
            )
          : [criarAssuntoDeModuloImportado(modulo)]
      );

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

function criarAssuntoDeEntradaImportada(
  modulo: Modulo,
  assunto: Assunto
): Assunto {
  const aulas = criarAulasDaEntradaImportada(assunto);
  return {
    ...assunto,
    id: `${PREFIXO_ASSUNTO_CURSO_VISAO}${codificar(modulo.id)}::${codificar(assunto.id)}`,
    nome: assunto.nome,
    aulas,
    aula: aulas.find((aula) => aula.url)?.url ?? assunto.aula,
    concluido:
      aulas.length > 0
        ? aulas.every((aula) => aula.concluida)
        : assunto.concluido,
  };
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

function moduloRepeteMateria(
  materiaNome: string,
  moduloNome: string
) {
  const materia = normalizarRotuloCurso(materiaNome);
  const modulo = normalizarRotuloCurso(
    removerPrefixoDoCurso(moduloNome)
  );
  if (!materia || !modulo) return false;
  if (materia === modulo) return true;

  const reduzir = (valor: string) =>
    valor
      .replace(/\b(nocoes?|lingua|direitos?|de|da|do|das|dos)\b/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const materiaReduzida = reduzir(materia);
  const moduloReduzido = reduzir(modulo);
  if (materiaReduzida && materiaReduzida === moduloReduzido) {
    return true;
  }

  return (
    /\bportuguesa?\b/.test(materia) &&
    /\bportuguesa?\b/.test(modulo)
  );
}

function normalizarRotuloCurso(valor: string) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
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

function mesclarAssuntosParaNavegacao(
  base: Assunto,
  extra: Assunto
): Assunto {
  const aulas = deduplicarAulasParaNavegacao([
    ...(base.aulas ?? []),
    ...(extra.aulas ?? []),
  ]);
  const materiais = deduplicarMateriaisParaNavegacao([
    ...(base.materiais ?? []),
    ...(extra.materiais ?? []),
  ]);
  const tarefas = [
    ...(base.tarefas ?? []),
    ...(extra.tarefas ?? []),
  ].filter(
    (tarefa, indice, lista) =>
      lista.findIndex(
        (item) =>
          item.id === tarefa.id ||
          (
            item.tipo === tarefa.tipo &&
            normalizarNomeAssunto(item.nome) === normalizarNomeAssunto(tarefa.nome)
          )
      ) === indice
  );

  const temOrigemCurso =
    Boolean(extra.origemConteudo === "curso" || extra.origemConteudo === "mesclado") ||
    aulas.some((aula) => Boolean(aula.origemCurso) || ehAulaVisaoCurso(aula.id));

  return {
    ...base,
    idsLegados: Array.from(
      new Set([
        ...(base.idsLegados ?? []),
        ...(extra.idsLegados ?? []),
        ...(extra.id !== base.id ? [extra.id] : []),
      ])
    ),
    aulas,
    aula:
      aulas.find((aula) => aula.url)?.url ??
      base.aula ??
      extra.aula,
    questoes: base.questoes ?? extra.questoes,
    pdf: base.pdf ?? extra.pdf,
    resumo: base.resumo ?? extra.resumo,
    anotacoes: juntarTextoNavegacao(base.anotacoes, extra.anotacoes),
    materiais: materiais.length > 0 ? materiais : undefined,
    tarefas: tarefas.length > 0 ? tarefas : undefined,
    concluido: Boolean(base.concluido || extra.concluido),
    concluidoEm: base.concluidoEm ?? extra.concluidoEm,
    conclusaoOrigem: base.conclusaoOrigem ?? extra.conclusaoOrigem,
    origemConteudo:
      base.origemEditalId && temOrigemCurso
        ? "mesclado"
        : base.origemConteudo ?? extra.origemConteudo,
    complementarAoEdital:
      base.origemEditalId
        ? false
        : Boolean(base.complementarAoEdital && extra.complementarAoEdital),
  };
}

function assuntosEquivalentesParaNavegacao(a: string, b: string) {
  const na = normalizarNomeAssunto(a);
  const nb = normalizarNomeAssunto(b);

  if (!na || !nb) return false;
  if (na === nb) return true;

  const menor = na.length <= nb.length ? na : nb;
  const maior = na.length > nb.length ? na : nb;
  if (
    menor.length >= 12 &&
    maior.includes(menor) &&
    menor.length / maior.length >= 0.72
  ) {
    return true;
  }

  return temaIncorporacaoDireitosHumanos(na) &&
    temaIncorporacaoDireitosHumanos(nb);
}

function normalizarNomeAssunto(texto: string) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^\s*em\s+producao\s*[-–—:]?\s*/i, "")
    .replace(/^\s*\d+\s*[.\-–—:)]\s*/i, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function temaIncorporacaoDireitosHumanos(texto: string) {
  return (
    texto.includes("incorporacao") &&
    texto.includes("internacion") &&
    (
      texto.includes("brasileir") ||
      texto.includes("brasil") ||
      texto.includes("ordenamento") ||
      texto.includes("direito interno")
    )
  );
}

function deduplicarAulasParaNavegacao(aulas: AulaAssunto[]) {
  const ids = new Set<string>();
  const urls = new Set<string>();

  return aulas.filter((aula) => {
    const url = normalizarUrlNavegacao(aula.url);
    if (ids.has(aula.id)) return false;
    if (url && urls.has(url)) return false;

    ids.add(aula.id);
    if (url) urls.add(url);
    return true;
  });
}

function deduplicarMateriaisParaNavegacao(
  materiais: NonNullable<Assunto["materiais"]>
) {
  const ids = new Set<string>();
  const urls = new Set<string>();

  return materiais.filter((material) => {
    const url = normalizarUrlNavegacao(material.url);
    if (ids.has(material.id)) return false;
    if (url && urls.has(url)) return false;

    ids.add(material.id);
    if (url) urls.add(url);
    return true;
  });
}

function normalizarUrlNavegacao(url?: string) {
  if (!url) return "";
  try {
    const objeto = new URL(url);
    objeto.hash = "";
    return objeto.href;
  } catch {
    return url.trim();
  }
}

function juntarTextoNavegacao(a?: string, b?: string) {
  const partes = [a?.trim(), b?.trim()].filter(Boolean) as string[];
  return Array.from(new Set(partes)).join("\n\n") || undefined;
}

function ehAulaVisaoCurso(aulaId: string) {
  return aulaId.startsWith(PREFIXO_AULA_CURSO_VISAO);
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
