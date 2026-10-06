import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("bootstrap público não carrega estilos privados nem inicializa Sentry sem erro", async () => {
  const main = await readFile("src/main.tsx", "utf8");

  assert.match(main, /import "\.\/global\.css";/);
  assert.doesNotMatch(main, /styles\/mobile\.css/);
  assert.doesNotMatch(main, /DashboardHeroPremium\.css/);
  assert.doesNotMatch(main, /iniciarSentryFrontend\(\)/);
  assert.match(main, /capturarErroFrontend/);
});

test("rotas públicas não carregam a aplicação autenticada antes da hora", async () => {
  const app = await readFile("src/App.tsx", "utf8");
  const autenticada = await readFile("src/AuthenticatedApp.tsx", "utf8");

  assert.match(app, /lazy\(\(\) => import\("\.\/AuthenticatedApp"\)\)/);
  assert.doesNotMatch(app, /context\/AppContext/);
  assert.doesNotMatch(app, /context\/AuthContext/);
  assert.doesNotMatch(app, /components\/Sidebar\/Sidebar/);

  assert.match(autenticada, /AuthProvider/);
  assert.match(autenticada, /path="\/login"/);
  assert.match(autenticada, /path="\/\*"/);
});

test("estilos pesados ficam no chunk autenticado", async () => {
  const privado = await readFile("src/PrivateApp.tsx", "utf8");

  assert.match(privado, /styles\/mobile\.css/);
  assert.match(privado, /styles\/app-premium\.css/);
  assert.match(privado, /DashboardHeroPremium\.css/);
  assert.match(privado, /context\/AppContext/);
});

test("prompt PWA não compete com o LCP inicial", async () => {
  const prompt = await readFile(
    "src/components/PWAInstallPrompt/PWAInstallPrompt.tsx",
    "utf8"
  );

  assert.match(prompt, /ATRASO_EXIBICAO_MS = 12_000/);
  assert.match(prompt, /prontoParaMostrar/);
  assert.match(prompt, /!prontoParaMostrar/);
});
