import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

test.describe("acesso autenticado ao Simulado PDF", () => {
  test.skip(!email || !senha, "Requer sessão de teste autorizada por variáveis de ambiente.");
  test("rota direta não volta para o Dashboard após login", async ({ page }) => {
    test.setTimeout(120_000);
    const erros: string[] = [];
    page.on("pageerror", e => erros.push(e.message));
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email!);
    await page.locator('input[autocomplete="current-password"]').fill(senha!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).not.toHaveURL(/login(?:$|[?])/, {timeout: 15000});
    await page.goto("/simulado-pdf", {waitUntil:"domcontentloaded"});
    await expect(page).toHaveURL(/\/simulado-pdf(?:[/?#]|$)/, {timeout:15000});
    await expect(page.getByRole("heading", { name: /Resumo da semana/i })).toHaveCount(0);
    expect(erros).toEqual([]);
  });
});
