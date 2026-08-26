import assert from "node:assert/strict";
import test from "node:test";

import {
  aplicarCursosAtivosNasMaterias,
  organizarCapturaCurso,
  sincronizarProgressoCursos,
} from "../src/utils/importacaoCurso.ts";
import type { CapturaCurso, CursoImportado } from "../src/types/cursos.ts";

const captura: CapturaCurso = {
  versao: 1,
  titulo: "Curso PMPE",
  urlOrigem: "https://curso.exemplo/area",
  itens: [
    { tipo: "cabecalho", texto: "Língua Portuguesa", nivel: 2 },
    { tipo: "cabecalho", texto: "Módulo 01 - Fonologia", nivel: 3 },
    { tipo: "link", texto: "Aula 01 - Fonema e letra", href: "https://curso.exemplo/aula/1" },
    { tipo: "link", texto: "Aula 02 - Dígrafos", href: "https://curso.exemplo/aula/2" },
    { tipo: "cabecalho", texto: "RLM", nivel: 2 },
    { tipo: "cabecalho", texto: "Módulo 01 - Proposições", nivel: 3 },
    { tipo: "link", texto: "Aula 01 - Proposição simples", href: "https://curso.exemplo/aula/3" },
  ],
};

test("organiza captura em matéria, módulo, aula e preserva links", () => {
  const curso = organizarCapturaCurso(captura);
  assert.equal(curso.materias.length, 2);
  assert.equal(curso.materias[0].nome, "Língua Portuguesa");
  assert.equal(curso.materias[0].modulos[0].nome, "Fonologia");
  assert.equal(curso.materias[0].modulos[0].aulas.length, 2);
  assert.equal(curso.materias[0].modulos[0].aulas[0].url, "https://curso.exemplo/aula/1");
  assert.equal(curso.materias[1].nome, "Raciocínio Lógico e Matemática");
});

test("dois cursos ficam em módulos separados dentro da mesma matéria", () => {
  const cursoA = organizarCapturaCurso(captura, "CETEM");
  const cursoB: CursoImportado = {
    ...organizarCapturaCurso(captura, "Projeto Caveira"),
    id: "curso-caveira",
    nome: "Projeto Caveira",
  };

  const materias = aplicarCursosAtivosNasMaterias([], [cursoA, cursoB], [cursoA.id, cursoB.id]);
  const portugues = materias.find((materia) => materia.nome === "Língua Portuguesa");
  assert.ok(portugues);
  assert.equal(portugues.modulos?.length, 2);
  assert.ok(portugues.modulos?.[0].nome.startsWith("CETEM ·"));
  assert.ok(portugues.modulos?.[1].nome.startsWith("Projeto Caveira ·"));
});

test("desativar um curso remove apenas seus módulos e preserva o outro", () => {
  const cursoA = organizarCapturaCurso(captura, "CETEM");
  const cursoB = { ...organizarCapturaCurso(captura, "Caveira"), id: "curso-caveira", nome: "Caveira" };
  const combinadas = aplicarCursosAtivosNasMaterias([], [cursoA, cursoB], [cursoA.id, cursoB.id]);
  const somenteA = aplicarCursosAtivosNasMaterias(combinadas, [cursoA, cursoB], [cursoA.id]);
  const portugues = somenteA.find((materia) => materia.nome === "Língua Portuguesa");
  assert.equal(portugues?.modulos?.length, 1);
  assert.ok(portugues?.modulos?.[0].nome.startsWith("CETEM ·"));
});

test("progresso de aula do curso volta para o catálogo antes de alternar cursos", () => {
  const curso = organizarCapturaCurso(captura, "CETEM");
  const materias = aplicarCursosAtivosNasMaterias([], [curso], [curso.id]);
  const portugues = materias.find((materia) => materia.nome === "Língua Portuguesa");
  assert.ok(portugues?.modulos?.[0].assuntos[0]);
  portugues!.modulos![0].assuntos[0].concluido = true;
  portugues!.modulos![0].assuntos[0].concluidoEm = "2026-08-26T10:00:00.000Z";

  const atualizados = sincronizarProgressoCursos([curso], materias);
  assert.equal(atualizados[0].materias[0].modulos[0].aulas[0].concluida, true);
  assert.equal(atualizados[0].materias[0].modulos[0].aulas[0].concluidaEm, "2026-08-26T10:00:00.000Z");
});
