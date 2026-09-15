import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

async function entrar(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(senha!);
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
  test.skip(!email || !senha, "Configure a conta E2E dedicada.");

  test("rotas operacionais carregam sem erro e cabem na tela", async ({ page }) => {
    const errosRuntime: string[] = [];
    page.on("pageerror", (erro) => errosRuntime.push(erro.message));

    await entrar(page);

    await abrirRota(page, "/parceiro", ".parceiro-pagina");
    await expect(page.getByText("ÁREA DO PARCEIRO", { exact: true })).toBeVisible();
    await expect(page.locator(".parceiro-erro")).toHaveCount(0);

    await abrirRota(page, "/parceiro/mentoria", ".mentoria-pagina");
    await expect(page.getByRole("heading", { name: "Trilha de estudos da turma" })).toBeVisible();
    await expect(page.locator(".mentoria-alerta.erro")).toHaveCount(0);

    await abrirRota(page, "/parceiro/cursos", ".pc-pagina");
    await expect(page.getByRole("heading", { name: "Links do curso" })).toBeVisible();
    await expect(page.locator(".pc-erro")).toHaveCount(0);

    await abrirRota(page, "/parceiro/simulados", ".parceiro-simulados");
    await expect(page.getByRole("heading", { name: "Simulados do Professor" })).toBeVisible();
    await expect(page.locator(".psim-aviso.erro")).toHaveCount(0);

    expect(errosRuntime, `Erros de runtime encontrados: ${errosRuntime.join(" | ")}`).toEqual([]);
  });

  test("permissoes, financeiro e operacao pedagogica respeitam o papel atual", async ({ page }) => {
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

    await expect(pagina.getByRole("link", { name: "Cronograma da turma" })).toBeVisible();
    await expect(pagina.getByRole("link", { name: "Conteúdos do curso" })).toBeVisible();
    await expect(pagina.getByRole("link", { name: "Simulados" })).toBeVisible();

    if (papel === "proprietario") {
      await pagina.getByRole("button", { name: "Financeiro" }).click();
      await expect(pagina.getByText("FINANCEIRO DA PARCERIA", { exact: true })).toBeVisible();
      await expect(pagina.getByRole("heading", { name: "Competências e repasses" })).toBeVisible();
      await expect(pagina.locator(".parceiro-financeiro-aviso.erro")).toHaveCount(0);
      await semOverflowHorizontal(page, "/parceiro#financeiro");
    } else {
      await expect(pagina.getByRole("button", { name: "Financeiro" })).toHaveCount(0);
    }

    await abrirRota(page, "/parceiro/mentoria", ".mentoria-pagina");
    await expect(page.getByLabel("Turma")).toBeVisible();
    await expect(page.getByLabel("Nome da trilha")).toBeVisible();
    await expect(page.getByRole("button", { name: /Salvar alterações|Criar trilha/ })).toBeVisible();

    await abrirRota(page, "/parceiro/cursos", ".pc-pagina");
    await expect(page.getByRole("heading", { name: "Cursos" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Novo curso" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Criar rascunho" })).toBeVisible();

    await abrirRota(page, "/parceiro/simulados", ".parceiro-simulados");
    await expect(page.getByRole("button", { name: "+ Novo simulado" })).toBeVisible();
  });

  test("painel individual do aluno abre completo e sem vazamento visual", async ({ page }) => {
    await entrar(page);
    await abrirRota(page, "/parceiro", ".parceiro-pagina");
    await page.getByRole("button", { name: "Alunos e turmas" }).click();

    const abrir = page.getByRole("link", { name: "Abrir acompanhamento" }).first();
    if (!(await abrir.isVisible().catch(() => false))) {
      test.skip(true, "A parceria da conta E2E não possui aluno ativo.");
    }

    await abrir.click();
    await expect(page).toHaveURL(/\/parceiro\/mentoria\/aluno\//, { timeout: 15_000 });
    await expect(page.locator(".mentoria-aluno-pagina")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("PAINEL INDIVIDUAL DA MENTORIA", { exact: true })).toBeVisible();
    await expect(page.getByText("ACOMPANHAMENTO DO MENTOR", { exact: true })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Intervenções e orientações" })).toBeVisible();
    await expect(page.getByLabel("Tipo de ação")).toBeVisible();
    await expect(page.getByRole("button", { name: "Registrar acompanhamento" })).toBeVisible();
    await expect(page.locator(".mentoria-aluno-alerta.erro")).toHaveCount(0);
    await semOverflowHorizontal(page, "/parceiro/mentoria/aluno/:id");
  });
});
