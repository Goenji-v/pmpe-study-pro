import assert from "node:assert/strict";
import test from "node:test";

import {
  montarObservacaoRedacao,
  rotuloModalidadeRedacao,
} from "../src/utils/redacaoRegistro";

test("treino de redação fica identificado e não registra nota", () => {
  const observacao = montarObservacaoRedacao(
    "Treinei apenas a introdução.",
    "treino",
    9.5
  );

  assert.equal(
    rotuloModalidadeRedacao("treino"),
    "Treino de redação"
  );
  assert.match(observacao, /^Modalidade: Treino de redação/m);
  assert.match(observacao, /Treinei apenas a introdução\./);
  assert.doesNotMatch(observacao, /Nota da redação:/);
});

test("redação completa pode registrar nota no histórico", () => {
  const observacao = montarObservacaoRedacao(
    "Tema completo.",
    "completa",
    82
  );

  assert.equal(
    rotuloModalidadeRedacao("completa"),
    "Redação completa"
  );
  assert.match(observacao, /^Modalidade: Redação completa/m);
  assert.match(observacao, /Nota da redação: 82/);
});

test("trocar a modalidade remove marcadores antigos antes de salvar", () => {
  const observacao = montarObservacaoRedacao(
    "Modalidade: Redação completa\nNota da redação: 70\nTreino de D1.",
    "treino"
  );

  assert.equal(
    observacao,
    "Modalidade: Treino de redação\nTreino de D1."
  );
});
