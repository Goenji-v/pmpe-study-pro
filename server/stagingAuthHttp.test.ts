import assert from "node:assert/strict";
import test from "node:test";
import { createClient } from "@supabase/supabase-js";

// One-off integration gate. Credentials are ONLY in Vercel branch-specific
// encrypted build environment variables, never in source or browser assets.
const mode = process.env.STAGING_AUTH_HTTP_TEST_MODE ?? "";
const enabled = process.env.STAGING_AUTH_HTTP_TEST_ENABLED === "true";
const expectedUrl = "https://isjzyyoqvftrltkctanw.supabase.co";

function client() {
  assert.equal(process.env.VITE_STUDY_PRO_STAGING_GUARD, "true");
  assert.equal(process.env.VITE_SUPABASE_URL, expectedUrl);
  const key = process.env.VITE_SUPABASE_ANON_KEY;
  assert.ok(key && key.length > 30, "Missing staging-only public key");
  return createClient(expectedUrl, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function fixture(name: "A" | "B") {
  const email = process.env[`STAGING_AUTH_HTTP_TEST_EMAIL_${name}`];
  const password = process.env[`STAGING_AUTH_HTTP_TEST_PASSWORD_${name}`];
  assert.ok(email && /^study-pro-pr562-[a-z0-9-]+@example\.com$/.test(email));
  assert.ok(password && password.length >= 22, "Missing strong test password");
  return { email, password };
}

function state(rev: number, sessions: string[]) {
  return {
    syncRevision: rev,
    sessoes: sessions.map((id) => ({ id })),
    questoes: [],
    revisoes: [],
    simulados: [],
    missoesConcluidas: [],
    configuracoes: {},
  };
}

function firstRow(data: unknown) {
  return Array.isArray(data) ? data[0] : data;
}

test("staging Supabase Auth via real HTTP and CAS via PostgREST", {
  skip: !enabled,
  timeout: 90_000,
}, async () => {
  assert.ok(mode === "signup" || mode === "login", "Invalid staging test mode");
  const a = fixture("A");
  const b = fixture("B");

  if (mode === "signup") {
    const outcomes: string[] = [];
    for (const f of [a, b]) {
      const c = client();
      const { data, error } = await c.auth.signUp({
        email: f.email,
        password: f.password,
        options: { data: { nome: "Aluno Fictício Staging" } },
      });
      assert.ifError(error);
      assert.ok(data.user?.id, "GoTrue did not return a user");
      outcomes.push(data.session ? "session-issued" : "confirmation-required");
    }
    console.info("STAGING_AUTH_SIGNUP:", outcomes.join(","));
    return;
  }

  // Two separate clients imitate the same student's PC/mobile sessions,
  // while B exercises actual JWT isolation for another test account.
  const pc = client(), phone = client(), other = client();
  const authA = await pc.auth.signInWithPassword(a);
  assert.ifError(authA.error);
  const userId = authA.data.user?.id;
  assert.ok(userId && authA.data.session?.access_token, "PC login failed");
  const authPhone = await phone.auth.signInWithPassword(a);
  assert.ifError(authPhone.error);
  assert.equal(authPhone.data.user?.id, userId);
  const authB = await other.auth.signInWithPassword(b);
  assert.ifError(authB.error);
  assert.ok(authB.data.user?.id && authB.data.user?.id !== userId);

  const first = await pc.rpc("salvar_estado_app_cas", {
    p_expected_revision: 0, p_estado: state(1, ["initial"]),
  });
  assert.ifError(first.error);
  assert.equal(firstRow(first.data)?.ok, true);

  const [pcRace, mobileRace] = await Promise.all([
    pc.rpc("salvar_estado_app_cas", {
      p_expected_revision: 1, p_estado: state(2, ["initial", "pc"]),
    }),
    phone.rpc("salvar_estado_app_cas", {
      p_expected_revision: 1, p_estado: state(2, ["initial", "mobile"]),
    }),
  ]);
  assert.ifError(pcRace.error);
  assert.ifError(mobileRace.error);
  const won = [firstRow(pcRace.data)?.ok, firstRow(mobileRace.data)?.ok];
  assert.equal(won.filter(Boolean).length, 1, "Exactly one concurrent writer must win");

  const read = await phone.from("configuracoes").select("dados").eq("user_id", userId).single();
  assert.ifError(read.error);
  const appState = read.data?.dados?.appState;
  assert.equal(appState?.syncRevision, 2);
  assert.equal(appState?.sessoes?.length, 2);
  assert.equal(appState?.sessoes?.[0]?.id, "initial");

  const cross = await other.from("configuracoes").select("user_id").eq("user_id", userId);
  assert.ifError(cross.error);
  assert.equal(cross.data?.length, 0, "RLS leaked another account's state");

  const direct = await pc.from("configuracoes")
    .update({ dados: { appState: state(999, []) } }).eq("user_id", userId);
  assert.ok(direct.error, "Direct UPDATE must not bypass CAS");

  const stale = await phone.rpc("salvar_estado_app_cas", {
    p_expected_revision: 1, p_estado: state(2, []),
  });
  assert.ifError(stale.error);
  assert.equal(firstRow(stale.data)?.ok, false, "Stale retry accepted");

  const forged = await phone.rpc("salvar_estado_app_cas", {
    p_expected_revision: 2, p_estado: state(300, []),
  });
  assert.ok(forged.error, "Forged revision accepted");

  const regression = await phone.rpc("salvar_estado_app_cas", {
    p_expected_revision: 2, p_estado: state(3, []),
  });
  assert.ifError(regression.error);
  assert.equal(firstRow(regression.data)?.ok, false, "History regression accepted");

  const unchanged = await pc.from("configuracoes").select("dados").eq("user_id", userId).single();
  assert.ifError(unchanged.error);
  assert.equal(unchanged.data?.dados?.appState?.syncRevision, 2);
  console.info("STAGING_AUTH_HTTP_PASS: two JWT sessions, two-client CAS, RLS, direct-write denial, stale and regression protection");
});
