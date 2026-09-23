import { expect, test } from "@playwright/test";

test.describe("segurança do formulário de autenticação", () => {
  test("login usa semântica segura para e-mail e senha", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    const email = page.getByLabel("E-mail");
    const senha = page.locator('input[autocomplete="current-password"]');

    await expect(email).toHaveAttribute("type", "email");
    await expect(email).toHaveAttribute("autocomplete", "email");
    await expect(senha).toHaveAttribute("type", "password");
    await expect(senha).toHaveAttribute("autocomplete", "current-password");

    const segredoTeste = "nao-deve-ser-persistido-928374";
    await senha.fill(segredoTeste);

    const senhaPersistida = await page.evaluate((valor) => {
      for (let indice = 0; indice < localStorage.length; indice += 1) {
        const chave = localStorage.key(indice);
        if (!chave) continue;

        const armazenado = localStorage.getItem(chave);
        if (armazenado?.includes(valor)) return true;
      }

      return false;
    }, segredoTeste);

    expect(senhaPersistida).toBe(false);
  });

  test("controle de exibição da senha não altera autocomplete", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    const senha = page.locator("#auth-senha");

    await page.getByRole("button", { name: "Mostrar senha" }).click();
    await expect(senha).toHaveAttribute("type", "text");
    await expect(senha).toHaveAttribute("autocomplete", "current-password");

    await page.getByRole("button", { name: "Ocultar senha" }).click();
    await expect(senha).toHaveAttribute("type", "password");
  });

  test("cadastro marca as duas senhas como novas", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Criar conta" }).click();

    await expect(page.getByLabel("Nome")).toHaveAttribute("autocomplete", "name");
    await expect(page.getByLabel("E-mail")).toHaveAttribute("autocomplete", "email");
    await expect(page.locator('input[placeholder="Sua senha"]')).toHaveAttribute("autocomplete", "new-password");
    await expect(page.locator('input[placeholder="Repita a senha"]')).toHaveAttribute(
      "autocomplete",
      "new-password"
    );
  });

  test("recuperação não exibe campo de senha", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Esqueci minha senha?" }).click();

    await expect(page.getByRole("heading", { name: "Recuperar senha" })).toBeVisible();
    await expect(page.getByLabel("E-mail")).toHaveAttribute("autocomplete", "email");
    await expect(page.locator('input[type="password"]')).toHaveCount(0);
  });
});
