import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("menu mobile fecha por Escape e ao sair do breakpoint mobile", async () => {
  const sidebar = await readFile(
    "src/components/Sidebar/Sidebar.tsx",
    "utf8"
  );

  assert.match(sidebar, /evento\.key !== "Escape"/);
  assert.match(sidebar, /window\.matchMedia\("\(min-width: 901px\)"\)/);
  assert.match(sidebar, /setMenuMobileAberto\(false\)/);
  assert.match(sidebar, /aria-controls="sidebar-principal"/);
  assert.match(sidebar, /id="sidebar-principal"/);
});

test("auditoria mobile cobre Redação, Simulado PDF e desbloqueio do menu", async () => {
  const [completa, navegacao] = await Promise.all([
    readFile("e2e/mobile-complete-audit.spec.ts", "utf8"),
    readFile("e2e/mobile-navigation.spec.ts", "utf8"),
  ]);

  assert.match(completa, /"\/simulado-pdf"/);
  assert.match(completa, /Iniciar treino/);
  assert.match(completa, /page\.reload/);
  assert.match(completa, /Treino em andamento/);

  assert.match(navegacao, /keyboard\.press\("Escape"\)/);
  assert.match(navegacao, /setViewportSize\(\{ width: 1024, height: 768 \}\)/);
  assert.match(navegacao, /not\.toHaveClass\(\/menu-mobile-aberto\/\)/);
});

test("workflow mobile espera a versão de produção e roda a suíte completa", async () => {
  const workflow = await readFile(
    ".github/workflows/mobile-audit.yml",
    "utf8"
  );

  assert.match(workflow, /push:/);
  assert.match(workflow, /version\.json/);
  assert.match(workflow, /GITHUB_SHA/);
  assert.match(workflow, /mobile-navigation\.spec\.ts/);
  assert.match(workflow, /mobile-complete-audit\.spec\.ts/);
  assert.match(workflow, /mobile-secondary\.spec\.ts/);
  assert.match(workflow, /mobile-visual-audit\.spec\.ts/);
});
