import type { Request, Response } from "express";

const LIMITE_ENVELOPE_BYTES = 512 * 1024;
const JANELA_RATE_LIMIT_MS = 60_000;
const LIMITE_POR_IP = 120;
const acessosPorIp = new Map<string, { inicio: number; quantidade: number }>();

type DsnSentry = {
  host: string;
  publicKey: string;
  projectId: string;
};

export function interpretarDsnSentry(valor: string): DsnSentry {
  const url = new URL(valor);
  const partes = url.pathname.split("/").filter(Boolean);
  const projectId = partes.at(-1) || "";

  if (
    url.protocol !== "https:" ||
    !url.username ||
    !projectId ||
    !/^\d+$/.test(projectId)
  ) {
    throw new Error("DSN do Sentry inválido.");
  }

  return {
    host: url.host,
    publicKey: url.username,
    projectId,
  };
}

export function origemPermitidaNoTunnel(origem: string) {
  return (
    /^https:\/\/pmpe-study-pro-two\.vercel\.app$/i.test(origem) ||
    /^https:\/\/pmpe-study-[a-z0-9-]+-pmpe-study-pro\.vercel\.app$/i.test(origem) ||
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origem)
  );
}

export function envelopePertenceAoDsn(
  corpo: Buffer,
  dsnPermitido: string
) {
  const quebraLinha = corpo.indexOf(0x0a);
  if (quebraLinha <= 0) return false;

  try {
    const cabecalho = JSON.parse(
      corpo.subarray(0, quebraLinha).toString("utf8")
    ) as { dsn?: unknown };

    if (typeof cabecalho.dsn !== "string") return false;

    const recebido = interpretarDsnSentry(cabecalho.dsn);
    const permitido = interpretarDsnSentry(dsnPermitido);

    return (
      recebido.host === permitido.host &&
      recebido.publicKey === permitido.publicKey &&
      recebido.projectId === permitido.projectId
    );
  } catch {
    return false;
  }
}

function excedeuRateLimit(req: Request) {
  const encaminhado = req.header("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = encaminhado || req.ip || "desconhecido";
  const agora = Date.now();
  const atual = acessosPorIp.get(ip);

  if (!atual || agora - atual.inicio >= JANELA_RATE_LIMIT_MS) {
    acessosPorIp.set(ip, { inicio: agora, quantidade: 1 });
    return false;
  }

  atual.quantidade += 1;
  return atual.quantidade > LIMITE_POR_IP;
}

export async function encaminharEnvelopeSentry(
  req: Request,
  res: Response
) {
  const dsnPermitido = process.env.SENTRY_TUNNEL_DSN?.trim();
  const origem = req.header("origin")?.trim() || "";

  if (!dsnPermitido) {
    res.status(503).end();
    return;
  }

  if (!origem || !origemPermitidaNoTunnel(origem)) {
    res.status(403).end();
    return;
  }

  if (excedeuRateLimit(req)) {
    res.setHeader("Retry-After", "60");
    res.status(429).end();
    return;
  }

  const corpo = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(req.body || "");

  if (!corpo.length || corpo.length > LIMITE_ENVELOPE_BYTES) {
    res.status(413).end();
    return;
  }

  if (!envelopePertenceAoDsn(corpo, dsnPermitido)) {
    res.status(403).end();
    return;
  }

  try {
    const dsn = interpretarDsnSentry(dsnPermitido);
    const destino = new URL(
      `https://${dsn.host}/api/${dsn.projectId}/envelope/`
    );
    destino.searchParams.set("sentry_key", dsn.publicKey);
    destino.searchParams.set("sentry_version", "7");

    const resposta = await fetch(destino, {
      method: "POST",
      headers: {
        "content-type": "application/x-sentry-envelope",
      },
      body: corpo,
      signal: AbortSignal.timeout(8_000),
    });

    const retryAfter = resposta.headers.get("retry-after");
    if (retryAfter) res.setHeader("Retry-After", retryAfter);

    res.status(resposta.status).end();
  } catch (erro) {
    console.error("Falha ao encaminhar envelope ao Sentry:", erro);
    res.status(502).end();
  }
}
