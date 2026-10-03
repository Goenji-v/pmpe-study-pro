import type { Materia } from "../types";
import type { CursoImportado } from "../types/cursos";
import type {
  AnaliseEdital,
  AssuntoEdital,
  MateriaEdital,
} from "../types/editalInteligente";
import {
  listarAssuntosDaMateria,
} from "../services/conteudos/navegarConteudos";
import {
  materiasEquivalentes,
  scoreAssociacaoAssunto,
  unificarGradeEditalCursos,
} from "./uniaoGradeEstudos";

export type StatusMigracaoAssunto =
  | "mantido"
  | "renomeado"
  | "novo"
  | "removido"
  | "ambiguo";

export type ItemMigracaoAssunto = {
  status: StatusMigracaoAssunto;
  materiaAnterior?: string;
  materiaNova: string;
  assuntoAnterior?: string;
  assuntoNovo: string;
  assuntoCanonicoId?: string;
  editalAnteriorId?: string;
  editalNovoId?: string;
  score?: number;
  candidatos?: Array<{
    id: string;
    nome: string;
    score: number;
  }>;
};

export type RelatorioMigracaoEdital = {
  criadoEm: string;
  totalAnterior: number;
  totalNovo: number;
  mantidos: number;
  renomeados: number;
  novos: number;
  removidos: number;
  ambiguos: number;
  itens: ItemMigracaoAssunto[];
  seguroParaAplicar: boolean;
  avisos: string[];
};

export type PlanoMigracaoEdital = {
  analiseMigrada: AnaliseEdital;
  materiasMigradas: Materia[];
  relatorio: RelatorioMigracaoEdital;
};

type OpcoesPlanejarMigracao = {
  materiasAtuais: Materia[];
  editalAnterior?: AnaliseEdital;
  novoEdital: AnaliseEdital;
  cursos: CursoImportado[];
  cursosAtivosIds: string[];
};

export function planejarMigracaoEdital({
  materiasAtuais,
  editalAnterior,
  novoEdital,
  cursos,
  cursosAtivosIds,
}: OpcoesPlanejarMigracao): PlanoMigracaoEdital {
  const itens: ItemMigracaoAssunto[] = [];
  const canonicosUsados = new Set<string>();

  const materiasMigradasDaAnalise: MateriaEdital[] =
    novoEdital.materias.map((materiaNova) => {
      const materiaAtual = encontrarMateriaAtual(
        materiasAtuais,
        materiaNova.nome
      );

      const assuntosAtuais = materiaAtual
        ? listarAssuntosDaMateria(materiaAtual)
        : [];

      const assuntos: AssuntoEdital[] =
        materiaNova.assuntos.map((assuntoNovo) => {
          const candidatos = assuntosAtuais
            .map((assunto) => ({
              assunto,
              score: scoreAssociacaoAssunto(
                assuntoNovo.nome,
                assunto.nome
              ),
            }))
            .sort((a, b) => b.score - a.score);

          const primeiro = candidatos[0];
          const segundo = candidatos[1];

          const forte =
            primeiro &&
            primeiro.score >= 0.9 &&
            (
              primeiro.score >= 0.96 ||
              !segundo ||
              primeiro.score - segundo.score >= 0.08
            ) &&
            !canonicosUsados.has(primeiro.assunto.id);

          if (forte && primeiro) {
            canonicosUsados.add(primeiro.assunto.id);

            const nomeIgual =
              normalizar(assuntoNovo.nome) ===
              normalizar(primeiro.assunto.nome);

            itens.push({
              status: nomeIgual ? "mantido" : "renomeado",
              materiaAnterior: materiaAtual?.nome,
              materiaNova: materiaNova.nome,
              assuntoAnterior: primeiro.assunto.nome,
              assuntoNovo: assuntoNovo.nome,
              assuntoCanonicoId: primeiro.assunto.id,
              editalAnteriorId:
                primeiro.assunto.origemEditalId,
              editalNovoId: assuntoNovo.id,
              score: primeiro.score,
            });

            return {
              ...assuntoNovo,
              conteudoCanonicoId: primeiro.assunto.id,
            };
          }

          const ambiguo =
            primeiro &&
            primeiro.score >= 0.74;

          if (ambiguo && primeiro) {
            itens.push({
              status: "ambiguo",
              materiaAnterior: materiaAtual?.nome,
              materiaNova: materiaNova.nome,
              assuntoAnterior: primeiro.assunto.nome,
              assuntoNovo: assuntoNovo.nome,
              editalNovoId: assuntoNovo.id,
              score: primeiro.score,
              candidatos: candidatos
                .slice(0, 3)
                .filter((item) => item.score >= 0.55)
                .map((item) => ({
                  id: item.assunto.id,
                  nome: item.assunto.nome,
                  score: item.score,
                })),
            });
          } else {
            itens.push({
              status: "novo",
              materiaNova: materiaNova.nome,
              assuntoNovo: assuntoNovo.nome,
              editalNovoId: assuntoNovo.id,
            });
          }

          return assuntoNovo;
        });

      return {
        ...materiaNova,
        conteudoCanonicoId: materiaAtual?.id,
        assuntos,
      };
    });

  const analiseMigrada: AnaliseEdital = {
    ...novoEdital,
    materias: materiasMigradasDaAnalise,
  };

  let materiasMigradas = unificarGradeEditalCursos({
    materiasAtuais,
    analiseEdital: analiseMigrada,
    cursos,
    cursosAtivosIds,
  });

  const idsAtivos = new Set(
    analiseMigrada.materias.flatMap((materia) =>
      materia.assuntos
        .map((assunto) => assunto.conteudoCanonicoId)
        .filter((id): id is string => Boolean(id))
    )
  );

  const assuntosAnteriores =
    editalAnterior?.materias.flatMap((materia) =>
      materia.assuntos.map((assunto) => ({
        materia,
        assunto,
      }))
    ) ?? [];

  for (const anterior of assuntosAnteriores) {
    const materiaAtual = encontrarMateriaAtual(
      materiasAtuais,
      anterior.materia.nome
    );
    const assuntoAtual = materiaAtual
      ? localizarAssuntoDoEditalAnterior(
          materiaAtual,
          anterior.assunto.id,
          anterior.assunto.nome
        )
      : undefined;

    if (
      assuntoAtual &&
      !idsAtivos.has(assuntoAtual.id) &&
      !canonicosUsados.has(assuntoAtual.id)
    ) {
      itens.push({
        status: "removido",
        materiaAnterior: anterior.materia.nome,
        materiaNova: anterior.materia.nome,
        assuntoAnterior: assuntoAtual.nome,
        assuntoNovo: assuntoAtual.nome,
        assuntoCanonicoId: assuntoAtual.id,
        editalAnteriorId: anterior.assunto.id,
      });
    }
  }

  const idsRemovidos = new Set(
    itens
      .filter((item) => item.status === "removido")
      .map((item) => item.assuntoCanonicoId)
      .filter((id): id is string => Boolean(id))
  );

  materiasMigradas = materiasMigradas.map((materia) => {
    const modulos = (materia.modulos ?? []).map((modulo) => ({
      ...modulo,
      assuntos: modulo.assuntos.map((assunto) =>
        idsRemovidos.has(assunto.id)
          ? {
              ...assunto,
              foraDoEditalAtual: true,
              complementarAoEdital: true,
              prioridade: "baixa" as const,
            }
          : assunto
      ),
    }));

    return {
      ...materia,
      modulos,
      assuntos: modulos.length > 0
        ? modulos.flatMap((modulo) => modulo.assuntos)
        : materia.assuntos.map((assunto) =>
            idsRemovidos.has(assunto.id)
              ? {
                  ...assunto,
                  foraDoEditalAtual: true,
                  complementarAoEdital: true,
                  prioridade: "baixa" as const,
                }
              : assunto
          ),
    };
  });

  const relatorio = criarRelatorio(
    itens,
    assuntosAnteriores.length,
    novoEdital.materias.reduce(
      (total, materia) => total + materia.assuntos.length,
      0
    )
  );

  return {
    analiseMigrada,
    materiasMigradas,
    relatorio,
  };
}

