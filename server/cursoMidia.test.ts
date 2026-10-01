import assert from "node:assert/strict";
import test from "node:test";

import { normalizarAnaliseCursoMidia } from "./cursoMidia.ts";

test("normaliza matérias, módulos e aulas vindos de prints/PDF", () => {
  const analise = normalizarAnaliseCursoMidia({
    nomeCurso: "Preparatório PMPE",
    materias: [
      {
        nome: "Português",
        categoria: "disciplina",
        modulos: [
          {
            nome: "Módulo 01",
            aulas: [
              { nome: "Aula 01 - Fonologia" },
              { nome: "Aula 02 - Crase", url: "https://curso.test/crase" },
            ],
          },
        ],
      },
      {
        nome: "Mentoria",
        categoria: "complementar",
        modulos: [
          {
            nome: "Encontros",
            aulas: [{ nome: "Encontro 01" }],
          },
        ],
      },
    ],
    avisos: ["Links não estavam visíveis em todas as telas."],
  });

  assert.equal(analise.nomeCurso, "Preparatório PMPE");
  assert.equal(analise.materias.length, 2);
  assert.equal(analise.materias[0].modulos[0].aulas.length, 2);
  assert.equal(
    analise.materias[0].modulos[0].aulas[1].url,
    "https://curso.test/crase"
  );
  assert.equal(analise.materias[1].categoria, "complementar");
});

test("remove URLs inválidas e repetições de prints sobrepostos", () => {
  const analise = normalizarAnaliseCursoMidia({
    nomeCurso: "Curso",
    materias: [
      {
        nome: "RLM",
        categoria: "disciplina",
        modulos: [
          {
            nome: "Proposições",
            aulas: [
              { nome: "Aula 01", url: "javascript:alert(1)" },
              { nome: "Aula 01", url: "javascript:alert(1)" },
              { nome: "Aula 02", url: "https://curso.test/aula-2" },
            ],
          },
        ],
      },
      {
        nome: "RLM",
        categoria: "disciplina",
        modulos: [
          {
            nome: "Proposições",
            aulas: [
              { nome: "Aula 02", url: "https://curso.test/aula-2" },
              { nome: "Aula 03" },
            ],
          },
        ],
      },
    ],
    avisos: [],
  });

  assert.equal(analise.materias.length, 1);
  assert.deepEqual(
    analise.materias[0].modulos[0].aulas.map((aula) => [
      aula.nome,
      aula.url ?? null,
    ]),
    [
      ["Aula 01", null],
      ["Aula 02", "https://curso.test/aula-2"],
      ["Aula 03", null],
    ]
  );
});

test("não aceita análise sem nenhuma aula identificada", () => {
  assert.throws(
    () =>
      normalizarAnaliseCursoMidia({
        nomeCurso: "Curso vazio",
        materias: [
          {
            nome: "Português",
            categoria: "disciplina",
            modulos: [{ nome: "Geral", aulas: [] }],
          },
        ],
      }),
    /Não foi possível identificar matérias e aulas/
  );
});
