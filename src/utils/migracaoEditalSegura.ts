import type {
  Assunto,
  Materia,
} from "../types";
import type { CursoImportado } from "../types/cursos";
import type {
  AnaliseEdital,
  CorrespondenciaMigracaoEdital,
  EditalAtivo,
  RelatorioMigracaoEdital,
  PlanoEdital,
} from "../types/editalInteligente";
import { aplicarCursosAtivosNasMaterias } from "./importacaoCurso";
import {
  normalizarAnaliseEdital,
  slugEdital,
} from "./planoEdital";
import {
  materiasEquivalentes,
  scoreAssociacaoAssunto,
} from "./uniaoGradeEstudos";

export type ContagemPreservacaoMigracao = {
  questoes: number;
  sessoes: number;
  revisoes: number;
  simulados: number;
  bancoQuestoes: number;
  simuladosGerados: number;
  missoesConcluidas: number;
};

export type PrepararMigracaoEditalArgs = {
  materiasAtuais: Materia[];
  editalAnterior?: EditalAtivo;
  editalNovoId: string;
  editalNovoNome: string;
  analiseNova: AnaliseEdital;
  cursos: CursoImportado[];
  cursosAtivosIds: string[];
  contagens: ContagemPreservacaoMigracao;
};

export type ResultadoPreparacaoMigracaoEdital = {
  analiseCanonica: AnaliseEdital;
  materiasMigradas: Materia[];
  relatorio: RelatorioMigracaoEdital;
};

type MatchAssunto = {
  assunto?: Assunto;
  score: number;
  ambiguo: boolean;
  candidatos: Array<{
    assuntoId: string;
    nome: string;
    score: number;
  }>;
};

export function remapearMissoesConcluidasPorConteudo(params: {
  planoNovo: PlanoEdital;
  concluidasAtuais: string[];
  referenciasLegadas: Array<{
    missaoId: string;
    materiaId: string;
    assuntoId: string;
  }>;
}) {
  const concluidas = new Set(params.concluidasAtuais);
  const referenciasConcluidas = new Set(
    params.referenciasLegadas
      .filter((item) => concluidas.has(item.missaoId))
      .map((item) => `${item.materiaId}::${item.assuntoId}`)
  );

  for (const semana of params.planoNovo.semanas) {
    for (const dia of semana.dias) {
      for (const missao of dia.missoes) {
        const chave =
          `${missao.materiaId}::${missao.assuntoId}`;
        if (referenciasConcluidas.has(chave)) {
          concluidas.add(missao.id);
        }
      }
    }
  }

  return Array.from(concluidas);
}

export function criarEditalAnteriorSintetico(params: {
  materias: Materia[];
  concurso: string;
  banca?: string;
}): EditalAtivo {
  const analisadoEm = new Date().toISOString();

  return {
    id: "estado-anterior-study-pro",
    nomeArquivo: "Estado anterior do Study Pro",
    storagePath: "",
    confirmadoEm: analisadoEm,
    analise: {
      concursoDetectado: params.concurso || "Concurso atual",
      bancaDetectada: params.banca,
      analisadoEm,
      materias: params.materias
        .map((materia) => ({
          id: materia.id,
          nome: materia.nome,
          incidenciaEstimada: 1,
          assuntos: listarAssuntosBrutos(materia).map((assunto) => ({
            id: assunto.id,
            nome: assunto.nome,
            prioridade: assunto.prioridade,
          })),
        }))
        .filter((materia) => materia.assuntos.length > 0),
    },
  };
}

