import assert from "node:assert/strict";
import test from "node:test";

import {
  buscarJobGeracaoIAPorRequestId,
  criarOuBuscarJobGeracaoIA,
  type ContextoSupabaseJob,
} from "./geracaoPersistente.ts";

const contexto: ContextoSupabaseJob = {
  supabaseUrl: "https://example.supabase.co",
  userId: "00000000-0000-4000-8000-000000000001",
  authorization: "Bearer token-do-usuario",
  anonKey: "anon-publica-com-tamanho-suficiente",
  serviceRoleKey: "service-role-privada-com-tamanho-suficiente",
};

test("consulta de job usa sessão do usuário e escrita usa service role", async () => {
  const originalFetch = globalThis.fetch;
  const chamadas: Array<{ url: string; init?: RequestInit }> = [];

  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), init });

    if (!init?.method || init.method === "GET") {
      return new Response("[]", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify([{
      id: "job-1",
      user_id: contexto.userId,
      request_id: "req-12345678",
      status: "fila",
      etapa: "fila",
      progresso: 0,
      titulo: "Teste",
      descricao: "Teste",
      payload: {},
      resultado: null,
      erro: null,
      criada_em: new Date().toISOString(),
      iniciada_em: null,
      atualizada_em: new Date().toISOString(),
      concluida_em: null,
      execucao_id: null,
      lease_ate: null,
    }]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    await buscarJobGeracaoIAPorRequestId(contexto, "req-12345678");
    await criarOuBuscarJobGeracaoIA(contexto, {
      requestId: "req-12345678",
      titulo: "Teste",
      descricao: "Teste",
      payload: {},
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  const consulta = chamadas[0];
  const escrita = chamadas.find((item) => item.init?.method === "POST");

  assert.ok(consulta);
  assert.equal(
    new Headers(consulta.init?.headers).get("authorization"),
    contexto.authorization
  );
  assert.ok(escrita);
  assert.equal(
    new Headers(escrita?.init?.headers).get("authorization"),
    `Bearer ${contexto.serviceRoleKey}`
  );
  assert.equal(
    new Headers(escrita?.init?.headers).get("apikey"),
    contexto.serviceRoleKey
  );
});
