import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

async function login(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(email!);
  await page.locator('input[autocomplete="current-password"]').fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 20_000 });
  await expect(page.locator(".layout")).toBeVisible({ timeout: 30_000 });
}

async function aplicarEditalSoldado(page: Page) {
  await page.goto("/meu-edital", { waitUntil: "domcontentloaded" });

  const card = page
    .locator(".edital-catalogo-card")
    .filter({ hasText: "Soldado PMPE" })
    .first();

  await expect(card).toBeVisible({ timeout: 30_000 });
  await card.getByRole("button", { name: /Usar direto|Selecionado/ }).click();

  const gerar = page.getByRole("button", {
    name: /Gerar prévia do cronograma/,
  });
  await expect(gerar).toBeVisible({ timeout: 20_000 });
  await gerar.click();

  const aplicar = page.getByRole("button", {
    name: /Aplicar edital e cronograma/,
  });
  await expect(aplicar).toBeVisible({ timeout: 20_000 });
  await aplicar.click();
  await expect(page).toHaveURL(/\/plano(?:$|\?)/, { timeout: 20_000 });
}

async function importarCursoFixture(page: Page) {
  await page.goto("/cursos", { waitUntil: "domcontentloaded" });

  const metodos = page.locator("details.cursos-metodos-avancados");
  await expect(metodos).toBeVisible({ timeout: 30_000 });
  if (!(await metodos.getAttribute("open"))) {
    await metodos.locator("summary").click();
  }

  const arquivo = page.locator('input[type="file"][accept*=".json"]');
  await arquivo.setInputFiles(
    path.join(process.cwd(), "e2e/fixtures/unified-grade-course.json")
  );

  await page.getByRole("button", { name: "Analisar curso" }).click();
  await expect(
    page.getByText("E2E Resumo do Concurseiro — PMPE", { exact: true }).first()
  ).toBeVisible({ timeout: 30_000 });

  await page.getByRole("button", { name: "Só importar" }).click();
  await expect(
    page.getByText(/Curso E2E Resumo do Concurseiro — PMPE pronto/)
  ).toBeVisible({ timeout: 20_000 });
}

async function verificarCentralUnificada(page: Page) {
  await page.context().route("https://example.com/study-pro-e2e/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<html><body>Study Pro E2E aula</body></html>",
    });
  });

  await page.goto("/central-estudos", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".central-estudos-container")).toBeVisible({
    timeout: 30_000,
  });

  const formulario = page.locator(".central-estudos-formulario");
  await expect(
    formulario.locator("label").filter({ hasText: /^Módulo$/ })
  ).toHaveCount(0);

  await page.locator(".central-estudos-tipos button").filter({ hasText: "Aula" }).click();

  const campos = formulario.locator(".central-estudos-campo");
  const materia = campos.filter({ hasText: "Matéria" }).locator("select");
  await materia.selectOption({ label: "Direito Constitucional" });

  const assunto = campos.filter({ hasText: /^Assunto/ }).locator("select");
  await assunto.selectOption({
    label: "Organização dos Poderes e Funções Essenciais à Justiça",
  });

  const aulaCampo = campos.filter({ hasText: /^Aula/ });
  await expect(aulaCampo).toBeVisible({ timeout: 15_000 });
  const aula = aulaCampo.locator("select");

  await expect(aula.locator("option")).toHaveCount(3);
  await aula.selectOption({ label: "Poder Legislativo" });

  const botaoAula = page.locator(".central-botao-aula");
  await expect(botaoAula).toBeVisible();

  const popupPromise = page.waitForEvent("popup");
  await botaoAula.click();
  const popup = await popupPromise;
  await expect
    .poll(() => popup.url(), { timeout: 10_000 })
    .toBe("https://example.com/study-pro-e2e/legislativo");
  await popup.close();

  await materia.selectOption({ label: "Informática" });
  await assunto.selectOption({ label: "Internet e intranet" });
  await expect(aulaCampo.locator("select")).toHaveValue(/e2e-internet-1/);

  const dimensoes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    scroll: document.documentElement.scrollWidth,
  }));
  expect(dimensoes.scroll).toBeLessThanOrEqual(dimensoes.viewport + 2);
}

test.describe("grade unificada edital + curso", () => {
  test.skip(
    !email || !senha,
    "Configure E2E_TEST_EMAIL e E2E_TEST_PASSWORD com a conta E2E dedicada."
  );

  test("edital e curso formam uma única navegação e abrem a aula correta", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const erros: Error[] = [];
    page.on("pageerror", (erro) => erros.push(erro));

    await login(page);
    await aplicarEditalSoldado(page);
    await importarCursoFixture(page);
    await verificarCentralUnificada(page);

    expect(erros).toEqual([]);
  });
});
