import assert from "node:assert/strict";
import test from "node:test";

import { criarPlanoCalendario } from "../src/utils/planoCalendario";
import { localizarMissaoRedacaoPendenteDoDia } from "../src/utils/redacaoPlano";

test("redação iniciada no dia da missão recebe o vínculo pendente", () => {
  const plano = criarPlanoCalendario(1);
  const domingo = plano[0]?.dias.find((dia) => dia.numero === 7);
  const redacao = domingo?.missoes.find((missao) => missao.tipo === "redacao");

  assert.ok(redacao);

  const vinculo = localizarMissaoRedacaoPendenteDoDia(plano, [], 1, 7);

  assert.deepEqual(vinculo, {
    missaoId: redacao.id,
    semana: 1,
    dia: 7,
  });
});

test("redação já concluída não é vinculada novamente", () => {
  const plano = criarPlanoCalendario(1);
  const redacao = plano[0]?.dias
    .find((dia) => dia.numero === 7)
    ?.missoes.find((missao) => missao.tipo === "redacao");

  assert.ok(redacao);

  const vinculo = localizarMissaoRedacaoPendenteDoDia(
    plano,
    [redacao.id],
    1,
    7
  );

  assert.equal(vinculo, null);
});

test("redação de outro dia não conclui a missão semanal por engano", () => {
  const plano = criarPlanoCalendario(1);

  assert.equal(
    localizarMissaoRedacaoPendenteDoDia(plano, [], 1, 6),
    null
  );
});
