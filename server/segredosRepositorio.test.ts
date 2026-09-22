import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import test from "node:test";

const RAIZES = ["src", "server", "e2e", "supabase", ".github"];
const IGNORAR = new Set(["segredosRepositorio.test.ts"]);
const EXTENSOES_TEXTO = /\.(?:ts|tsx|js|jsx|json|yml|yaml|sql|md|html|css)$/i;

function listar(diretorio: string): string[] {
  if (!existsSync(diretorio)) return [];
  return readdirSync(diretorio).flatMap((nome) => {
    const caminho = join(diretorio, nome);
    const stat = statSync(caminho);
    if (stat.isDirectory()) return listar(caminho);
    return EXTENSOES_TEXTO.test(nome) && !IGNORAR.has(basename(caminho))
      ? [caminho]
      : [];
  });
}

test("árvore versionada não contém formatos comuns de segredos", () => {
  const arquivos = RAIZES.flatMap(listar);
  const detectores: Array<[string, RegExp]> = [
    ["chave Google/Gemini", /AIza[0-9A-Za-z_-]{35}/g],
    ["token GitHub", /gh[pousr]_[A-Za-z0-9]{30,}/g],
    ["access key AWS", /AKIA[0-9A-Z]{16}/g],
    ["chave privada PEM", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
    ["JWT literal", /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/g],
  ];

  const achados: string[] = [];
  for (const arquivo of arquivos) {
    const fonte = readFileSync(arquivo, "utf8");
    for (const [nome, detector] of detectores) {
      detector.lastIndex = 0;
      if (detector.test(fonte)) achados.push(`${nome}: ${arquivo}`);
    }
  }

  assert.deepEqual(
    achados,
    [],
    "Foram encontrados formatos compatíveis com segredo. O teste informa apenas tipo e arquivo, nunca o valor."
  );
});
