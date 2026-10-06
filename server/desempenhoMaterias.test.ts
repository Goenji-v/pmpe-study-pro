import assert from "node:assert/strict";
import test from "node:test";

import type { RegistroQuestao } from "../src/types/index.ts";
import {
  calcularDesempenhoPorMateria,
  chaveDaMateria,
  destacarMelhorEPior,
  selecionarMateriasParaCards,
  selecionarPontosDeAtencao,
} from "../src/utils/desempenhoMaterias.ts";

function registro(materia: string, certas: number, erradas: number): RegistroQuestao {
  return {
    id: `${materia}-${certas}-${erradas}-${Math.random()}`,
    materia,
    assunto: "Geral",
    banca: "Teste",
    certas,
    erradas,
    minutos: 10,
    data: "2026-10-05",
  };
}

test("junta nomes equivalentes de Português em uma única matéria", () => {
  const resultado = calcularDesempenhoPorMateria([
    registro("Português", 30, 10),
    registro("Língua Portuguesa", 5, 15),
    registro(" lingua  portuguesa ", 0, 5),
  ]);

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].total, 65);
  assert.equal(resultado[0].certas, 35);
  assert.equal(resultado[0].percentual, 54);
  // Exibe a grafia mais usada.
  assert.equal(resultado[0].materia, "Português");
});

test("não funde matérias diferentes só por terem uma palavra em comum", () => {
  assert.notEqual(chaveDaMateria("Direito Penal Militar"), chaveDaMateria("Direito Penal"));
  assert.equal(chaveDaMateria("RLM"), chaveDaMateria("Raciocínio Lógico e Matemática"));
  assert.equal(chaveDaMateria("Leis Extravagantes"), chaveDaMateria("Legislação Extravagante"));
  assert.equal(chaveDaMateria("   "), "");
  assert.equal(chaveDaMateria(undefined), "");
});

test("ignora registros sem matéria e valores inválidos", () => {
  const resultado = calcularDesempenhoPorMateria([
    registro("", 10, 10),
    registro("História", Number.NaN, -5),
    registro("História", 8, 2),
  ]);

  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].total, 10);
  assert.equal(resultado[0].percentual, 80);
});

test("melhor/pior ignoram matérias com amostra pequena", () => {
  const materias = calcularDesempenhoPorMateria([
    registro("Geografia", 3, 0), // 100%, mas só 3 questões
    registro("História", 77, 23),
    registro("Informática", 74, 26),
    registro("Português", 53, 47),
  ]);

  const { melhor, pior } = destacarMelhorEPior(materias);
  assert.equal(melhor?.materia, "História");
  assert.equal(pior?.materia, "Português");
});

test("com uma única matéria elegível não há pior matéria", () => {
  const materias = calcularDesempenhoPorMateria([
    registro("História", 40, 10),
    registro("Geografia", 2, 1),
  ]);
  const { melhor, pior } = destacarMelhorEPior(materias);
  assert.equal(melhor?.materia, "História");
  assert.equal(pior, null);

  assert.deepEqual(destacarMelhorEPior([]), { melhor: null, pior: null });
});

test("cards: a pior matéria aparece mesmo fora do top 6 por volume", () => {
  const materias = calcularDesempenhoPorMateria([
    registro("A", 90, 10),
    registro("B", 80, 20),
    registro("C", 70, 30),
    registro("D", 60, 40),
    registro("E", 55, 45),
    registro("F", 50, 50),
    registro("G", 10, 14), // 7ª por volume (24 questões) e a pior (42%)
  ]);
  const { melhor, pior } = destacarMelhorEPior(materias);
  const cards = selecionarMateriasParaCards(materias, 6, [melhor, pior]);

  assert.equal(pior?.materia, "G");
  assert.equal(materias.slice(0, 6).some((item) => item.materia === "G"), false);
  assert.equal(cards.length, 6);
  assert.ok(cards.some((item) => item.materia === "G"));
  // A melhor matéria também precisa continuar visível.
  assert.ok(cards.some((item) => item.materia === melhor?.materia));
});

test("pontos de atenção respeitam média geral e amostra mínima", () => {
  const materias = calcularDesempenhoPorMateria([
    registro("RLM", 55, 45),
    registro("Português", 53, 47),
    registro("História", 77, 23),
    registro("Geografia", 1, 4), // amostra pequena: ignorada
  ]);

  const atencao = selecionarPontosDeAtencao(materias, 63);
  assert.deepEqual(
    atencao.map((item) => item.materia),
    ["Português", "RLM"]
  );
});

test("cards: melhor e pior fora do top 6 entram sem remover uma à outra", () => {
  const materias = calcularDesempenhoPorMateria([
    registro("A", 60, 40),
    registro("B", 60, 40),
    registro("C", 60, 40),
    registro("D", 60, 40),
    registro("E", 60, 40),
    registro("F", 60, 40),
    registro("Melhor", 20, 2), // 7ª por volume, 91%
    registro("Pior", 9, 12), // 8ª por volume, 43%
  ]);
  const { melhor, pior } = destacarMelhorEPior(materias);
  const cards = selecionarMateriasParaCards(materias, 6, [melhor, pior]);

  assert.equal(cards.length, 6);
  assert.ok(cards.some((item) => item.materia === "Melhor"));
  assert.ok(cards.some((item) => item.materia === "Pior"));
  assert.equal(new Set(cards.map((item) => item.materia)).size, 6);
});
