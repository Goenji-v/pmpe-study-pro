// Upload de source maps executado apenas durante o build de produção.
import { readdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DIST_DIR = path.resolve("dist");
const PROJECT = process.env.SENTRY_PROJECT?.trim() || "study-pro-web";
const RELEASE =
  process.env.SENTRY_RELEASE?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.GITHUB_SHA?.trim() ||
  "";
const AUTH_TOKEN = process.env.SENTRY_AUTH_TOKEN?.trim() || "";
const ORG_OVERRIDE = process.env.SENTRY_ORG?.trim() || "";
const SENTRY_DSN = process.env.VITE_SENTRY_DSN?.trim() || "";
const VERCEL_ENV = process.env.VERCEL_ENV?.trim() || "";
const VALIDAR_SOURCE_MAPS_UMA_VEZ = true;
const MARCADOR_VALIDACAO =
  "Erro fatal capturado na interface do Study Pro.";
const URL_PRODUCAO =
  process.env.SENTRY_PUBLIC_URL?.trim() ||
  "https://pmpe-study-pro-two.vercel.app";

async function listarArquivos(diretorio) {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const arquivos = [];

  for (const entrada of entradas) {
    const absoluto = path.join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      arquivos.push(...(await listarArquivos(absoluto)));
    } else {
      arquivos.push(absoluto);
    }
  }

  return arquivos;
}

