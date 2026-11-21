import {
  createClient,
} from "@supabase/supabase-js";

export const SUPABASE_PUBLIC_URL =
  import.meta.env
    .VITE_SUPABASE_URL;

export const SUPABASE_PUBLIC_KEY =
  import.meta.env
    .VITE_SUPABASE_ANON_KEY;

if (
  !SUPABASE_PUBLIC_URL ||
  !SUPABASE_PUBLIC_KEY
) {
  throw new Error(
    "As variáveis do Supabase não foram configuradas no arquivo .env."
  );
}

// Never let the isolated sync-preview connect to the real users' database.
// This flag is configured only on the PR #562 Vercel preview branch.
if (
  import.meta.env.VITE_STUDY_PRO_STAGING_GUARD === "true" &&
  SUPABASE_PUBLIC_URL !== "https://isjzyyoqvftrltkctanw.supabase.co"
) {
  throw new Error(
    "Prévia de testes bloqueada: conexão Supabase fora do staging isolado."
  );
}

export const supabase =
  createClient(
    SUPABASE_PUBLIC_URL,
    SUPABASE_PUBLIC_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    }
  );
