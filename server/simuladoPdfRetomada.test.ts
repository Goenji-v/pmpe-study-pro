import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("simulado PDF salva cada bloco e preserva o parcial na retomada", async () => {
  const [processador, api] = await Promise.all([
    readFile("server/processarSimuladoPdfPersistente.ts", "utf8"),
    readFile("server/index.ts", "utf8"),
  ]);

  assert.match(processador, /progresso salvo/);
  assert.match(processador, /resultadoParcial/);
  assert.match(processador, /obterResultadoParcial/);
  assert.doesNotMatch(processador, /const CONCORRENCIA = 2/);
  assert.match(api, /resultado: job\.resultado/);
  assert.match(api, /último bloco salvo/);
});
