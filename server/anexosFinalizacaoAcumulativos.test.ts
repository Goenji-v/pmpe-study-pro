import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { acumularArquivosFinalizacao } from "../src/utils/anexosFinalizacao";

const arquivo = (nome: string, texto: string, modificado = 1234) =>
  new File([texto], nome, { type: "application/pdf", lastModified: modificado });

test("acumula anexos adicionados separadamente sem substituir os anteriores", () => {
  const primeiro = arquivo("apostila.pdf", "abc");
  const segundo = arquivo("aula.pdf", "def");
  const terceiro = arquivo("resumo.pdf", "ghi");
  const quarto = arquivo("slides.pdf", "jkl");

  const etapa1 = acumularArquivosFinalizacao([], [primeiro]);
  const etapa2 = acumularArquivosFinalizacao(etapa1, [segundo]);
  const etapa3 = acumularArquivosFinalizacao(etapa2, [terceiro, quarto]);
  assert.deepEqual(etapa3, [primeiro, segundo, terceiro, quarto]);
  assert.deepEqual(etapa1, [primeiro]);
  assert.deepEqual(etapa2, [primeiro, segundo]);
});

test("não duplica seleção repetida, mas permite arquivo diferente com mesmo nome", () => {
  const original = arquivo("mesmo.pdf", "abc", 100);
  const copia = arquivo("mesmo.pdf", "abcd", 200);
  const varios = acumularArquivosFinalizacao([original], [original, arquivo("mesmo.pdf", "abc", 100), copia]);
  assert.deepEqual(varios, [original, copia]);
});

test("arquivo removido pode ser escolhido novamente, sem limitar a quantidade", () => {
  const listagem = Array.from({ length: 17 }, (_, i) => arquivo(`anexo-${i}.pdf`, `texto-${i}`));
  const inicial = acumularArquivosFinalizacao([], listagem.slice(0, 9));
  const completo = acumularArquivosFinalizacao(inicial, listagem.slice(9));
  assert.equal(completo.length, 17);
  const removidos = completo.filter((item) => item !== listagem[1]);
  assert.deepEqual(acumularArquivosFinalizacao(removidos, [listagem[1]]), [...removidos, listagem[1]]);
});

test("Central mantém input múltiplo, lista de remoção e salvamento por assunto", () => {
  const code = readFileSync("src/pages/CentralEstudos/CentralEstudos.tsx", "utf8");
  assert.match(code, /type="file"\s+multiple/);
  assert.match(code, /acumularArquivosFinalizacao\(anteriores, selecionados\)/);
  assert.match(code, /evento\.currentTarget\.value = ""/);
  assert.match(code, /arquivosFinalizacao\.map\(\(arquivo, indice\)/);
  assert.match(code, /anteriores\.filter\(\(_, itemIndice\) => itemIndice !== indice\)/);
  assert.match(code, /materiaId: estado\.materiaId/);
  assert.match(code, /assuntoId: estado\.assuntoId/);
  assert.match(code, /Promise\.allSettled\(/);
});
