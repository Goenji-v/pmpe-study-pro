const PADROES_CHUNK_DINAMICO = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
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
const JANELA_RELOAD_CHUNK_MS = 30_000;

export function ehErroChunkDinamico(erro: unknown) {
  const mensagem =
    erro instanceof Error
      ? `${erro.name} ${erro.message}`
      : typeof erro === "string"
        ? erro
        : "";

  const normalizada = mensagem.toLowerCase();
  return PADROES_CHUNK_DINAMICO.some((padrao) => normalizada.includes(padrao));
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
    window.location.reload();
    return true;
  } catch {
    return false;
  }
}
