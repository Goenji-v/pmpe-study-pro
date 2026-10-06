import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

async function fecharRecompensaDiariaSeAberta(page: Page) {
  const overlay = page.locator(".economia-login-overlay");

  try {
    await overlay.waitFor({ state: "visible", timeout: 5_000 });
  } catch {
    return;
  }

  await expect(page.getByRole("dialog")).toBeVisible();

  const fechar = page.getByRole("button", {
    name: "Fechar recompensa de login",
    exact: true,
  });

  await expect(fechar).toBeVisible();
  await fechar.click();
  await expect(overlay).toHaveCount(0);
}

async function entrar(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(email!);
  await page.locator('input[autocomplete="current-password"]').fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });
  await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });
  await fecharRecompensaDiariaSeAberta(page);
}

async function verificarSemOverflowHorizontal(page: Page) {
  const dimensoes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    pagina: Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth
    ),
  }));

  expect(dimensoes.pagina).toBeLessThanOrEqual(dimensoes.viewport + 2);
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

  await verificarSemOverflowHorizontal(page);
}

async function navegarPeloPerfil(
  page: Page,
  item: string,
  destino: RegExp
) {
  const trigger = page.locator(".user-profile-trigger");

  await expect(trigger).toBeVisible();
  await trigger.click();

  const dropdown = page.locator(".user-profile-dropdown");
  await expect(dropdown).toBeVisible();

  const opcao = dropdown.getByRole("menuitem", {
    name: item,
    exact: true,
  });
  await expect(opcao).toBeVisible();

  // O header pode renderizar novamente quando a sincronização termina.
  // Se isso acontecer entre abrir o perfil e clicar, reabre uma vez em vez
  // de transformar a atualização de estado em falso negativo da auditoria.
  try {
    await opcao.click({ timeout: 4_000 });
  } catch {
    await expect(trigger).toBeVisible();
    await trigger.click();
    const opcaoRetomada = page
      .locator(".user-profile-dropdown")
      .getByRole("menuitem", { name: item, exact: true });
    await expect(opcaoRetomada).toBeVisible();
    await opcaoRetomada.click();
  }

  await expect(page).toHaveURL(destino, { timeout: 15_000 });
  await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(".user-profile-dropdown")).toHaveCount(0);

  await verificarSemOverflowHorizontal(page);
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

    await navegarPeloPerfil(
      page,
      "Configurações",
      /\/configuracoes(?:$|\?)/
    );

    expect(errosDePagina).toEqual([]);
  });

  test("menu móvel nunca deixa o body travado ao fechar por Escape ou mudar viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Teste exclusivo do projeto mobile.");

    await page.setViewportSize({ width: 360, height: 740 });
    await entrar(page);

    const toggle = page.locator(".sidebar-mobile-toggle");
    await expect(toggle).toHaveAttribute("aria-controls", "sidebar-principal");

    await toggle.click();
    await expect(page.locator("body")).toHaveClass(/menu-mobile-aberto/);
    await expect(page.locator(".sidebar-mobile-overlay")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(toggle).toHaveAttribute("aria-label", "Abrir menu");
    await expect(page.locator(".sidebar-mobile-overlay")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/menu-mobile-aberto/);

    await toggle.click();
    await expect(page.locator("body")).toHaveClass(/menu-mobile-aberto/);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator(".sidebar-mobile-overlay")).toHaveCount(0);
    await expect(page.locator("body")).not.toHaveClass(/menu-mobile-aberto/);

    await page.setViewportSize({ width: 360, height: 740 });
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator(".sidebar-mobile-overlay")).toBeVisible();

    // O centro do backdrop fica coberto pela própria sidebar. Toca na faixa
    // direita realmente visível, como um usuário faria no celular.
    await page.mouse.click(350, 370);

    await expect(toggle).toHaveAttribute("aria-label", "Abrir menu");
    await expect(page.locator("body")).not.toHaveClass(/menu-mobile-aberto/);
  });
});
