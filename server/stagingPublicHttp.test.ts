import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

// No credentials, no fixtures, no writes. Exercises the REAL staging HTTP API.
const staging = "https://isjzyyoqvftrltkctanw.supabase.co";
const enabled = process.env.VITE_STUDY_PRO_STAGING_GUARD === "true";

test("prévia staging: Auth HTTP saudável e anônimo sem acesso a dados privados", {
  skip: !enabled,
  timeout: 45_000,
}, async () => {
  assert.equal(process.env.VITE_SUPABASE_URL, staging);
  const anon = process.env.VITE_SUPABASE_ANON_KEY;
  assert.ok(anon, "Staging publishable key unavailable");

  const health = await fetch(`${staging}/auth/v1/health`, {
    headers: { apikey: anon },
    signal: AbortSignal.timeout(15_000),
  });
  assert.equal(health.status, 200, "GoTrue health endpoint unavailable");

  const client = createClient(staging, anon, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data: session } = await client.auth.getSession();
  assert.equal(session.session, null, "Test client must start unauthenticated");

  const configRead = await client.from("configuracoes").select("user_id").limit(1);
  assert.ok(configRead.error, "Anonymous user read protected sync state");

  const profilesRead = await client.from("perfis").select("id").limit(1);
  assert.ok(profilesRead.error, "Anonymous user read private profiles");

  const forbiddenWrite = await client.rpc("salvar_estado_app_cas", {
    p_expected_revision: 0,
    p_estado: {
      syncRevision: 1,
      sessoes: [], questoes: [], revisoes: [], simulados: [], missoesConcluidas: [],
    },
  });
  assert.ok(forbiddenWrite.error, "Anonymous caller executed private CAS");
  console.info("STAGING_PUBLIC_HTTP_PASS: GoTrue, anonymous RLS and CAS permission gates");
});
