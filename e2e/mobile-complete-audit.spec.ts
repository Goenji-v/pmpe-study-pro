import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

const rotasPrincipais = [
  "/",
  "/plano",
  "/central-estudos",
  "/questoes",
  "/revisoes",
  "/simulados",
  "/configuracoes",
];

const questaoTeste = {
  id: "e2e-mobile-layout-1",
  materia: "Direito Constitucional",
  materiaId: "direito-constitucional",
  modulo: "Direitos e garantias fundamentais",
  moduloId: "direitos-garantias",
  assunto: "Direitos individuais e coletivos com um nome propositalmente longo para testar quebra de linha no celular",
  assuntoId: "direitos-individuais",
  banca: "AOCP",
  dificuldade: "Difícil",
  enunciado:
    "Considerando a Constituição Federal e um enunciado propositalmente longo para reproduzir uma questão real em uma tela estreita, assinale a alternativa correta.",
  alternativas: {
    A: "Alternativa A com texto longo suficiente para testar a quebra automática de linha sem criar rolagem horizontal.",
    B: "Alternativa B com outro texto comprido para simular uma prova real no celular.",
    C: "Alternativa C com conteúdo de tamanho semelhante ao encontrado em questões de concurso.",
    D: "Alternativa D usada apenas para validar o comportamento visual responsivo.",
    E: "Alternativa E usada apenas para validar o comportamento visual responsivo.",
  },
  respostaCorreta: "A",
  explicacao: "Explicação de teste.",
};

async function fecharRecompensaDiariaSeAberta(page: Page) {
  const overlay = page.locator(".economia-login-overlay");

  try {
    await overlay.waitFor({ state: "visible", timeout: 3_000 });
  } catch {
    return;
  }

  await page
    .getByRole("button", { name: "Fechar recompensa de login", exact: true })
    .click();
  await expect(overlay).toHaveCount(0);
}

async function entrar(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });
  await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });
  await fecharRecompensaDiariaSeAberta(page);
}

async function coletarDiagnosticoMobile(page: Page) {
  return page.evaluate(() => {
    const largura = window.innerWidth;
    const altura = window.innerHeight;
    const tolerancia = 2;

    const visivel = (elemento: HTMLElement) => {
      const estilo = getComputedStyle(elemento);
      const caixa = elemento.getBoundingClientRect();
      return (
        estilo.display !== "none" &&
        estilo.visibility !== "hidden" &&
        Number(estilo.opacity) !== 0 &&
        caixa.width > 0 &&
        caixa.height > 0
      );
    };

    const dentroDeScrollerHorizontal = (elemento: HTMLElement) => {
      let ancestral = elemento.parentElement;
      while (ancestral && ancestral !== document.body) {
        const estilo = getComputedStyle(ancestral);
        if (
          (estilo.overflowX === "auto" || estilo.overflowX === "scroll") &&
          ancestral.scrollWidth > ancestral.clientWidth + 1
        ) {
          return true;
        }
        ancestral = ancestral.parentElement;
      }
      return false;
    };

    const elementos = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".page button, .page a[href], .page input, .page select, .page textarea, [role='dialog'] button, [role='dialog'] a[href], [role='dialog'] input, [role='dialog'] select"
      )
    ).filter(visivel);

    const foraDaTela = elementos
      .filter((elemento) => {
        if (dentroDeScrollerHorizontal(elemento)) return false;
        const caixa = elemento.getBoundingClientRect();
        return caixa.left < -tolerancia || caixa.right > largura + tolerancia;
      })
      .slice(0, 12)
      .map((elemento) => {
        const caixa = elemento.getBoundingClientRect();
        return {
          tag: elemento.tagName.toLowerCase(),
          texto:
            elemento.getAttribute("aria-label") ||
            elemento.textContent?.trim().slice(0, 70) ||
            elemento.getAttribute("name") ||
            "sem identificação",
          left: Math.round(caixa.left),
          right: Math.round(caixa.right),
        };
      });

    const alvosCriticamentePequenos = elementos
      .filter((elemento) => {
        const caixa = elemento.getBoundingClientRect();
        const estilo = getComputedStyle(elemento);
        if (estilo.pointerEvents === "none") return false;
        return caixa.width < 24 || caixa.height < 24;
      })
      .slice(0, 12)
      .map((elemento) => {
        const caixa = elemento.getBoundingClientRect();
        return {
          tag: elemento.tagName.toLowerCase(),
          texto:
            elemento.getAttribute("aria-label") ||
            elemento.textContent?.trim().slice(0, 70) ||
            "sem identificação",
          largura: Math.round(caixa.width),
          altura: Math.round(caixa.height),
        };
      });

    const dialogosForaDaTela = Array.from(
      document.querySelectorAll<HTMLElement>("[role='dialog']")
    )
      .filter(visivel)
      .filter((elemento) => {
        const caixa = elemento.getBoundingClientRect();
        return (
          caixa.left < -tolerancia ||
          caixa.right > largura + tolerancia ||
          (caixa.top < -tolerancia && getComputedStyle(elemento).overflowY !== "auto") ||
          (caixa.bottom > altura + tolerancia && getComputedStyle(elemento).overflowY !== "auto")
        );
      })
      .map((elemento) => {
        const caixa = elemento.getBoundingClientRect();
        return {
          classe: elemento.className,
          top: Math.round(caixa.top),
          right: Math.round(caixa.right),
          bottom: Math.round(caixa.bottom),
          left: Math.round(caixa.left),
        };
      });

    return {
      largura,
      altura,
      larguraPagina: Math.max(
        document.documentElement.scrollWidth,
        document.body.scrollWidth
      ),
      foraDaTela,
      alvosCriticamentePequenos,
      dialogosForaDaTela,
    };
  });
}

