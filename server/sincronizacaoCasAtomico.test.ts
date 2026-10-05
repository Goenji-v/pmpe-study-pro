import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("autosave usa CAS atômico em vez de leitura + upsert", async () => {
  const codigo = await readFile("src/services/sincronizacaoService.ts", "utf8");
  const inicio = codigo.indexOf("export async function salvarEstadoComControleDeRevisao");
  const fim = codigo.indexOf("export function montarEstadoNuvem", inicio);
  const trecho = codigo.slice(inicio, fim);

  assert.match(trecho, /supabase\.rpc\(\s*"salvar_estado_app_cas"/);
  assert.doesNotMatch(trecho, /carregarEstadoDaNuvem\(/);
  assert.doesNotMatch(trecho, /salvarEstadoNaNuvem\(/);
  assert.match(trecho, /new ConflitoSincronizacaoError/);
});

test("alterações estruturais não fazem rollback por cima de conflito legítimo", async () => {
  const codigo = await readFile("src/services/sincronizacaoService.ts", "utf8");
  const inicio = codigo.indexOf("export async function salvarEstadoEstruturalComSeguranca");
  const fim = codigo.indexOf("export class ConflitoSincronizacaoError", inicio);
  const trecho = codigo.slice(inicio, fim);

  assert.match(trecho, /salvarEstadoComControleDeRevisao/);
  assert.match(
    trecho,
    /if \(erroSalvar instanceof ConflitoSincronizacaoError\)[\s\S]*throw erroSalvar/
  );
});

test("usar este aparelho também confirma a revisão com CAS", async () => {
  const codigo = await readFile("src/context/AppContext.tsx", "utf8");
  const inicio = codigo.indexOf("async function resolverConflitoSincronizacao");
  const fim = codigo.indexOf("async function aplicarEstadoEstruturalSeguro", inicio);
  const trecho = codigo.slice(inicio, fim);

  assert.match(trecho, /const localConfirmado =[\s\S]*salvarEstadoComControleDeRevisao/);
  assert.doesNotMatch(
    trecho,
    /await salvarEstadoNaNuvem\(\s*usuario\.id,\s*localParaSalvar/
  );
});
