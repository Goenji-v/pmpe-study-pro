import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

const rotasCriticas = [
  "/cronograma-ia",
  "/central-estudos",
  "/simulados",
  "/desempenho",
  "/",
];

test.describe("fluxo crítico autenticado", () => {
  test.skip(!email || !senha, "Configure E2E_TEST_EMAIL e E2E_TEST_PASSWORD com uma conta de teste dedicada.");

  test("login persiste e as rotas críticas abrem sem erro de runtime", async ({ page }) => {
    const errosDePagina: Error[] = [];
    page.on("pageerror", (erro) => errosDePagina.push(erro));

    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha").fill(senha!);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });
    await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page).not.toHaveURL(/\/login(?:$|\?)/);
    await expect(page.locator(".layout")).toBeVisible();

    for (const rota of rotasCriticas) {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      await expect(page).not.toHaveURL(/\/login(?:$|\?)/);
      await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });

      const texto = await page.locator("body").innerText();
      expect(texto).not.toContain("Algo deu errado");
      expect(texto).not.toContain("Erro inesperado");
    }

    expect(errosDePagina).toEqual([]);
  });
});
