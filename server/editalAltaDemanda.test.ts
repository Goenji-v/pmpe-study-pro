import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("análise do edital usa retry com modelo reserva para erros temporários", async () => {
  const codigo = await readFile("server/secureEntry.ts", "utf8");

  assert.match(codigo, /executarComFallbackGemini/);
  assert.match(codigo, /modelos: \[modeloEdital, modeloFallbackEdital\]/);
  assert.match(codigo, /tentativasPorModelo: \[2, 3\]/);
  assert.match(codigo, /\[edital-inteligente\] trocando modelo/);
  assert.match(codigo, /status === 503\s*\? 503/);
});

test("frontend não exibe JSON bruto do provedor quando edital recebe 503", async () => {
  const codigo = await readFile(
    "src/services/editalInteligenteService.ts",
    "utf8"
  );

  assert.match(codigo, /normalizarErroAnaliseEdital/);
  assert.match(codigo, /high demand/);
  assert.match(codigo, /\\bUNAVAILABLE\\b/);
  assert.match(codigo, /"code"\\s\*:\\s\*503/);
  assert.match(codigo, /modelo reserva/);
  assert.match(codigo, /PDF continua selecionado/);
});

test("Meu Edital oferece nova tentativa sem exigir selecionar o PDF de novo", async () => {
  const codigo = await readFile("src/pages/MeuEdital/MeuEdital.tsx", "utf8");

  assert.match(codigo, /erroProcessamento && !analise/);
  assert.match(codigo, /Tentar analisar novamente/);
});
