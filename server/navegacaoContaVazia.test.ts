import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync(new URL("../src/App.tsx", import.meta.url), "utf8");

test("conta sem edital pode acessar cursos e as demais rotas", () => {
  assert.doesNotMatch(app, /EditalPrimeiroAcessoGuard/);
  assert.doesNotMatch(app, /navigate\("\/meu-edital", \{ replace: true \}\)/);
  assert.match(app, /path="\/cursos"/);
  assert.match(app, /path="\/estudos"/);
  assert.match(app, /path="\/questoes"/);
});
