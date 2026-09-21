import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

test("a geração de questões trata 503 do provedor sem expor JSON bruto", async () => {
  const codigo = await readFile("src/services/apiAutenticada.ts", "utf8");

  assert.match(codigo, /ATRASOS_GERACAO_IA_MS/);
  assert.match(codigo, /codigo === 503/);
  assert.match(codigo, /alta demanda agora/);
  assert.match(codigo, /respostaAmigavelIa/);
  assert.doesNotMatch(
    codigo,
    /return\s+new\s+Response\(mensagem\s*,/,
    "a resposta amigável deve ser JSON controlado pelo Study Pro"
  );
});


test("a API de geração persistente trata falha de rede e identifica o usuário", async () => {
  const codigo = await readFile("src/services/apiAutenticada.ts", "utf8");

  assert.match(codigo, /\/api\/geracoes/);
  assert.match(codigo, /X-Study-User-Id/);
  assert.match(codigo, /Falha de rede ao acessar a geração de questões/);
  assert.match(codigo, /operação continua salva/);
});
