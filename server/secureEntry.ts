import "dotenv/config";
import cors from "cors";
import { randomBytes } from "node:crypto";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import http from "node:http";
import { GoogleGenAI } from "@google/genai";
import { capturarErroServidor } from "./sentry.ts";
import { encaminharEnvelopeSentry } from "./sentryTunnel.ts";
import {
  montarPromptAnaliseEdital,
} from "./editalInteligente.ts";
import {
  interpretarRespostaAnaliseEdital,
} from "./editalAnaliseRobusta.ts";
import {
  executarComFallbackGemini,
  obterStatusErro,
} from "./retryGemini.ts";
import { parametrosExtracaoGemini, resolverModelosGemini } from "./modelosGemini.ts";
import {
  analisarCursoPorMidia,
  type ArquivoCursoMidia,
} from "./cursoMidia.ts";

const portaPublica = Number(process.env.PORT || 3001);
const portaInterna = Number(
  process.env.INTERNAL_API_PORT || portaPublica + 1
);
const supabaseUrl =
  process.env.SUPABASE_URL ||
  "https://kibnmdwabpiwyprkrhvq.supabase.co";
const anonKeyServidor =
  process.env.SUPABASE_ANON_KEY?.trim() || "";
const segredoProxyInterno =
  process.env.INTERNAL_PROXY_SECRET?.trim() ||
  randomBytes(32).toString("hex");
process.env.INTERNAL_PROXY_SECRET = segredoProxyInterno;
const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || "";
const { modelo: modeloEdital, modeloFallback: modeloFallbackEdital } = resolverModelosGemini(process.env);
const aiEdital = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;

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
app.set("trust proxy", 1);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  next();
});

app.post(
  "/api/sentry-tunnel",
  express.raw({ type: "*/*", limit: "512kb" }),
  encaminharEnvelopeSentry
);

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

app.post(
  "/api/analisar-edital",
  express.json({ limit: "40mb" }),
  analisarEdital
);

app.post(
  "/api/analisar-curso-midia",
  express.json({ limit: "40mb" }),
  analisarCursoMidia
);

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
        // Sobrescritos no proxy: a API interna não confia em identidade
        // nem em chave Supabase recebidas diretamente do navegador.
        "x-study-user-id": String(res.locals.userId || ""),
        "x-supabase-anon-key": anonKeyServidor,
        "x-study-internal-secret": segredoProxyInterno,
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
    capturarErroServidor(erro, {
      area: "proxy-seguro",
      metodo: req.method,
      rota: req.path,
    });
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

