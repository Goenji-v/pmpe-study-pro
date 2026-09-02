import assert from "node:assert/strict";
import test from "node:test";

import { organizarCapturaCurso } from "../src/utils/importacaoCurso.ts";
import type { CapturaCurso } from "../src/types/cursos.ts";

test("capturador v2 ignora menu e separa módulo de aulas reais", () => {
  const captura: CapturaCurso = {
    versao: 2,
    titulo: "Português PMPE",
    urlOrigem: "https://curso.exemplo/courses/portugues",
    itens: [
      { tipo: "link", texto: "Edital atual", href: "https://curso.exemplo/edital", area: "menu" },
      { tipo: "link", texto: "Anotações", href: "https://curso.exemplo/anotacoes", area: "menu" },
      { tipo: "link", texto: "Português", href: "https://curso.exemplo/courses/portugues", area: "menu" },
      { tipo: "cabecalho", texto: "Língua Portuguesa", nivel: 2, area: "conteudo" },
      { tipo: "cabecalho", texto: "Morfologia", nivel: 3, area: "conteudo", containerKey: "module-morfologia" },
      { tipo: "link", texto: "Aula 01 - Visão geral", href: "https://curso.exemplo/courses/portugues/lessons/morfologia-visao-geral", area: "conteudo", containerKey: "module-morfologia" },
      { tipo: "link", texto: "Aula 02 - Substantivo", href: "https://curso.exemplo/courses/portugues/lessons/substantivo", area: "conteudo", containerKey: "module-morfologia" },
      { tipo: "cabecalho", texto: "GRUPO LIVE AO VIVO QUINTA FEIRA", nivel: 3, area: "conteudo" },
    ],
  };

  const curso = organizarCapturaCurso(captura);
  assert.equal(curso.materias.length, 1);
  assert.equal(curso.materias[0].nome, "Língua Portuguesa");
  assert.equal(curso.materias[0].modulos.length, 1);
  assert.equal(curso.materias[0].modulos[0].nome, "Morfologia");
  assert.deepEqual(curso.materias[0].modulos[0].aulas.map((a) => a.nome), [
    "Aula 01 - Visão geral",
    "Aula 02 - Substantivo",
  ]);
});

test("material PDF fica vinculado à aula e não vira outra aula", () => {
  const captura: CapturaCurso = {
    versao: 2,
    titulo: "Português PMPE",
    itens: [
      { tipo: "cabecalho", texto: "Língua Portuguesa", nivel: 2, area: "conteudo" },
      { tipo: "cabecalho", texto: "Módulo 01 - Fonologia", nivel: 3, area: "conteudo" },
      { tipo: "link", texto: "Aula 01 - Fonema e letra", href: "https://curso.exemplo/lessons/fonema-letra", area: "conteudo" },
      { tipo: "link", texto: "PDF da aula", href: "https://curso.exemplo/materiais/fonema-letra.pdf", area: "conteudo" },
    ],
  };

  const curso = organizarCapturaCurso(captura);
  const aulas = curso.materias[0].modulos[0].aulas;
  assert.equal(aulas.length, 1);
  assert.equal(aulas[0].nome, "Aula 01 - Fonema e letra");
  assert.equal(aulas[0].materiais?.length, 1);
  assert.equal(aulas[0].materiais?.[0].tipo, "pdf");
  assert.equal(aulas[0].materiais?.[0].url, "https://curso.exemplo/materiais/fonema-letra.pdf");
});
