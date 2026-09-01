import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularTotalQuestoesMultiAssunto,
  consolidarBlocosMultiAssunto,
  validarGeracaoMultiAssunto,
} from "../src/utils/geracaoMultiAssunto";

test("calcula a quantidade por subassunto sem transformar a sessão em simulado", () => {
  assert.equal(calcularTotalQuestoesMultiAssunto(3, 5), 15);
  assert.equal(calcularTotalQuestoesMultiAssunto(3, 10), 30);
  assert.equal(calcularTotalQuestoesMultiAssunto(3, 15), 45);
});

test("bloqueia sessão multiassunto acima de 60 questões", () => {
  assert.equal(validarGeracaoMultiAssunto(4, 15).valida, true);

  const invalida = validarGeracaoMultiAssunto(5, 15);
  assert.equal(invalida.valida, false);
  assert.equal(invalida.total, 75);
  assert.match(invalida.mensagem, /limite é 60/i);
});

test("exige pelo menos cinco questões e um subassunto", () => {
  assert.equal(validarGeracaoMultiAssunto(0, 5).valida, false);
  assert.equal(validarGeracaoMultiAssunto(2, 4).valida, false);
});

test("só consolida quando cada subassunto possui a cota exata", () => {
  const blocos = [
    ["nassau-1", "nassau-2", "nassau-3", "nassau-4", "nassau-5"],
    ["colonizacao-1", "colonizacao-2", "colonizacao-3", "colonizacao-4", "colonizacao-5"],
    ["cabanos-1", "cabanos-2", "cabanos-3", "cabanos-4", "cabanos-5"],
  ];

  const consolidadas = consolidarBlocosMultiAssunto(blocos, 5);
  assert.equal(consolidadas.length, 15);
  assert.equal(consolidadas.filter((item) => item.startsWith("nassau")).length, 5);
  assert.equal(consolidadas.filter((item) => item.startsWith("colonizacao")).length, 5);
  assert.equal(consolidadas.filter((item) => item.startsWith("cabanos")).length, 5);

  assert.throws(
    () => consolidarBlocosMultiAssunto([["a", "b"], ["c"]], 2),
    /não atingiu as 2 questões esperadas/i
  );
});
