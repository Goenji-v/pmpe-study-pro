import assert from "node:assert/strict";
import test from "node:test";
import {
  envelopePertenceAoDsn,
  interpretarDsnSentry,
  origemPermitidaNoTunnel,
} from "./sentryTunnel.ts";

const DSN =
  "https://abc123@o123.ingest.us.sentry.io/456789";

test("interpreta DSN do Sentry para encaminhamento seguro", () => {
  assert.deepEqual(interpretarDsnSentry(DSN), {
    host: "o123.ingest.us.sentry.io",
    publicKey: "abc123",
    projectId: "456789",
  });
});

test("aceita somente envelopes do projeto configurado", () => {
  const valido = Buffer.from(
    JSON.stringify({ dsn: DSN }) + "\n" + JSON.stringify({ type: "event" })
  );
  const outroProjeto = Buffer.from(
    JSON.stringify({
      dsn: "https://abc123@o123.ingest.us.sentry.io/999999",
    }) + "\n"
  );

  assert.equal(envelopePertenceAoDsn(valido, DSN), true);
  assert.equal(envelopePertenceAoDsn(outroProjeto, DSN), false);
});

test("rejeita envelope inválido e origem externa", () => {
  assert.equal(envelopePertenceAoDsn(Buffer.from("invalido"), DSN), false);
  assert.equal(
    origemPermitidaNoTunnel("https://pmpe-study-pro-two.vercel.app"),
    true
  );
  assert.equal(
    origemPermitidaNoTunnel(
      "https://pmpe-study-abc123-pmpe-study-pro.vercel.app"
    ),
    true
  );
  assert.equal(origemPermitidaNoTunnel("https://site-externo.com"), false);
});

import { excedeuRateLimit } from "./sentryTunnel.ts";
import type { Request } from "express";
import { readFileSync } from "node:fs";
import { stripTypeScriptTypes } from "node:module";
import vm from "node:vm";

test("cabeçalho forjado não renova o limite do mesmo cliente", () => {
  let bloqueadas = 0;
  for (let i = 0; i < 130; i++) {
    const req = { ip: "192.0.2.55", header: () => `198.51.100.${i}` } as unknown as Request;
    bloqueadas += Number(excedeuRateLimit(req));
  }
  assert.equal(bloqueadas, 10);
});

function importador(fetchMock: typeof fetch) {
  const fonte = readFileSync(new URL("../supabase/functions/importar-curso-publico/index.ts", import.meta.url), "utf8");
  const contexto = vm.createContext({ URL, AbortController, TextDecoder, setTimeout, clearTimeout,
    fetch: fetchMock, Deno: { env: { get: () => "courses.example.org,127.0.0.1,[::ffff:7f00:1]" } } });
  vm.runInContext(stripTypeScriptTypes(fonte.slice(fonte.indexOf("function validarUrlPublica"), fonte.indexOf("function extrairEstrutura"))), contexto);
  return contexto;
}

test("importador rejeita IPs, credenciais e domínios não autorizados", () => {
  const c = importador(fetch);
  for (const url of ["https://127.0.0.1", "https://[::ffff:127.0.0.1]", "https://other.example.org", "https://user:pass@courses.example.org", "https://courses.example.org:8443"]) {
    assert.throws(() => c.validarUrlPublica(url));
  }
  assert.equal(c.validarUrlPublica("https://courses.example.org").hostname, "courses.example.org");
});

test("importador limita bytes mesmo sem Content-Length e cancela download", async () => {
  let cancelado = false;
  const c = importador(async () => new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(1_000_000)); },
    cancel() { cancelado = true; },
  }), { headers: { "content-type": "text/html" } }));
  await assert.rejects(c.buscarHtmlSeguro(new URL("https://courses.example.org")), /grande demais/);
  assert.equal(cancelado, true);
});

test("importador revalida destino de redirecionamento e lê HTML válido", async () => {
  const c = importador(async () => new Response(null, { status: 302, headers: { location: "https://127.0.0.1" } }));
  await assert.rejects(c.buscarHtmlSeguro(new URL("https://courses.example.org")));
  const ok = importador(async () => new Response("<h1>Curso</h1>", { headers: { "content-type": "text/html" } }));
  assert.equal((await ok.buscarHtmlSeguro(new URL("https://courses.example.org"))).html, "<h1>Curso</h1>");
});
