import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

async function entrar(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });
  await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });
}

async function navegarPeloMenu(
  page: Page,
  grupo: string,
  item: string,
  destino: RegExp
) {
  const toggle = page.locator(".sidebar-mobile-toggle");

  await expect(toggle).toBeVisible();
  await expect(toggle).toHaveAttribute("aria-label", "Abrir menu");
  await toggle.click();

  await expect(toggle).toHaveAttribute("aria-label", "Fechar menu");
  await expect(page.locator(".sidebar-mobile-overlay")).toBeVisible();
  await expect(page.locator("body")).toHaveClass(/menu-mobile-aberto/);

  await page.getByRole("button", { name: grupo, exact: true }).click();
  await page.getByRole("link", { name: item, exact: true }).click();

  await expect(page).toHaveURL(destino, { timeout: 15_000 });
  await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });
  await expect(toggle).toHaveAttribute("aria-label", "Abrir menu");
  await expect(page.locator(".sidebar-mobile-overlay")).toHaveCount(0);
  await expect(page.locator("body")).not.toHaveClass(/menu-mobile-aberto/);

  const dimensoes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    pagina: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth
    ),
  }));

  expect(dimensoes.pagina).toBeLessThanOrEqual(dimensoes.viewport + 2);
}

test.describe("navegação mobile autenticada", () => {
  test.skip(!email || !senha, "Configure a conta E2E dedicada.");

  test("menu lateral abre, navega e fecha nas rotas principais", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Teste exclusivo do projeto mobile.");

    const errosDePagina: Error[] = [];
    page.on("pageerror", (erro) => errosDePagina.push(erro));

    await entrar(page);

    await navegarPeloMenu(
      page,
      "Planejamento",
      "Cronograma IA",
      /\/cronograma-ia(?:$|\?)/
    );

    await navegarPeloMenu(
      page,
      "Prática",
      "Simulados",
      /\/simulados(?:$|\?)/
    );

    await navegarPeloMenu(
      page,
      "Sistema",
      "Configurações",
      /\/configuracoes(?:$|\?)/
    );

    expect(errosDePagina).toEqual([]);
  });
});
