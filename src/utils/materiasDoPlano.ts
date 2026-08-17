import {
  planoPMPE,
  type MissaoPlano,
} from "../data/planoPMPE";

import type {
  Assunto,
  Materia,
  Prioridade,
} from "../types/index";

import {
  CURSO_PORTUGUES_NOME,
  cursoPortuguesModulos,
} from "../data/cursoPortugues";

import {
  criarIdModuloGeral,
  NOME_MODULO_GERAL,
} from "../services/conteudos/navegarConteudos";

function criarId(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizarTexto(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/**
 * Somente conteúdo real pode alimentar a árvore canônica de Conteúdos.
 * Revisões, redação, questões avulsas e tarefas livres continuam existindo
 * no Plano/Revisões, mas não viram assunto do edital.
 */
export function missaoGeraConteudo(
  missao: MissaoPlano
) {
  return missao.tipo === "conteudo";
}

/**
 * Detecta um par matéria/assunto que nasceu de uma missão operacional do
 * planejamento antigo. É usado pela migração para retirar falsos assuntos
 * sem apagar conteúdo personalizado legítimo do usuário.
 */
export function ehEntradaOperacionalDoPlano(
  materia: string,
  assunto: string
) {
  const materiaNormalizada = normalizarTexto(materia);
  const assuntoNormalizado = normalizarTexto(assunto);

  let existeComoConteudo = false;
  let existeComoOperacional = false;

  planoPMPE.forEach((semana) => {
    semana.dias.forEach((dia) => {
      dia.missoes.forEach((missao) => {
        if (
          normalizarTexto(missao.materia) !== materiaNormalizada ||
          normalizarTexto(missao.assunto) !== assuntoNormalizado
        ) {
          return;
        }

        if (missaoGeraConteudo(missao)) {
          existeComoConteudo = true;
        } else {
          existeComoOperacional = true;
        }
      });
    });
  });

  return existeComoOperacional && !existeComoConteudo;
}

/**
 * Identifica matérias inteiras que existiam apenas para representar revisão,
 * redação ou tarefa livre no Plano antigo.
 */
export function ehMateriaOperacionalDoPlano(
  materia: string
) {
  const materiaNormalizada = normalizarTexto(materia);
  let possuiConteudo = false;
  let possuiOperacional = false;

  planoPMPE.forEach((semana) => {
    semana.dias.forEach((dia) => {
      dia.missoes.forEach((missao) => {
        if (normalizarTexto(missao.materia) !== materiaNormalizada) {
          return;
        }

        if (missaoGeraConteudo(missao)) {
          possuiConteudo = true;
        } else {
          possuiOperacional = true;
        }
      });
    });
  });

  return possuiOperacional && !possuiConteudo;
}

function prioridadeDaMissao(
  _missao: MissaoPlano
): Prioridade {
  return "media";
}

export function gerarMateriasDoPlano(): Materia[] {
  const mapa = new Map<
    string,
    {
      nome: string;
      assuntos: Map<string, Assunto>;
    }
  >();

  planoPMPE.forEach((semana) => {
    semana.dias.forEach((dia) => {
      dia.missoes.forEach((missao) => {
        if (
          !missaoGeraConteudo(missao) ||
          missao.materia === CURSO_PORTUGUES_NOME
        ) {
          return;
        }

        const chaveMateria = criarId(
          missao.materia
        );

        if (!mapa.has(chaveMateria)) {
          mapa.set(chaveMateria, {
            nome: missao.materia,
            assuntos: new Map<
              string,
              Assunto
            >(),
          });
        }

        const materia = mapa.get(
          chaveMateria
        );

        if (!materia) return;

        const chaveAssunto = criarId(
          `${missao.materia}-${missao.assunto}`
        );

        if (
          !materia.assuntos.has(
            chaveAssunto
          )
        ) {
          materia.assuntos.set(
            chaveAssunto,
            {
              id: chaveAssunto,
              nome: missao.assunto,
              concluido: false,
              prioridade:
                prioridadeDaMissao(
                  missao
                ),
              aula:
                missao.urlAula,
              questoes:
                missao.urlQuestoes,
            }
          );
        }
      });
    });
  });

  const portuguesId = criarId(CURSO_PORTUGUES_NOME);
  const assuntosPortugues = cursoPortuguesModulos.flatMap((modulo) => modulo.assuntos);

  const materias = Array.from(
    mapa.entries()
  )
    .map(([id, dados]) => {
      const assuntos = Array.from(
        dados.assuntos.values()
      ).sort((a, b) =>
        a.nome.localeCompare(
          b.nome,
          "pt-BR"
        )
      );

      return {
        id,
        nome: dados.nome,
        modulos: [
          {
            id: criarIdModuloGeral(id),
            nome: NOME_MODULO_GERAL,
            ordem: 0,
            assuntos,
          },
        ],
        assuntos,
      };
    })
    .sort((a, b) =>
      a.nome.localeCompare(
        b.nome,
        "pt-BR"
      )
    );

  materias.push({
    id: portuguesId,
    nome: CURSO_PORTUGUES_NOME,
    modulos: cursoPortuguesModulos.map((modulo) => ({
      ...modulo,
      assuntos: modulo.assuntos.map((assunto) => ({ ...assunto })),
    })),
    assuntos: assuntosPortugues.map((assunto) => ({ ...assunto })),
  });

  return materias.sort((a, b) =>
    a.nome.localeCompare(b.nome, "pt-BR")
  );
}
