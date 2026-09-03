import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Executa o mesmo handler do AuthProvider, sem importar as variáveis Vite
// nem conectar uma conta real. Não duplica a opção de escopo no teste.
const contexto = readFileSync(new URL("../src/context/AuthContext.tsx", import.meta.url), "utf8");
const handler = contexto.match(/async function sair\(\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(handler, "O handler sair do AuthProvider precisa estar coberto pelo teste.");

function sairPeloApp(supabase: SupabaseClient): Promise<void> {
  return runInNewContext(`(${handler})()`, {
    supabase,
    traduzirErro: (mensagem: string) => mensagem,
  });
}

function prepararAparelhos(falharLogout = false) {
  const ativas = new Set(["celular", "computador"]);
  const escopos: (string | null)[] = [];
  const usuario = {
    id: "mesmo-usuario",
    aud: "authenticated",
    role: "authenticated",
    email: "teste@example.test",
    app_metadata: {},
    user_metadata: {},
    created_at: "2026-09-01T00:00:00Z",
  };
  function sessao(aparelho: string) {
    return {
      access_token: `acesso-${aparelho}`,
      refresh_token: `renovacao-${aparelho}`,
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: usuario,
    };
  }
  const fetchSimulado: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    if (url.pathname === "/auth/v1/logout") {
      const escopo = url.searchParams.get("scope");
      escopos.push(escopo);
      if (falharLogout) {
        return Response.json({ msg: "Falha temporária ao sair" }, { status: 500 });
      }
      const token = new Headers(init?.headers).get("Authorization");
      const atual = token?.replace("Bearer acesso-", "");
      assert.ok(atual && ativas.has(atual));
      if (escopo === "local") ativas.delete(atual);
      else if (escopo === "others") {
        for (const aparelho of ativas) if (aparelho !== atual) ativas.delete(aparelho);
      } else ativas.clear();
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/auth/v1/token" && url.searchParams.get("grant_type") === "refresh_token") {
      const { refresh_token } = JSON.parse(String(init?.body));
      const aparelho = refresh_token.replace("renovacao-", "");
      return ativas.has(aparelho)
        ? Response.json(sessao(aparelho))
        : Response.json({ msg: "Refresh token revogado", code: "refresh_token_not_found" }, { status: 400 });
    }
    throw new Error(`Requisição inesperada no teste: ${url.pathname}`);
  };
  function aparelho(nome: string) {
    const chave = `auth-teste-${nome}`;
    const pendente = "pmpe:seguranca:sync-pendente:mesmo-usuario";
    const estudos = "pmpe:mesmo-usuario:materias";
    const storage = new Map([
      [chave, JSON.stringify(sessao(nome))],
      [pendente, '{"baseRevision":12,"notas":"ainda não sincronizadas"}'],
      [estudos, '[{"nome":"Português","concluido":true}]'],
    ]);
    const client = createClient("https://auth.example.test", "chave-publica-teste", {
      global: { fetch: fetchSimulado },
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: true,
        storageKey: chave,
        storage: {
          getItem: key => storage.get(key) ?? null,
          setItem: (key, value) => { storage.set(key, value); },
          removeItem: key => { storage.delete(key); },
        },
      },
    });
    return { client, storage, chave, pendente, estudos };
  }
  return { celular: aparelho("celular"), computador: aparelho("computador"), ativas, escopos };
}

for (const origem of ["celular", "computador"] as const) {
  test(`sair no ${origem} encerra apenas essa sessão e preserva o outro aparelho e os estudos`, async () => {
    const ambiente = prepararAparelhos();
    const atual = ambiente[origem];
    const outro = ambiente[origem === "celular" ? "computador" : "celular"];
    await Promise.all([atual.client.auth.getSession(), outro.client.auth.getSession()]);
    const pendenteAntes = atual.storage.get(atual.pendente);
    const estudosAntes = atual.storage.get(atual.estudos);
    const eventos: string[] = [];
    const { data } = atual.client.auth.onAuthStateChange(evento => { eventos.push(evento); });
    try {
      await sairPeloApp(atual.client);
      assert.deepEqual(ambiente.escopos, ["local"]);
      assert.equal((await atual.client.auth.getSession()).data.session, null);
      assert.equal(atual.storage.has(atual.chave), false);
      assert.ok(eventos.includes("SIGNED_OUT"));
      assert.equal(atual.storage.get(atual.pendente), pendenteAntes);
      assert.equal(atual.storage.get(atual.estudos), estudosAntes);
      // Renovar prova que o outro acesso não ficou apenas com um JWT antigo.
      const renovacao = await outro.client.auth.refreshSession();
      assert.equal(renovacao.error, null);
      assert.equal(renovacao.data.session?.user.id, "mesmo-usuario");
      assert.ok(outro.storage.has(outro.chave));
      assert.equal(ambiente.ativas.size, 1);
    } finally {
      data.subscription.unsubscribe();
    }
  });
}

test("falha ao sair é propagada sem apagar estudos nem tentar logout global", async () => {
  const ambiente = prepararAparelhos(true);
  const { client, storage } = ambiente.celular;
  await client.auth.getSession();
  const { pendente, estudos } = ambiente.celular;
  const pendenteAntes = storage.get(pendente);
  const estudosAntes = storage.get(estudos);
  await assert.rejects(sairPeloApp(client), /Falha temporária ao sair/);
  assert.deepEqual(ambiente.escopos, ["local"]);
  assert.equal(storage.get(pendente), pendenteAntes);
  assert.equal(storage.get(estudos), estudosAntes);
  assert.equal(ambiente.ativas.size, 2);
  assert.equal((await ambiente.computador.client.auth.refreshSession()).error, null);
});