export function prepararMigracaoEditalSegura({
  materiasAtuais,
  editalAnterior,
  editalNovoId,
  editalNovoNome,
  analiseNova,
  cursos,
  cursosAtivosIds,
  contagens,
}: PrepararMigracaoEditalArgs): ResultadoPreparacaoMigracaoEdital {
  const nova = normalizarAnaliseEdital(analiseNova);
  const usados = new Set<string>();
  const correspondencias: CorrespondenciaMigracaoEdital[] = [];
  const fontePorCanonico = new Map<
    string,
    {
      materiaNovaId: string;
      assuntoNovoId: string;
      nomeNovo: string;
    }
  >();

  const materiasCanonicas = nova.materias.map((materiaNova) => {
    const materiaAtual = localizarMateriaAtual(
      materiasAtuais,
      materiaNova.nome
    );
    const idMateriaCanonica = materiaAtual?.id ?? materiaNova.id;
    const candidatos = materiaAtual
      ? listarAssuntosBrutos(materiaAtual)
      : [];

    const assuntos = materiaNova.assuntos.map((assuntoNovo) => {
      const match = escolherAssunto(
        candidatos.filter(
          (assunto) =>
            !usados.has(
              chaveCanonica(idMateriaCanonica, assunto.id)
            )
        ),
        assuntoNovo.nome
      );

      if (match.assunto && !match.ambiguo) {
        usados.add(
          chaveCanonica(idMateriaCanonica, match.assunto.id)
        );
        fontePorCanonico.set(
          chaveCanonica(idMateriaCanonica, match.assunto.id),
          {
            materiaNovaId: materiaNova.id,
            assuntoNovoId: assuntoNovo.id,
            nomeNovo: assuntoNovo.nome,
          }
        );

        correspondencias.push({
          materiaAnteriorId: materiaAtual?.id,
          materiaAnterior: materiaAtual?.nome,
          assuntoAnteriorId: match.assunto.id,
          assuntoAnterior: match.assunto.nome,
          materiaNovaId: materiaNova.id,
          materiaNova: materiaNova.nome,
          assuntoNovoId: assuntoNovo.id,
          assuntoNovo: assuntoNovo.nome,
          status:
            normalizarNome(match.assunto.nome) === normalizarNome(assuntoNovo.nome)
              ? "mantido"
              : "renomeado",
          score: arredondar(match.score),
          candidatos: match.candidatos,
        });

        return {
          ...assuntoNovo,
          id: match.assunto.id,
        };
      }

      fontePorCanonico.set(
        chaveCanonica(idMateriaCanonica, assuntoNovo.id),
        {
          materiaNovaId: materiaNova.id,
          assuntoNovoId: assuntoNovo.id,
          nomeNovo: assuntoNovo.nome,
        }
      );

      correspondencias.push({
        materiaAnteriorId: materiaAtual?.id,
        materiaAnterior: materiaAtual?.nome,
        materiaNovaId: materiaNova.id,
        materiaNova: materiaNova.nome,
        assuntoNovoId: assuntoNovo.id,
        assuntoNovo: assuntoNovo.nome,
        status: match.ambiguo ? "ambiguo" : "novo",
        score: match.score ? arredondar(match.score) : undefined,
        candidatos: match.candidatos.length ? match.candidatos : undefined,
      });

      return assuntoNovo;
    });

    return {
      ...materiaNova,
      id: idMateriaCanonica,
      assuntos,
    };
  });

  const analiseCanonica: AnaliseEdital = {
    ...nova,
    materias: materiasCanonicas,
  };

  const removidos = localizarAssuntosRemovidos(
    materiasAtuais,
    editalAnterior,
    usados,
    correspondencias,
    editalNovoId,
    editalNovoNome
  );

  let materiasMigradas = aplicarCursosAtivosNasMaterias(
    materiasAtuais,
    cursos,
    cursosAtivosIds,
    analiseCanonica
  );

  materiasMigradas = marcarVinculosDoNovoEdital(
    materiasMigradas,
    analiseCanonica,
    fontePorCanonico,
    editalAnterior,
    editalNovoId,
    nova.analisadoEm
  );

  materiasMigradas = preservarRemovidosComoComplementares(
    materiasMigradas,
    removidos,
    editalAnterior
  );

  const resumo = {
    mantidos: correspondencias.filter((item) => item.status === "mantido").length,
    renomeados: correspondencias.filter((item) => item.status === "renomeado").length,
    novos: correspondencias.filter((item) => item.status === "novo").length,
    removidosPreservados: correspondencias.filter(
      (item) => item.status === "removido_preservado"
    ).length,
    ambiguos: correspondencias.filter((item) => item.status === "ambiguo").length,
    totalAnterior: editalAnterior
      ? editalAnterior.analise.materias.reduce(
          (total, materia) => total + materia.assuntos.length,
          0
        )
      : 0,
    totalNovo: nova.materias.reduce(
      (total, materia) => total + materia.assuntos.length,
      0
    ),
  };

  const relatorio: RelatorioMigracaoEdital = {
    id: `migracao-edital-${Date.now()}`,
    criadoEm: new Date().toISOString(),
    editalAnteriorId: editalAnterior?.id,
    editalAnteriorNome: editalAnterior?.nomeArquivo,
    editalNovoId,
    editalNovoNome,
    correspondencias,
    resumo,
    preservacao: {
      ...contagens,
      linksQuestoes: contarLinksQuestoes(materiasAtuais),
      anotacoes: contarAnotacoes(materiasAtuais),
      materiais: contarMateriais(materiasAtuais),
    },
    bloqueios:
      nova.materias.length === 0
        ? ["O novo edital não possui matérias válidas."]
        : [],
  };

  return {
    analiseCanonica,
    materiasMigradas,
    relatorio,
  };
}

