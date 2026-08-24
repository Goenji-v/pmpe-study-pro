export type RegraLimiteApi = {
  janelaMs: number;
  maximo: number;
};

const ORIGEM_PRODUCAO_PADRAO =
  "https://pmpe-study-pro-two.vercel.app";

export function montarOrigensPermitidas(
  valorConfigurado = process.env.FRONTEND_URL || ""
) {
  const configuradas = valorConfigurado
    .split(",")
    .map((origem) => origem.trim().replace(/\/$/, ""))
    .filter(Boolean);

  return new Set([
    ORIGEM_PRODUCAO_PADRAO,
    ...configuradas,
  ]);
}

export function origemPermitida(
  origem: string | undefined,
  permitidas: ReadonlySet<string>
) {
  if (!origem) return true;

  const normalizada = origem.trim().replace(/\/$/, "");
  if (permitidas.has(normalizada)) return true;

  return /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/i.test(
    normalizada
  );
}

export function rotaPublica(
  metodo: string | undefined,
  caminho: string
) {
  if ((metodo || "GET").toUpperCase() === "OPTIONS") return true;
  return caminho === "/api/saude";
}

export function limiteCorpoBytes(caminho: string) {
  if (caminho === "/api/analisar-prova") {
    return 36 * 1024 * 1024;
  }

  return 1024 * 1024;
}

export function regraRateLimit(caminho: string): RegraLimiteApi {
  if (caminho === "/api/analisar-prova") {
    return { janelaMs: 60 * 60 * 1000, maximo: 10 };
  }

  if (caminho === "/api/gerar") {
    return { janelaMs: 60 * 60 * 1000, maximo: 60 };
  }

  if (caminho === "/api/coach" || caminho === "/api/cronograma") {
    return { janelaMs: 60 * 60 * 1000, maximo: 30 };
  }

  return { janelaMs: 60 * 60 * 1000, maximo: 120 };
}

export function extrairBearer(valor: string | undefined) {
  if (!valor) return null;
  const correspondencia = valor.match(/^Bearer\s+(.+)$/i);
  const token = correspondencia?.[1]?.trim();
  return token || null;
}
