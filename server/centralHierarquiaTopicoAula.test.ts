import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assuntosPrincipaisSemDuplicarAulas } from "../src/utils/aulasDeSubassuntosDistintos.ts";
import type { Assunto } from "../src/types/index.ts";

const assunto = (id: string, nome: string, aulas: string[] = []): Assunto => ({
  id, nome, concluido: false, prioridade: "media",
  aulas: aulas.map((n, i) => ({id: "aula-"+i, nome: n, ordem: i, concluida: false})),
});
const titulo = "Princípios e técnicas de contagem, princípio multiplicativo, permutações, arranjos, combinações e probabilidade";

test("tópico do edital com aulas reais não duplica Arranjo e Combinação no seletor Assunto", () => {
  const pai = assunto("edital", titulo, ["Arranjo", "Combinação", "Permutação", "Probabilidade"]);
  const itens = [pai, assunto("arranjo","Arranjo"), assunto("combinacao","Combinação"), assunto("naoRelacionado","Operações básicas da matemática")];
  assert.deepEqual(assuntosPrincipaisSemDuplicarAulas("Raciocínio Lógico e Matemática",itens).map(x=>x.id),
    ["edital","naoRelacionado"]);
});

test("sem aula vinculada não esconde os assuntos legados nem apaga progresso", () => {
  const pai = assunto("edital",titulo);
  const filho = assunto("arranjo","Arranjo");
  const itens=[pai,filho];
  const resultado=assuntosPrincipaisSemDuplicarAulas("Raciocínio Lógico e Matemática",itens);
  assert.deepEqual(resultado,itens);
  assert.equal(resultado[0],pai);
});

test("Centro de Estudos tem dois seletores sem duplicar campo de assunto", () => {
  const src=readFileSync(new URL("../src/pages/CentralEstudos/CentralEstudos.tsx",import.meta.url),"utf8");
  assert.match(src,/assuntosPrincipaisSemDuplicarAulas/);
  assert.match(src,/\(estado.tipo === "aula" \|\| estado.tipo === "revisao"\)/);
  assert.match(src,/\{!assuntoSelecionado && \(/);
  assert.match(src,/<label>Aula<\/label>/);
});
