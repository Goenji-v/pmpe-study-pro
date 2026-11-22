import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../src/pages/Revisoes/Revisoes.css", import.meta.url), "utf8");
const component = readFileSync(new URL("../src/pages/Revisoes/Revisoes.tsx", import.meta.url), "utf8");

test("painel aberto ocupa a largura do card sem espremer o resumo", () => {
  assert.match(css, /\.revisao-card > \.revisao-conteudo-vinculado\s*\{[^}]*flex:\s*0 0 100%/);
  assert.match(css, /\.revisao-card > \.revisao-conteudo\s*\{[^}]*flex:\s*1 1 320px/);
  assert.match(css, /\.revisao-card > \.revisao-lateral\s*\{[^}]*flex:\s*0 1 auto/);
  assert.match(component, /revisaoEmExibicaoId === revisao\.id && \(\s*<ConteudoDaRevisao/);
});

test("layout do painel é responsivo no celular", () => {
  assert.match(css, /@media \(max-width: 720px\).*?\.revisao-conteudo-secoes/s);
  assert.match(css, /@media \(max-width: 700px\)\s*\{[\s\S]*?\.revisao-card > \.revisao-lateral/);
});
