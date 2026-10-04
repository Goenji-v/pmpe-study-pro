import assert from "node:assert/strict";
import test from "node:test";

import type { Materia } from "../src/types/index.ts";
import {
  materiaTemCursoImportado,
  moduloGerenciadoPorCurso,
  prepararMateriaParaConteudos,
} from "../src/pages/Estudos/estudosHierarquia.ts";

function materiaImportada(): Materia {
  return {
    id: "direito-constitucional",
    nome: "Direito Constitucional",
    assuntos: [],
    modulos: [
      {
        id: "curso:rdc:modulo:principios",
        nome: "RDC · Dos princípios fundamentais",
        ordem: 1,
        assuntos: [
          {
            id: "curso:rdc:aula:principios-aula",
            nome: "Aula",
            concluido: false,
            prioridade: "media",
            aula: "https://curso.test/principios/aula",
            aulas: [{ id: "link-aula", nome: "Aula", url: "https://curso.test/principios/aula", ordem: 1, concluida: false }],
          },
          {
            id: "curso:rdc:aula:principios-pdf",
            nome: "PDF",
            concluido: false,
            prioridade: "media",
            aula: "https://curso.test/principios/pdf",
            aulas: [{ id: "link-pdf", nome: "PDF", url: "https://curso.test/principios/pdf", ordem: 1, concluida: false }],
          },
        ],
      },
      {
        id: "curso:rdc:modulo:sociais",
        nome: "RDC · Direitos Sociais",
        ordem: 2,
        assuntos: [
          {
            id: "curso:rdc:aula:sociais-aula",
            nome: "Aula",
            concluido: false,
            prioridade: "media",
            aula: "https://curso.test/sociais/aula",
            aulas: [{ id: "link-social", nome: "Aula", url: "https://curso.test/sociais/aula", ordem: 1, concluida: false }],
          },
        ],
      },
    ],
  };
}

test("Conteúdos usa a mesma visão da Central: Geral → assuntos → aulas", () => {
  const exibida = prepararMateriaParaConteudos(materiaImportada());
  assert.equal(exibida.modulos?.length, 1);
  assert.equal(exibida.modulos?.[0].nome, "Geral");
  assert.equal(moduloGerenciadoPorCurso(exibida.modulos![0]), true);
  assert.equal(materiaTemCursoImportado(exibida), true);
  assert.deepEqual(
    exibida.modulos?.[0].assuntos.map((assunto) => assunto.nome),
    ["Dos princípios fundamentais", "Direitos Sociais"]
  );
  assert.deepEqual(
    exibida.modulos?.[0].assuntos[0].aulas?.map((aula) => aula.nome),
    ["Aula", "PDF"]
  );
});

test("matéria comum mantém sua estrutura editável", () => {
  const comum: Materia = {
    id: "manual",
    nome: "Matéria manual",
    assuntos: [],
    modulos: [{ id: "manual-geral", nome: "Geral", ordem: 0, assuntos: [] }],
  };
  const exibida = prepararMateriaParaConteudos(comum);
  assert.equal(exibida.modulos?.[0].id, "manual-geral");
  assert.equal(materiaTemCursoImportado(exibida), false);
});


test("módulo que apenas repete o nome da matéria exibe cada aula como assunto", () => {
  const constitucional: Materia = {
    id: "direito-constitucional",
    nome: "Direito Constitucional",
    assuntos: [],
    modulos: [
      {
        id: "curso:rdc:modulo:constitucional",
        nome: "RDC · Direito Constitucional",
        ordem: 1,
        assuntos: [
          {
            id: "curso:rdc:aula:vida",
            nome: "Direito a vida",
            concluido: false,
            prioridade: "media",
            aulas: [
              {
                id: "vida-link",
                nome: "Direito a vida",
                url: "https://curso.test/vida",
                ordem: 1,
                concluida: false,
              },
            ],
          },
          {
            id: "curso:rdc:aula:igualdade",
            nome: "Direito a Igualdade",
            concluido: false,
            prioridade: "media",
            aulas: [
              {
                id: "igualdade-link",
                nome: "Direito a Igualdade",
                url: "https://curso.test/igualdade",
                ordem: 1,
                concluida: false,
              },
            ],
          },
        ],
      },
    ],
  };

  const exibida = prepararMateriaParaConteudos(constitucional);
  assert.equal(exibida.modulos?.length, 1);
  assert.equal(exibida.modulos?.[0].nome, "Geral");
  assert.deepEqual(
    exibida.modulos?.[0].assuntos.map((assunto) => assunto.nome),
    ["Direito a vida", "Direito a Igualdade"]
  );
  assert.deepEqual(
    exibida.modulos?.[0].assuntos.map((assunto) => assunto.aulas?.length),
    [1, 1]
  );
});
