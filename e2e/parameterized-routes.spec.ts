import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;
const rotas = [
  "/perfil/00000000-0000-4000-8000-000000000000",
  "/parceiro/mentoria/aluno/00000000-0000-4000-8000-000000000000",
  "/simulado-oficial/00000000-0000-4000-8000-000000000000",
  "/resolver-simulado-ia/revisao/00000000-0000-4000-8000-000000000000",
  "/convite/codigo-inexistente-teste",
];

test.describe("rotas com parâmetros e autenticação", () => {
  test.skip(!email || !senha, "Configure E2E_TEST_EMAIL e E2E_TEST_PASSWORD.");

  test("rotas não causam erros de runtime", async ({ page }) => {
    test.setTimeout(120_000);
    const erros: string[] = [];
    page.on("pageerror", erro => erros.push(erro.message));
    await page.goto("/login");
    await page.getByLabel("E-mail").fill(email!);
    await page.locator('input[autocomplete="current-password"]').fill(senha!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).not.toHaveURL(/login(?:$|[?])/, { timeout: 15_000 });    for (const rota of rotas) {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).not.toBeEmpty();
    }
    expect(erros).toEqual([]);
  });
});