export function validarPreservacaoMigracao(params: {
  antes: {
    materias: Materia[];
    questoes: unknown[];
    sessoes: unknown[];
    revisoes: unknown[];
    simulados: unknown[];
    bancoQuestoes: unknown[];
    simuladosGerados: unknown[];
    missoesConcluidas: string[];
  };
  depois: {
    materias: Materia[];
    questoes: unknown[];
    sessoes: unknown[];
    revisoes: unknown[];
    simulados: unknown[];
    bancoQuestoes: unknown[];
    simuladosGerados: unknown[];
    missoesConcluidas: string[];
  };
}) {
  const colecoes: Array<{
    nome: string;
    antes: number;
    depois: number;
  }> = [
    { nome: "questões", antes: params.antes.questoes.length, depois: params.depois.questoes.length },
    { nome: "sessões", antes: params.antes.sessoes.length, depois: params.depois.sessoes.length },
    { nome: "revisões", antes: params.antes.revisoes.length, depois: params.depois.revisoes.length },
    { nome: "simulados", antes: params.antes.simulados.length, depois: params.depois.simulados.length },
    { nome: "banco de questões", antes: params.antes.bancoQuestoes.length, depois: params.depois.bancoQuestoes.length },
    { nome: "simulados gerados", antes: params.antes.simuladosGerados.length, depois: params.depois.simuladosGerados.length },
    {
      nome: "missões concluídas",
      antes: params.antes.missoesConcluidas.length,
      depois: params.depois.missoesConcluidas.length,
    },
  ];

  const perdas = colecoes.filter((item) => item.depois < item.antes);
  if (perdas.length > 0) {
    throw new Error(
      `Migração interrompida: houve redução inesperada em ${perdas
        .map((item) => `${item.nome} (${item.antes} → ${item.depois})`)
        .join(", ")}.`
    );
  }

  const linksAntes = listarLinksQuestoes(params.antes.materias);
  const linksDepois = new Set(listarLinksQuestoes(params.depois.materias));
  const linksPerdidos = linksAntes.filter((url) => !linksDepois.has(url));
  if (linksPerdidos.length > 0) {
    throw new Error(
      `Migração interrompida: ${linksPerdidos.length} link(s) de questões deixariam de existir.`
    );
  }

  const anotacoesAntes = listarAnotacoes(params.antes.materias);
  const anotacoesDepois = listarAnotacoes(params.depois.materias);
  const anotacoesPerdidas = anotacoesAntes.filter(
    (anotacao) =>
      !anotacoesDepois.some((atual) => atual.includes(anotacao))
  );
  if (anotacoesPerdidas.length > 0) {
    throw new Error(
      `Migração interrompida: ${anotacoesPerdidas.length} anotação(ões) deixariam de existir.`
    );
  }

  const materiaisAntes = listarUrlsMateriais(params.antes.materias);
  const materiaisDepois = new Set(
    listarUrlsMateriais(params.depois.materias)
  );
  const materiaisPerdidos = materiaisAntes.filter(
    (url) => !materiaisDepois.has(url)
  );
  if (materiaisPerdidos.length > 0) {
    throw new Error(
      `Migração interrompida: ${materiaisPerdidos.length} material(is) deixariam de existir.`
    );
  }
}

function localizarMateriaAtual(
  materias: Materia[],
  nome: string
) {
  return (
    materias.find((materia) => materiasEquivalentes(materia.nome, nome)) ??
    materias.find((materia) => normalizarNome(materia.nome) === normalizarNome(nome))
  );
}

