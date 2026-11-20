import type { Materia } from "../types";
import type { AnaliseEdital } from "../types/editalInteligente";
import type { CursoImportado } from "../types/cursos";
import { listarAssuntosDaMateria } from "../services/conteudos/navegarConteudos";
import { scoreAssociacaoAssunto } from "./uniaoGradeEstudos";
import {
  FAMILIAS_CATALOGO,
  identificarConteudoCatalogo,
  identificarDisciplinaCatalogo,
  normalizarNomeCatalogo,
  type IdentificacaoCatalogo,
} from "./catalogoAssuntosCentral";

/**
 * Diagnóstico sem efeitos colaterais. O catálogo identifica famílias e
 * subassuntos; não autoriza fusões nem regrava IDs do estudante.
 */
export type CandidatoImportacao = {
  origem: "edital" | "curso";
  materia: string;
  assunto: string;
  idOrigem: string;
};
export type SituacaoConciliacao =
  | "exato"
  | "alias"
  | "mesma-familia"
  | "titulo-composto"
  | "disciplina-divergente"
  | "nome-semelhante"
  | "repetido-no-arquivo"
  | "novo";
export type ItemConciliacao = CandidatoImportacao & {
  situacao: SituacaoConciliacao;
  referencia?: { materiaId: string; assuntoId: string; materia: string; assunto: string; doArquivo?: boolean };
  familiaId?: string;
  familiasIds?: string[];
  familia?: string;
  subassuntosIds: string[];
  confianca: "alta" | "revisar" | "nenhuma";
  explicacao: string;
};
export type RelatorioConciliacao = {
  total: number;
  identicos: number;
  alias: number;
  relacionados: number;
  risco: number;
  novos: number;
  itens: ItemConciliacao[];
  chaveConferencia: string;
};

export function candidatosDoEdital(analise: AnaliseEdital): CandidatoImportacao[] {
  return analise.materias.flatMap((materia) =>
    materia.assuntos.map((assunto) => ({
      origem: "edital" as const,
      materia: materia.nome,
      assunto: assunto.nome,
      idOrigem: assunto.id,
    }))
  );
}

export function candidatosDoCurso(curso: CursoImportado): CandidatoImportacao[] {
  return curso.materias.filter((materia) =>
    !materia.categoria || materia.categoria === "disciplina"
  ).flatMap((materia) => materia.modulos.flatMap((modulo) =>
    modulo.aulas.map((aula) => ({
      origem: "curso" as const,
      materia: materia.nome,
      assunto: aula.nome,
      idOrigem: curso.id + ":" + materia.id + ":" + modulo.id + ":" + aula.id,
    }))
  ));
}

type AssuntoExistente = {
  materiaId: string;
  assuntoId: string;
  materia: string;
  assunto: string;
  disciplinaId: string | null;
  identificado: IdentificacaoCatalogo;
};

