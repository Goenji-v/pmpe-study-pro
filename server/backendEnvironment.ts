import { createHash } from "node:crypto";
import { stagingApi, stagingSupabase, validatePreview } from "../scripts/previewEnvironment.ts";

export const frontendStaging = "https://pmpe-study-pro-git-preview-fsrs-revisoes-a1d2d6-pmpe-study-pro.vercel.app";
const branch = "preview/fsrs-revisoes-20261123";
type Env = Record<string, string | undefined>;

export function isStaging(env: Env) {
  return env.RENDER_SERVICE_ID === "srv-damnctou01pc7389opcg" ||
    env.RENDER_SERVICE_NAME === "pmpe-study-pro-api-staging" ||
    env.RENDER_EXTERNAL_URL === stagingApi || env.RENDER_GIT_BRANCH === branch ||
    env.STUDY_PRO_ENV === "staging";
}

export function validateBackend(env: Env, node = process.versions.node) {
  if (!isStaging(env)) return;
  if (env.RENDER_SERVICE_ID !== "srv-damnctou01pc7389opcg" || env.RENDER_GIT_BRANCH !== branch ||
      env.FRONTEND_URL !== frontendStaging || !node.startsWith("24."))
    throw new Error("Staging: confira serviço, branch, frontend e Node 24.");
  validatePreview({ VITE_API_URL: stagingApi, VITE_SUPABASE_URL: env.SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY: env.SUPABASE_ANON_KEY, VITE_SENTRY_DSN: env.SENTRY_DSN });
  const key = env.GEMINI_API_KEY?.trim();
  if (!key || createHash("sha256").update(key).digest("hex") !== env.STAGING_GEMINI_KEY_SHA256 ||
      env.GOOGLE_GENAI_USE_VERTEXAI || env.GOOGLE_GEMINI_BASE_URL || env.GOOGLE_VERTEX_BASE_URL)
    throw new Error("Staging: confira a credencial Gemini aprovada e o endpoint padrão.");
}

export function supabaseOrigin(env: Env) {
  validateBackend(env);
  return isStaging(env) ? stagingSupabase : env.SUPABASE_URL || "https://kibnmdwabpiwyprkrhvq.supabase.co";
}