async function analisarCursoMidia(req: Request, res: Response) {
  const inicio = Date.now();

  try {
    if (!aiEdital) {
      res.status(503).json({
        sucesso: false,
        erro: "A leitura inteligente do curso está temporariamente indisponível.",
      });
      return;
    }

    const corpo = req.body as {
      nomeCurso?: unknown;
      arquivos?: unknown;
    };

    const nomeCurso =
      typeof corpo.nomeCurso === "string"
        ? corpo.nomeCurso.trim().slice(0, 180)
        : "";

    if (!Array.isArray(corpo.arquivos) || corpo.arquivos.length < 1 || corpo.arquivos.length > 12) {
      res.status(400).json({
        sucesso: false,
        erro: "Envie de 1 a 12 imagens ou um PDF da grade do curso.",
      });
      return;
    }

    const tiposPermitidos = new Set<ArquivoCursoMidia["mimeType"]>([
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ]);
    const arquivos: ArquivoCursoMidia[] = [];
    let totalBytes = 0;

    for (const valor of corpo.arquivos) {
      if (!valor || typeof valor !== "object") {
        res.status(400).json({ sucesso: false, erro: "Um dos arquivos enviados é inválido." });
        return;
      }

      const item = valor as Record<string, unknown>;
      const nome =
        typeof item.nome === "string"
          ? item.nome.trim().slice(0, 220)
          : "arquivo";
      const mimeType =
        typeof item.mimeType === "string"
          ? item.mimeType.trim().toLowerCase()
          : "";
      const base64 =
        typeof item.base64 === "string"
          ? item.base64.trim()
          : "";

      if (!tiposPermitidos.has(mimeType as ArquivoCursoMidia["mimeType"]) || !base64) {
        res.status(400).json({
          sucesso: false,
          erro: "Use somente PDF, JPG, PNG ou WEBP.",
        });
        return;
      }

      let bytes: Buffer;
      try {
        bytes = Buffer.from(base64, "base64");
      } catch {
        res.status(400).json({ sucesso: false, erro: "Um dos arquivos não pôde ser lido." });
        return;
      }

      if (bytes.length < 8 || bytes.length > 12 * 1024 * 1024) {
        res.status(400).json({
          sucesso: false,
          erro: "Cada arquivo deve ter no máximo 12 MB.",
        });
        return;
      }

      if (!arquivoMidiaValido(bytes, mimeType)) {
        res.status(400).json({
          sucesso: false,
          erro: "Um dos arquivos não corresponde ao tipo informado.",
        });
        return;
      }

      totalBytes += bytes.length;
      if (totalBytes > 25 * 1024 * 1024) {
        res.status(400).json({
          sucesso: false,
          erro: "As imagens/PDFs juntos devem ter no máximo 25 MB.",
        });
        return;
      }

      arquivos.push({
        nome,
        mimeType: mimeType as ArquivoCursoMidia["mimeType"],
        base64,
      });
    }

    const modelos = Array.from(
      new Set([modeloEdital, modeloFallbackEdital].filter(Boolean))
    );
    const analise = await analisarCursoPorMidia(
      aiEdital,
      modelos,
      arquivos,
      nomeCurso
    );

    console.info("[curso-midia] análise concluída", {
      userId: res.locals.userId,
      duracaoMs: Date.now() - inicio,
      arquivos: arquivos.length,
      materias: analise.materias.length,
      aulas: analise.materias.reduce(
        (total, materia) =>
          total +
          materia.modulos.reduce(
            (subtotal, modulo) => subtotal + modulo.aulas.length,
            0
          ),
        0
      ),
    });

    res.json({
      sucesso: true,
      analise,
    });
  } catch (erro) {
    console.error("Erro ao analisar imagens/PDF do curso:", erro);
    capturarErroServidor(erro, { area: "analisar-curso-midia" });
    const status = obterStatusErro(erro);
    res.status(status === 429 ? 429 : status === 503 ? 503 : 500).json({
      sucesso: false,
      erro:
        erro instanceof Error
          ? erro.message
          : "Não foi possível organizar o curso agora.",
    });
  }
}

function arquivoMidiaValido(bytes: Buffer, mimeType: string) {
  if (mimeType === "application/pdf") {
    return bytes.subarray(0, 5).toString("ascii") === "%PDF-";
  }

  if (mimeType === "image/png") {
    return bytes.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    );
  }

  if (mimeType === "image/jpeg") {
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9;
  }

  if (mimeType === "image/webp") {
    return (
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP"
    );
  }

  return false;
}

