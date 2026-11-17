import assert from "node:assert/strict";
import test from "node:test";
import type { Revisao } from "../src/types/index.ts";
import {
  GRUPOS_INTEGRADOS,
  identificarGrupoIntegrado,
  idsTopicosReconhecidos,
  topicosPresentesNoBloco,
  revisoesDaFamilia,
} from "../src/utils/catalogoRevisoesIntegradas.ts";
import { agruparRevisoesParaEstudo } from "../src/utils/blocosRevisoes.ts";

function entrada(
  id: string, materia: string, assunto: string,
  etapa: Revisao["etapa"] = 3, data = "2026-11-17T15:00:00.000Z"
): Revisao {
  return {
    id, materia, assunto, etapa,
    materiaId: id + "-materia", assuntoId: id + "-assunto",
    dataCriacao: "2026-11-01T15:00:00.000Z",
    dataPrevista: data, concluida: false,
  };
}

test("catálogo piloto possui três grupos e subtópicos estáveis", () => {
  assert.deepEqual(GRUPOS_INTEGRADOS.map(g => g.id), [
    "logica-proposicional", "fonologia", "seguranca-informacao",
  ]);
  for (const grupo of GRUPOS_INTEGRADOS) {
    assert.ok(grupo.topicos.length >= 3);
    assert.equal(new Set(grupo.topicos.map(t => t.id)).size, grupo.topicos.length);
  }
});

test("RLM: equivalências, tautologia e tabelas-verdade pertencem ao mesmo assunto principal, mas seguem subtópicos diferentes", () => {
  const entradas = [
    entrada("1", "RLM", "Conectivos, tabelas-verdade e negação", 5),
    entrada("2", "Raciocínio Lógico e Matemática", "Equivalências lógicas", 4),
    entrada("3", "RLM", "Tautologias, Contradições e contingências", 1),
  ];
  assert.deepEqual(idsTopicosReconhecidos(entradas[0]), ["conectivos", "tabelas", "negacoes"]);
  assert.deepEqual(idsTopicosReconhecidos(entradas[1]), ["equivalencias"]);
  assert.deepEqual(idsTopicosReconhecidos(entradas[2]), ["tautologias"]);
  assert.equal(agruparRevisoesParaEstudo(entradas).length, 1);
  assert.deepEqual(topicosPresentesNoBloco(entradas).map(t => t.id), [
    "conectivos", "tabelas", "negacoes", "equivalencias", "tautologias",
  ]);
  assert.deepEqual(entradas.map(e => e.etapa), [5, 4, 1]);
  assert.ok(entradas.every(e => !e.concluida));
});

test("Português: fonemas, dígrafos, encontros vocálicos e sílabas são agrupáveis, mas orações, crase e ortografia não", () => {
  const entradas = [
    entrada("1", "Português", "Fonemas, letras e sons da fala"),
    entrada("2", "Língua Portuguesa", "Dígrafo e encontro consonantal"),
    entrada("3", "Português", "Encontros vocálicos"),
    entrada("4", "Português", "Sílaba"),
  ];
  assert.equal(agruparRevisoesParaEstudo(entradas).length, 1);
  assert.deepEqual(idsTopicosReconhecidos(entradas[1]), ["digrafos", "encontros-consonantais"]);
  assert.deepEqual(topicosPresentesNoBloco(entradas).map(x => x.id), [
    "fonemas", "digrafos", "encontros-consonantais", "encontros-vocalicos", "silabas",
  ]);
  for (const assunto of ["Crase", "Ortografia", "Orações subordinadas adverbiais", "Acentuação gráfica"]) {
    assert.equal(identificarGrupoIntegrado(entrada("x", "Língua Portuguesa", assunto)), null);
  }
});

test("Informática: proteção e segurança 1–4, 5–9 e PDF compartilham o mapa sem mudar o calendário", () => {
  const entradas = [
    entrada("1", "Informática", "Conceitos de proteção e segurança - aulas 1 a 4"),
    entrada("2", "Informática", "Conceitos de proteção e segurança - aulas 5 a 9", 5, "2026-12-01T15:00:00.000Z"),
    entrada("3", "Informática", "Segurança da informação (PDF)", 4, "2026-12-02T15:00:00.000Z"),
  ];
  assert.deepEqual(entradas.map(x => idsTopicosReconhecidos(x)), [
    ["aulas-1-4"], ["aulas-5-9"], ["material-pdf"],
  ]);
  assert.equal(revisoesDaFamilia(entradas, "seguranca-informacao").length, 3);
  assert.equal(agruparRevisoesParaEstudo(entradas).length, 3);
  assert.deepEqual(entradas.map(x => x.dataPrevista), [
    "2026-11-17T15:00:00.000Z", "2026-12-01T15:00:00.000Z", "2026-12-02T15:00:00.000Z",
  ]);
  assert.equal(identificarGrupoIntegrado(entrada("outro", "Informática", "Internet, Intranet, Extranet e VPN")), null);
});

test("nome idêntico fora da disciplina nunca gera agrupamento falso", () => {
  assert.equal(identificarGrupoIntegrado(entrada("x", "História", "Tabela verdade")), null);
  assert.equal(identificarGrupoIntegrado(entrada("x", "Direitos Humanos", "Conectivos")), null);
  assert.equal(identificarGrupoIntegrado(entrada("x", "Legislação Extravagante", "Proteção e segurança")), null);
  assert.equal(identificarGrupoIntegrado(entrada("x", "RLM", "Exercícios - Lógica argumentativa")), null);
});
