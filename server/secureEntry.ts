import "dotenv/config";
import cors from "cors";
import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import http from "node:http";
import { GoogleGenAI } from "@google/genai";
import {
  montarPromptAnaliseEdital,
} from "./editalInteligente.ts";
import {
  interpretarRespostaAnaliseEdital,
} from "./editalAnaliseRobusta.ts";
import {
  obterStatusErro,
} from "./retryGemini.ts";

const portaPublica = Number(process.env.PORT || 3001);
const portaInterna = Number(
  process.env.INTERNAL_API_PORT || portaPublica + 1
);
const supabaseUrl =
  process.env.SUPABASE_URL ||
  "https://kibnmdwabpiwyprkrhvq.supabase.co";
const anonKeyServidor =
  process.env.SUPABASE_ANON_KEY?.trim() || "";
const geminiApiKey = process.env.GEMINI_API_KEY?.trim() || "";
const modeloEdital =
  process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
const modeloFallbackEdital =
  process.env.GEMINI_FALLBACK_MODEL || "gemini-2.5-flash";
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
          temperature: 0,
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
    res.status(500).json({
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

  const modelos = Array.from(
    new Set([modeloEdital, modeloFallbackEdital].map((item) => item.trim()).filter(Boolean))
  );
  let ultimoErro: unknown;

  for (const modeloAtual of modelos) {
    for (let tentativa = 1; tentativa <= 2; tentativa += 1) {
      try {
        const resposta = await aiEdital.models.generateContent({
          model: modeloAtual,
          contents,
          config: {
            temperature: 0,
            responseMimeType: "application/json",
            maxOutputTokens: 32768,
          },
        });

        if (!resposta.text) {
          throw new Error("A IA não retornou a estrutura do edital.");
        }

        return interpretarRespostaAnaliseEdital(resposta.text);
      } catch (erro) {
        ultimoErro = erro;
        const status = obterStatusErro(erro);

        console.warn("[edital-inteligente] tentativa estruturada falhou", {
          modelo: modeloAtual,
          tentativa,
          status,
          erro: erro instanceof Error ? erro.message : String(erro),
        });

        if (status === 429) {
          throw erro;
        }

        if (tentativa < 2) {
          await aguardar(1200);
        }
      }
    }
  }

  throw ultimoErro instanceof Error
    ? ultimoErro
    : new Error("Não foi possível concluir a leitura estruturada do edital.");
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

    const importacao =
      req.path === "/analisar-prova" || req.path === "/analisar-edital";
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
    req.path === "/analisar-prova" || req.path === "/analisar-edital";
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

function aguardar(milissegundos: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milissegundos);
  });
}

process.env.PORT = String(portaInterna);

await import("./index.ts");

app.listen(portaPublica, "0.0.0.0", () => {
  console.log(`Proxy seguro da API online na porta ${portaPublica}`);
  console.log(`API interna isolada na porta ${portaInterna}`);
});
