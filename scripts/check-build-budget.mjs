import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const raiz = new URL("../dist/assets/", import.meta.url);

const limitesKb = {
  ".js": 500,
  ".css": 160,
};

async function listarArquivos(diretorio) {
  const entradas = await readdir(diretorio, { withFileTypes: true });
  const arquivos = [];

  for (const entrada of entradas) {
    const caminho = join(diretorio, entrada.name);
    if (entrada.isDirectory()) {
      arquivos.push(...(await listarArquivos(caminho)));
    } else {
      arquivos.push(caminho);
    }
  }

  return arquivos;
}

const arquivos = await listarArquivos(raiz);
const problemas = [];
const maiores = {};

for (const arquivo of arquivos) {
  const extensao = arquivo.endsWith(".js")
    ? ".js"
    : arquivo.endsWith(".css")
      ? ".css"
      : null;

  if (!extensao) continue;

  const info = await stat(arquivo);
  const tamanhoKb = info.size / 1024;
  const atual = maiores[extensao];

  if (!atual || tamanhoKb > atual.tamanhoKb) {
    maiores[extensao] = {
      arquivo: relative(raiz.pathname, arquivo),
      tamanhoKb,
    };
  }

  const limiteKb = limitesKb[extensao];
  if (tamanhoKb > limiteKb) {
    problemas.push({
      arquivo: relative(raiz.pathname, arquivo),
      tamanhoKb,
      limiteKb,
    });
  }
}

console.log("Budget de frontend:");
for (const [extensao, item] of Object.entries(maiores)) {
  console.log(
    `- Maior ${extensao}: ${item.arquivo} = ${item.tamanhoKb.toFixed(2)} kB (limite ${limitesKb[extensao]} kB)`
  );
}

if (problemas.length > 0) {
  console.error("\nRegressão de tamanho detectada:");
  for (const problema of problemas) {
    console.error(
      `- ${problema.arquivo}: ${problema.tamanhoKb.toFixed(2)} kB > ${problema.limiteKb} kB`
    );
  }
  process.exit(1);
}
