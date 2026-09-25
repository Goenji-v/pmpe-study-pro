// Upload de source maps executado apenas durante o build de deploy.\nimport { readdir, readFile, rm } from "node:fs/promises";
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

async function apagarSourceMaps() {
  let arquivos = [];
  try {
    arquivos = await listarArquivos(DIST_DIR);
  } catch {
    return;
  }

  await Promise.all(
    arquivos
      .filter((arquivo) => arquivo.endsWith(".map"))
      .map((arquivo) => rm(arquivo, { force: true }))
  );
}

async function requisicaoJson(url, init = {}) {
  const resposta = await fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${AUTH_TOKEN}`,
      accept: "application/json",
      ...(init.headers || {}),
    },
  });

  if (!resposta.ok) {
    const corpo = await resposta.text();
    throw new Error(
      `Sentry respondeu ${resposta.status} em ${url}: ${corpo.slice(0, 500)}`
    );
  }

  return resposta.json();
}

async function descobrirOrganizacao() {
  if (ORG_OVERRIDE) {
    return {
      slug: ORG_OVERRIDE,
      regionUrl: process.env.SENTRY_REGION_URL?.trim() || "https://sentry.io",
    };
  }

  const organizacoes = await requisicaoJson(
    "https://sentry.io/api/0/organizations/"
  );

  if (!Array.isArray(organizacoes) || organizacoes.length === 0) {
    throw new Error("O token do Sentry não possui organização acessível.");
  }

  if (organizacoes.length > 1) {
    throw new Error(
      "O token acessa mais de uma organização. Defina SENTRY_ORG no Vercel."
    );
  }

  const organizacao = organizacoes[0];
  return {
    slug: organizacao.slug,
    regionUrl: organizacao.links?.regionUrl || "https://sentry.io",
  };
}

async function criarRelease(baseUrl, orgSlug) {
  const resposta = await fetch(
    `${baseUrl}/api/0/organizations/${encodeURIComponent(orgSlug)}/releases/`,
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

async function enviarArquivo(baseUrl, orgSlug, arquivo) {
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
    `${baseUrl}/api/0/projects/${encodeURIComponent(orgSlug)}/` +
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
  if (!AUTH_TOKEN || !RELEASE) {
    console.warn(
      "[sentry] Source maps não enviados: SENTRY_AUTH_TOKEN ou release ausente."
    );
    await apagarSourceMaps();
    return;
  }

  const organizacao = await descobrirOrganizacao();
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

  await criarRelease(baseUrl, organizacao.slug);
  await executarEmLotes(artefatos, 6, (arquivo) =>
    enviarArquivo(baseUrl, organizacao.slug, arquivo)
  );

  await apagarSourceMaps();

  console.info(
    `[sentry] Source maps enviados: projeto=${PROJECT} release=${RELEASE} arquivos=${artefatos.length}`
  );
}

main().catch(async (erro) => {
  console.error("[sentry] Falha no upload de source maps:", erro);
  await apagarSourceMaps();
  process.exitCode = 1;
});
