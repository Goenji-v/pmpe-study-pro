import assert from "node:assert/strict";
import test from "node:test";

import type { CursoImportado } from "../src/types/cursos";
import {
  aplicarCursosAtivosNasMaterias,
  sincronizarProgressoCursos,
} from "../src/utils/importacaoCurso";

function cursoExemplo(): CursoImportado {
  return {
    id: "curso-pmpe",
    nome: "Curso PMPE",
    origem: "texto",
    criadoEm: "2026-09-30T00:00:00.000Z",
    atualizadoEm: "2026-09-30T00:00:00.000Z",
    materias: [
      {
        id: "materia-portugues",
        nome: "Português",
        ordem: 1,
        categoria: "disciplina",
        modulos: [
          {
            id: "modulo-gramatica",
            nome: "Gramática",
            ordem: 1,
            aulas: [
              {
                id: "aula-crase",
                nome: "Crase",
                url: "https://curso.test/crase",
                ordem: 1,
              },
            ],
          },
        ],
      },
      {
        id: "materia-mentoria",
        nome: "Mentoria",
        ordem: 2,
        categoria: "complementar",
        modulos: [
          {
            id: "modulo-mentoria",
            nome: "Encontros",
            ordem: 1,
            aulas: [
              {
                id: "aula-encontro",
                nome: "Encontro 01",
                ordem: 1,
              },
            ],
          },
        ],
      },
    ],
  };
}

test("curso ativo vira trilha Matéria -> Módulo -> Aula em Conteúdos", () => {
  const curso = cursoExemplo();
  const materias = aplicarCursosAtivosNasMaterias(
    [],
    [curso],
    [curso.id]
  );

  assert.equal(materias.length, 1);
  assert.equal(materias[0].nome, "Português");

  const modulo = materias[0].modulos?.[0];
  assert.ok(modulo);
  assert.equal(modulo.id, "curso:curso-pmpe:modulo:modulo-gramatica");
  assert.equal(modulo.nome, "Curso PMPE · Gramática");

  const assunto = modulo.assuntos[0];
  assert.equal(assunto.id, "curso:curso-pmpe:aula:aula-crase");
  assert.equal(assunto.nome, "Crase");
  assert.equal(assunto.aulas?.[0]?.url, "https://curso.test/crase");
});

test("progresso da trilha volta para o curso importado", () => {
  const curso = cursoExemplo();
  const materias = aplicarCursosAtivosNasMaterias(
    [],
    [curso],
    [curso.id]
  );

  const modulo = materias[0].modulos?.[0];
  assert.ok(modulo);

  const materiasComProgresso = [
    {
      ...materias[0],
      modulos: [
        {
          ...modulo,
          assuntos: modulo.assuntos.map((assunto) => ({
            ...assunto,
            concluido: true,
            concluidoEm: "2026-09-30T20:00:00.000Z",
            aulas: assunto.aulas?.map((aula) => ({
              ...aula,
              concluida: true,
              concluidaEm: "2026-09-30T20:00:00.000Z",
            })),
          })),
        },
      ],
      assuntos: modulo.assuntos.map((assunto) => ({
        ...assunto,
        concluido: true,
      })),
    },
  ];

  const sincronizado =
    sincronizarProgressoCursos([curso], materiasComProgresso)[0];

  assert.equal(
    sincronizado.materias[0].modulos[0].aulas[0].concluida,
    true
  );
});