async function auditar(page: Page, rota: string) {
  await page.goto(rota, { waitUntil: "domcontentloaded" });
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/);
  await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });
  await page.waitForTimeout(700);

  const texto = await page.locator("body").innerText();
  expect(texto).not.toContain("Algo deu errado");
  expect(texto).not.toContain("Erro inesperado");

  const diagnostico = await coletarDiagnosticoMobile(page);

  expect(
    diagnostico.larguraPagina,
    `${rota} criou overflow horizontal em ${diagnostico.largura}px`
  ).toBeLessThanOrEqual(diagnostico.largura + 2);
  expect(
    diagnostico.foraDaTela,
    `${rota} possui controles fora da viewport`
  ).toEqual([]);
  expect(
    diagnostico.alvosCriticamentePequenos,
    `${rota} possui alvos de toque menores que 24px`
  ).toEqual([]);
  expect(
    diagnostico.dialogosForaDaTela,
    `${rota} possui diálogo sem contenção na viewport`
  ).toEqual([]);
}

test.describe("auditoria mobile completa", () => {
  test.skip(!email || !senha, "Configure a conta E2E dedicada.");

  test("rotas principais e prova realista cabem em 360px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Teste exclusivo do projeto mobile.");

    await page.setViewportSize({ width: 360, height: 740 });

    const errosDePagina: Error[] = [];
    page.on("pageerror", (erro) => errosDePagina.push(erro));

    await entrar(page);

    for (const rota of rotasPrincipais) {
      errosDePagina.length = 0;
      await auditar(page, rota);
      expect(errosDePagina, `Erro de JavaScript em ${rota}`).toEqual([]);
    }

    await page.evaluate((questao) => {
      localStorage.setItem("pmpe_questoes_ia", JSON.stringify([questao]));
      localStorage.removeItem("pmpe_resultados_simulados_ia");
    }, questaoTeste);

    errosDePagina.length = 0;
    await auditar(page, "/resolver-simulado-ia/prova");
    expect(errosDePagina, "Erro de JavaScript na tela de prova").toEqual([]);

    await expect(page.locator(".resolver-ia-container")).toBeVisible();
    await expect(page.getByText("Carregando questões...", { exact: true })).toHaveCount(0);
  });
});