export function compararImportacaoConteudos(
  materiasAtuais: readonly Materia[],
  candidatos: readonly CandidatoImportacao[]
): RelatorioConciliacao {
  const existentes: AssuntoExistente[] = materiasAtuais.flatMap((materia) => {
    const disciplinaId = identificarDisciplinaCatalogo(materia.nome)?.id ?? null;
    return listarAssuntosDaMateria(materia).map((assunto) => ({
      materiaId: materia.id,
      assuntoId: assunto.id,
      materia: materia.nome,
      assunto: assunto.nome,
      disciplinaId,
      identificado: identificarConteudoCatalogo(materia.nome, assunto.nome),
    }));
  });
  const anteriores: CandidatoImportacao[] = [];
  const itens: ItemConciliacao[] = candidatos.map((candidato) => {
    const atual = identificarConteudoCatalogo(candidato.materia,candidato.assunto);
    const normNome = normalizarNomeCatalogo(candidato.assunto);
    const normMat = normalizarNomeCatalogo(candidato.materia);
    const daDisciplina = existentes.filter((x) =>
      atual.disciplinaId ? x.disciplinaId === atual.disciplinaId
        : normalizarNomeCatalogo(x.materia) === normMat
    );

    const literal = daDisciplina.find((x) => normalizarNomeCatalogo(x.assunto) === normNome);
    const referenciar = (x?: AssuntoExistente) => x ? ({
      materiaId:x.materiaId,assuntoId:x.assuntoId,materia:x.materia,assunto:x.assunto
    }) : undefined;
    const base = {
      ...candidato,
      familiaId: atual.familiaId ?? undefined,
      familiasIds: atual.familiasIds ?? (atual.familiaId ? [atual.familiaId] : []),
      familia: atual.nomeFamilia ?? undefined,
      subassuntosIds: atual.idsSubassuntos,
      confianca: atual.confianca,
    };
    const familiaEmOutraDisciplina = FAMILIAS_CATALOGO.find((familia) =>
      familia.disciplinaId !== (atual.disciplinaId ?? normMat) &&
      [familia.nome, ...familia.nomesAlternativos,
        ...familia.subassuntos.flatMap((sub) => [sub.nome, ...sub.nomesAlternativos])]
        .some((nome) => normalizarNomeCatalogo(nome) === normNome)
    );
    // Prioridade à classificação correta. Mesmo se a conta já tiver o
    // mesmo título incorretamente em Direitos Humanos, Estatuto nunca
    // deve ser considerado uma correspondência "exata" de DH.
    if (familiaEmOutraDisciplina) {
      return {
        ...base, situacao:"disciplina-divergente" as const,
        confianca:"revisar" as const, referencia:referenciar(literal),
        explicacao:"O catálogo identifica esse título em " +
          (familiaEmOutraDisciplina.disciplinaId === "estatuto-pmpe" ? "Estatuto PMPE" : "outra disciplina") +
          ". Confira a matéria antes de conservar ou criar vínculos."
      };
    }
    const duplicadaNoArquivo = anteriores.find((anterior) => {
      const outra = identificarConteudoCatalogo(anterior.materia, anterior.assunto);
      const disciplinaIgual = atual.disciplinaId
        ? outra.disciplinaId === atual.disciplinaId
        : normalizarNomeCatalogo(anterior.materia) === normMat;
      if (!disciplinaIgual) return false;
      if (normalizarNomeCatalogo(anterior.assunto) === normNome) return true;
      return atual.tipo === "subassunto" && outra.tipo === "subassunto" &&
        atual.idsSubassuntos[0] === outra.idsSubassuntos[0] &&
        atual.familiaId === outra.familiaId;
    });
    // Guardar os nomes anteriores do próprio arquivo para detectar
    // duplicações mesmo quando a conta começa sem edital e sem curso.
    anteriores.push(candidato);
    if (duplicadaNoArquivo) {
      return {
        ...base, situacao:"repetido-no-arquivo" as const,confianca:"revisar" as const,
        referencia:{materiaId:"importacao",assuntoId:duplicadaNoArquivo.idOrigem,
          materia:duplicadaNoArquivo.materia,assunto:duplicadaNoArquivo.assunto,doArquivo:true},
        explicacao:"O próprio arquivo importado repete um subassunto (ou um nome equivalente). Confirmar se são aulas distintas antes de criar novo registro."
      };
    }

    // Um título de edital pode mencionar conteúdos de DUAS OU MAIS famílias.
    // A prévia sugere quais aulas anteriores cobrem trechos do edital,
    // mas não reaproveita o ID de uma aula como se cobrisse o título todo.
    if (atual.tipo === "composto" && atual.idsSubassuntos.length > 1) {
      const candidatosCobertura = daDisciplina.map((existente) => {
        const compartilhados = atual.idsSubassuntos.filter((id) =>
          existente.identificado.idsSubassuntos.includes(id)
        );
        return { existente, compartilhados };
      }).filter((item) => item.compartilhados.length > 0)
        .sort((a,b) => b.compartilhados.length - a.compartilhados.length);
      const cobertura = new Set(candidatosCobertura.flatMap((item) => item.compartilhados));
      return {
        ...base, situacao:"titulo-composto" as const, confianca:"revisar" as const,
        referencia:referenciar(candidatosCobertura[0]?.existente ?? literal),
        explicacao: "O título do edital abrange " + atual.idsSubassuntos.length +
          " subassuntos em " + (base.familiasIds.length || 1) + " família(s). " +
          (cobertura.size > 0
            ? cobertura.size + " subassunto(s) identificados nos registros atuais. "
            : "Nenhuma cobertura específica comprovada no curso existente. ") +
          "Não copiar um único ID para todo o título; revisar o conteúdo e manter aulas/históricos independentes."
      };
    }
    if (literal) return {
      ...base, situacao:"exato" as const, confianca:"alta" as const,
      referencia:referenciar(literal),explicacao:"Mesmo nome normalizado na mesma disciplina. Reaproveitamento de ID deve ser validado pelo importador."
    };
    if (atual.tipo==="subassunto") {
      const alias = daDisciplina.find((x) =>
        x.identificado.tipo==="subassunto" &&
        x.identificado.familiaId===atual.familiaId &&
        x.identificado.idsSubassuntos[0]===atual.idsSubassuntos[0]
      );
      if (alias) return {
        ...base,situacao:"alias" as const,confianca:"revisar" as const,
        referencia:referenciar(alias),explicacao:"Nomes alternativos do MESMO subassunto no catálogo. Confirmar a vinculação do ID antes de importar."
      };
    }
    if (atual.familiaId) {
      const familia = daDisciplina.find((x) =>
        x.identificado.familiaId===atual.familiaId
      );
      if (familia) return {
        ...base,situacao: atual.tipo==="composto" || atual.tipo==="familia"
          ? "titulo-composto" as const : "mesma-familia" as const,
        confianca:"revisar" as const,referencia:referenciar(familia),
        explicacao:"Assuntos da mesma família NÃO são o mesmo subassunto. Podem compartilhar revisão, mas não se deve fundir aulas ou IDs automaticamente."
      };
    }

    // Uma mesma lei/código no grupo ERRADO não deve ser silenciosamente
    // integrada a outra matéria. Exemplo real: Estatuto em Direitos Humanos.
    const deOutraDisciplina = existentes.find((x) =>
      normalizarNomeCatalogo(x.assunto)===normNome &&
      x.disciplinaId !== (atual.disciplinaId ?? normMat)
    );
    const outraFamilia = FAMILIAS_CATALOGO.find((familia) =>
      familia.disciplinaId !== (atual.disciplinaId ?? normMat) &&
      [familia.nome,...familia.nomesAlternativos,...familia.subassuntos.flatMap((s)=>[s.nome,...s.nomesAlternativos])]
        .some((nome) => normalizarNomeCatalogo(nome)===normNome)
    );
    if (deOutraDisciplina || outraFamilia) return {
      ...base,situacao:"disciplina-divergente" as const,confianca:"revisar" as const,
      referencia:referenciar(deOutraDisciplina),
      explicacao: "O nome aparece em outra disciplina. Verificar classificação antes de criar vínculo ou transferir histórico."
    };

    const semelhante = daDisciplina
      .map((x) => ({x, score:scoreAssociacaoAssunto(candidato.assunto,x.assunto)}))
      .sort((a,b)=>b.score-a.score)[0];
    if (semelhante && semelhante.score>=0.74) return {
      ...base,situacao:"nome-semelhante" as const,confianca:"revisar" as const,
      referencia:referenciar(semelhante.x),
      explicacao:"A semelhança textual não comprova equivalência de conteúdo. Exige conferência humana."
    };

    return {
      ...base, situacao:"novo" as const, confianca:"nenhuma" as const,
      explicacao:atual.familiaId
        ? "Identificado no catálogo, mas nenhum subassunto correspondente foi encontrado no conteúdo atual."
        : "Sem correspondência segura identificada; precisa de classificação no catálogo se for um nome recorrente."
    };
  });
  const contar = (situacao:SituacaoConciliacao)=>itens.filter((i)=>i.situacao===situacao).length;
  // Chave por estado analisado, usada só para invalidar uma confirmação
  // quando a importação ou a base mudou. Nunca armazenar dados sensíveis.
  const chaveConferencia = JSON.stringify([
    existentes.map(x=>[x.materiaId,x.assuntoId,x.materia,x.assunto]),
    candidatos.map(x=>[x.idOrigem,x.materia,x.assunto]),
  ]);
  return {
    total:itens.length,
    identicos:contar("exato"),
    alias:contar("alias"),
    relacionados:contar("mesma-familia"),
    risco:contar("titulo-composto")+contar("disciplina-divergente")+contar("nome-semelhante")+contar("repetido-no-arquivo"),
    novos:contar("novo"),
    itens,
    chaveConferencia,
  };
}
