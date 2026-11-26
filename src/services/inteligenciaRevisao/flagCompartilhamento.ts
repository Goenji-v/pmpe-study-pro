export function fsrsCompartilhamentoHabilitado() {
  if (import.meta.env?.VITE_PLANO_ADAPTATIVO !== "true" || !import.meta.env.VITE_FSRS_SYNC_CONTAS) return false;
  const url = import.meta.env.VITE_SUPABASE_URL;
  return url === "https://isjzyyoqvftrltkctanw.supabase.co" ||
    (import.meta.env.DEV && /^http:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?$/.test(url ?? ""));
}
