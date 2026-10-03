import type {
  Assunto,
  AulaAssunto,
  CandidatoVinculoCurso,
  Materia,
  MaterialAssunto,
  Modulo,
} from "../types";
import type {
  CursoAula,
  CursoImportado,
  CursoMateria,
  CursoModulo,
} from "../types/cursos";
import type {
  AnaliseEdital,
  AssuntoEdital,
  MateriaEdital,
} from "../types/editalInteligente";
import {
  identificarDisciplina,
  textoIdentidadeCurso,
} from "./classificacaoCurso";

const STOPWORDS = new Set([
  "a", "ao", "aos", "as", "com", "como", "da", "das", "de", "do", "dos",
  "e", "em", "entre", "na", "nas", "no", "nos", "o", "os", "para", "por",
  "que", "se", "um", "uma", "art", "artigo", "artigos", "lei", "leis",
  "n", "numero", "parte", "aula", "modulo", "conteudo", "conteudos",
  "conceito", "conceitos", "nocao", "nocoes", "introducao", "geral", "gerais",
]);

const TOKENS_GENERICOS = new Set([
  "direito", "direitos", "norma", "normas", "sistema", "sistemas",
  "principio", "principios", "aspecto", "aspectos", "estudo", "estudos",
]);

const MODULOS_GENERICOS = new Set([
  "geral", "conteudo", "conteudos", "aulas", "curso", "curso importado",
  "edital atual", "conteudo do edital",
]);

type EstadoAnteriorAula = {
  assunto: Assunto;
  aula?: AulaAssunto;
};

type ResultadoAssociacao = {
  status: "automatico" | "ambiguo" | "complementar";
  assunto?: Assunto;
  candidatos: CandidatoVinculoCurso[];
};

export type OpcoesUniaoGrade = {
  materiasAtuais: Materia[];
  analiseEdital?: AnaliseEdital;
  cursos: CursoImportado[];
  cursosAtivosIds: string[];
};

export function materiasEquivalentes(a: string, b: string) {
  return scoreMateria(a, b) >= 0.82;
}

export function scoreAssociacaoAssunto(alvo: string, candidato: string) {
  return scoreTexto(alvo, candidato);
}

