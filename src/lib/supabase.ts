import {
  createClient,
} from "@supabase/supabase-js";

const PREVIEW_SUPABASE_URL =
  "https://kibnmdwabpiwyprkrhvq.supabase.co";

const PREVIEW_SUPABASE_PUBLIC_KEY =
  "sb_publishable_hcInKQ8p4J490tnsZe8EQg_UQWZ8UHQ";

export const SUPABASE_PUBLIC_URL =
  import.meta.env.VITE_SUPABASE_URL ||
  PREVIEW_SUPABASE_URL;

export const SUPABASE_PUBLIC_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  PREVIEW_SUPABASE_PUBLIC_KEY;

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
