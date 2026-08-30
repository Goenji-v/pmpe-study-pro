declare const __APP_VERSION__: string;

export function obterVersaoApp() {
  return typeof __APP_VERSION__ !== "undefined" && __APP_VERSION__
    ? __APP_VERSION__
    : "local";
}

export function criarFingerprintErro(mensagem: string, rota: string) {
  const base = `${rota}|${normalizar(mensagem)}`;
  let hash = 2166136261;

  for (let indice = 0; indice < base.length; indice += 1) {
    hash ^= base.charCodeAt(indice);
    hash = Math.imul(hash, 16777619);
  }

  return `erro-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function descreverAmbiente(userAgent: string | null | undefined) {
  const ua = userAgent ?? "";

  const navegador = /Edg\//i.test(ua)
    ? "Edge"
    : /Firefox\//i.test(ua)
      ? "Firefox"
      : /CriOS\//i.test(ua)
        ? "Chrome iOS"
        : /Chrome\//i.test(ua)
          ? "Chrome"
          : /Safari\//i.test(ua)
            ? "Safari"
            : "Navegador desconhecido";

  const sistema = /Android/i.test(ua)
    ? "Android"
    : /iPhone|iPad|iPod/i.test(ua)
      ? "iOS"
      : /Windows/i.test(ua)
        ? "Windows"
        : /Mac OS X/i.test(ua)
          ? "macOS"
          : /Linux/i.test(ua)
            ? "Linux"
            : "Sistema desconhecido";

  return `${navegador} · ${sistema}`;
}

function normalizar(valor: string) {
  return valor
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, "<url>")
    .replace(/[a-f0-9_-]{12,}/gi, "<id>")
    .replace(/\b\d+\b/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 1000);
}
