import { expect, test } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

test.describe("permissoes da Area do Parceiro", () => {
  test.skip(!email || !senha, "Configure E2E_TEST_EMAIL e E2E_TEST_PASSWORD com a conta de teste dedicada.");

  test("o perfil atual recebe apenas as permissoes esperadas", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.getByLabel("E-mail").fill(email!);
    await page.getByLabel("Senha").fill(senha!);
    await page.getByRole("button", { name: "Entrar" }).click();
    await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });

    await page.goto("/parceiro", { waitUntil: "domcontentloaded" });

    const pagina = page.locator(".parceiro-pagina");
    if (!(await pagina.isVisible().catch(() => false))) {
      test.skip(true, "A conta E2E atual nao possui papel de parceiro; teste de permissoes ignorado.");
    }

    await expect(page.getByRole("button", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Alunos e turmas" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Cronograma da turma" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Conteúdos do curso" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Simulados" })).toBeVisible();

    const classes = (await pagina.getAttribute("class")) ?? "";
    const papel = classes.includes("papel-proprietario")
      ? "proprietario"
      : classes.includes("papel-gestor")
        ? "gestor"
        : classes.includes("papel-professor")
          ? "professor"
          : "desconhecido";

    expect(papel, `Papel nao identificado pelas classes: ${classes}`).not.toBe("desconhecido");

    if (papel === "proprietario") {
      await expect(page.getByRole("button", { name: /Convites/ })).toBeVisible();
      await expect(page.getByRole("button", { name: "Financeiro" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Histórico" })).toBeVisible();
      await expect(page.getByRole("button", { name: "+ Nova turma" })).toBeVisible();
      return;
    }

    if (papel === "gestor") {
      await expect(page.getByRole("button", { name: /Convites/ })).toBeVisible();
      await expect(page.getByRole("button", { name: "Financeiro" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Histórico" })).toBeVisible();
      await expect(page.getByRole("button", { name: "+ Nova turma" })).toBeVisible();
      return;
    }

    await expect(page.getByRole("button", { name: /Convites/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Financeiro" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Histórico" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "+ Nova turma" })).toHaveCount(0);

    await page.getByRole("button", { name: "Alunos e turmas" }).click();
    await expect(
      page.getByText("Alterações de acesso e movimentações ficam com proprietário ou gestor.")
    ).toBeVisible();
    await expect(page.getByText("Permissão", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Suspender" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Remover" })).toHaveCount(0);
    await expect(page.locator('select[aria-label^="Mover "]')).toHaveCount(0);
  });
});
