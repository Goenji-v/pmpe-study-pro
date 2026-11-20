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

test("migração de schema usa CAS e nunca faz upsert direto", async () => {
  const codigo = await readFile("src/services/sincronizacaoService.ts", "utf8");
  const inicio = codigo.indexOf("export async function carregarEstadoDaNuvem");
  const fim = codigo.indexOf("export async function salvarEstadoEstruturalComSeguranca", inicio);
  const trecho = codigo.slice(inicio, fim);

  assert.match(trecho, /salvarEstadoComControleDeRevisao\(/);
  assert.match(trecho, /obterRevisaoSincronizacao\(estadoMigrado\)/);
  assert.doesNotMatch(trecho, /await salvarEstadoNaNuvem\(/);
});

test("falha estrutural preserva backup sem rollback de estado potencialmente antigo", async () => {
  const codigo = await readFile("src/services/sincronizacaoService.ts", "utf8");
  const inicio = codigo.indexOf("export async function salvarEstadoEstruturalComSeguranca");
  const fim = codigo.indexOf("export class ConflitoSincronizacaoError", inicio);
  const trecho = codigo.slice(inicio, fim);

  assert.match(trecho, /criarBackupAutomaticoLocal/);
  assert.match(trecho, /salvarEstadoComControleDeRevisao\(/);
  assert.doesNotMatch(trecho, /salvarEstadoNaNuvem\(/);
  assert.match(trecho, /A nuvem não foi revertida automaticamente/);
});

test("cadastro inicial impede disputa entre dois aparelhos com CAS revisão zero", async () => {
  const codigo = await readFile("src/context/AppContext.tsx", "utf8");
  const inicio = codigo.indexOf("const estadoInicial = {");
  const fim = codigo.indexOf("nuvemInicializadaRef.current = true;", inicio);
  const trecho = codigo.slice(inicio, fim);
  assert.ok(inicio >= 0 && fim > inicio);
  assert.match(trecho, /salvarEstadoComControleDeRevisao\([\s\S]*?idDaConta,[\s\S]*?estadoInicial,[\s\S]*?0\s*\)/);
  assert.doesNotMatch(trecho, /salvarEstadoNaNuvem\(/);
});

test("restauração quando a nuvem está vazia usa CAS para impedir escrita concorrente", async () => {
  const codigo = await readFile("src/context/AppContext.tsx", "utf8");
  const inicio = codigo.indexOf("async function restaurarEstadoCompleto");
  const fim = codigo.indexOf("useEffect(() => {", inicio);
  const trecho = codigo.slice(inicio, fim);
  assert.ok(inicio >= 0 && fim > inicio);
  assert.match(trecho, /salvarEstadoComControleDeRevisao\([\s\S]*?usuario\.id,[\s\S]*?restaurado,[\s\S]*?0\s*\)/);
  assert.doesNotMatch(trecho, /salvarEstadoNaNuvem\(/);
});

test("não existe API de upsert direto do estado completo", async () => {
  const codigo = await readFile("src/services/sincronizacaoService.ts", "utf8");
  assert.doesNotMatch(codigo, /export async function salvarEstadoNaNuvem/);
  assert.doesNotMatch(codigo, /\.from\("configuracoes"\)[\s\S]{0,150}\.upsert\(/);
});