function criarRelatorio(
  itens: ItemMigracaoAssunto[],
  totalAnterior: number,
  totalNovo: number
): RelatorioMigracaoEdital {
  const contar = (status: StatusMigracaoAssunto) =>
    itens.filter((item) => item.status === status).length;

  const ambiguos = contar("ambiguo");
  const avisos: string[] = [];

  if (ambiguos > 0) {
    avisos.push(
      `${ambiguos} associação(ões) ficaram ambíguas. O Study Pro preservará o conteúdo antigo e criará o novo separadamente até revisão.`
    );
  }

  const removidos = contar("removido");
  if (removidos > 0) {
    avisos.push(
      `${removidos} conteúdo(s) saíram do edital novo, mas serão preservados como histórico/complemento.`
    );
  }

  return {
    criadoEm: new Date().toISOString(),
    totalAnterior,
    totalNovo,
    mantidos: contar("mantido"),
    renomeados: contar("renomeado"),
    novos: contar("novo"),
    removidos,
    ambiguos,
    itens,
    seguroParaAplicar: true,
    avisos,
  };
}

function encontrarMateriaAtual(
  materias: Materia[],
  nome: string
) {
  return materias.find((materia) =>
    materiasEquivalentes(materia.nome, nome)
  );
}

function localizarAssuntoDoEditalAnterior(
  materia: Materia,
  editalId: string,
  nome: string
) {
  const assuntos = listarAssuntosDaMateria(materia);
  return assuntos.find(
    (assunto) =>
      assunto.origemEditalId === editalId ||
      assunto.referenciasEdital?.includes(editalId) ||
      assunto.id === editalId
  ) ?? assuntos
    .map((assunto) => ({
      assunto,
      score: scoreAssociacaoAssunto(nome, assunto.nome),
    }))
    .sort((a, b) => b.score - a.score)
    .find((item) => item.score >= 0.9)
    ?.assunto;
}

function normalizar(texto: string) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}
