import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import { resolverLinksAtividade } from "../src/utils/linksAtividade.ts";
import { resolverCategoriaLinkMaterial, separarMateriaisPorUso } from "../src/utils/materiaisLinks.ts";
import { agruparMateriaisDaDisciplina } from "../src/utils/correspondenciaMateriais.ts";

test("Central: revisão aberta por outro caminho encontra aula já importada no curso", () => {
  const links = resolverLinksAtividade({
    urlAulaSelecionada: "https://aulas.example/seguranca",
    urlAulaAssunto: "https://aulas.example/outro",
  });
  assert.equal(links.aula, "https://aulas.example/seguranca");
  assert.equal(links.questoes, undefined);
});

test("Central: preservar URL explícita da sessão e usar questões do assunto como fallback", () => {
  const links = resolverLinksAtividade({
    urlAulaSessao: "https://aulas.example/aula-9",
    urlAulaSelecionada: "https://aulas.example/aula-10",
    urlQuestoesAssunto: "https://questoes.example/seguranca",
  });
  assert.equal(links.aula, "https://aulas.example/aula-9");
  assert.equal(links.questoes, "https://questoes.example/seguranca");
});

test("Central: link de questões cadastrado nos materiais prevalece sem esconder aula do curso", () => {
  const links = resolverLinksAtividade({
    urlAulaSelecionada: "https://aulas.example/aula-5",
    urlQuestoesMaterial: "https://questoes.example/qc",
    urlQuestoesAssunto: "https://questoes.example/outra",
  });
  assert.equal(links.aula, "https://aulas.example/aula-5");
  assert.equal(links.questoes, "https://questoes.example/qc");
});

test("Atalhos legados: reconhecer video aula, erro de digitação e questões QC", () => {
  for (const nome of ["video aula", "vidoe aula", "AULA  NO YOUTUBE", "Videoaula"]) {
    assert.equal(resolverCategoriaLinkMaterial({tipo: "link", nome}), "aula", nome);
  }
  for (const nome of ["questoes", "QUESTÕES", "questoes qc"]) {
    assert.equal(resolverCategoriaLinkMaterial({tipo: "link", nome}), "questoes", nome);
  }
  assert.equal(resolverCategoriaLinkMaterial({tipo:"link",nome:"aula 2",categoria:"personalizado"}),"personalizado");
  assert.equal(resolverCategoriaLinkMaterial({tipo:"link",nome:"Aula de combate",categoria:"personalizado"}),"personalizado");
});

test("Atalhos: aula legada aparece no botão e PDF continua na lista de materiais", () => {
  const lista = [
    { id:"aula", nome:"video aula", tipo:"link" as const, url:"https://example.org/aula" },
    { id:"questoes", nome:"questoes qc", tipo:"link" as const, url:"https://example.org/questoes" },
    { id:"pdf", nome:"Resumo_Informatica_Seguranca", tipo:"arquivo" as const },
  ];
  const separados = separarMateriaisPorUso(lista);
  assert.equal(separados.aula?.id, "aula");
  assert.equal(separados.questoes?.id, "questoes");
  assert.deepEqual(separados.vinculados.map(x=>x.id),["pdf"]);
});

test("PDF da Informática sem assunto ID não desaparece nem é atribuído a aula diferente", () => {
  const material = {
    id:"pdf-protecao", tipo:"arquivo" as const,
    materia:"Informática", materiaId:"informatica",
    modulo:"Geral", assunto:"Conceitos de proteção e segurança - aulas 5 a 9",
    nome:"Resumo_Informatica_Seguranca",
  };
  const referencia = {
    materia:"Informática", materiaId:"informatica", modulo:"Geral",
    assunto:"Conceito de aplicativos de segurança, IDS, IPS, antimalwares, antivírus e firewall",
    assuntoId:"curso-aula-48",
  };
  const resultado = agruparMateriaisDaDisciplina([material],referencia);
  assert.deepEqual(resultado.vinculados,[]);
  assert.equal(resultado.outrosDaDisciplina[0]?.nome,"Resumo_Informatica_Seguranca");
});

test("Material de outra disciplina nunca entra nos outros da Informática", () => {
  const result = agruparMateriaisDaDisciplina([
    {materia:"Direito Penal",assunto:"Conceitos de segurança",nome:"Outro"},
    {materia:"Informática",assunto:"Segurança",nome:"PDF certo"},
  ], {materia:"Informática",assunto:"Segurança"});
  assert.deepEqual(result.vinculados.map(x=>x.nome),["PDF certo"]);
  assert.deepEqual(result.outrosDaDisciplina,[]);
});

test("Central transmite IDs estáveis e o componente distingue materiais sem vínculo", async () => {
  const tela=await readFile("src/pages/CentralEstudos/CentralEstudos.tsx","utf8");
  const materiais=await readFile("src/components/MateriaisDoAssunto/MateriaisDoAssunto.tsx","utf8");
  assert.match(tela,/materiaId=\{materiaSelecionada\?\.id/);
  assert.match(tela,/assuntoId=\{assuntoSelecionado\?\.id/);
  assert.match(tela,/urlAulaSelecionada: aulaSelecionada\?\.url/);
  assert.match(materiais,/agruparMateriaisDaDisciplina/);
  assert.match(materiais,/Outros materiais de/);
});
