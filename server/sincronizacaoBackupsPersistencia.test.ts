import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { haAlteracoesPendentesAntesDeAtualizar } from "../src/utils/atualizacaoSegura.ts";

function armazenamento(itens: Record<string, string>): Pick<Storage, "length" | "key" | "getItem"> {
  const chaves = Object.keys(itens);
  return {
    length: chaves.length,
    key: (indice) => chaves[indice] ?? null,
    getItem: (chave) => itens[chave] ?? null,
  };
}

test("atualização automática é adiada quando existe fila de estudo pendente", () => {
  const pendente = armazenamento({
    "pmpe:seguranca:sync-pendente:aluno-1": "{\"baseRevision\":5751}",
  });
  assert.equal(haAlteracoesPendentesAntesDeAtualizar([pendente]), true);
  assert.equal(haAlteracoesPendentesAntesDeAtualizar([null, pendente]), true);
});

test("metadados ou outras chaves não impedem atualização automática", () => {
  const apenasMetadados = armazenamento({
    "pmpe:seguranca:sync-meta:aluno-1": "{\"ultimaRevisaoConfirmada\":5752}",
    "outro-item": "ok",
  });
  assert.equal(haAlteracoesPendentesAntesDeAtualizar([apenasMetadados]), false);
  assert.equal(haAlteracoesPendentesAntesDeAtualizar([]), false);
});

test("erro ao inspecionar armazenamento impede recarga insegura", () => {
  const bloqueado: Pick<Storage, "length" | "key" | "getItem"> = {
    length: 1,
    key: () => { throw new Error("storage indisponível"); },
    getItem: () => null,
  };
  assert.equal(haAlteracoesPendentesAntesDeAtualizar([bloqueado]), true);
});

test("CAS confirma progresso sem aguardar consulta de backup", async () => {
  const fonte = await readFile("src/services/sincronizacaoService.ts", "utf8");
  assert.match(fonte, /void registrarBackupIncrementalNuvem\(/);
  assert.doesNotMatch(fonte, /await registrarBackupIncrementalNuvem\(/);
  assert.match(fonte, /salvar_estado_app_cas/);
});

test("histórico de backups consulta resumos e recupera estado sob demanda", async () => {
  const fonte = await readFile("src/services/seguranca/backupHistoricoService.ts", "utf8");
  const pagina = await readFile("src/pages/Backup/Backup.tsx", "utf8");
  assert.match(fonte, /select\("resumo:dados->resumo"\)/);
  assert.match(fonte, /export async function carregarEstadoBackupHistoricoNuvem/);
  assert.match(fonte, /tipo:dados->>tipo/);
  assert.match(pagina, /carregarEstadoBackupHistoricoNuvem/);
  assert.doesNotMatch(pagina, /\[usuarioId, statusNuvem, ultimaSincronizacao\]/);
});
