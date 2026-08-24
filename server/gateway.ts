import "dotenv/config";
import {
  createServer,
  request as criarRequisicaoInterna,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";

import {
  extrairBearer,
  limiteCorpoBytes,
  montarOrigensPermitidas,
  origemPermitida,
  regraRateLimit,
  rotaPublica,
} from "./apiGatewaySecurity.ts";

const portaPublica = Number(process.env.PORT || 3001);
const portaInterna = Number(
  process.env.INTERNAL_API_PORT || portaPublica + 1
);
const supabaseUrl = (
  process.env.SUPABASE_URL ||
  "https://kibnmdwabpiwyprkrhvq.supabase.co"
).replace(/\/$/, "");
const origensPermitidas = montarOrigensPermitidas();

const limites = new Map<
  string,
  { inicio: number; total: number }
>();

// O servidor legado continua responsável somente pelas regras de negócio.
// Ele é carregado em uma porta interna; o Render expõe apenas este gateway.
process.env.PORT = String(portaInterna);
await import("./index.ts");
process.env.PORT = String(portaPublica);

const gateway = createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://gateway.local");
  const caminho = url.pathname;
  const origem = cabecalhoUnico(req.headers.origin);

  aplicarCabecalhosSeguranca(res);

  if (!origemPermitida(origem, origensPermitidas)) {
    responderJson(res, 403, {
      sucesso: false,
      erro: "Origem não autorizada.",
    });
    return;
  }

  aplicarCors(res, origem);

  if ((req.method || "GET").toUpperCase() === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const limiteCorpo = limiteCorpoBytes(caminho);
  const tamanhoDeclarado = Number(
    cabecalhoUnico(req.headers["content-length"]) || 0
  );

  if (
    Number.isFinite(tamanhoDeclarado) &&
    tamanhoDeclarado > limiteCorpo
  ) {
    responderJson(res, 413, {
      sucesso: false,
      erro: "A requisição ultrapassa o limite permitido para esta rota.",
    });
    return;
  }

  let usuarioId = "publico";

  if (!rotaPublica(req.method, caminho)) {
    const validacao = await validarUsuario(req);

    if (!validacao.ok) {
      responderJson(res, validacao.status, {
        sucesso: false,
        erro: validacao.erro,
      });
      return;
    }

    usuarioId = validacao.userId;

    const rate = consumirLimite(`${usuarioId}:${caminho}`, caminho);
    res.setHeader("X-RateLimit-Limit", String(rate.limite));
    res.setHeader("X-RateLimit-Remaining", String(rate.restante));

    if (!rate.permitido) {
      res.setHeader("Retry-After", String(rate.retryAfterSegundos));
      responderJson(res, 429, {
        sucesso: false,
        erro: "Limite temporário de uso da IA atingido. Tente novamente mais tarde.",
      });
      return;
    }
  }

  encaminharParaApiInterna(req, res, origem);
});

gateway.on("clientError", (_erro, socket) => {
  socket.end("HTTP/1.1 400 Bad Request\r\n\r\n");
});

gateway.listen(portaPublica, "0.0.0.0", () => {
  console.log(`[gateway] API protegida na porta ${portaPublica}`);
  console.log(`[gateway] API interna na porta ${portaInterna}`);
});

type ResultadoValidacaoUsuario =
  | { ok: true; userId: string }
  | { ok: false; status: number; erro: string };