async function analisarEdital(req: Request, res: Response) {
  const inicio = Date.now();

  try {
    if (!aiEdital) {
      res.status(503).json({
        sucesso: false,
        erro: "A análise de edital está temporariamente indisponível.",
      });
      return;
    }

    const corpo = req.body as {
      pdfBase64?: unknown;
      nomeArquivo?: unknown;
      concurso?: unknown;
      banca?: unknown;
    };

    const pdfBase64 =
      typeof corpo.pdfBase64 === "string" ? corpo.pdfBase64.trim() : "";
    const nomeArquivo =
      typeof corpo.nomeArquivo === "string"
        ? corpo.nomeArquivo.trim().slice(0, 220)
        : "edital.pdf";
    const concurso =
      typeof corpo.concurso === "string"
        ? corpo.concurso.trim().slice(0, 180)
        : "";
    const banca =
      typeof corpo.banca === "string"
        ? corpo.banca.trim().slice(0, 120)
        : "";

    if (!pdfBase64 || pdfBase64.length > 36_000_000) {
      res.status(400).json({
        sucesso: false,
        erro: "O PDF do edital está vazio ou ultrapassa o limite de análise.",
      });
      return;
    }

    let bytesPdf: Buffer;
    try {
      bytesPdf = Buffer.from(pdfBase64, "base64");
    } catch {
      res.status(400).json({ sucesso: false, erro: "O PDF enviado é inválido." });
      return;
    }

    if (
      bytesPdf.length <= 5 ||
      bytesPdf.length > 25 * 1024 * 1024 ||
      bytesPdf.subarray(0, 5).toString("ascii") !== "%PDF-"
    ) {
      res.status(400).json({
        sucesso: false,
        erro: "O arquivo recebido não é um PDF válido para análise.",
      });
      return;
    }

    const prompt = montarPromptAnaliseEdital({
      nomeArquivo,
      concurso,
      banca,
    });

    const contents = [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType: "application/pdf",
              data: pdfBase64,
            },
          },
          { text: prompt },
        ],
      },
    ];

    console.info("[edital-inteligente] análise iniciada", {
      userId: res.locals.userId,
      nomeArquivo,
      tamanhoKb: Math.round(bytesPdf.length / 1024),
    });

    let analise;

    try {
      const respostaPesquisa = await aiEdital.models.generateContent({
        model: modeloEdital,
        contents,
        config: {
          tools: [{ googleSearch: {} }],
          ...parametrosExtracaoGemini(modeloEdital),
          maxOutputTokens: 32768,
        },
      });

      if (!respostaPesquisa.text) {
        throw new Error("A IA não retornou texto na análise assistida por pesquisa.");
      }

      analise = interpretarRespostaAnaliseEdital(respostaPesquisa.text);
    } catch (erroPesquisa) {
      console.warn(
        "[edital-inteligente] análise com pesquisa não pôde ser confirmada; usando extração estruturada:",
        erroPesquisa
      );
    }

    if (!analise) {
      analise = await analisarEditalEstruturado(contents);
    }

    console.info("[edital-inteligente] análise concluída", {
      userId: res.locals.userId,
      duracaoMs: Date.now() - inicio,
      materias: analise.materias.length,
      assuntos: analise.materias.reduce(
        (total, materia) => total + materia.assuntos.length,
        0
      ),
    });

    res.json({
      sucesso: true,
      analise,
    });
  } catch (erro) {
    console.error("Erro ao analisar edital:", erro);
    capturarErroServidor(erro, { area: "analisar-edital" });

    const status = obterStatusErro(erro);
    const statusHttp =
      status === 429
        ? 429
        : status === 503
          ? 503
          : 500;

    res.status(statusHttp).json({
      sucesso: false,
      erro:
        erro instanceof Error
          ? erro.message
          : "Não foi possível analisar o edital.",
    });
  }
}

async function analisarEditalEstruturado(
  contents: Array<{
    role: string;
    parts: Array<
      | { inlineData: { mimeType: string; data: string } }
      | { text: string }
    >;
  }>
) {
  if (!aiEdital) {
    throw new Error("A análise de edital está temporariamente indisponível.");
  }

  return executarComFallbackGemini(
    async (modeloAtual) => {
      const resposta = await aiEdital.models.generateContent({
        model: modeloAtual,
        contents,
        config: {
          ...parametrosExtracaoGemini(modeloAtual),
          responseMimeType: "application/json",
          maxOutputTokens: 32768,
        },
      });

      if (!resposta.text) {
        throw new Error("A IA não retornou a estrutura do edital.");
      }

      return interpretarRespostaAnaliseEdital(resposta.text);
    },
    {
      rotulo: "análise estruturada do edital",
      modelos: [modeloEdital, modeloFallbackEdital],
      tentativasPorModelo: [2, 3],
      aoTentarNovamente: (dados) => {
        console.warn("[edital-inteligente] nova tentativa", dados);
      },
      aoTrocarModelo: (dados) => {
        console.warn("[edital-inteligente] trocando modelo", dados);
      },
    }
  );
}

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
    const anonKey = anonKeyServidor;

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

    const importacao =
      req.path === "/analisar-prova" ||
      req.path === "/analisar-edital" ||
      req.path === "/analisar-curso-midia";
    const consultaLeve =
      req.method === "GET" &&
      (
        req.path.startsWith("/geracoes") ||
        req.path.startsWith("/gerar/status/") ||
        req.path.startsWith("/simulados-pdf/jobs")
      );

    if (consultaLeve) {
      res.locals.userId = userId;
      next();
      return;
    }

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
    res.locals.userId = userId;
    next();
  } catch (erro) {
    console.error("Falha na autenticação da API:", erro);
    capturarErroServidor(erro, {
      area: "autenticacao-api",
      metodo: req.method,
      rota: req.path,
    });
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
  const importacao =
    req.path === "/analisar-prova" ||
    req.path === "/analisar-edital" ||
    req.path === "/analisar-curso-midia";
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
