const PADROES_CHUNK_DINAMICO = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "error loading dynamically imported module",
  "failed to load module script",
  "chunkloaderror",
  "loading chunk",
  "unable to preload css for",
  "failed to preload css",
  "failed to load stylesheet",
  "loading css chunk",
  "css chunk load failed",
];

const CHAVE_RELOAD_CHUNK = "study-pro:reload-chunk-dinamico";
const PARAMETRO_RELOAD_CHUNK = "__sp_refresh";
const JANELA_RELOAD_CHUNK_MS = 30_000;

export function ehErroChunkDinamico(erro: unknown) {
  const mensagem =
    erro instanceof Error
      ? `${erro.name} ${erro.message}`
      : typeof erro === "string"
        ? erro
        : erro && typeof erro === "object" && "message" in erro
          ? String((erro as { message?: unknown }).message || "")
          : "";

  const normalizada = mensagem.toLowerCase();
  return PADROES_CHUNK_DINAMICO.some((padrao) => normalizada.includes(padrao));
}

export function limparMarcadorRecuperacaoChunkDaUrl() {
  if (typeof window === "undefined") return;

  try {
    const atual = new URL(window.location.href);
    if (!atual.searchParams.has(PARAMETRO_RELOAD_CHUNK)) return;

    atual.searchParams.delete(PARAMETRO_RELOAD_CHUNK);
    const limpa = `${atual.pathname}${atual.search}${atual.hash}`;
    window.history.replaceState(window.history.state, "", limpa);
  } catch {
    // O marcador é apenas técnico; falhar ao limpá-lo não bloqueia o app.
  }
}

export function tentarRecarregarChunkObsoletoUmaVez() {
  if (typeof window === "undefined") return false;

  try {
    const agora = Date.now();
    const ultimaTentativa = Number(
      window.sessionStorage.getItem(CHAVE_RELOAD_CHUNK) || "0"
    );

    if (
      Number.isFinite(ultimaTentativa) &&
      ultimaTentativa > 0 &&
      agora - ultimaTentativa < JANELA_RELOAD_CHUNK_MS
    ) {
      return false;
    }

    window.sessionStorage.setItem(CHAVE_RELOAD_CHUNK, String(agora));

    const destino = new URL(window.location.href);
    destino.searchParams.set(PARAMETRO_RELOAD_CHUNK, String(agora));

    // Um endereço de navegação único força a obtenção do index atual após
    // um deploy e evita que o navegador simplesmente recarregue a mesma
    // árvore de chunks antigos que acabou de falhar.
    window.location.replace(destino.toString());
    return true;
  } catch {
    return false;
  }
}
