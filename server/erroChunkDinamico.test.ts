import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { ehErroChunkDinamico } from "../src/utils/erroChunkDinamico.ts";

test("detecta falha de importação dinâmica do navegador", () => {
  assert.equal(
    ehErroChunkDinamico(
      new TypeError(
        "Failed to fetch dynamically imported module: https://app.test/assets/CentralInteligencia-antigo.js"
      )
    ),
    true
  );
});

test("detecta ChunkLoadError e falha de module script", () => {
  assert.equal(ehErroChunkDinamico(new Error("ChunkLoadError: Loading chunk 12 failed")), true);
  assert.equal(ehErroChunkDinamico(new Error("Failed to load module script")), true);
});

test("detecta falha de CSS versionado após deploy", () => {
  assert.equal(
    ehErroChunkDinamico(
      new Error("Unable to preload CSS for https://app.test/assets/ParceiroCursos-antigo.css")
    ),
    true
  );
  assert.equal(ehErroChunkDinamico("CSS chunk load failed: styles-antigo.css"), true);
});

test("não trata erro comum da aplicação como chunk obsoleto", () => {
  assert.equal(ehErroChunkDinamico(new Error("Falha ao salvar revisão")), false);
});


test("recuperação de chunk usa navegação com cache-busting, não reload simples", async () => {
  const codigo = await readFile("src/utils/erroChunkDinamico.ts", "utf8");

  assert.match(codigo, /__sp_refresh/);
  assert.match(codigo, /window\.location\.replace/);
  assert.doesNotMatch(
    codigo,
    /window\.location\.reload\(\)/,
    "Chunk antigo não deve repetir a mesma navegação/cache após deploy"
  );
  assert.match(codigo, /replaceState/);
});

test("main usa a mesma recuperação de chunk do ErrorBoundary", async () => {
  const codigo = await readFile("src/main.tsx", "utf8");

  assert.match(codigo, /ehErroChunkDinamico/);
  assert.match(codigo, /tentarRecarregarChunkObsoletoUmaVez/);
  assert.match(codigo, /limparMarcadorRecuperacaoChunkDaUrl/);
  assert.doesNotMatch(codigo, /study-pro:asset-reload/);
});
