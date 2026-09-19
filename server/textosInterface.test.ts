import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

function listarArquivos(diretorio: string): string[] {
  return readdirSync(diretorio).flatMap((nome) => {
    const caminho = join(diretorio, nome);
    const stat = statSync(caminho);
    if (stat.isDirectory()) return listarArquivos(caminho);
    return /\.(ts|tsx)$/.test(nome) ? [caminho] : [];
  });
}

test("interface não reintroduz marca antiga nem erros ortográficos conhecidos", () => {
  const arquivos = listarArquivos(new URL("../src", import.meta.url).pathname);
  const proibidos = [
    { rotulo: "marca Studio Pro", padrao: /Studio Pro/g },
    { rotulo: "revisãoões", padrao: /revisãoões/gi },
    { rotulo: "mêses", padrao: /mêses/gi },
    { rotulo: "1 revisões", padrao: /\b1\s+revisões\b/gi },
    { rotulo: "1 pendentes", padrao: /\b1\s+pendentes\b/gi },
  ];

  const falhas: string[] = [];
  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, "utf8");
    for (const item of proibidos) {
      item.padrao.lastIndex = 0;
      if (item.padrao.test(fonte)) {
        falhas.push(`${item.rotulo}: ${arquivo}`);
      }
    }
  }

  assert.deepEqual(falhas, []);
});
