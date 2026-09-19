import assert from "node:assert/strict";
import test from "node:test";

import { consumirCotaIaPersistente } from "./limiteIaPersistente.ts";

test("cota persistente usa service role e respeita resposta do banco", async () => {
  let requisicao: { url?: string; init?: RequestInit } = {};

  const resultado = await consumirCotaIaPersistente({
    supabaseUrl: "https://example.supabase.co",
    serviceRoleKey: "service-role-privada-com-tamanho-suficiente",
    userId: "00000000-0000-4000-8000-000000000001",
    categoria: "geral",
    janelaMs: 10 * 60 * 1000,
    limite: 60,
    fetchImpl: (async (url: string | URL | Request, init?: RequestInit) => {
      requisicao = { url: String(url), init };
      return new Response(JSON.stringify([{
        permitido: false,
        usados: 61,
        limite: 60,
        retry_after_segundos: 42,
      }]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch,
  });

  assert.equal(resultado.permitido, false);
  assert.equal(resultado.usados, 61);
  assert.equal(resultado.retryAfterSegundos, 42);
  assert.match(requisicao.url ?? "", /\/rpc\/consumir_cota_ia$/);

  const headers = new Headers(requisicao.init?.headers);
  assert.equal(
    headers.get("authorization"),
    "Bearer service-role-privada-com-tamanho-suficiente"
  );
  assert.equal(
    headers.get("apikey"),
    "service-role-privada-com-tamanho-suficiente"
  );
});
