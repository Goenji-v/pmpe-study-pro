import { expect, test } from "@playwright/test";

async function verificarSemOverflow(page: import("@playwright/test").Page) {
  const dimensoes = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documento: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
  }));
  expect(dimensoes.documento).toBeLessThanOrEqual(dimensoes.viewport + 2);
}

test.describe("build local no navegador", () => {
  test("login renderiza sem erro de runtime", async ({ page }) => {
    const erros: Error[] = [];
    page.on("pageerror", (erro) => erros.push(erro));

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
    await verificarSemOverflow(page);
    expect(erros).toEqual([]);
  });

  test("demo pública carrega o bundle principal e navega sem erro", async ({ page }) => {
    const erros: Error[] = [];
    page.on("pageerror", (erro) => erros.push(erro));

    await page.goto("/demo", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("MODO DEMONSTRAÇÃO")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Como estou indo?" })).toBeVisible();
    await page.getByRole("button", { name: "Plano Tático" }).click();
    await expect(page.getByRole("heading", { name: "O que preciso fazer?" })).toBeVisible();
    await verificarSemOverflow(page);
    expect(erros).toEqual([]);
  });
});