async function limparSourceMapsDoDeploy() {
  let arquivos = [];
  try {
    arquivos = await listarArquivos(DIST_DIR);
  } catch {
    return;
  }

  const javascript = arquivos.filter((arquivo) => arquivo.endsWith(".js"));
  await Promise.all(
    javascript.map(async (arquivo) => {
      const conteudo = await readFile(arquivo, "utf8");
      const limpo = conteudo.replace(
        /(?:\r?\n)?\/\/[#@]\s*sourceMappingURL=.*?(?:\r?\n|$)/g,
        "\n"
      );
      if (limpo !== conteudo) {
        await writeFile(arquivo, limpo, "utf8");
      }
    })
  );

  await Promise.all(
    arquivos
      .filter((arquivo) => arquivo.endsWith(".map"))
      .map((arquivo) => rm(arquivo, { force: true }))
  );
}

function resolverOrganizacao() {
  if (ORG_OVERRIDE) {
    return {
      idOrSlug: ORG_OVERRIDE,
      regionUrl:
        process.env.SENTRY_REGION_URL?.trim() || "https://sentry.io",
    };
  }

  if (!SENTRY_DSN) {
    throw new Error(
      "VITE_SENTRY_DSN ausente: não foi possível identificar a organização."
    );
  }

  let dsn;
  try {
    dsn = new URL(SENTRY_DSN);
  } catch {
    throw new Error(
      "VITE_SENTRY_DSN inválido: não foi possível identificar a organização."
    );
  }

  const org = dsn.hostname.match(/^o(\d+)\./i)?.[1];
  if (!org) {
    throw new Error(
      "Não foi possível extrair o ID da organização a partir do VITE_SENTRY_DSN."
    );
  }

  const region = dsn.hostname.match(
    /\.ingest\.([a-z0-9-]+)\.sentry\.io$/i
  )?.[1];

  return {
    idOrSlug: org,
    regionUrl:
      process.env.SENTRY_REGION_URL?.trim() ||
      (region ? `https://${region}.sentry.io` : "https://sentry.io"),
  };
}

async function criarRelease(baseUrl, orgIdOrSlug) {
  const resposta = await fetch(
    `${baseUrl}/api/0/organizations/${encodeURIComponent(orgIdOrSlug)}/releases/`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${AUTH_TOKEN}`,
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        version: RELEASE,
        projects: [PROJECT],
        ref: process.env.VERCEL_GIT_COMMIT_SHA || RELEASE,
      }),
    }
  );

  if (resposta.ok || resposta.status === 208 || resposta.status === 409) {
    return;
  }

  const corpo = await resposta.text();
  throw new Error(
    `Falha ao criar release no Sentry (${resposta.status}): ${corpo.slice(0, 500)}`
  );
}

async function enviarArquivo(baseUrl, orgIdOrSlug, arquivo) {
  const relativo = path.relative(DIST_DIR, arquivo).split(path.sep).join("/");
  const conteudo = await readFile(arquivo);
  const form = new FormData();

  form.set("name", `~/${relativo}`);
  form.set(
    "file",
    new Blob([conteudo], {
      type: arquivo.endsWith(".map")
        ? "application/json"
        : "application/javascript",
    }),
    path.basename(arquivo)
  );

  const url =
    `${baseUrl}/api/0/projects/${encodeURIComponent(orgIdOrSlug)}/` +
    `${encodeURIComponent(PROJECT)}/releases/${encodeURIComponent(RELEASE)}/files/`;

  const resposta = await fetch(url, {
    method: "POST",
    headers: {
      authorization: `Bearer ${AUTH_TOKEN}`,
      accept: "application/json",
    },
    body: form,
  });

  if (resposta.ok || resposta.status === 409) return;

  const corpo = await resposta.text();
  throw new Error(
    `Falha ao enviar ${relativo} ao Sentry (${resposta.status}): ${corpo.slice(0, 500)}`
  );
}

async function executarEmLotes(itens, tamanho, callback) {
  for (let i = 0; i < itens.length; i += tamanho) {
    await Promise.all(itens.slice(i, i + tamanho).map(callback));
  }
}


function esperar(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function localizarFrameDeValidacao(artefatos) {
  for (const arquivo of artefatos.filter((item) => item.endsWith(".js"))) {
    const conteudo = await readFile(arquivo, "utf8");
    const indice = conteudo.indexOf(MARCADOR_VALIDACAO);
    if (indice < 0) continue;

    const antes = conteudo.slice(0, indice);
    const quebras = antes.match(/\n/g)?.length || 0;
    const ultimaQuebra = antes.lastIndexOf("\n");
    const linha = quebras + 1;
    const coluna = indice - ultimaQuebra;

    return {
      arquivo,
      relativo: path.relative(DIST_DIR, arquivo).split(path.sep).join("/"),
      linha,
      coluna,
    };
  }

  throw new Error(
    "Não foi possível localizar o marcador de validação no JavaScript gerado."
  );
}

async function enviarEventoSinteticoDeValidacao(frame) {
  const Sentry = await import("@sentry/node");

  Sentry.init({
    dsn: SENTRY_DSN,
    release: RELEASE,
    environment: "source-map-validation",
    sendDefaultPii: false,
    tracesSampleRate: 0,
    defaultIntegrations: false,
  });

  const absPath = `${URL_PRODUCAO.replace(/\/$/, "")}/${frame.relativo}`;
  const eventId = Sentry.captureEvent({
    platform: "javascript",
    level: "error",
    release: RELEASE,
    environment: "source-map-validation",
    fingerprint: ["study-pro-source-map-validation-one-shot"],
    tags: {
      source_map_validation: "one-shot",
    },
    exception: {
      values: [
        {
          type: "SentrySourceMapValidation",
          value: "TESTE_SENTRY_SOURCEMAP_E2E_20260927",
          mechanism: {
            type: "generic",
            handled: true,
          },
          stacktrace: {
            frames: [
              {
                filename: `/${frame.relativo}`,
                abs_path: absPath,
                lineno: frame.linha,
                colno: frame.coluna,
                function: "AppErrorBoundary.componentDidCatch",
                in_app: true,
              },
            ],
          },
        },
      ],
    },
  });

  const enviado = await Sentry.flush(10000);
  if (!enviado) {
    throw new Error("O Sentry não confirmou o envio do evento sintético.");
  }

  return eventId;
}

async function resolverEventoNoSentry(baseUrl, orgIdOrSlug, eventId) {
  const url =
    `${baseUrl}/api/0/organizations/${encodeURIComponent(orgIdOrSlug)}/` +
    `eventids/${encodeURIComponent(eventId)}/`;

  for (let tentativa = 1; tentativa <= 30; tentativa += 1) {
    const resposta = await fetch(url, {
      headers: {
        authorization: `Bearer ${AUTH_TOKEN}`,
        accept: "application/json",
      },
    });

    if (resposta.ok) {
      return resposta.json();
    }

    if (resposta.status !== 404) {
      const corpo = await resposta.text();
      throw new Error(
        `Falha ao consultar evento de validação no Sentry (${resposta.status}): ${corpo.slice(0, 500)}`
      );
    }

    await esperar(1000);
  }

  throw new Error(
    "O evento de validação não ficou disponível no Sentry dentro do tempo esperado."
  );
}

function validarEventoSimbolicado(resolvido) {
  const evento = resolvido?.event;
  const erros = Array.isArray(evento?.errors) ? evento.errors : [];
  const erroSourceMap = erros.find((erro) =>
    /source.?map|sourcemap/i.test(
      `${erro?.type || ""} ${erro?.message || ""}`
    )
  );

  if (erroSourceMap) {
    throw new Error(
      `O Sentry registrou erro de Source Map: ${erroSourceMap.type || ""} ${erroSourceMap.message || ""}`
    );
  }

  const entradaExcecao = evento?.entries?.find(
    (entrada) => entrada?.type === "exception"
  );
  const valores = entradaExcecao?.data?.values || [];
  const valor = valores.find(
    (item) => item?.type === "SentrySourceMapValidation"
  );
  const frames = valor?.stacktrace?.frames || [];
  const frame = frames.at(-1);

  const origem = [
    frame?.filename,
    frame?.absPath,
    frame?.module,
  ]
    .filter(Boolean)
    .join(" ");

  if (!/AppErrorBoundary\.tsx/i.test(origem)) {
    throw new Error(
      `O evento chegou, mas o frame não foi simbolicado para AppErrorBoundary.tsx. Frame recebido: ${origem || "vazio"}`
    );
  }

  return {
    arquivo: frame.filename || frame.absPath || "AppErrorBoundary.tsx",
    linha: frame.lineNo || null,
    eventoId: evento.eventID || evento.id || null,
  };
}

async function validarSourceMapsFimAFim(
  baseUrl,
  orgIdOrSlug,
  artefatos
) {
  const frame = await localizarFrameDeValidacao(artefatos);
  const eventId = await enviarEventoSinteticoDeValidacao(frame);
  const resolvido = await resolverEventoNoSentry(
    baseUrl,
    orgIdOrSlug,
    eventId
  );
  const resultado = validarEventoSimbolicado(resolvido);

  console.info(
    `[sentry] Validação E2E OK: evento=${resultado.eventoId || eventId} origem=${resultado.arquivo}${resultado.linha ? `:${resultado.linha}` : ""}`
  );
}

async function main() {
  if (VERCEL_ENV && VERCEL_ENV !== "production") {
    console.info(
      `[sentry] Source maps não enviados no ambiente Vercel "${VERCEL_ENV}".`
    );
    await limparSourceMapsDoDeploy();
    return;
  }

  if (!AUTH_TOKEN || !RELEASE) {
    console.warn(
      "[sentry] Source maps não enviados: SENTRY_AUTH_TOKEN ou release ausente."
    );
    await limparSourceMapsDoDeploy();
    return;
  }

  const organizacao = resolverOrganizacao();
  const baseUrl = String(organizacao.regionUrl || "https://sentry.io").replace(
    /\/$/,
    ""
  );

  const todos = await listarArquivos(DIST_DIR);
  const artefatos = todos.filter(
    (arquivo) => arquivo.endsWith(".js") || arquivo.endsWith(".js.map")
  );

  if (!artefatos.length) {
    throw new Error("Nenhum artefato JavaScript encontrado em dist.");
  }

  await criarRelease(baseUrl, organizacao.idOrSlug);
  await executarEmLotes(artefatos, 6, (arquivo) =>
    enviarArquivo(baseUrl, organizacao.idOrSlug, arquivo)
  );

  if (VALIDAR_SOURCE_MAPS_UMA_VEZ) {
    await validarSourceMapsFimAFim(
      baseUrl,
      organizacao.idOrSlug,
      artefatos
    );
  }

  await limparSourceMapsDoDeploy();

  console.info(
    `[sentry] Source maps enviados: projeto=${PROJECT} release=${RELEASE} arquivos=${artefatos.length}`
  );
}

main().catch(async (erro) => {
  console.error("[sentry] Falha no upload de source maps:", erro);
  await limparSourceMapsDoDeploy();
  process.exitCode = 1;
});
