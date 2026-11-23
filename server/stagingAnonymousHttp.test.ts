import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

// Temporary disposable identity tests. They run ONLY in the branch-scoped
// staging build, when explicitly enabled; never in production or local builds.
// Anonymous GoTrue accounts have authenticated JWTs, so these exercise real
// PostgREST RLS/CAS without emails or permanent credentials.
const STAGING_URL = "https://isjzyyoqvftrltkctanw.supabase.co";
const TAG = "study-pro-pr562-20261120-anon-http";
const enabled = process.env.STAGING_ANONYMOUS_TEST_ENABLED === "true";

function settings() {
  assert.equal(process.env.VITE_STUDY_PRO_STAGING_GUARD, "true", "Not a staging-only build");
  assert.equal(process.env.VITE_SUPABASE_URL, STAGING_URL, "Unexpected Supabase endpoint");
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  assert.ok(key && key.length > 25, "Missing staging public key");
  return { key };
}

function appState(revision: number, sessions: string[]) {
  return {
    syncRevision: revision,
    sessoes: sessions.map((id) => ({ id })),
    questoes: [], revisoes: [], simulados: [], missoesConcluidas: [], configuracoes: {},
  };
}

async function request(token: string, key: string, path: string, method: "GET" | "POST" | "PATCH", payload?: unknown) {
  const response = await fetch(STAGING_URL + "/rest/v1/" + path, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: payload === undefined ? undefined : JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  const json = text ? JSON.parse(text) : null;
  return { status: response.status, json };
}

function row(result: { status: number; json: unknown }) {
  assert.equal(result.status, 200, `RPC HTTP failed (${result.status}): ${JSON.stringify(result.json).slice(0, 250)}`);
  const parsed = result.json as Record<string, unknown> | Record<string, unknown>[];
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

test("staging anonymous JWT: CAS concurrency, RLS and direct-write denial", {
  skip: !enabled,
  timeout: 90000,
}, async (t) => {
  const { key } = settings();
  function newClient() {
    return createClient(STAGING_URL, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
  }
  const student = newClient();
  const anonymous = await student.auth.signInAnonymously({
    options: { data: { study_pro_qa_tag: TAG, name: "Study Pro Test Only" } },
  });
  if (anonymous.error) {
    const message = anonymous.error.message ?? "";
    // Provider flag is intentionally left unchanged. Report the missing
    // prerequisite rather than falsely claiming a passing JWT test.
    if (/anonymous.*(disabled|not enabled|not allowed)|signups?.*disabled/i.test(message)) {
      console.info("STAGING_ANONYMOUS_DISABLED: provider must be enabled only in staging to run this optional test");
      t.skip("Supabase staging has anonymous sign-ins disabled");
      return;
    }
    throw anonymous.error;
  }

  const ownToken = anonymous.data.session?.access_token;
  const ownerId = anonymous.data.user?.id;
  assert.ok(ownToken && ownerId, "Anonymous GoTrue session missing JWT or user ID");
  assert.equal(anonymous.data.user?.is_anonymous, true);
  console.info("STAGING_ANONYMOUS_CREATED_A:", ownerId, "tag:", TAG);

  const other = newClient();
  const otherAuth = await other.auth.signInAnonymously({
    options: { data: { study_pro_qa_tag: TAG, name: "Study Pro Test Only" } },
  });
  assert.ifError(otherAuth.error);
  const otherToken = otherAuth.data.session?.access_token;
  assert.ok(otherToken && otherAuth.data.user?.id && otherAuth.data.user.id !== ownerId);
  console.info("STAGING_ANONYMOUS_CREATED_B:", otherAuth.data.user.id, "tag:", TAG);

  const cas = (token: string, expectedRevision: number, newRevision: number, sessions: string[]) =>
    request(token, key, "rpc/salvar_estado_app_cas", "POST", {
      p_expected_revision: expectedRevision,
      p_estado: appState(newRevision, sessions),
    });

  const initial = row(await cas(ownToken, 0, 1, ["initial"]));
  assert.equal(initial.ok, true, "Valid initial save should be accepted");

  // Two independent real HTTP requests with the same user JWT simulate
  // competing devices, but are not two independently reauthenticated sessions.
  const [pc, phone] = await Promise.all([
    cas(ownToken, 1, 2, ["initial", "pc"]),
    cas(ownToken, 1, 2, ["initial", "mobile"]),
  ]);
  const outcome = [row(pc).ok, row(phone).ok];
  assert.equal(outcome.filter(Boolean).length, 1, "Exactly one concurrent CAS save must win");

  const ownRead = await request(ownToken, key, `configuracoes?user_id=eq.${ownerId}&select=dados`, "GET");
  assert.equal(ownRead.status, 200);
  const ownRows = ownRead.json as Array<{ dados: { appState: ReturnType<typeof appState> } }>;
  assert.equal(ownRows.length, 1);
  assert.equal(ownRows[0].dados.appState.syncRevision, 2);
  assert.equal(ownRows[0].dados.appState.sessoes[0].id, "initial");

  const crossRead = await request(otherToken, key, `configuracoes?user_id=eq.${ownerId}&select=user_id`, "GET");
  assert.equal(crossRead.status, 200);
  assert.deepEqual(crossRead.json, [], "RLS must prevent another JWT from reading this account");

  const directPatch = await request(ownToken, key, `configuracoes?user_id=eq.${ownerId}`, "PATCH", {
    dados: { appState: appState(999, []) },
  });
  assert.ok(directPatch.status >= 400, "Direct UPDATE must not bypass CAS");

  assert.equal(row(await cas(ownToken, 1, 2, [])).ok, false, "Stale replay must be rejected");
  const forged = await cas(ownToken, 2, 999, []);
  assert.ok(forged.status >= 400, "Forged revision must fail");
  assert.equal(row(await cas(ownToken, 2, 3, [])).ok, false, "Historical regression must fail");

  console.info("STAGING_ANONYMOUS_HTTP_PASS: JWT from GoTrue, two competing HTTP requests, RLS, direct-write and anti-regression");
});
