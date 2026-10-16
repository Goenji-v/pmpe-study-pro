const PROTOCOLOS_PERMITIDOS = new Set(["http:", "https:"]);

/**
 * Retorna a URL apenas se for http(s) válida, sem credenciais embutidas.
 * Bloqueia esquemas perigosos como javascript:, data: e vbscript: (inclusive com
 * maiúsculas, espaços ou caracteres de controle no início).
 */
export function urlSegura(valor?: string | null, base?: string): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpo = Array.from(valor).filter((c) => { const n = c.charCodeAt(0); return n > 31 && n !== 127; }).join("").trim();
  if (!limpo || limpo.length > 2000) return undefined;
  try {
    const url = base ? new URL(limpo, base) : new URL(limpo);
    if (!PROTOCOLOS_PERMITIDOS.has(url.protocol) || url.username || url.password) return undefined;
    return url.href;
  } catch {
    return undefined;
  }
}
