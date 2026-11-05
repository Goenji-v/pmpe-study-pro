import assert from "node:assert/strict";
import test from "node:test";
import {
  atualizarEtapaChecklist, chaveChecklistPlano, normalizarChecklistPlano,
} from "../src/utils/checklistMissaoPlano.ts";

test("checklist isolado por usuário e por reinício de dados", () => {
  assert.notEqual(chaveChecklistPlano("conta-lucas"), chaveChecklistPlano("conta-teste"));
  assert.notEqual(chaveChecklistPlano("conta-lucas"), chaveChecklistPlano("conta-lucas", "2026-11-04"));
});
test("checklist mantém progresso individual sem concluir outra atividade", () => {
  const inicio = atualizarEtapaChecklist({}, "missao-1", 0, true);
  const depois = atualizarEtapaChecklist(inicio, "missao-2", 2, true);
  assert.deepEqual(depois["missao-1"], [true, false, false, false]);
  assert.deepEqual(depois["missao-2"], [false, false, true, false]);
  assert.deepEqual(inicio["missao-2"], undefined);
  assert.equal(atualizarEtapaChecklist(inicio, "missao-1", 4, true), inicio);
});
test("leitura descarta payload inválido e não executa protótipos", () => {
  const dados = normalizarChecklistPlano({
    "missao-1": [true, false, true, false],
    "missao-incompleta": [true],
    "missao-falsa": [1, 0, 1, 0],
  });
  assert.deepEqual(dados, { "missao-1": [true, false, true, false] });
  assert.deepEqual(normalizarChecklistPlano(null), {});
  assert.deepEqual(normalizarChecklistPlano([]), {});
});
