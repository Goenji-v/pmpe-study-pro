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
