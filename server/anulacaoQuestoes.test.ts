import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const caminho = new URL(
  "../supabase/migrations/20260926003000_anulacao_questoes_recalcula_resultados.sql",
  import.meta.url
);

test("anulação preserva catálogo e recalcula tentativas históricas", async () => {
  const sql = await readFile(caminho, "utf8");

  assert.match(sql, /set status = 'anulada'/);
  assert.match(sql, /recalcular_resultados_questao_anulada/);
  assert.match(sql, /questoesValidas/);
  assert.match(sql, /'total', v_total/);
  assert.match(sql, /'anuladas', jsonb_array_length\(v_excluidas\)/);
  assert.match(sql, /'totalQuestoes', v_total/);
  assert.match(sql, /Questões anuladas são excluídas do numerador e do denominador/);
  assert.doesNotMatch(sql, /delete from public\.questoes_catalogo/i);
});

test("card do caderno usa a última tentativa depois da auditoria", async () => {
  const sql = await readFile(caminho, "utf8");

  assert.match(sql, /array_agg\(r\.certas order by r\.data desc\)/);
  assert.match(sql, /count\(r\.id\)::integer as tentativas/);
  assert.match(sql, /ultimaTentativaEm/);
});
