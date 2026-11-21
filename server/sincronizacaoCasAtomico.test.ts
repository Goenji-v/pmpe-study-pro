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

test("prévia isolada recusa URL do Supabase fora do staging", async () => {
  const codigo = await readFile("src/lib/supabase.ts", "utf8");
  assert.match(codigo, /VITE_STUDY_PRO_STAGING_GUARD === "true"/);
  assert.match(codigo, /SUPABASE_PUBLIC_URL !== "https:\/\/isjzyyoqvftrltkctanw\.supabase\.co"/);
  assert.match(codigo, /Prévia de testes bloqueada/);
  assert.ok(codigo.indexOf("Prévia de testes bloqueada") < codigo.indexOf("createClient("));
});

test("prévia isolada não utiliza a API externa de produção", async () => {
  const codigo = await readFile("src/config/api.ts", "utf8");
  assert.match(codigo, /VITE_STUDY_PRO_STAGING_GUARD === "true"/);
  assert.match(codigo, /urlConfigurada !== "https:\/\/study-pro-staging-api\.invalid"/);
  assert.match(codigo, /API externa não isolada da produção/);
  assert.ok(codigo.indexOf("API externa não isolada da produção") < codigo.indexOf("const fallbackProducao"));
});

test("restauração de histórico usa CAS somente no staging e nunca chama o RPC na produção", async () => {
  const page = await readFile("src/pages/Backup/Backup.tsx", "utf8");
  const service = await readFile("src/services/seguranca/restauracaoBackupStagingService.ts", "utf8");
  assert.match(page, /VITE_STUDY_PRO_STAGING_GUARD === "true"/);
  assert.match(page, /RESTAURACAO_SEGURA_STAGING[\s\S]*restaurarBackupHistoricoSeguroStaging/);
  assert.match(page, /if \(RESTAURACAO_SEGURA_STAGING\)[\s\S]*restaurarBackupHistoricoSeguroStaging\([\s\S]*else \{[\s\S]*restaurarEstadoCompleto\(backup\.estado\)/);
  assert.match(service, /VITE_SUPABASE_URL !== "https:\/\/isjzyyoqvftrltkctanw\.supabase\.co"/);
  assert.match(service, /supabase\.rpc\("restaurar_backup_cas"/);
  assert.match(service, /p_confirmacao: "CONFIRMO_RESTAURACAO"/);
});

test("restauração CAS é serializada e bloqueia conflitos, offline e progresso local não salvo", async () => {
  const ctx = await readFile("src/context/AppContext.tsx", "utf8");
  const start = ctx.indexOf("async function restaurarBackupHistoricoSeguroStaging(");
  const end = ctx.indexOf("async function restaurarEstadoCompleto(", start);
  assert.ok(start > 0 && end > start, "Cannot find staging restore function");
  const section = ctx.slice(start, end);
  assert.match(section, /navegadorEstaOnline\(\)/);
  assert.match(section, /executarOperacaoNuvemSerializada/);
  assert.match(section, /alteracoesPendentes > 0/);
  assert.match(section, /obterEstadoPendenteSincronizacao\(usuario\.id\)/);
  assert.match(section, /assinaturaEstado\(estadoLocal\) !== ultimoEstadoSalvoRef\.current/);
  assert.match(section, /revisaoRemota !== revisaoBaseRef\.current/);
  assert.match(section, /criarBackupAutomaticoLocal\(/);
  assert.match(section, /restaurarBackupHistoricoStaging\(/);
  assert.match(section, /confirmarSincronizacaoLocal\(/);
  assert.doesNotMatch(section, /salvarEstadoNaNuvem|onConflict|rollback/i);
});

test("protótipo de restauração preserva geração de reinício e copia o histórico antes de gravar", async () => {
  const script = await readFile("supabase/staging-tests/restaurar_backup_cas_prototype.sql", "utf8");
  assert.match(script, /v_current #>> '\{configuracoes,dadosReiniciadosEm\}'/);
  assert.match(script, /v_new #>> '\{configuracoes,dadosReiniciadosEm\}'/);
  assert.match(script, /jsonb_typeof\(v_snapshot -> 'bancoQuestoes'\) IS DISTINCT FROM 'array'/);
  assert.match(script, /jsonb_typeof\(v_snapshot -> 'simuladosGerados'\) IS DISTINCT FROM 'array'/);
  const backupInsert = script.indexOf("insert into public.backups");
  const configUpdate = script.indexOf("update public.configuracoes");
  assert.ok(backupInsert > 0 && configUpdate > backupInsert, "Safety copy must precede cloud update");
});

test("backup malformado e schema futuro são rejeitados antes de qualquer INSERT de segurança", async () => {
  const sql = await readFile("supabase/staging-tests/restaurar_backup_cas_prototype.sql", "utf8");
  const checks = [
    "schemaVersion", "versao", "metaQuestoesDiaria", "metaMinutosDiaria",
    "metaRevisoesDiaria", "missoesPorDia", "missoesConcluidas",
    "v_ids_materias", "v_ids_modulos", "v_ids_assuntos", "v_ids_aulas"
  ];
  checks.forEach((key) => assert.ok(sql.includes(key), `Missing backup check: ${key}`));
  assert.match(sql, /Versão de backup incompatível; migração necessária/);
  assert.match(sql, /Matéria inválida ou repetida no backup/);
  assert.match(sql, /Aula inválida ou repetida no backup/);
  assert.ok(
    sql.indexOf("Matéria inválida ou repetida no backup") < sql.indexOf("insert into public.backups"),
    "Malformed backups must fail before creating a safety copy"
  );
});

test("o ensaio de navegador cobre falha de conexão e revisão concorrente sem rollback", async () => {
  const uiTest = await readFile("e2e/staging-backup-ui.spec.ts", "utf8");
  assert.match(uiTest, /outcome: "stale"/);
  assert.match(uiTest, /outcome: "uncertain"/);
  assert.match(uiTest, /MOCK_POST_COMMIT_NETWORK_FAILURE/);
  assert.match(uiTest, /restorationCalls\)\.toBe\(1\)/);
  assert.match(uiTest, /wrongWriteCalls\)\.toBe\(0\)/);
});

test("staging: importação JSON e backup local usam CAS e checkpoint sob RLS", async () => {
  const page = await readFile("src/pages/Backup/Backup.tsx", "utf8");
  const ctx = await readFile("src/context/AppContext.tsx", "utf8");
  const service = await readFile("src/services/seguranca/restauracaoBackupStagingService.ts", "utf8");
  assert.match(page, /if \(RESTAURACAO_SEGURA_STAGING\)[\s\S]*restaurarBackupHistoricoSeguroStaging\(null, arquivoAnalisado\.estado\)/);
  assert.match(page, /if \(RESTAURACAO_SEGURA_STAGING\)[\s\S]*restaurarBackupHistoricoSeguroStaging\(null, estado\)/);
  assert.match(ctx, /const idRestaurar = backupId \?\?[\s\S]*arquivarBackupParaRestauracaoStaging/);
  assert.match(service, /VITE_STUDY_PRO_STAGING_GUARD !== "true"/);
  assert.match(service, /\.from\("backups"\)/);
  assert.match(service, /user_id: usuarioId/);
  assert.match(service, /\.insert\(/);
  assert.match(service, /\.select\("id"\)/);
});

test("histórico de backups valida cada registro e não permite snapshot corrompido ocultar a lista", async () => {
  const source = await readFile("src/services/seguranca/backupHistoricoService.ts", "utf8");
  assert.match(source, /const migrado = validarEMigrarEstado\(dados\.estado\)/);
  assert.match(source, /validarIntegridadeEstado\(migrado\)/);
  assert.match(source, /catch \{\s*return null;\s*\}/);
  assert.match(source, /const resumo = resumirEstado\(estado\)/);
  assert.match(source, /\.filter\(\(backup\): backup is BackupHistoricoNuvem => Boolean\(backup\)\)/);
});

test("backup histórico de schema legado passa por migração antes de chamar a RPC estrita", async () => {
  const service = await readFile("src/services/seguranca/backupHistoricoService.ts", "utf8");
  const page = await readFile("src/pages/Backup/Backup.tsx", "utf8");
  assert.match(service, /precisaMigracao =\s*obterSchemaVersionEstado/);
  assert.match(page, /backup\.precisaMigracao \? null : backup\.id/);
  assert.match(page, /restaurarBackupHistoricoSeguroStaging\(/);
  assert.match(page, /RESTAURACAO_SEGURA_STAGING/);
});