function listarAssuntosBrutos(materia: Materia) {
  const lista = materia.modulos?.length
    ? materia.modulos.flatMap((modulo) => modulo.assuntos)
    : materia.assuntos ?? [];
  const ids = new Set<string>();

  return lista.filter((assunto) => {
    if (!assunto.id || ids.has(assunto.id)) return false;
    ids.add(assunto.id);
    return true;
  });
}

function escolherAssunto(
  assuntos: Assunto[],
  nomeNovo: string
): MatchAssunto {
  if (assuntos.length === 0) {
    return {
      score: 0,
      ambiguo: false,
      candidatos: [],
    };
  }

  const candidatos = assuntos
    .map((assunto) => ({
      assunto,
      score: scoreAssociacaoAssunto(nomeNovo, assunto.nome),
    }))
    .sort((a, b) => b.score - a.score);

  const top = candidatos[0];
  const segundo = candidatos[1];
  const margem = top.score - (segundo?.score ?? 0);
  const resumo = candidatos
    .filter((item) => item.score >= 0.45)
    .slice(0, 3)
    .map(({ assunto, score }) => ({
      assuntoId: assunto.id,
      nome: assunto.nome,
      score: arredondar(score),
    }));

  if (
    top.score >= 0.86 &&
    (margem >= 0.08 || top.score >= 0.94)
  ) {
    return {
      assunto: top.assunto,
      score: top.score,
      ambiguo: false,
      candidatos: resumo,
    };
  }

  return {
    score: top.score,
    ambiguo: top.score >= 0.58,
    candidatos: resumo,
  };
}

function localizarAssuntosRemovidos(
  materiasAtuais: Materia[],
  editalAnterior: EditalAtivo | undefined,
  usados: Set<string>,
  correspondencias: CorrespondenciaMigracaoEdital[],
  editalNovoId: string,
  editalNovoNome: string
) {
  const removidos: Array<{
    materiaId: string;
    assunto: Assunto;
    materiaAnteriorId?: string;
    assuntoAnteriorId?: string;
    nomeAnterior?: string;
  }> = [];

  if (!editalAnterior) return removidos;

  for (const materiaAnterior of editalAnterior.analise.materias) {
    const materiaAtual = localizarMateriaAtual(
      materiasAtuais,
      materiaAnterior.nome
    );
    if (!materiaAtual) continue;

    const assuntosAtuais = listarAssuntosBrutos(materiaAtual);

    for (const assuntoAnterior of materiaAnterior.assuntos) {
      const atual =
        assuntosAtuais.find(
          (assunto) =>
            assunto.id === assuntoAnterior.id ||
            assunto.origemEditalId === assuntoAnterior.id ||
            assunto.idsLegados?.includes(assuntoAnterior.id)
        ) ??
        escolherAssunto(assuntosAtuais, assuntoAnterior.nome).assunto;

      if (
        !atual ||
        usados.has(chaveCanonica(materiaAtual.id, atual.id))
      ) {
        continue;
      }

      usados.add(chaveCanonica(materiaAtual.id, atual.id));
      removidos.push({
        materiaId: materiaAtual.id,
        assunto: atual,
        materiaAnteriorId: materiaAnterior.id,
        assuntoAnteriorId: assuntoAnterior.id,
        nomeAnterior: assuntoAnterior.nome,
      });

      correspondencias.push({
        materiaAnteriorId: materiaAnterior.id,
        materiaAnterior: materiaAnterior.nome,
        assuntoAnteriorId: assuntoAnterior.id,
        assuntoAnterior: assuntoAnterior.nome,
        materiaNovaId: materiaAtual.id,
        materiaNova: materiaAtual.nome,
        assuntoNovoId: atual.id,
        assuntoNovo: atual.nome,
        status: "removido_preservado",
      });
    }
  }

  void editalNovoId;
  void editalNovoNome;
  return removidos;
}

