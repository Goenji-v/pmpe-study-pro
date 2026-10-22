import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dashboard = readFileSync("src/pages/Dashboard/Dashboard.tsx", "utf8");
const css = readFileSync("src/pages/Dashboard/Dashboard.css", "utf8");

test("fila de revisão usa linha integral para nome e separa origem e status", () => {
  assert.match(dashboard, /className="dashboard-pro-review-title">\{revisao\.assunto\}<\/b>/);
  assert.match(dashboard, /className="dashboard-pro-review-origin"/);
  assert.match(dashboard, /dashboard-pro-review-status \$\{status\.classe\}/);
  assert.match(css, /grid-template-areas:\s*"icon spacer status"\s*"title title title"\s*"origin origin arrow"/);
  assert.match(css, /\.dashboard-pro-review-list \.dashboard-pro-review-title \{[\s\S]*?grid-area: title/);
  assert.match(css, /\.dashboard-pro-review-list \.dashboard-pro-review-origin \{[\s\S]*?grid-area: origin/);
  assert.match(css, /white-space: normal/);
  assert.match(css, /overflow-wrap: break-word/);
  assert.match(css, /word-break: normal/);
});

test("nome longo, status e origem preservam navegação e cartões inteiros clicáveis", () => {
  const fila = dashboard.split('className="dashboard-pro-review-list"')[1]?.split('</article>')[0] ?? "";
  assert.match(fila, /revisoesDashboard\.length > 0/);
  assert.match(fila, /onClick=\{\(\) => navigate\("\/revisoes"\)\}/);
  assert.match(fila, /rotuloOrigemRevisaoSimulado\(revisao, nomesSimulados\)/);
  assert.match(fila, /className="dashboard-pro-review-title"/);
  assert.match(fila, /<em aria-hidden="true">›<\/em>/);
  assert.match(css, /@media \(max-width: 720px\) \{[\s\S]*?\.dashboard-pro-v3 \.dashboard-pro-review-list > button \{/);
});
