import { expect, test } from "@playwright/test";

const rotasProtegidas = [
  "/",
  "/meu-edital",
  "/cursos",
  "/curso-mentoria",
  "/plano",
  "/plano-estudos",
  "/calendario",
  "/cronograma-ia",
  "/central-estudos",
  "/materiais",
  "/inteligencia",
  "/estudos",
  "/conteudos",
  "/buscar",
  "/pesquisa",
  "/search",
  "/revisoes",
  "/questoes",
  "/registrar-questoes",
  "/historico",
  "/banco-questoes",
  "/estatisticas",
  "/simulados",
  "/simulados-oficiais",
  "/simulado-oficial/teste",
  "/resolver-simulado-ia",
  "/caderno-questoes",
  "/resolver-simulado-ia/prova",
  "/resolver-simulado-ia/revisao/teste",
  "/gerar-simulado-ia",
  "/estatisticas-simulado-ia",
  "/desempenho",
  "/historico-sessoes",
  "/estatisticas-sessoes",
  "/perfil",
  "/ranking",
  "/conquistas",
  "/loja",
  "/relatorio-inteligente",
  "/ia-coach",
  "/backup",
  "/configuracoes",
  "/admin",
  "/parceiro",
  "/parceiro/mentoria",
  "/parceiro/mentoria/aluno/teste",
  "/parceiro/cursos",
  "/parceiro/simulados",
  "/parceiro/relatorios",
  "/meu-acesso",
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

    await page.locator('input[autocomplete="current-password"]').fill("qualquer-senha");
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

    const larguraViewport = page.viewportSize()?.width ?? 1280;
    if (larguraViewport <= 720) {
      await page.getByRole("button", { name: "Abrir menu" }).click();
    }

    await page.getByRole("button", { name: "Plano Tático" }).click();

    await expect(page.getByRole("heading", { name: "O que preciso fazer?" })).toBeVisible();
    expect(errosDePagina).toEqual([]);
  });
});