function marcarVinculosDoNovoEdital(
  materias: Materia[],
  analiseCanonica: AnaliseEdital,
  fontePorCanonico: Map<
    string,
    {
      materiaNovaId: string;
      assuntoNovoId: string;
      nomeNovo: string;
    }
  >,
  editalAnterior: EditalAtivo | undefined,
  editalNovoId: string,
  vinculadoEm: string
) {
  return materias.map((materia) => {
    const materiaAnalise = analiseCanonica.materias.find(
      (item) => item.id === materia.id || materiasEquivalentes(item.nome, materia.nome)
    );

    const vinculosMateria = (materia.vinculosEdital ?? []).map((vinculo) => ({
      ...vinculo,
      ativo: vinculo.editalId === editalNovoId,
    }));

    if (materiaAnalise) {
      const existente = vinculosMateria.find(
        (vinculo) => vinculo.editalId === editalNovoId
      );
      if (existente) {
        existente.ativo = true;
        existente.materiaEditalId =
          fonteMateriaOriginal(
            fontePorCanonico,
            materia.id
          ) ?? materiaAnalise.id;
        existente.nomeNoEdital = materiaAnalise.nome;
      } else {
        vinculosMateria.push({
          editalId: editalNovoId,
          materiaEditalId:
            fonteMateriaOriginal(
              fontePorCanonico,
              materia.id
            ) ?? materiaAnalise.id,
          nomeNoEdital: materiaAnalise.nome,
          ativo: true,
          vinculadoEm,
        });
      }
    }

    const modulos = (materia.modulos ?? []).map((modulo) => ({
      ...modulo,
      assuntos: modulo.assuntos.map((assunto) => {
        const fonte = fontePorCanonico.get(
          chaveCanonica(materia.id, assunto.id)
        );

        const vinculos = (assunto.vinculosEdital ?? []).map((vinculo) => ({
          ...vinculo,
          ativo: vinculo.editalId === editalNovoId,
        }));

        const origemAnterior =
          editalAnterior
            ? localizarOrigemNoEditalAnterior(
                editalAnterior,
                materia.nome,
                assunto
              )
            : undefined;

        if (origemAnterior && vinculos.length === 0) {
          vinculos.push({
            editalId: editalAnterior!.id,
            materiaEditalId: origemAnterior.materiaId,
            assuntoEditalId: origemAnterior.assuntoId,
            nomeNoEdital: origemAnterior.nome,
            ativo: false,
            vinculadoEm: editalAnterior!.confirmadoEm ?? vinculadoEm,
          });
        }

        if (fonte) {
          const existente = vinculos.find(
            (vinculo) => vinculo.editalId === editalNovoId
          );
          if (existente) {
            existente.ativo = true;
            existente.materiaEditalId = fonte.materiaNovaId;
            existente.assuntoEditalId = fonte.assuntoNovoId;
            existente.nomeNoEdital = fonte.nomeNovo;
          } else {
            vinculos.push({
              editalId: editalNovoId,
              materiaEditalId: fonte.materiaNovaId,
              assuntoEditalId: fonte.assuntoNovoId,
              nomeNoEdital: fonte.nomeNovo,
              ativo: true,
              vinculadoEm,
            });
          }
        }

        return {
          ...assunto,
          vinculosEdital: vinculos.length ? vinculos : undefined,
        };
      }),
    }));

    return {
      ...materia,
      vinculosEdital: vinculosMateria.length ? vinculosMateria : undefined,
      modulos,
      assuntos: modulos.length
        ? deduplicarPorId(modulos.flatMap((modulo) => modulo.assuntos))
        : materia.assuntos,
    };
  });
}

function preservarRemovidosComoComplementares(
  materias: Materia[],
  removidos: Array<{
    materiaId: string;
    assunto: Assunto;
    materiaAnteriorId?: string;
    assuntoAnteriorId?: string;
    nomeAnterior?: string;
  }>,
  editalAnterior?: EditalAtivo
) {
  if (removidos.length === 0) return materias;
  const ids = new Set(removidos.map((item) => item.assunto.id));

  return materias.map((materia) => {
    const modulos = (materia.modulos ?? []).map((modulo) => ({
      ...modulo,
      assuntos: modulo.assuntos.map((assunto) => {
        if (!ids.has(assunto.id)) return assunto;

        const removido = removidos.find((item) => item.assunto.id === assunto.id);
        const vinculos = (assunto.vinculosEdital ?? []).map((vinculo) => ({
          ...vinculo,
          ativo: false,
        }));

        if (
          editalAnterior &&
          removido?.assuntoAnteriorId &&
          !vinculos.some((vinculo) => vinculo.editalId === editalAnterior.id)
        ) {
          vinculos.push({
            editalId: editalAnterior.id,
            materiaEditalId: removido.materiaAnteriorId,
            assuntoEditalId: removido.assuntoAnteriorId,
            nomeNoEdital: removido.nomeAnterior ?? assunto.nome,
            ativo: false,
            vinculadoEm: editalAnterior.confirmadoEm ?? new Date().toISOString(),
          });
        }

        return {
          ...assunto,
          origemEditalId: undefined,
          origemConteudo: "manual" as const,
          complementarAoEdital: true,
          prioridade: "baixa" as const,
          vinculosEdital: vinculos.length ? vinculos : undefined,
        };
      }),
    }));

    return {
      ...materia,
      modulos,
      assuntos: modulos.length
        ? deduplicarPorId(modulos.flatMap((modulo) => modulo.assuntos))
        : materia.assuntos,
    };
  });
}

