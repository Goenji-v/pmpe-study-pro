import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

const rotasSecundarias = [
  "/meu-edital",
  "/cursos",
  "/calendario",
  "/materiais",
  "/inteligencia",
  "/revisoes",
  "/questoes",
  "/registrar-questoes",
  "/ranking",
  "/conquistas",
  "/backup",
  "/configuracoes",
];

async function entrar(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });
  await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });
}

async function auditarRota(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/);
  await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(500);

  const texto = await page.locator("body").innerText();
  expect(texto).not.toContain("Algo deu errado");
  expect(texto).not.toContain("Erro inesperado");

  const diagnostico = await page.evaluate(() => {
    const viewport = window.innerWidth;
    const larguraPagina = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth
    );

    const controles = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".page button, .page a[href], .page input, .page select, .page textarea"
      )
    );

    const foraDaTela = controles
      .filter((elemento) => {
        const estilo = window.getComputedStyle(elemento);
        const caixa = elemento.getBoundingClientRect();

        if (
          estilo.display === "none" ||
          estilo.visibility === "hidden" ||
          Number(estilo.opacity) === 0 ||
          caixa.width <= 0 ||
          caixa.height <= 0
        ) {
          return false;
        }

        let ancestral = elemento.parentElement;
        while (ancestral && ancestral !== document.body) {
          const overflowX = window.getComputedStyle(ancestral).overflowX;
          const rolagemHorizontalIntencional =
            (overflowX === "auto" || overflowX === "scroll") &&
            ancestral.scrollWidth > ancestral.clientWidth + 1;

          if (rolagemHorizontalIntencional) return false;
          ancestral = ancestral.parentElement;
        }

        return caixa.left < -2 || caixa.right > viewport + 2;
      })
      .slice(0, 10)
      .map((elemento) => {
        const caixa = elemento.getBoundingClientRect();
        return {
          tag: elemento.tagName.toLowerCase(),
          texto:
            elemento.getAttribute("aria-label") ||
            elemento.textContent?.trim().slice(0, 80) ||
            elemento.getAttribute("name") ||
            elemento.getAttribute("type") ||
            "sem identificação",
          esquerda: Math.round(caixa.left),
          direita: Math.round(caixa.right),
        };
      });

    return {
      viewport,
      larguraPagina,
      foraDaTela,
    };
  });

  expect(
    diagnostico.larguraPagina,
    `${rota} criou overflow horizontal na página`
  ).toBeLessThanOrEqual(diagnostico.viewport + 2);

  expect(
    diagnostico.foraDaTela,
    `${rota} possui controles comuns fora da largura útil do celular`
  ).toEqual([]);
}

test.describe("auditoria mobile de telas secundárias", () => {
  test.skip(!email || !senha, "Configure a conta E2E dedicada.");

  test("telas e formulários cabem em 360px sem erro de runtime", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Teste exclusivo do projeto mobile.");

    await page.setViewportSize({ width: 360, height: 740 });

    const errosDePagina: Error[] = [];
    page.on("pageerror", (erro) => errosDePagina.push(erro));

    await entrar(page);

    for (const rota of rotasSecundarias) {
      errosDePagina.length = 0;
      await auditarRota(page, rota);
      expect(errosDePagina, `Erro de JavaScript ao abrir ${rota}`).toEqual([]);
    }

    await page.goto("/configuracoes", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".page select").first()).toBeVisible({ timeout: 15_000 });
  });
});
