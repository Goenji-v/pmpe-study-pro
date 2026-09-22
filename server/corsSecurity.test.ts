import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function codigoProxySeguro() {
  return readFile("server/secureEntry.ts", "utf8");
}

test("CORS mantém allowlist explícita do frontend", async () => {
  const codigo = await codigoProxySeguro();

  assert.match(codigo, /https:\/\/pmpe-study-pro-two\.vercel\.app/);
  assert.match(codigo, /origensPermitidas\.has\(origem\)/);
  assert.match(codigo, /credentials:\s*false/);
  assert.doesNotMatch(
    codigo,
    /origin:\s*["']\*["']/,
    "CORS não pode liberar qualquer origem"
  );
});

test("CORS rejeita origem externa fora da allowlist", async () => {
  const codigo = await codigoProxySeguro();

  assert.match(codigo, /Origem não autorizada pelo CORS/);
  assert.match(codigo, /callback\(new Error\(/);
});

test("CORS preserva desenvolvimento local sem abrir produção", async () => {
  const codigo = await codigoProxySeguro();

  assert.match(codigo, /localhost/);
  assert.match(codigo, /127\\\.0\\\.0\\\.1/);
  assert.match(codigo, /192\\\.168/);
  assert.match(codigo, /local \|\| origensPermitidas\.has\(origem\)/);
});
