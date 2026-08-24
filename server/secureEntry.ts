import "dotenv/config";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import http from "node:http";

const portaPublica = Number(process.env.PORT || 3001);
const portaInterna = Number(
  process.env.INTERNAL_API_PORT || portaPublica + 1
);
const supabaseUrl =
  process.env.SUPABASE_URL ||
  "https://kibnmdwabpiwyprkrhvq.supabase.co";
const anonKeyServidor =
  process.env.SUPABASE_ANON_KEY?.trim() || "";

const origensPermitidas = new Set(
  [
    "https://pmpe-study-pro-two.vercel.app",
    ...(process.env.FRONTEND_URL || "")
      .split(",")
      .map((origem) => origem.trim())
      .filter(Boolean),
  ]
);

const janelaGeralMs = 10 * 60 * 1000;
const limiteGeral = 60;
const janelaImportacaoMs = 60 * 60 * 1000;
const limiteImportacao = 8;
const acessos = new Map<string, number[]>();

const app = express();

app.disable("x-powered-by");

app.use(
  cors({
    credentials: false,
    origin(origem, callback) {
      if (!origem) {
        callback(null, true);
        return;
      }

      const local = /^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+)(:\d+)?$/i.test(
        origem
      );

      if (local || origensPermitidas.has(origem)) {
        callback(null, true);
        return;
      }

      callback(new Error("Origem não autorizada pelo CORS."));
    },
  })
);

app.use("/api", validarTamanhoDaRequisicao);
app.use("/api", autenticarEControlarUso);

app.use((req, res) => {
  const requisicao = http.request(
    {
      hostname: "127.0.0.1",
      port: portaInterna,
      path: req.originalUrl,
      method: req.method,
      headers: {
        ...req.headers,
        host: `127.0.0.1:${portaInterna}`,
      },
    },
    (respostaInterna) => {
      res.status(respostaInterna.statusCode || 502);

      for (const [nome, valor] of Object.entries(respostaInterna.headers)) {
        if (valor !== undefined && nome.toLowerCase() !== "access-control-allow-origin") {
          res.setHeader(nome, valor);
        }
      }

      respostaInterna.pipe(res);
    }
  );

  requisicao.on("error", (erro) => {
    console.error("Falha no proxy seguro da API:", erro);
    if (!res.headersSent) {
      res.status(502).json({
        sucesso: false,
        erro: "A API interna está temporariamente indisponível.",
      });
    } else {
      res.end();
    }
  });

  req.pipe(requisicao);
});

async function autenticarEControlarUso(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (req.path === "/saude") {
    next();
    return;
  }

  try {
    const autorizacao = req.header("authorization") ?? "";
    const anonKey =
      req.header("x-supabase-anon-key")?.trim() ||
      anonKeyServidor;

    if (!autorizacao.startsWith("Bearer ") || anonKey.length < 20) {
      res.status(401).json({
        sucesso: false,
        erro: "Faça login para usar a inteligência artificial.",
      });
      return;
    }

    const usuarioResposta = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: autorizacao,
      },
    });

    if (!usuarioResposta.ok) {
      res.status(401).json({
        sucesso: false,
        erro: "Sua sessão expirou. Entre novamente.",
      });
      return;
    }

    const usuario = (await usuarioResposta.json()) as { id?: string };
    const userId = usuario.id?.trim();

    if (!userId) {
      res.status(401).json({
        sucesso: false,
        erro: "Não foi possível validar o usuário.",
      });
      return;
    }

    const importacao = req.path === "/analisar-prova";
    const chave = `${userId}:${importacao ? "importacao" : "geral"}`;
    const agora = Date.now();
    const janela = importacao ? janelaImportacaoMs : janelaGeralMs;
    const limite = importacao ? limiteImportacao : limiteGeral;
    const recentes = (acessos.get(chave) ?? []).filter(
      (instante) => agora - instante < janela
    );

    if (recentes.length >= limite) {
      res.setHeader("Retry-After", String(Math.ceil(janela / 1000)));
      res.status(429).json({
        sucesso: false,
        erro: "Limite temporário de uso da IA atingido. Aguarde alguns minutos e tente novamente.",
      });
      return;
    }

    recentes.push(agora);
    acessos.set(chave, recentes);
    next();
  } catch (erro) {
    console.error("Falha na autenticação da API:", erro);
    res.status(503).json({
      sucesso: false,
      erro: "Não foi possível validar sua sessão agora.",
    });
  }
}

function validarTamanhoDaRequisicao(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const bytes = Number(req.header("content-length") || 0);
  const importacao = req.path === "/analisar-prova";
  const limite = importacao ? 40 * 1024 * 1024 : 2 * 1024 * 1024;

  if (Number.isFinite(bytes) && bytes > limite) {
    res.status(413).json({
      sucesso: false,
      erro: importacao
        ? "A importação ultrapassa o limite de 40 MB."
        : "A requisição ultrapassa o limite permitido para esta função.",
    });
    return;
  }

  next();
}

process.env.PORT = String(portaInterna);

await import("./index.ts");

app.listen(portaPublica, "0.0.0.0", () => {
  console.log(`Proxy seguro da API online na porta ${portaPublica}`);
  console.log(`API interna isolada na porta ${portaInterna}`);
});
