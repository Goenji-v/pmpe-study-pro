import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

const rotasCriticas = [
  "/plano",
  "/cursos",
  "/conteudos",
  "/cronograma-ia",
  "/central-estudos",
  "/materiais",
  "/questoes",
  "/resolver-simulado-ia",
  "/revisoes",
  "/simulados",
  "/desempenho",
  "/",
];

async function esperarLayoutEstavel(page: import("@playwright/test").Page) {
  await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });
  await page.evaluate(async () => {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }
  });
}

async function verificarSemOverflowHorizontal(
  page: import("@playwright/test").Page,
  rota: string
) {
  const dimensoes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documento: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));

  const larguraReal = Math.max(dimensoes.documento, dimensoes.body);
  expect(
    larguraReal,
    `A rota ${rota} criou overflow horizontal: ${larguraReal}px para viewport de ${dimensoes.viewport}px.`
  ).toBeLessThanOrEqual(dimensoes.viewport + 2);
}

test.describe("fluxo crítico autenticado", () => {
  test.skip(!email || !senha, "Configure E2E_TEST_EMAIL e E2E_TEST_PASSWORD com uma conta de teste dedicada.");

  test("login persiste e as rotas críticas abrem sem erro de runtime ou overflow", async ({ page }) => {
    const errosDePagina: Error[] = [];
    page.on("pageerror", (erro) => errosDePagina.push(erro));

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha").fill(senha!);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });
    await esperarLayoutEstavel(page);
    await verificarSemOverflowHorizontal(page, page.url());

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login(?:$|\?)/);
    await esperarLayoutEstavel(page);
    await verificarSemOverflowHorizontal(page, page.url());

    for (const rota of rotasCriticas) {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      await expect(page).not.toHaveURL(/\/login(?:$|\?)/);
      await esperarLayoutEstavel(page);

      const texto = await page.locator("body").innerText();
      expect(texto).not.toContain("Algo deu errado");
      expect(texto).not.toContain("Erro inesperado");
      expect(texto).not.toContain('"status":"UNAVAILABLE"');
      expect(texto).not.toContain('{"error":{"code":503');
      await verificarSemOverflowHorizontal(page, rota);
    }

    expect(errosDePagina).toEqual([]);
  });
});
