import assert from "node:assert/strict";
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

test("não trata erro comum da aplicação como chunk obsoleto", () => {
  assert.equal(ehErroChunkDinamico(new Error("Falha ao salvar revisão")), false);
});
