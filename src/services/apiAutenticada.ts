import { supabase } from "../lib/supabase";

const chavePublicaSupabase =
  import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || "";

export async function fetchApiAutenticada(
  url: string,
  init: RequestInit = {}
) {
  const { data, error } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (error || !token) {
    throw new Error("Sua sessão expirou. Entre novamente para usar a inteligência artificial.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);

  if (chavePublicaSupabase) {
    headers.set("X-Supabase-Anon-Key", chavePublicaSupabase);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}