export function unificarGradeEditalCursos({
  materiasAtuais,
  analiseEdital,
  cursos,
  cursosAtivosIds,
}: OpcoesUniaoGrade): Materia[] {
  const estadoAnterior = mapearEstadoAnterior(materiasAtuais);
  let materias = limparGradeAnterior(materiasAtuais);
  materias = consolidarMateriasEquivalentes(materias);

  if (analiseEdital) {
    materias = injetarEdital(
      materias,
      garantirIdsDaAnalise(analiseEdital)
    );
  }

  const ativos = cursos.filter((curso) => cursosAtivosIds.includes(curso.id));
  ativos.forEach((curso, indiceCurso) => {
    materias = aplicarCursoNaGrade(
      materias,
      curso,
      indiceCurso,
      estadoAnterior
    );
  });

  return normalizarGrade(materias)
    .filter((materia) => materia.assuntos.length > 0)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

export function criarAnalisePlanejamentoUnificada(
  analise: AnaliseEdital,
  materias: Materia[]
): AnaliseEdital {
  const materiasUsadas = new Set<string>();
  const materiasPlano: MateriaEdital[] = analise.materias.map((materiaEdital) => {
    const materiaCanonica = melhorMateria(materias, materiaEdital.nome);
    if (!materiaCanonica) return materiaEdital;

    materiasUsadas.add(materiaCanonica.id);
    const assuntosCanonicos = listarAssuntos(materiaCanonica);
    const idsUsados = new Set<string>();

    const assuntos: AssuntoEdital[] = materiaEdital.assuntos.map((assuntoEdital) => {
      const canonico =
        assuntosCanonicos.find((assunto) => assunto.origemEditalId === assuntoEdital.id) ??
        melhorAssunto(assuntosCanonicos, assuntoEdital.nome, 0.84)?.assunto;

      if (!canonico) return assuntoEdital;
      idsUsados.add(canonico.id);
      return {
        ...assuntoEdital,
        id: assuntoEdital.id,
        conteudoCanonicoId: canonico.id,
        nome: canonico.nome,
      };
    });

    assuntosCanonicos
      .filter(
        (assunto) =>
          assunto.complementarAoEdital &&
          !idsUsados.has(assunto.id)
      )
      .forEach((assunto) => {
        assuntos.push({
          id: assunto.id,
          nome: assunto.nome,
          prioridade: "baixa",
          justificativaPrioridade: "Conteúdo complementar de curso ativo.",
        });
        idsUsados.add(assunto.id);
      });

    return {
      ...materiaEdital,
      conteudoCanonicoId: materiaCanonica.id,
      nome: materiaCanonica.nome,
      assuntos,
    };
  });

  materias
    .filter(
      (materia) =>
        !materiasUsadas.has(materia.id) &&
        listarAssuntos(materia).some((assunto) => assunto.complementarAoEdital)
    )
    .forEach((materia) => {
      materiasPlano.push({
        id: materia.id,
        nome: materia.nome,
        incidenciaEstimada: 1,
        assuntos: listarAssuntos(materia)
          .filter((assunto) => assunto.complementarAoEdital)
          .map((assunto) => ({
            id: assunto.id,
            nome: assunto.nome,
            prioridade: "baixa" as const,
            justificativaPrioridade: "Conteúdo complementar de curso ativo.",
          })),
      });
    });

  return {
    ...analise,
    materias: materiasPlano.filter((materia) => materia.assuntos.length > 0),
  };
}

function garantirIdsDaAnalise(
  analise: AnaliseEdital
): AnaliseEdital {
  const idsMaterias = new Set<string>();

  return {
    ...analise,
    materias: analise.materias.map((materia, indiceMateria) => {
      let materiaId = materia.id?.trim();
      if (!materiaId || idsMaterias.has(materiaId)) {
        materiaId = `edital-materia-${slug(materia.nome)}-${indiceMateria + 1}`;
      }
      idsMaterias.add(materiaId);

      const idsAssuntos = new Set<string>();
      const assuntos = materia.assuntos.map((assunto, indiceAssunto) => {
        let assuntoId = assunto.id?.trim();
        if (!assuntoId || idsAssuntos.has(assuntoId)) {
          assuntoId =
            `edital-assunto-${slug(materia.nome)}-${slug(assunto.nome)}-${indiceAssunto + 1}`;
        }
        idsAssuntos.add(assuntoId);
        return { ...assunto, id: assuntoId };
      });

      return {
        ...materia,
        id: materiaId,
        assuntos,
      };
    }),
  };
}

function limparGradeAnterior(materias: Materia[]): Materia[] {
  return materias.flatMap((materia) => {
    const modulosOriginais =
      materia.modulos && materia.modulos.length > 0
        ? materia.modulos
        : [
            {
              id: `modulo-geral-${materia.id}`,
              nome: "Geral",
              ordem: 0,
              assuntos: materia.assuntos ?? [],
            },
          ];

    const gerais: Assunto[] = [];
    const pedagogicos: Modulo[] = [];

    for (const modulo of modulosOriginais) {
      if (ehModuloCurso(modulo)) continue;

      const assuntos = modulo.assuntos
        .map(limparAssuntoAnterior)
        .filter((assunto): assunto is Assunto => Boolean(assunto));

      if (assuntos.length === 0) continue;

      if (ehModuloFonte(modulo)) {
        gerais.push(...assuntos);
      } else {
        pedagogicos.push({ ...modulo, assuntos });
      }
    }

    if (gerais.length > 0) {
      const geralExistente = pedagogicos.findIndex((modulo) =>
        normalizar(modulo.nome) === "geral"
      );
      if (geralExistente >= 0) {
        pedagogicos[geralExistente] = {
          ...pedagogicos[geralExistente],
          assuntos: [
            ...pedagogicos[geralExistente].assuntos,
            ...gerais,
          ],
        };
      } else {
        pedagogicos.unshift({
          id: `modulo-geral-${materia.id}`,
          nome: "Geral",
          ordem: 0,
          assuntos: gerais,
        });
      }
    }

    if (pedagogicos.length === 0) {
      const legados = (materia.assuntos ?? [])
        .map(limparAssuntoAnterior)
        .filter((assunto): assunto is Assunto => Boolean(assunto));
      if (legados.length > 0) {
        pedagogicos.push({
          id: `modulo-geral-${materia.id}`,
          nome: "Geral",
          ordem: 0,
          assuntos: legados,
        });
      }
    }

    const modulos = pedagogicos.map((modulo, indice) => ({
      ...modulo,
      ordem: indice,
      assuntos: deduplicarAssuntosPorId(modulo.assuntos),
    }));
    const assuntos = deduplicarAssuntosPorId(
      modulos.flatMap((modulo) => modulo.assuntos)
    );

    if (
      assuntos.length === 0 &&
      (materia.id.startsWith("curso-materia-") ||
        materia.id.startsWith("curso:"))
    ) {
      return [];
    }

    return [{ ...materia, modulos, assuntos }];
  });
}

function limparAssuntoAnterior(assunto: Assunto): Assunto | null {
  // Formato legado: cada aula importada era um assunto separado. O estado é
  // capturado antes desta limpeza e reaplicado à aula canônica pelo ID/URL.
  if (
    assunto.id.startsWith("curso:") &&
    !assunto.origemEditalId
  ) {
    return null;
  }

  const aulas = (assunto.aulas ?? []).filter(
    (aula) => !ehAulaCurso(aula)
  );
  const materiais = (assunto.materiais ?? []).filter(
    (material) => !material.id.startsWith("curso-material:")
  );

  if (
    assunto.complementarAoEdital &&
    !assunto.origemEditalId &&
    aulas.length === 0 &&
    materiais.length === 0 &&
    !(assunto.tarefas?.length) &&
    !assunto.resumo &&
    !assunto.anotacoes &&
    !assunto.questoes &&
    !assunto.pdf
  ) {
    return null;
  }

  return {
    ...assunto,
    aulas,
    aula: aulas.find((aula) => aula.url)?.url,
    materiais: materiais.length ? materiais : undefined,
    origemConteudo:
      assunto.origemEditalId
        ? "edital"
        : assunto.origemConteudo === "mesclado"
          ? "manual"
          : assunto.origemConteudo,
    vinculoCurso: undefined,
  };
}

function consolidarMateriasEquivalentes(materias: Materia[]) {
  const resultado: Materia[] = [];

  for (const materia of materias) {
    const indice = resultado.findIndex((existente) =>
      materiasEquivalentes(existente.nome, materia.nome)
    );
    if (indice < 0) {
      resultado.push(clonar(materia));
      continue;
    }

    resultado[indice] = fundirMaterias(resultado[indice], materia);
  }

  return resultado;
}

function fundirMaterias(base: Materia, outra: Materia): Materia {
  const idsLegados = unicos([
    ...(base.idsLegados ?? []),
    ...(outra.idsLegados ?? []),
    ...(base.id !== outra.id ? [outra.id] : []),
  ]);

  const modulos = clonar(base.modulos ?? []);
  for (const modulo of outra.modulos ?? []) {
    const indice = modulos.findIndex(
      (existente) => normalizar(existente.nome) === normalizar(modulo.nome)
    );
    if (indice < 0) {
      modulos.push(clonar(modulo));
      continue;
    }
    modulos[indice] = {
      ...modulos[indice],
      assuntos: mesclarAssuntosExatos(
        modulos[indice].assuntos,
        modulo.assuntos
      ),
    };
  }

  return {
    ...base,
    idsLegados: idsLegados.length ? idsLegados : undefined,
    modulos,
    assuntos: deduplicarAssuntosPorId(
      modulos.flatMap((modulo) => modulo.assuntos)
    ),
  };
}

function injetarEdital(materias: Materia[], analise: AnaliseEdital): Materia[] {
  const resultado = clonar(materias);

  for (const materiaEdital of analise.materias) {
    let indiceMateria = materiaEdital.conteudoCanonicoId
      ? resultado.findIndex(
          (materia) =>
            materia.id === materiaEdital.conteudoCanonicoId ||
            materia.idsLegados?.includes(materiaEdital.conteudoCanonicoId as string)
        )
      : -1;
    if (indiceMateria < 0) {
      indiceMateria = indiceMelhorMateria(resultado, materiaEdital.nome);
    }
    if (indiceMateria < 0) {
      const materiaCanonicaId =
        materiaEdital.conteudoCanonicoId ?? materiaEdital.id;
      resultado.push({
        id: materiaCanonicaId,
        nome: materiaEdital.nome,
        modulos: [
          {
            id: `modulo-geral-${materiaCanonicaId}`,
            nome: "Geral",
            ordem: 0,
            assuntos: [],
          },
        ],
        assuntos: [],
      });
      indiceMateria = resultado.length - 1;
    }

    const materia = resultado[indiceMateria];
    const modulos = garantirModuloGeral(materia);
    let todos = modulos.flatMap((modulo) => modulo.assuntos);

    for (const assuntoEdital of materiaEdital.assuntos) {
      const porOrigem = todos.find(
        (assunto) =>
          assunto.id === assuntoEdital.conteudoCanonicoId ||
          assunto.idsLegados?.includes(
            assuntoEdital.conteudoCanonicoId ?? ""
          ) ||
          assunto.id === assuntoEdital.id ||
          assunto.origemEditalId === assuntoEdital.id
      );
      const candidato =
        porOrigem ??
        melhorAssunto(
          todos.filter((assunto) => !assunto.origemEditalId),
          assuntoEdital.nome,
          0.86
        )?.assunto;

      let canonico: Assunto;

      if (candidato) {
        canonico = {
          ...candidato,
          nome: assuntoEdital.nome,
          origemEditalId: assuntoEdital.id,
          referenciasEdital: unicos([
            ...(candidato.referenciasEdital ?? []),
            ...(candidato.origemEditalId ? [candidato.origemEditalId] : []),
            assuntoEdital.id,
          ]),
          foraDoEditalAtual: false,
          origemConteudo:
            (candidato.aulas ?? []).some(ehAulaCurso)
              ? "mesclado"
              : "edital",
          complementarAoEdital: false,
          prioridade: assuntoEdital.prioridade,
          idsLegados: unicos([
            ...(candidato.idsLegados ?? []),
            ...(candidato.id !== assuntoEdital.id ? [assuntoEdital.id] : []),
          ]),
        };
        substituirAssunto(modulos, candidato.id, canonico);
      } else {
        canonico = {
          id: assuntoEdital.conteudoCanonicoId ?? assuntoEdital.id,
          nome: assuntoEdital.nome,
          concluido: false,
          prioridade: assuntoEdital.prioridade,
          origemEditalId: assuntoEdital.id,
          referenciasEdital: [assuntoEdital.id],
          foraDoEditalAtual: false,
          origemConteudo: "edital",
          complementarAoEdital: false,
          aulas: [],
        };
        obterModuloGeral(modulos, materia.id).assuntos.push(canonico);
      }

      absorverAssuntosLegadosEquivalentes(
        modulos,
        canonico,
        assuntoEdital.nome
      );
      todos = modulos.flatMap((modulo) => modulo.assuntos);
    }

    const criadaPeloCurso =
      materia.id.startsWith("curso-materia-") ||
      materia.id.startsWith("curso-materia-unificada-");
    const idCanonico =
      materiaEdital.conteudoCanonicoId ??
      (criadaPeloCurso ? materiaEdital.id : materia.id);
    const modulosCanonicos = modulos.map((modulo) =>
      normalizar(modulo.nome) === "geral" &&
      modulo.id.startsWith("modulo-geral-")
        ? {
            ...modulo,
            id: `modulo-geral-${idCanonico}`,
          }
        : modulo
    );

    resultado[indiceMateria] = {
      ...materia,
      id: idCanonico,
      nome: criadaPeloCurso ? materiaEdital.nome : materia.nome,
      idsLegados: unicos([
        ...(materia.idsLegados ?? []),
        ...(materia.id !== idCanonico ? [materia.id] : []),
        ...(idCanonico !== materiaEdital.id ? [materiaEdital.id] : []),
      ]),
      modulos: modulosCanonicos,
      assuntos: deduplicarAssuntosPorId(
        modulosCanonicos.flatMap((modulo) => modulo.assuntos)
      ),
    };
  }

  return resultado;
}

function absorverAssuntosLegadosEquivalentes(
  modulos: Modulo[],
  canonico: Assunto,
  nomeEdital: string
) {
  for (const modulo of modulos) {
    const mantidos: Assunto[] = [];

    for (const candidato of modulo.assuntos) {
      if (candidato.id === canonico.id) {
        mantidos.push(candidato);
        continue;
      }

      if (
        candidato.origemEditalId &&
        candidato.origemEditalId !== canonico.origemEditalId
      ) {
        mantidos.push(candidato);
        continue;
      }

      if (!assuntosLegadosEquivalentes(nomeEdital, candidato.nome)) {
        mantidos.push(candidato);
        continue;
      }

      preservarDadosAssunto(canonico, candidato);
      canonico.aulas = deduplicarAulas([
        ...(canonico.aulas ?? []),
        ...(candidato.aulas ?? []),
      ]);
      canonico.aula =
        canonico.aulas.find((aula) => aula.url)?.url ??
        canonico.aula ??
        candidato.aula;

      const tarefas = [
        ...(canonico.tarefas ?? []),
        ...(candidato.tarefas ?? []),
      ];
      canonico.tarefas = tarefas.length
        ? tarefas.filter(
            (tarefa, indice, lista) =>
              lista.findIndex(
                (item) =>
                  item.id === tarefa.id ||
                  (
                    item.tipo === tarefa.tipo &&
                    normalizar(item.nome) === normalizar(tarefa.nome)
                  )
              ) === indice
          )
        : undefined;

      if (candidato.concluido && !canonico.concluido) {
        canonico.concluido = true;
        canonico.concluidoEm = candidato.concluidoEm;
        canonico.conclusaoOrigem =
          candidato.conclusaoOrigem ?? canonico.conclusaoOrigem;
      } else if (!canonico.concluidoEm && candidato.concluidoEm) {
        canonico.concluidoEm = candidato.concluidoEm;
      }

      if (
        candidato.aula ||
        (candidato.aulas ?? []).some((aula) => Boolean(aula.url))
      ) {
        canonico.origemConteudo = "mesclado";
      }
    }

    modulo.assuntos = mantidos;
  }
}

function assuntosLegadosEquivalentes(a: string, b: string) {
  const na = normalizarAssuntoLegado(a);
  const nb = normalizarAssuntoLegado(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  if (na.includes(nb) || nb.includes(na)) {
    const menor = Math.min(na.length, nb.length);
    const maior = Math.max(na.length, nb.length);
    if (menor >= 12 && menor / maior >= 0.65) return true;
  }

  if (ehIncorporacaoInternacionalBrasil(na, nb)) return true;

  return scoreTexto(na, nb) >= 0.94;
}

function normalizarAssuntoLegado(texto: string) {
  return normalizarExpandido(texto)
    .replace(/^em producao\s+/, "")
    .replace(/^\d+\s+/, "")
    .trim();
}

function ehIncorporacaoInternacionalBrasil(a: string, b: string) {
  const ehTema = (texto: string) =>
    /\bincorporacao\b/.test(texto) &&
    /\binternacion/.test(texto) &&
    /\b(brasil|brasileir|interno|ordenamento)/.test(texto);

  return ehTema(a) && ehTema(b) && scoreTokens(a, b) >= 0.45;
}

function aplicarCursoNaGrade(
  materias: Materia[],
  curso: CursoImportado,
  indiceCurso: number,
  estadoAnterior: Map<string, EstadoAnteriorAula>
): Materia[] {
  const resultado = clonar(materias);

  for (const materiaCurso of curso.materias) {
    if (materiaCurso.categoria && materiaCurso.categoria !== "disciplina") {
      continue;
    }

    let indiceMateria = indiceMelhorMateria(resultado, materiaCurso.nome);
    if (indiceMateria < 0) {
      resultado.push({
        id: `curso-materia-unificada-${slug(materiaCurso.nome)}`,
        nome: materiaCurso.nome,
        idsLegados: [
          materiaCurso.id,
          `curso-materia-${slug(materiaCurso.nome)}`,
        ],
        modulos: [
          {
            id: `modulo-geral-curso-${slug(materiaCurso.nome)}`,
            nome: "Geral",
            ordem: 0,
            assuntos: [],
          },
        ],
        assuntos: [],
      });
      indiceMateria = resultado.length - 1;
    }

    let materia = resultado[indiceMateria];
    const modulos = garantirModuloGeral(materia);

    for (const moduloCurso of materiaCurso.modulos
      .slice()
      .sort((a, b) => a.ordem - b.ordem)) {
      const assuntosAtuais = () =>
        modulos.flatMap((modulo) => modulo.assuntos);
      const associacaoModulo = resolverAssociacao(
        moduloCurso.nome,
        moduloCurso.nome,
        assuntosAtuais()
      );

      for (const aulaCurso of moduloCurso.aulas
        .slice()
        .sort((a, b) => a.ordem - b.ordem)) {
        const override = localizarOverride(
          resultado,
          aulaCurso,
          materia.id
        );
        let alvo: Assunto | undefined;
        let status: "automatico" | "manual" | "ambiguo" | "complementar";
        let candidatos: CandidatoVinculoCurso[] = [];

        if (aulaCurso.manterComoComplementar) {
          status = "complementar";
        } else if (override) {
          alvo = override.assunto;
          status = "manual";
        } else {
          const associacaoAula = resolverAssociacao(
            aulaCurso.nome,
            moduloCurso.nome,
            assuntosAtuais().filter((assunto) => !assunto.complementarAoEdital)
          );

          const usarModulo =
            associacaoAula.status !== "automatico" &&
            associacaoModulo.status === "automatico";

          if (associacaoAula.status === "automatico") {
            alvo = associacaoAula.assunto;
            status = "automatico";
            candidatos = associacaoAula.candidatos;
          } else if (usarModulo) {
            alvo = associacaoModulo.assunto;
            status = "automatico";
            candidatos = associacaoModulo.candidatos;
          } else {
            status =
              associacaoAula.status === "ambiguo"
                ? "ambiguo"
                : "complementar";
            candidatos = associacaoAula.candidatos;
          }
        }

        if (!alvo) {
          alvo = obterOuCriarComplemento({
            materia,
            modulos,
            curso,
            materiaCurso,
            moduloCurso,
            aulaCurso,
            status,
            candidatos,
          });
        }

        anexarAula({
          alvo,
          curso,
          materiaCurso,
          moduloCurso,
          aulaCurso,
          indiceCurso,
          estadoAnterior,
          status,
          candidatos,
        });
      }
    }

    materia = {
      ...materia,
      idsLegados: unicos([
        ...(materia.idsLegados ?? []),
        ...(materia.id !== materiaCurso.id ? [materiaCurso.id] : []),
        `curso-materia-${slug(materiaCurso.nome)}`,
      ]),
      modulos,
      assuntos: deduplicarAssuntosPorId(
        modulos.flatMap((modulo) => modulo.assuntos)
      ),
    };
    resultado[indiceMateria] = materia;
  }

  return resultado;
}

function resolverAssociacao(
  nomeAula: string,
  nomeModulo: string,
  assuntos: Assunto[]
): ResultadoAssociacao {
  if (assuntos.length === 0) {
    return { status: "complementar", candidatos: [] };
  }

  const candidatos = assuntos
    .map((assunto) => {
      const scoreAula = scoreTexto(assunto.nome, nomeAula);
      const scoreModulo = scoreTexto(assunto.nome, nomeModulo) * 0.92;
      const scoreCombinado =
        scoreTexto(assunto.nome, `${nomeModulo} ${nomeAula}`) * 0.96;
      return {
        assunto,
        score: Math.max(scoreAula, scoreModulo, scoreCombinado),
      };
    })
    .sort((a, b) => b.score - a.score);

  const top = candidatos[0];
  const segundo = candidatos[1];
  const margem = top.score - (segundo?.score ?? 0);
  const resumo = candidatos.slice(0, 3).map(({ assunto, score }) => ({
    assuntoId: assunto.id,
    nome: assunto.nome,
    score: arredondar(score),
  }));

  if (
    top.score >= 0.86 &&
    (margem >= 0.08 || top.score >= 0.94)
  ) {
    return {
      status: "automatico",
      assunto: top.assunto,
      candidatos: resumo,
    };
  }

  if (top.score >= 0.58) {
    return {
      status: "ambiguo",
      candidatos: resumo,
    };
  }

  return {
    status: "complementar",
    candidatos: resumo.filter((item) => item.score >= 0.45),
  };
}

function obterOuCriarComplemento({
  materia,
  modulos,
  curso,
  materiaCurso,
  moduloCurso,
  aulaCurso,
  status,
  candidatos,
}: {
  materia: Materia;
  modulos: Modulo[];
  curso: CursoImportado;
  materiaCurso: CursoMateria;
  moduloCurso: CursoModulo;
  aulaCurso: CursoAula;
  status: "ambiguo" | "complementar" | "automatico" | "manual";
  candidatos: CandidatoVinculoCurso[];
}) {
  const nome = nomeComplemento(materiaCurso, moduloCurso, aulaCurso);
  const existentes = modulos.flatMap((modulo) => modulo.assuntos);
  const equivalente = melhorAssunto(
    existentes.filter((assunto) => assunto.complementarAoEdital),
    nome,
    0.88
  )?.assunto;

  if (equivalente) {
    if (status === "ambiguo" && !equivalente.vinculoCurso?.candidatos?.length) {
      equivalente.vinculoCurso = {
        status: "ambiguo",
        candidatos,
      };
    }
    return equivalente;
  }

  const usaModulo =
    !ehModuloGenerico(moduloCurso.nome) &&
    !materiasEquivalentes(materiaCurso.nome, moduloCurso.nome);
  const idBase = usaModulo ? moduloCurso.id : aulaCurso.id;
  const novo: Assunto = {
    id: `curso-complementar:${curso.id}:${idBase}`,
    nome,
    concluido: false,
    prioridade: "baixa",
    origemConteudo: "curso",
    complementarAoEdital: true,
    vinculoCurso: {
      status: status === "ambiguo" ? "ambiguo" : "complementar",
      candidatos,
    },
    idsLegados: [],
    aulas: [],
  };
  obterModuloGeral(modulos, materia.id).assuntos.push(novo);
  return novo;
}

function anexarAula({
  alvo,
  curso,
  materiaCurso,
  moduloCurso,
  aulaCurso,
  indiceCurso,
  estadoAnterior,
  status,
  candidatos,
}: {
  alvo: Assunto;
  curso: CursoImportado;
  materiaCurso: CursoMateria;
  moduloCurso: CursoModulo;
  aulaCurso: CursoAula;
  indiceCurso: number;
  estadoAnterior: Map<string, EstadoAnteriorAula>;
  status: "automatico" | "manual" | "ambiguo" | "complementar";
  candidatos: CandidatoVinculoCurso[];
}) {
  const idAula = `curso:${curso.id}:aula:${aulaCurso.id}:link`;
  const url = normalizarUrl(aulaCurso.url);
  const anterior =
    estadoAnterior.get(`id:${idAula}`) ??
    (url ? estadoAnterior.get(`url:${url}`) : undefined);
  const registro = aulaCurso.registroEstudo ?? anterior?.assunto;

  preservarDadosAssunto(alvo, registro);

  const existente = (alvo.aulas ?? []).find(
    (aula) =>
      aula.id === idAula ||
      Boolean(url && aula.url && normalizarUrl(aula.url) === url)
  );

  const nova: AulaAssunto = {
    ...(existente ?? {}),
    id: existente?.id ?? idAula,
    nome: aulaCurso.nome,
    url,
    ordem:
      existente?.ordem ??
      indiceCurso * 1_000_000 + moduloCurso.ordem * 1_000 + aulaCurso.ordem,
    concluida:
      anterior?.aula?.concluida ??
      aulaCurso.concluida ??
      false,
    concluidaEm:
      anterior?.aula?.concluidaEm ??
      aulaCurso.concluidaEm ??
      aulaCurso.concluidoEm,
    origemCurso: {
      cursoId: curso.id,
      cursoNome: curso.nome,
      materiaCursoId: materiaCurso.id,
      materiaCursoNome: materiaCurso.nome,
      moduloCursoId: moduloCurso.id,
      moduloCursoNome: moduloCurso.nome,
      aulaCursoId: aulaCurso.id,
    },
    vinculoCurso: {
      status,
      candidatos: candidatos.length ? candidatos : undefined,
    },
  };

  alvo.aulas = existente
    ? (alvo.aulas ?? []).map((aula) => aula.id === existente.id ? nova : aula)
    : [...(alvo.aulas ?? []), nova];
  alvo.aula = alvo.aulas.find((aula) => aula.url)?.url;

  alvo.idsLegados = unicos([
    ...(alvo.idsLegados ?? []),
    `curso:${curso.id}:aula:${aulaCurso.id}`,
  ]);

  if (alvo.origemEditalId) {
    alvo.origemConteudo = "mesclado";
    alvo.complementarAoEdital = false;
    alvo.vinculoCurso = { status: "confirmado" };
  }

  for (const material of aulaCurso.materiais ?? []) {
    anexarMaterialCurso(
      alvo,
      curso.id,
      material,
      curso.criadoEm
    );
  }
}

function preservarDadosAssunto(alvo: Assunto, anterior?: Assunto) {
  if (!anterior || anterior.id === alvo.id) return;

  alvo.idsLegados = unicos([
    ...(alvo.idsLegados ?? []),
    ...(anterior.idsLegados ?? []),
    anterior.id,
  ]);
  alvo.anotacoes = juntarTexto(alvo.anotacoes, anterior.anotacoes);
  alvo.resumo = alvo.resumo || anterior.resumo;
  alvo.questoes = alvo.questoes || anterior.questoes;
  alvo.pdf = alvo.pdf || anterior.pdf;
  alvo.materiais = mesclarMateriais(
    alvo.materiais ?? [],
    anterior.materiais ?? []
  );
}

function anexarMaterialCurso(
  assunto: Assunto,
  cursoId: string,
  material: { id: string; nome: string; tipo: string; url: string },
  criadoEm: string
) {
  const url = normalizarUrl(material.url);
  if (!url) return;
  const atual = assunto.materiais ?? [];
  if (atual.some((item) => normalizarUrl(item.url) === url)) return;

  const tipo: MaterialAssunto["tipo"] =
    material.tipo === "pdf" ? "pdf" : "link";
  assunto.materiais = [
    ...atual,
    {
      id: `curso-material:${cursoId}:${material.id}`,
      nome: material.nome,
      tipo,
      url,
      criadoEm,
    },
  ];
}

function localizarOverride(
  materias: Materia[],
  aula: CursoAula,
  materiaPadraoId: string
) {
  if (!aula.vinculoAssuntoId) return undefined;
  const materia =
    materias.find((item) => item.id === aula.vinculoMateriaId) ??
    materias.find((item) => item.id === materiaPadraoId);
  if (!materia) return undefined;
  const assunto = listarAssuntos(materia).find(
    (item) => item.id === aula.vinculoAssuntoId
  );
  return assunto ? { materia, assunto } : undefined;
}

function nomeComplemento(
  materia: CursoMateria,
  modulo: CursoModulo,
  aula: CursoAula
) {
  if (
    !ehModuloGenerico(modulo.nome) &&
    !materiasEquivalentes(materia.nome, modulo.nome)
  ) {
    return modulo.nome.trim();
  }
  return aula.nome.trim();
}

function normalizarGrade(materias: Materia[]) {
  return materias.map((materia) => {
    const modulos = garantirModuloGeral(materia)
      .map((modulo, indiceModulo) => ({
        ...modulo,
        ordem: indiceModulo,
        assuntos: deduplicarAssuntosPorId(modulo.assuntos)
          .map((assunto) => {
            const aulas = deduplicarAulas(assunto.aulas ?? [])
              .sort((a, b) => a.ordem - b.ordem)
              .map((aula, indice) => ({ ...aula, ordem: indice + 1 }));
            const complementar = Boolean(
              assunto.complementarAoEdital && !assunto.origemEditalId
            );
            return {
              ...assunto,
              prioridade: complementar ? "baixa" as const : assunto.prioridade,
              aulas,
              aula: aulas.find((aula) => aula.url)?.url ?? assunto.aula,
              concluido:
                complementar && aulas.length > 0
                  ? aulas.every((aula) => aula.concluida)
                  : assunto.concluido,
              origemConteudo:
                assunto.origemEditalId && aulas.some(ehAulaCurso)
                  ? "mesclado" as const
                  : assunto.origemEditalId
                    ? "edital" as const
                    : assunto.origemConteudo,
            };
          }),
      }))
      .filter((modulo) => modulo.assuntos.length > 0);

    return {
      ...materia,
      modulos,
      assuntos: deduplicarAssuntosPorId(
        modulos.flatMap((modulo) => modulo.assuntos)
      ),
    };
  });
}

function mapearEstadoAnterior(materias: Materia[]) {
  const mapa = new Map<string, EstadoAnteriorAula>();

  for (const materia of materias) {
    const modulos =
      materia.modulos?.length
        ? materia.modulos
        : [{ id: "legado", nome: "Geral", ordem: 0, assuntos: materia.assuntos }];

    for (const modulo of modulos) {
      for (const assunto of modulo.assuntos) {
        for (const aula of assunto.aulas ?? []) {
          if (!ehAulaCurso(aula) && !aula.id.startsWith("curso:")) continue;
          mapa.set(`id:${aula.id}`, { assunto, aula });
          const url = normalizarUrl(aula.url);
          if (url) mapa.set(`url:${url}`, { assunto, aula });
        }

        if (assunto.id.startsWith("curso:") && assunto.aula) {
          const url = normalizarUrl(assunto.aula);
          if (url && !mapa.has(`url:${url}`)) {
            mapa.set(`url:${url}`, { assunto });
          }
        }
      }
    }
  }

  return mapa;
}

function melhorMateria(materias: Materia[], nome: string) {
  const indice = indiceMelhorMateria(materias, nome);
  return indice >= 0 ? materias[indice] : undefined;
}

function indiceMelhorMateria(materias: Materia[], nome: string) {
  let melhor = -1;
  let score = 0;
  materias.forEach((materia, indice) => {
    const atual = scoreMateria(materia.nome, nome);
    if (atual > score) {
      score = atual;
      melhor = indice;
    }
  });
  return score >= 0.82 ? melhor : -1;
}

function scoreMateria(a: string, b: string) {
  const na = normalizar(a);
  const nb = normalizar(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;

  const da = identificarDisciplina(a);
  const db = identificarDisciplina(b);
  if (da && db && normalizar(da) === normalizar(db)) return 0.96;

  if (na.includes(nb) || nb.includes(na)) return 0.9;
  return scoreTokens(a, b);
}

function melhorAssunto(
  assuntos: Assunto[],
  nome: string,
  minimo: number
) {
  const candidatos = assuntos
    .map((assunto) => ({
      assunto,
      score: scoreTexto(nome, assunto.nome),
    }))
    .sort((a, b) => b.score - a.score);

  const top = candidatos[0];
  if (!top || top.score < minimo) return undefined;
  const segundo = candidatos[1];
  if (top.score < 0.94 && segundo && top.score - segundo.score < 0.08) {
    return undefined;
  }
  return top;
}

function scoreTexto(a: string, b: string) {
  const na = normalizarExpandido(a);
  const nb = normalizarExpandido(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) {
    const menor = Math.min(na.length, nb.length);
    if (menor >= 7) return 0.93;
  }

  if (ehOrganizacaoPoderes(na, nb)) return 0.92;

  const tokenScore = scoreTokens(na, nb);
  const fortesA = tokensFortes(na);
  const fortesB = tokensFortes(nb);
  if (
    fortesA.length === 1 &&
    fortesB.length === 1 &&
    fortesA[0] !== fortesB[0]
  ) {
    return Math.min(tokenScore, 0.35);
  }
  return tokenScore;
}

function scoreTokens(a: string, b: string) {
  const ta = tokensFortes(a);
  const tb = tokensFortes(b);
  if (ta.length === 0 || tb.length === 0) return 0;

  const sa = new Set(ta);
  const sb = new Set(tb);
  const inter = [...sa].filter((token) => sb.has(token)).length;
  if (inter === 0) return 0;

  const coberturaA = inter / sa.size;
  const coberturaB = inter / sb.size;
  const jaccard = inter / new Set([...sa, ...sb]).size;
  const fortesCompartilhados = [...sa].filter(
    (token) => sb.has(token) && !TOKENS_GENERICOS.has(token)
  ).length;

  let score =
    Math.max(coberturaA, coberturaB) * 0.48 +
    Math.min(coberturaA, coberturaB) * 0.22 +
    jaccard * 0.3;

  if (fortesCompartilhados >= 2) score += 0.08;
  if (fortesCompartilhados === 0) score = Math.min(score, 0.55);
  return Math.min(1, score);
}

function ehOrganizacaoPoderes(a: string, b: string) {
  const um = `${a} ${b}`;
  const temOrganizacao =
    /organizacao.*poder|poder.*organizacao/.test(um);
  const temPoderEspecifico =
    /poder (executivo|legislativo|judiciario)/.test(um) ||
    /(executivo|legislativo|judiciario).*poder/.test(um);
  return temOrganizacao && temPoderEspecifico;
}

function tokensFortes(texto: string) {
  return normalizarExpandido(texto)
    .split(" ")
    .map(radical)
    .filter(
      (token) =>
        token.length >= 3 &&
        !STOPWORDS.has(token)
    );
}

function radical(token: string) {
  if (token.endsWith("oes") && token.length > 6) return token.slice(0, -3) + "ao";
  if (token.endsWith("ais") && token.length > 5) return token.slice(0, -3) + "al";
  if (token.endsWith("res") && token.length > 5) return token.slice(0, -2);
  if (token.endsWith("s") && token.length > 4) return token.slice(0, -1);
  return token;
}

function normalizarExpandido(texto: string) {
  return normalizar(texto)
    .replace(/\brlm\b/g, "raciocinio logico matematica")
    .replace(/\bti\b/g, "tecnologia informacao")
    .replace(/\bcf\b/g, "constituicao federal")
    .replace(/\bconst\b/g, "constituicao")
    .replace(/\bproc\b/g, "processual");
}

function normalizar(texto: string) {
  return textoIdentidadeCurso(String(texto || ""))
    .replace(/\s+/g, " ")
    .trim();
}

function slug(texto: string) {
  return normalizar(texto).replace(/\s+/g, "-") || "conteudo";
}

function ehModuloCurso(modulo: Modulo) {
  return modulo.id.startsWith("curso:") || modulo.id.startsWith("curso-visao:");
}

function ehModuloFonte(modulo: Modulo) {
  const nome = normalizar(modulo.nome);
  return (
    nome === "geral" ||
    nome === "edital atual" ||
    nome === "conteudo do edital" ||
    modulo.id.endsWith("-edital") ||
    modulo.id.endsWith("-edital-atual") ||
    modulo.id.endsWith("-edital-importado")
  );
}

function ehModuloGenerico(nome: string) {
  return MODULOS_GENERICOS.has(normalizar(nome));
}

function ehAulaCurso(aula: AulaAssunto) {
  return Boolean(aula.origemCurso) || aula.id.startsWith("curso:");
}

function garantirModuloGeral(materia: Materia) {
  const modulos = clonar(materia.modulos ?? []);
  if (modulos.length === 0) {
    modulos.push({
      id: `modulo-geral-${materia.id}`,
      nome: "Geral",
      ordem: 0,
      assuntos: [],
    });
  }
  if (!modulos.some((modulo) => normalizar(modulo.nome) === "geral")) {
    modulos.unshift({
      id: `modulo-geral-${materia.id}`,
      nome: "Geral",
      ordem: 0,
      assuntos: [],
    });
  }
  return modulos;
}

function obterModuloGeral(modulos: Modulo[], materiaId: string) {
  let geral = modulos.find((modulo) => normalizar(modulo.nome) === "geral");
  if (!geral) {
    geral = {
      id: `modulo-geral-${materiaId}`,
      nome: "Geral",
      ordem: 0,
      assuntos: [],
    };
    modulos.unshift(geral);
  }
  return geral;
}

function listarAssuntos(materia: Materia) {
  return deduplicarAssuntosPorId(
    (materia.modulos?.length
      ? materia.modulos.flatMap((modulo) => modulo.assuntos)
      : materia.assuntos) ?? []
  );
}

function substituirAssunto(
  modulos: Modulo[],
  assuntoId: string,
  atualizado: Assunto
) {
  for (const modulo of modulos) {
    const indice = modulo.assuntos.findIndex((assunto) => assunto.id === assuntoId);
    if (indice >= 0) {
      modulo.assuntos[indice] = atualizado;
      return;
    }
  }
}

function mesclarAssuntosExatos(base: Assunto[], novos: Assunto[]) {
  const resultado = clonar(base);
  for (const assunto of novos) {
    const existente = resultado.find(
      (item) =>
        item.id === assunto.id ||
        normalizar(item.nome) === normalizar(assunto.nome)
    );
    if (!existente) {
      resultado.push(clonar(assunto));
      continue;
    }
    preservarDadosAssunto(existente, assunto);
    existente.aulas = deduplicarAulas([
      ...(existente.aulas ?? []),
      ...(assunto.aulas ?? []),
    ]);
  }
  return resultado;
}

function deduplicarAssuntosPorId(assuntos: Assunto[]) {
  const vistos = new Set<string>();
  return assuntos.filter((assunto) => {
    if (vistos.has(assunto.id)) return false;
    vistos.add(assunto.id);
    return true;
  });
}

function deduplicarAulas(aulas: AulaAssunto[]) {
  const ids = new Set<string>();
  const urls = new Set<string>();
  return aulas.filter((aula) => {
    if (ids.has(aula.id)) return false;
    const url = normalizarUrl(aula.url);
    if (url && urls.has(url)) return false;
    ids.add(aula.id);
    if (url) urls.add(url);
    return true;
  });
}

function mesclarMateriais(a: MaterialAssunto[], b: MaterialAssunto[]) {
  const resultado = [...a];
  for (const item of b) {
    const url = normalizarUrl(item.url);
    if (
      resultado.some(
        (atual) =>
          atual.id === item.id ||
          Boolean(url && normalizarUrl(atual.url) === url)
      )
    ) {
      continue;
    }
    resultado.push(item);
  }
  return resultado;
}

function juntarTexto(a?: string, b?: string) {
  const partes = [a?.trim(), b?.trim()].filter(Boolean) as string[];
  return unicos(partes).join("\n\n") || undefined;
}

function normalizarUrl(url?: string) {
  if (!url) return undefined;
  try {
    const objeto = new URL(url);
    objeto.hash = "";
    return objeto.href;
  } catch {
    return undefined;
  }
}

function unicos<T>(itens: T[]) {
  return [...new Set(itens)];
}

function arredondar(valor: number) {
  return Math.round(valor * 100) / 100;
}

function clonar<T>(valor: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(valor)
    : JSON.parse(JSON.stringify(valor)) as T;
}