function localizarOrigemNoEditalAnterior(
  editalAnterior: EditalAtivo,
  materiaNome: string,
  assunto: Assunto
) {
  const materia = editalAnterior.analise.materias.find(
    (item) => materiasEquivalentes(item.nome, materiaNome)
  );
  if (!materia) return undefined;

  const origem = materia.assuntos.find(
    (item) =>
      item.id === assunto.origemEditalId ||
      item.id === assunto.id ||
      assunto.idsLegados?.includes(item.id)
  );

  if (origem) {
    return {
      materiaId: materia.id,
      assuntoId: origem.id,
      nome: origem.nome,
    };
  }

  const candidatos = materia.assuntos
    .map((item) => ({
      item,
      score: scoreAssociacaoAssunto(item.nome, assunto.nome),
    }))
    .sort((a, b) => b.score - a.score);

  const top = candidatos[0];
  if (!top || top.score < 0.94) return undefined;

  return {
    materiaId: materia.id,
    assuntoId: top.item.id,
    nome: top.item.nome,
  };
}

function fonteMateriaOriginal(
  fontePorCanonico: Map<
    string,
    {
      materiaNovaId: string;
      assuntoNovoId: string;
      nomeNovo: string;
    }
  >,
  materiaCanonicaId: string
) {
  for (const [chave, fonte] of fontePorCanonico) {
    if (chave.startsWith(`${materiaCanonicaId}::`)) {
      return fonte.materiaNovaId;
    }
  }
  return undefined;
}

function listarLinksQuestoes(materias: Materia[]) {
  return Array.from(
    new Set(
      listarTodosAssuntos(materias)
        .map((assunto) => assunto.questoes?.trim())
        .filter((url): url is string => Boolean(url))
    )
  );
}

function listarAnotacoes(materias: Materia[]) {
  return Array.from(
    new Set(
      listarTodosAssuntos(materias)
        .map((assunto) => assunto.anotacoes?.trim())
        .filter((texto): texto is string => Boolean(texto))
    )
  );
}

function listarUrlsMateriais(materias: Materia[]) {
  return Array.from(
    new Set(
      listarTodosAssuntos(materias)
        .flatMap((assunto) => assunto.materiais ?? [])
        .map((material) => material.url?.trim())
        .filter((url): url is string => Boolean(url))
    )
  );
}

function contarLinksQuestoes(materias: Materia[]) {
  return listarTodosAssuntos(materias).filter(
    (assunto) => Boolean(assunto.questoes?.trim())
  ).length;
}

function contarAnotacoes(materias: Materia[]) {
  return listarTodosAssuntos(materias).filter(
    (assunto) => Boolean(assunto.anotacoes?.trim())
  ).length;
}

function contarMateriais(materias: Materia[]) {
  return listarTodosAssuntos(materias).reduce(
    (total, assunto) => total + (assunto.materiais?.length ?? 0),
    0
  );
}

function listarTodosAssuntos(materias: Materia[]) {
  const ids = new Set<string>();
  return materias.flatMap((materia) =>
    listarAssuntosBrutos(materia).filter((assunto) => {
      const chave = `${materia.id}::${assunto.id}`;
      if (ids.has(chave)) return false;
      ids.add(chave);
      return true;
    })
  );
}

function deduplicarPorId(assuntos: Assunto[]) {
  const ids = new Set<string>();
  return assuntos.filter((assunto) => {
    if (ids.has(assunto.id)) return false;
    ids.add(assunto.id);
    return true;
  });
}

function chaveCanonica(materiaId: string, assuntoId: string) {
  return `${materiaId}::${assuntoId}`;
}

function normalizarNome(nome: string) {
  return slugEdital(nome);
}

function arredondar(valor: number) {
  return Math.round(valor * 100) / 100;
}
