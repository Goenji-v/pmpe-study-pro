import assert from "node:assert/strict";
import test from "node:test";

import type { Materia } from "../src/types/index.ts";
import {
  listarModulosDaMateria,
} from "../src/services/conteudos/navegarConteudos.ts";
import {
  atualizarAssuntoNaArvore,
  migrarMateriasParaModulos,
} from "../src/services/conteudos/migrarEstruturaConteudos.ts";
import {
  criarPlanoCalendario,
} from "../src/utils/planoCalendario.ts";

function materiaCurso(): Materia {
  const aula = {
    id: "curso:rdc:aula:aula-direitos-politicos",
    nome: "Aula",
    concluido: false,
    prioridade: "media" as const,
    aula: "https://rdc.test/courses/pmpe-direito-constitucional/lessons/aula-28/",
    aulas: [
      {
        id: "curso:rdc:aula:aula-direitos-politicos:link",
        nome: "Aula",
        url: "https://rdc.test/courses/pmpe-direito-constitucional/lessons/aula-28/",
        ordem: 1,
        concluida: false,
      },
    ],
  };
  const pdf = {
    id: "curso:rdc:aula:pdf-direitos-politicos",
    nome: "PDF",
    concluido: false,
    prioridade: "media" as const,
    aula: "https://rdc.test/courses/pmpe-direito-constitucional/lessons/pdf-28/",
    aulas: [
      {
        id: "curso:rdc:aula:pdf-direitos-politicos:link",
        nome: "PDF",
        url: "https://rdc.test/courses/pmpe-direito-constitucional/lessons/pdf-28/",
        ordem: 1,
        concluida: false,
      },
    ],
  };
  const sociais = {
    id: "curso:rdc:aula:aula-direitos-sociais",
    nome: "Aula",
    concluido: false,
    prioridade: "media" as const,
    aula: "https://rdc.test/courses/pmpe-direito-constitucional/lessons/aula-sociais/",
    aulas: [
      {
        id: "curso:rdc:aula:aula-direitos-sociais:link",
        nome: "Aula",
        url: "https://rdc.test/courses/pmpe-direito-constitucional/lessons/aula-sociais/",
        ordem: 1,
        concluida: false,
      },
    ],
  };

  return {
    id: "curso-materia-direito-constitucional",
    nome: "Direito Constitucional",
    modulos: [
      {
        id: "curso:rdc:modulo:direitos-politicos",
        nome: "Módulo PMPE – Área de Membros | RDC · Direitos Políticos",
        ordem: 1,
        assuntos: [aula, pdf],
      },
      {
        id: "curso:rdc:modulo:direitos-sociais",
        nome: "Módulo PMPE – Área de Membros | RDC · Direitos Sociais",
        ordem: 2,
        assuntos: [sociais],
      },
    ],
    assuntos: [aula, pdf, sociais],
  };
}

test("curso com uma origem vira Geral -> assunto -> aula/PDF na navegação", () => {
  const materia = materiaCurso();
  const modulos = listarModulosDaMateria(materia);

  assert.equal(modulos.length, 1);
  assert.equal(modulos[0].nome, "Geral");
  assert.deepEqual(
    modulos[0].assuntos.map((assunto) => assunto.nome),
    ["Direitos Políticos", "Direitos Sociais"]
  );
  assert.deepEqual(
    modulos[0].assuntos[0].aulas?.map((aula) => aula.nome),
    ["Aula", "PDF"]
  );
});

test("conclusão de uma aula da visão agrupada volta para o item original", () => {
  const materia = materiaCurso();
  const modulo = listarModulosDaMateria(materia)[0];
  const assunto = modulo.assuntos[0];
  const primeiraAula = assunto.aulas?.[0];
  assert.ok(primeiraAula);

  const atualizada = atualizarAssuntoNaArvore(
    materia,
    assunto.id,
    (atual) => ({
      ...atual,
      aulas: atual.aulas?.map((aula) =>
        aula.id === primeiraAula.id
          ? { ...aula, concluida: true, concluidaEm: "2026-09-05T00:00:00.000Z" }
          : aula
      ),
    }),
    modulo.id
  );

  const bruto = atualizada.modulos?.find(
    (item) => item.id === "curso:rdc:modulo:direitos-politicos"
  );
  assert.ok(bruto);
  assert.equal(bruto.assuntos[0].concluido, true);
  assert.equal(bruto.assuntos[1].concluido, false);
});

test("conta sem plano padrão cria cronograma com os conteúdos importados", () => {
  migrarMateriasParaModulos([materiaCurso()]);
  const plano = criarPlanoCalendario(1, false);

  assert.ok(plano.length > 0);
  const missoes = plano.flatMap((semana) =>
    semana.dias.flatMap((dia) => dia.missoes)
  );
  assert.equal(missoes.length, 2);
  assert.deepEqual(
    missoes.map((missao) => [missao.materia, missao.assunto]),
    [
      ["Direito Constitucional", "Direitos Políticos"],
      ["Direito Constitucional", "Direitos Sociais"],
    ]
  );
  assert.ok(missoes.every((missao) => missao.conteudo?.assuntoId));
});
