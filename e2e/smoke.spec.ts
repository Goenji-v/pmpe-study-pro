import { expect, test } from "@playwright/test";

const rotasProtegidas = [
  "/",
  "/cronograma-ia",
  "/central-estudos",
  "/simulados",
];

test.describe("smoke de autenticação e produção", () => {
  for (const rota of rotasProtegidas) {
    test(`${rota} exige autenticação e carrega o login`, async ({ page }) => {
      const errosDePagina: Error[] = [];
      page.on("pageerror", (erro) => errosDePagina.push(erro));

      await page.goto(rota, { waitUntil: "domcontentloaded" });

      await expect(page).toHaveURL(/\/login(?:$|\?)/);
      await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Entrar" })).toBeVisible();
      expect(errosDePagina).toEqual([]);
    });
  }

  test("login vazio é rejeitado pelo cliente sem quebrar a página", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    await page.getByLabel("Senha").fill("qualquer-senha");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Digite um e-mail válido.")).toBeVisible();
    await expect(page).toHaveURL(/\/login(?:$|\?)/);
  });

  test("demonstração pública abre sem login e permite navegar pelas áreas", async ({ page }) => {
    const errosDePagina: Error[] = [];
    page.on("pageerror", (erro) => errosDePagina.push(erro));

    await page.goto("/demo", { waitUntil: "domcontentloaded" });

    await expect(page).toHaveURL(/\/demo$/);
    await expect(page.getByText("MODO DEMONSTRAÇÃO")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Como estou indo?" })).toBeVisible();

    const botaoPlano = page.getByRole("button", { name: "Plano Tático" });
    if (await botaoPlano.isVisible()) {
      await botaoPlano.click();
    } else {
      await page.getByRole("button", { name: "Abrir menu" }).click();
      await page.getByRole("button", { name: "Plano Tático" }).click();
    }

    await expect(page.getByRole("heading", { name: "O que preciso fazer?" })).toBeVisible();
    expect(errosDePagina).toEqual([]);
  });
});
