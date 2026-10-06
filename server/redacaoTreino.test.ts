import assert from "node:assert/strict";
import test from "node:test";

import {
  criarRascunhoTreinoRedacao,
  normalizarRascunhoTreinoRedacao,
  rascunhoTreinoRedacaoTemConteudo,
} from "../src/utils/redacaoTreino";

test("rascunho de redação preserva tema, objetivo, observações e vínculo do plano", () => {
  const rascunho = criarRascunhoTreinoRedacao({
    tema: "Violência contra a mulher",
    objetivo: "Treinar introdução e D1",
    observacao: "Usar repertório constitucional.",
    missaoId: "s1-d7-redacao",
    semana: 1,
    dia: 7,
    agora: new Date("2026-10-06T08:00:00.000Z"),
  });

  assert.equal(rascunho.tema, "Violência contra a mulher");
  assert.equal(rascunho.objetivo, "Treinar introdução e D1");
  assert.equal(rascunho.observacao, "Usar repertório constitucional.");
  assert.equal(rascunho.missaoId, "s1-d7-redacao");
  assert.equal(rascunho.semana, 1);
  assert.equal(rascunho.dia, 7);
  assert.equal(rascunho.atualizadoEm, "2026-10-06T08:00:00.000Z");
});

test("rascunho inválido não quebra a retomada e campos opcionais são saneados", () => {
  assert.equal(normalizarRascunhoTreinoRedacao(null), null);
  assert.equal(normalizarRascunhoTreinoRedacao("texto"), null);
  assert.equal(
    normalizarRascunhoTreinoRedacao({
      tema: "",
      objetivo: "",
      observacao: "",
    }),
    null
  );

  const rascunho = normalizarRascunhoTreinoRedacao({
    tema: "Tema salvo",
    objetivo: 123,
    observacao: "Anotação",
    missaoId: "  missao-1  ",
    semana: "2",
    dia: 0,
    atualizadoEm: "data inválida",
  });

  assert.ok(rascunho);
  assert.equal(rascunho.tema, "Tema salvo");
  assert.equal(rascunho.objetivo, "");
  assert.equal(rascunho.observacao, "Anotação");
  assert.equal(rascunho.missaoId, "missao-1");
  assert.equal(rascunho.semana, 2);
  assert.equal(rascunho.dia, undefined);
  assert.equal(rascunho.atualizadoEm, "1970-01-01T00:00:00.000Z");
});

test("rascunho considera conteúdo real e ignora apenas espaços", () => {
  assert.equal(
    rascunhoTreinoRedacaoTemConteudo({
      tema: "   ",
      objetivo: "",
      observacao: "\n",
    }),
    false
  );

  assert.equal(
    rascunhoTreinoRedacaoTemConteudo({
      tema: "",
      objetivo: "Treinar D1",
      observacao: "",
    }),
    true
  );
});
