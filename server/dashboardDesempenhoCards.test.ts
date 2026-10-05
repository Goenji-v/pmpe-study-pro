import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("dashboard oficial usa cards 2D no lugar do gráfico 3D", async () => {
  const codigo = await readFile("src/pages/Dashboard/DashboardOficial.tsx", "utf8");
  const css = await readFile("src/pages/Dashboard/DashboardDesempenhoCards.css", "utf8");

  assert.match(codigo, /USAR_DESEMPENHO_CARDS = true/);
  assert.match(codigo, /DesempenhoGeralCards/);
  assert.match(codigo, /dashboard-cards-grid/);
  assert.match(codigo, /dashboard-materia-card/);
  assert.match(codigo, /dashboard-geral-cards-titleline/);
  assert.match(codigo, /<strong>\{aproveitamento\}%<\/strong>/);
  assert.match(codigo, /aria-label=\{`Abrir desempenho de \$\{item\.materia\}`\}/);
  assert.match(codigo, /onClick=\{onDetalhes\}/);
  assert.match(codigo, /Foque nos pontos de atenção/);
  assert.match(codigo, /Recomendação/);
  assert.doesNotMatch(codigo, /DesempenhoGeral3D/);
  assert.doesNotMatch(codigo, /dashboard-3d-stage/);

  assert.match(css, /grid-template-columns: repeat\(3, minmax\(0, 1fr\)\)/);
  assert.match(css, /dashboard-materia-progress/);
  assert.match(css, /min-height: 118px/);
  assert.match(css, /cursor: pointer/);
  assert.match(css, /dashboard-cards-insight/);
  assert.match(css, /@media \(max-width: 560px\)/);
});
