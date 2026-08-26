const PADROES_CHUNK_DINAMICO = [
  "failed to fetch dynamically imported module",
  "importing a module script failed",
  "failed to load module script",
  "chunkloaderror",
  "loading chunk",
];

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
