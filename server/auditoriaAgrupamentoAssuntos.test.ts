import test from "node:test";
import assert from "node:assert/strict";
import { agruparAssuntosParaExibicao, auditarGruposDePartes, identificarParte, sugerirModuloPortugues } from "../src/utils/auditoriaAgrupamentoAssuntos";
import type { Materia } from "../src/types";

test("reconhece as partes sem confundir assuntos normais", () => {
  assert.deepEqual(identificarParte("Word - Parte III: Formatos"), { titulo: "Word", parte: 3 });
  assert.deepEqual(identificarParte("Redes de computadores – Parte 5"), { titulo: "Redes de computadores", parte: 5 });
  assert.equal(identificarParte("Uso do sinal grave indicativo de crase"), null);
});
test("propoe agrupamento sem excluir, alterar IDs, ou marcar conclusao", () => {
  const partes = ["Word - Parte I: Conceito", "Word - Parte II: Características", "Word - Parte III: Formatos"];
  const materias = [{
    id: "mat", nome: "Informática",
    modulos: [{id:"geral",nome:"Geral",ordem:0,assuntos:partes.map((nome,i)=>({
      id: "ass-"+i, nome, concluido:i===0, prioridade:"alta", aulas:[], materiais:[],
    }))}], assuntos:[],
  }] as Materia[];
  const original = JSON.stringify(materias);
  const grupos = auditarGruposDePartes(materias);
  assert.equal(grupos.length,1);
  assert.equal(grupos[0].assunto,"Word");
  assert.deepEqual(grupos[0].partes.map(x=>x.assuntoId),["ass-0","ass-1","ass-2"]);
  assert.deepEqual(grupos[0].partes.map(x=>x.concluido),[true,false,false]);
  assert.equal(JSON.stringify(materias),original);
});
test("portugues sugere modulos tematicos, sem alterar aulas", () => {
  assert.equal(sugerirModuloPortugues("Língua Portuguesa","Substantivo"),"Classes de palavras");
  assert.equal(sugerirModuloPortugues("Língua Portuguesa","Compreensão e interpretação de textos"),"Leitura e interpretação");
  assert.equal(sugerirModuloPortugues("Informática","Substantivo"),null);
});

test("agrupamento visual preserva todos os IDs e estados sem duplicação", () => {
  const nomes = [
    "Word - Parte I: Conceitos",
    "Windows - Parte I: Sistema",
    "Word - Parte II: Arquivos",
    "Word - Parte III: Menus",
    "Windows - Parte II: Arquivos",
    "Segurança da informação",
  ];
  const assuntos = nomes.map((nome, i) => ({
    id: "id-" + i, nome, concluido: i === 0, prioridade: "media" as const,
  }));
  const antes = JSON.stringify(assuntos);
  const grupos = agruparAssuntosParaExibicao("Informática", "geral", assuntos);
  assert.deepEqual(grupos.map((g) => [g.titulo, g.assuntos.length]), [
    ["Word", 3], ["Windows", 2], ["Segurança da informação", 1],
  ]);
  assert.deepEqual(
    grupos.flatMap((g) => g.assuntos.map((a) => a.id)).slice().sort(),
    assuntos.map((a) => a.id).sort(),
  );
  assert.equal(grupos[0].assuntos.filter((a) => a.concluido).length, 1);
  assert.equal(JSON.stringify(assuntos), antes);
});
test("agrupamento Português cria tema sem confundir os IDs originais", () => {
  const assuntos = ["Substantivo", "Adjetivo", "Conjunção", "Compreensão e interpretação de textos"]
    .map((nome,i) => ({id:"pt-"+i,nome,concluido:i===1,prioridade:"alta" as const}));
  const grupos = agruparAssuntosParaExibicao("Português","geral",assuntos);
  assert.deepEqual(grupos.map((g) => [g.titulo,g.assuntos.length]), [
    ["Classes de palavras",3],["Compreensão e interpretação de textos",1],
  ]);
});
