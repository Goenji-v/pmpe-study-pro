import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("reconciliação de questões IA não reinicia a cada autosave", async () => {
  const codigo = await readFile("src/context/AppContext.tsx", "utf8");

  assert.match(
    codigo,
    /importacaoInicialResultadosIARef\.current !== userId/
  );
  assert.match(
    codigo,
    /importacaoInicialResultadosIARef\.current = userId;\s*void importarTentativasIA\(\);/
  );
  assert.match(
    codigo,
    /importacaoInicialResultadosIARef\.current = null;/
  );
});


test("sincronização manual absorve migração estrutural remota com backup das duas versões", async () => {
  const codigo = await readFile("src/context/AppContext.tsx", "utf8");

  assert.match(
    codigo,
    /deveAplicarMigracaoEstruturalRemota\(\s*pendente\.estado,\s*estadoNuvem\s*\)/
  );
  assert.match(
    codigo,
    /registrarBackupConflitoNaNuvem\(\{\s*usuarioId: usuario\.id,\s*estadoLocal: pendente\.estado,\s*estadoNuvem,\s*\}\)/
  );
  assert.match(
    codigo,
    /aplicarEstadoDaNuvem\(estadoNuvem\);\s*confirmarSincronizacaoLocal\(usuario\.id, estadoNuvem\);/
  );
});
