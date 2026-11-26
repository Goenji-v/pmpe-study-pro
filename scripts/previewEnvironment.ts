export const stagingSupabase = "https://isjzyyoqvftrltkctanw.supabase.co";
export const stagingApi = "https://pmpe-study-pro-api-staging.onrender.com";
const verifiedApis: readonly string[] = [stagingApi];

export function validatePreview(env: Record<string, string | undefined>, allowedApis = verifiedApis) {
  if (!env.VITE_API_URL || !allowedApis.includes(env.VITE_API_URL))
    throw new Error("Preview requires a verified staging API");
  if (env.VITE_SUPABASE_URL !== stagingSupabase)
    throw new Error("Preview requires staging Supabase");
  const key = env.VITE_SUPABASE_ANON_KEY || "";
  const payload = JSON.parse(Buffer.from(key.split(".")[1] || "", "base64url").toString() || "{}");
  if (payload.ref !== "isjzyyoqvftrltkctanw" || payload.role !== "anon")
    throw new Error("Preview requires the staging anon key");
  if (env.VITE_SENTRY_DSN || env.SENTRY_AUTH_TOKEN)
    throw new Error("Disable Sentry reporting and uploads in preview");
}
