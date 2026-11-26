import assert from "node:assert/strict";
import test from "node:test";
import { stagingSupabase, validatePreview } from "../scripts/previewEnvironment.ts";

const api = "https://api.staging.invalid";
const payload = Buffer.from(JSON.stringify({ ref: "isjzyyoqvftrltkctanw", role: "anon" })).toString("base64url");
const valid = { VITE_API_URL: api, VITE_SUPABASE_URL: stagingSupabase, VITE_SUPABASE_ANON_KEY: "fixture." + payload + ".fixture" };

test("requires explicit verified staging destinations", () => {
  assert.throws(() => validatePreview({}));
  assert.throws(() => validatePreview(valid));
  assert.doesNotThrow(() => validatePreview(valid, [api]));
  for (const overrides of [
    { VITE_API_URL: "https://pmpe-study-pro-api.onrender.com" },
    { VITE_SUPABASE_URL: "https://kibnmdwabpiwyprkrhvq.supabase.co" },
    { VITE_SUPABASE_ANON_KEY: "" }, { VITE_SENTRY_DSN: "production" }
  ]) assert.throws(() => validatePreview({ ...valid, ...overrides }, [api]));
});
