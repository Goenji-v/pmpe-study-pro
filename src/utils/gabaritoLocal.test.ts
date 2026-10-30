import assert from "node:assert/strict";
import { test } from "node:test";
import { calcularNotaLocal, lerGabarito } from "./gabaritoLocal.ts";

test("múltiplos formatos de gabarito resultam na mesma sequência", () => {
  const formatos = ["1-A 2-B 3-C", "1A 2B 3C", "1) A\n2) B\n3) C", "A B C", "A\nB\nC"];
  for (const texto of formatos) {
    const p = lerGabarito(texto, 3);
    assert.deepEqual([...p.respostas.values()], ["A","B","C"]);
    assert.deepEqual(p.faltantes, []);
  }
});
test("reconhece anulada, branco, falta e duplicata", () => {
  const p = lerGabarito("1-A 2-ANULADA 3-N 3-B", 4);
  assert.equal(p.respostas.get(2), "X");
  assert.deepEqual(p.duplicadas, [3]);
  assert.deepEqual(p.faltantes, [4]);
});
test("calcula acerto, erro, branco e anulada por matéria", () => {
  const oficial = lerGabarito("A B C X E",5);
  const aluno = lerGabarito("A C N B E",5);
  const nota = calcularNotaLocal(oficial.respostas, aluno.respostas, 5, [{inicio:1,fim:2,materia:"Português"},{inicio:3,fim:5,materia:"Direito"}]);
  assert.deepEqual([nota.acertos,nota.erros,nota.brancos,nota.anuladas,nota.validas,nota.percentual], [2,1,1,1,4,50]);
  assert.equal(nota.materias[0].percentual,50);
});

test("50 questões corrigidas localmente preservam todas as respostas", () => {
  const texto = Array.from({ length: 50 }, (_, i) => `${i + 1}-A`).join(" ");
  const oficial = lerGabarito(texto, 50);
  const aluno = lerGabarito(texto, 50);
  assert.deepEqual(oficial.faltantes, []);
  assert.deepEqual(aluno.duplicadas, []);
  const nota = calcularNotaLocal(oficial.respostas, aluno.respostas, 50);
  assert.equal(nota.acertos, 50);
  assert.equal(nota.percentual, 100);
});

test("anuladas são excluídas da nota por padrão ou pontuadas quando configurado", () => {
  const oficial = lerGabarito("1-A 2-X", 2);
  const aluno = lerGabarito("1-B 2-N", 2);
  const padrao = calcularNotaLocal(oficial.respostas, aluno.respostas, 2);
  assert.equal(padrao.validas, 1);
  assert.equal(padrao.acertos, 0);
  const pontuado = calcularNotaLocal(oficial.respostas, aluno.respostas, 2, [], false);
  assert.equal(pontuado.validas, 2);
  assert.equal(pontuado.acertos, 1);
});
