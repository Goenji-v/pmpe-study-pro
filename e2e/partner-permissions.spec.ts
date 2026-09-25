import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

async function entrarComoContaTeste(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(email!);
  await page.locator('input[autocomplete="current-password"]').fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });
}

test.describe("permissoes da Area do Parceiro", () => {
  test.skip(!email || !senha, "Configure E2E_TEST_EMAIL e E2E_TEST_PASSWORD com a conta de teste dedicada.");

  test("o perfil atual recebe apenas as permissoes esperadas", async ({ page }) => {
    await entrarComoContaTeste(page);
    await page.goto("/parceiro", { waitUntil: "domcontentloaded" });

    const pagina = page.locator(".parceiro-pagina");
    if (!(await pagina.isVisible().catch(() => false))) {
      test.skip(true, "A conta E2E atual nao possui papel de parceiro; teste de permissoes ignorado.");
    }

    await expect(page.getByRole("button", { name: "Visão geral" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Gerenciar meu curso", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Simulados" })).toBeVisible();
    await expect(page.getByText("Somente números consolidados são exibidos ao parceiro.")).toBeVisible();

    const classes = (await pagina.getAttribute("class")) ?? "";
    const papel = classes.includes("papel-proprietario")
      ? "proprietario"
      : classes.includes("papel-gestor")
        ? "gestor"
        : classes.includes("papel-professor")
          ? "professor"
          : "desconhecido";

    expect(papel, `Papel nao identificado pelas classes: ${classes}`).not.toBe("desconhecido");

    await expect(page.getByRole("button", { name: "Alunos e turmas" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Abrir acompanhamento" })).toHaveCount(0);

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
  });

  test("o parceiro permanece restrito a dados consolidados das turmas", async ({ page }) => {
    await entrarComoContaTeste(page);
    await page.goto("/parceiro", { waitUntil: "domcontentloaded" });

    const pagina = page.locator(".parceiro-pagina");
    if (!(await pagina.isVisible().catch(() => false))) {
      test.skip(true, "A conta E2E atual nao possui papel de parceiro.");
    }

    await expect(page.getByText(/Nenhum dado individual de aluno é exibido nesta área\./)).toBeVisible();
    await expect(page.getByRole("button", { name: "Alunos e turmas" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Abrir acompanhamento" })).toHaveCount(0);

    await page.goto("/parceiro/mentoria/aluno/e2e-usuario-inexistente", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/parceiro\/?$/, { timeout: 15_000 });
    await expect(page.locator(".parceiro-pagina")).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(".mentoria-aluno-pagina")).toHaveCount(0);
  });
});