async function validarUsuario(
  req: IncomingMessage
): Promise<ResultadoValidacaoUsuario> {
  const autorizacao = cabecalhoUnico(req.headers.authorization);
  const token = extrairBearer(autorizacao);
  const chavePublica = cabecalhoUnico(
    req.headers["x-supabase-anon-key"]
  );

  if (!token || !chavePublica || chavePublica.length < 20) {
    return {
      ok: false,
      status: 401,
      erro: "Sessão não informada ou inválida.",
    };
  }

  try {
    const resposta = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: chavePublica,
        Authorization: `Bearer ${token}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!resposta.ok) {
      return {
        ok: false,
        status: 401,
        erro: "Sessão expirada ou inválida.",
      };
    }

    const usuario = await resposta.json() as { id?: unknown };
    const userId = typeof usuario.id === "string"
      ? usuario.id.trim()
      : "";

    if (!userId) {
      return {
        ok: false,
        status: 401,
        erro: "Não foi possível identificar o usuário autenticado.",
      };
    }

    return { ok: true, userId };
  } catch (erro) {
    console.error("[gateway] Falha ao validar sessão:", erro);
    return {
      ok: false,
      status: 503,
      erro: "O serviço de autenticação está temporariamente indisponível.",
    };
  }
}

function consumirLimite(chave: string, caminho: string) {
  const agora = Date.now();
  const regra = regraRateLimit(caminho);
  const atual = limites.get(chave);

  if (!atual || agora - atual.inicio >= regra.janelaMs) {
    limites.set(chave, { inicio: agora, total: 1 });
    return {
      permitido: true,
      limite: regra.maximo,
      restante: Math.max(0, regra.maximo - 1),
      retryAfterSegundos: Math.ceil(regra.janelaMs / 1000),
    };
  }

  if (atual.total >= regra.maximo) {
    return {
      permitido: false,
      limite: regra.maximo,
      restante: 0,
      retryAfterSegundos: Math.max(
        1,
        Math.ceil((regra.janelaMs - (agora - atual.inicio)) / 1000)
      ),
    };
  }

  atual.total += 1;
  limites.set(chave, atual);

  return {
    permitido: true,
    limite: regra.maximo,
    restante: Math.max(0, regra.maximo - atual.total),
    retryAfterSegundos: Math.max(
      1,
      Math.ceil((regra.janelaMs - (agora - atual.inicio)) / 1000)
    ),
  };
}

function encaminharParaApiInterna(
  req: IncomingMessage,
  res: ServerResponse,
  origem?: string
) {
  const cabecalhos = {
    ...req.headers,
    host: `127.0.0.1:${portaInterna}`,
  };

  const interna = criarRequisicaoInterna(
    {
      hostname: "127.0.0.1",
      port: portaInterna,
      path: req.url || "/",
      method: req.method,
      headers: cabecalhos,
    },
    (respostaInterna) => {
      const cabecalhosResposta = {
        ...respostaInterna.headers,
      };

      for (const nome of Object.keys(cabecalhosResposta)) {
        if (nome.toLowerCase().startsWith("access-control-")) {
          delete cabecalhosResposta[nome];
        }
      }

      aplicarCors(res, origem);
      aplicarCabecalhosSeguranca(res);
      res.writeHead(
        respostaInterna.statusCode || 502,
        cabecalhosResposta
      );
      respostaInterna.pipe(res);
    }
  );

  interna.on("error", (erro) => {
    console.error("[gateway] API interna indisponível:", erro);
    if (!res.headersSent) {
      responderJson(res, 502, {
        sucesso: false,
        erro: "A API de inteligência está temporariamente indisponível.",
      });
      return;
    }
    res.destroy();
  });

  req.pipe(interna);
}

function aplicarCors(
  res: ServerResponse,
  origem?: string
) {
  if (origem) {
    res.setHeader("Access-Control-Allow-Origin", origem);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Supabase-Anon-Key, X-Importacao-Id"
  );
  res.setHeader("Access-Control-Max-Age", "600");
}

function aplicarCabecalhosSeguranca(res: ServerResponse) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("Cross-Origin-Resource-Policy", "same-site");
}

function responderJson(
  res: ServerResponse,
  status: number,
  corpo: Record<string, unknown>
) {
  if (res.writableEnded) return;

  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(corpo));
}

function cabecalhoUnico(
  valor: string | string[] | undefined
) {
  return Array.isArray(valor) ? valor[0] : valor;
}
