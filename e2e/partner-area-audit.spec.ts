import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

async function entrar(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(email!);
  await page.locator('input[autocomplete="current-password"]').fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });
}

async function semOverflowHorizontal(page: Page, rota: string) {
  await page.waitForTimeout(350);
  const largura = await page.evaluate(() => ({
    viewport: window.innerWidth,
    documento: document.documentElement.scrollWidth,
    corpo: document.body.scrollWidth,
  }));
  const real = Math.max(largura.documento, largura.corpo);
  expect(real, `${rota} criou overflow horizontal: ${real}px para viewport ${largura.viewport}px`).toBeLessThanOrEqual(
    largura.viewport + 2,
  );
}

async function abrirRota(page: Page, rota: string, seletor: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/);
  await expect(page.locator(seletor)).toBeVisible({ timeout: 15_000 });
  await semOverflowHorizontal(page, rota);
}

test.describe("auditoria final da Area do Parceiro", () => {
  test.setTimeout(120_000);
  test.skip(!email || !senha, "Configure a conta E2E dedicada.");

  test("rotas atuais e redirecionamentos legados carregam sem erro", async ({ page }) => {
    const errosRuntime: string[] = [];
    page.on("pageerror", (erro) => errosRuntime.push(erro.message));

    await entrar(page);

    await abrirRota(page, "/parceiro", ".parceiro-pagina");
    await expect(page.getByText("ÁREA DO PARCEIRO", { exact: true })).toBeVisible();
    await expect(page.locator(".parceiro-erro")).toHaveCount(0);
    await expect(page.locator(".prof-dashboard-erro")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Gerenciar meu curso", exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Simulados", exact: true })).toBeVisible();

    await abrirRota(page, "/parceiro/cursos", ".pc-pagina");
    await expect(page.getByRole("heading", { name: "Rota do Concurseiro" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Cursos" })).toBeVisible();
    await expect(page.locator(".pc-erro")).toHaveCount(0);

    await abrirRota(page, "/parceiro/simulados", ".parceiro-simulados");
    await expect(page.getByRole("heading", { name: "Simulados do curso" })).toBeVisible();
    await expect(page.locator(".psim-aviso.erro")).toHaveCount(0);

    await page.goto("/parceiro/mentoria", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/parceiro\/cursos\/?$/, { timeout: 15_000 });
    await expect(page.locator(".pc-pagina")).toBeVisible({ timeout: 15_000 });
    await semOverflowHorizontal(page, "/parceiro/mentoria → /parceiro/cursos");

    await page.goto("/parceiro/relatorios", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/parceiro\/?$/, { timeout: 15_000 });
    await expect(page.locator(".parceiro-pagina")).toBeVisible({ timeout: 15_000 });
    await semOverflowHorizontal(page, "/parceiro/relatorios → /parceiro");

    expect(errosRuntime, `Erros de runtime encontrados: ${errosRuntime.join(" | ")}`).toEqual([]);
  });

  test("permissoes e operacao respeitam o modelo consolidado atual", async ({ page }) => {
    await entrar(page);
    await abrirRota(page, "/parceiro", ".parceiro-pagina");

    const pagina = page.locator(".parceiro-pagina");
    const classes = (await pagina.getAttribute("class")) ?? "";
    const papel = classes.includes("papel-proprietario")
      ? "proprietario"
      : classes.includes("papel-gestor")
        ? "gestor"
        : classes.includes("papel-professor")
          ? "professor"
          : "desconhecido";

    expect(papel).not.toBe("desconhecido");

    await expect(pagina.getByRole("link", { name: "Gerenciar meu curso", exact: true })).toBeVisible();
    await expect(pagina.getByRole("link", { name: "Simulados", exact: true })).toBeVisible();
    await expect(page.getByText("Somente números consolidados são exibidos ao parceiro.")).toBeVisible();
    await expect(page.getByText(/Nenhum dado individual de aluno é exibido nesta área\./)).toBeVisible();

    await expect(pagina.getByRole("button", { name: "Alunos e turmas" })).toHaveCount(0);
    await expect(pagina.getByRole("link", { name: "Abrir acompanhamento" })).toHaveCount(0);

    if (papel === "proprietario") {
      await pagina.getByRole("button", { name: "Financeiro" }).click();
      await expect(pagina.getByText("FINANCEIRO DA PARCERIA", { exact: true })).toBeVisible();
      await expect(pagina.getByRole("heading", { name: "Cobranças da plataforma" })).toBeVisible();
      await expect(pagina.locator(".parceiro-financeiro-aviso.erro")).toHaveCount(0);
      await semOverflowHorizontal(page, "/parceiro#financeiro");
    } else {
      await expect(pagina.getByRole("button", { name: "Financeiro" })).toHaveCount(0);
    }

    await abrirRota(page, "/parceiro/cursos", ".pc-pagina");
    await expect(page.getByRole("heading", { name: "Cursos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Novo curso" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar rascunho" })).toBeVisible();
    await expect(page.getByText(/Visão consolidada das turmas liberadas\./)).toBeVisible();

    await abrirRota(page, "/parceiro/simulados", ".parceiro-simulados");
    await expect(page.getByRole("button", { name: "+ Novo simulado" })).toBeVisible();
    await expect(page.getByText(/acompanhe somente os resultados consolidados/i)).toBeVisible();
  });

  test("rotas individuais antigas nao reabrem dados de aluno", async ({ page }) => {
    await entrar(page);

    await page.goto("/parceiro/mentoria/aluno/e2e-usuario-inexistente", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/parceiro\/?$/, { timeout: 15_000 });
    await expect(page.locator(".parceiro-pagina")).toBeVisible({ timeout: 15_000 });

    await expect(page.locator(".mentoria-aluno-pagina")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Abrir acompanhamento" })).toHaveCount(0);
    await expect(page.getByText(/Nenhum dado individual de aluno é exibido nesta área\./)).toBeVisible();
    await semOverflowHorizontal(page, "/parceiro/mentoria/aluno/:id → /parceiro");
  });
});
