import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;

test.describe("Fase 3 — resumo semanal autenticado", () => {
  test.skip(!email || !password, "Requer credenciais de teste via ambiente, nunca no repositório.");
  test("abre o Dashboard e apresenta o resumo sem erro de execução", async ({ page }) => {
    test.setTimeout(120_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email!);
    await page.locator('input[autocomplete="current-password"]').fill(password!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).not.toHaveURL(/\/login(?:$|[?])/, { timeout: 15000 });
    await page.goto("/");
    const weekly = page.getByRole("region", { name: "Resumo da semana" });
    await expect(weekly).toBeVisible({ timeout: 20000 });
    await expect(weekly.getByText("Questões:", { exact: false })).toBeVisible();
    await expect(weekly.getByText("Revisões atrasadas:", { exact: false })).toBeVisible();
    await expect(weekly.getByRole("heading", { name: "Três prioridades para amanhã" })).toBeVisible();
    await expect(weekly.getByRole("button").first()).toBeVisible();
    expect(errors).toEqual([]);
  });
});
