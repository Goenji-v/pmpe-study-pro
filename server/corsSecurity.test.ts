import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { frontendStaging, validateBackend } from "./backendEnvironment.ts";
import { corsOptions, origemPermitida } from "./corsConfig.ts";
import { stagingSupabase } from "../scripts/previewEnvironment.ts";

const prod = "https://pmpe-study-pro-two.vercel.app";
test("CORS staging aceita exclusivamente a origem FSRS nos navegadores", () => {
  const env = { RENDER_SERVICE_NAME: "pmpe-study-pro-api-staging", FRONTEND_URL: prod };
  assert.equal(corsOptions.credentials, false);
  assert.ok(origemPermitida(frontendStaging, env));
  for (const origem of [prod, frontendStaging + ".example.org", "http://localhost:5173", "https://preview-simulado-pdf.vercel.app"])
    assert.equal(origemPermitida(origem, env), false);
});
test("CORS produção rejeita staging e origens locais", () => {
  const env = { NODE_ENV: "production", FRONTEND_URL: frontendStaging };
  assert.ok(origemPermitida(prod, env));
  assert.equal(origemPermitida(frontendStaging, env), false);
  assert.equal(origemPermitida("http://localhost:5173", env), false);
});
test("CORS desenvolvimento local preserva localhost e rede local", () => {
  for (const host of ["localhost", "127.0.0.1", "192.168.0.1"])
    assert.ok(origemPermitida("http://" + host + ":5173", {}));
  assert.equal(origemPermitida("https://outsider.example", {}), false);
});
test("Render staging valida destinos e credenciais antes de iniciar", () => {
  const payload = Buffer.from(JSON.stringify({role:"anon", ref:"isjzyyoqvftrltkctanw"})).toString("base64url");
  const env = { RENDER_SERVICE_ID:"srv-damnctou01pc7389opcg", RENDER_GIT_BRANCH:"preview/fsrs-revisoes-20261123",
    FRONTEND_URL:frontendStaging, SUPABASE_URL:stagingSupabase, SUPABASE_ANON_KEY:"fixture."+payload+".fixture",
    GEMINI_API_KEY:"synthetic", STAGING_GEMINI_KEY_SHA256:createHash("sha256").update("synthetic").digest("hex") };
  assert.doesNotThrow(() => validateBackend(env,"24.0.0"));
  assert.throws(() => validateBackend(env,"20.0.0"));
  for (const overrides of [{SUPABASE_URL:undefined},{SUPABASE_URL:"https://kibnmdwabpiwyprkrhvq.supabase.co"},
    {SUPABASE_ANON_KEY:"invalid"},{GEMINI_API_KEY:"other"},{SENTRY_DSN:"production"},{FRONTEND_URL:prod},
    {RENDER_GIT_BRANCH:"main"},{GOOGLE_GEMINI_BASE_URL:"https://other.example"}])
    assert.throws(() => validateBackend({...env,...overrides},"24.0.0"));
});
