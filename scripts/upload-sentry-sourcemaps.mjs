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
