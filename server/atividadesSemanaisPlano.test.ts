import assert from "node:assert/strict";
import test from "node:test";

import { criarPlanoCalendario } from "../src/utils/planoCalendario";
import { aplicarDiasAtividadesSemanais } from "../src/utils/atividadesSemanaisPlano";

test("redação e simulado permanecem no domingo por padrão", () => {
  const plano = aplicarDiasAtividadesSemanais(criarPlanoCalendario(1, true));
  const primeira = plano[0];
  const domingo = primeira?.dias.find((dia) => dia.numero === 7);

  assert.ok(domingo?.missoes.some((missao) => missao.tipo === "redacao"));
  assert.ok(domingo?.missoes.some((missao) => missao.tipo === "simulado"));
});

test("usuário pode mover redação e simulado sem alterar as missões normais", () => {
  const original = criarPlanoCalendario(1, true);
  const conteudoAntes = original[0]?.dias
    .flatMap((dia) => dia.missoes)
    .filter((missao) => missao.tipo === "conteudo").length;

  const plano = aplicarDiasAtividadesSemanais(original, {
    diaRedacaoSemanal: "sab",
    diaSimuladoSemanal: "qua",
  });

  const semana = plano[0];
  const quarta = semana?.dias.find((dia) => dia.numero === 3);
  const sabado = semana?.dias.find((dia) => dia.numero === 6);
  const domingo = semana?.dias.find((dia) => dia.numero === 7);
  const conteudoDepois = semana?.dias
    .flatMap((dia) => dia.missoes)
    .filter((missao) => missao.tipo === "conteudo").length;

  assert.ok(quarta?.missoes.some((missao) => missao.tipo === "simulado"));
  assert.ok(sabado?.missoes.some((missao) => missao.tipo === "redacao"));
  assert.equal(domingo?.missoes.some((missao) => missao.tipo === "redacao"), false);
  assert.equal(domingo?.missoes.some((missao) => missao.tipo === "simulado"), false);
  assert.equal(conteudoDepois, conteudoAntes);
});
