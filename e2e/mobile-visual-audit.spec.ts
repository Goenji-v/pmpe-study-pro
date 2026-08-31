import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const senha = process.env.E2E_TEST_PASSWORD;

const telas = [
  ["dashboard", "/"],
  ["plano", "/plano"],
  ["central-estudos", "/central-estudos"],
  ["questoes", "/questoes"],
  ["revisoes", "/revisoes"],
  ["simulados", "/simulados"],
  ["configuracoes", "/configuracoes"],
] as const;

const questaoTeste = {
  id: "e2e-mobile-visual-1",
  materia: "Direito Constitucional",
  materiaId: "direito-constitucional",
  modulo: "Direitos e garantias fundamentais",
  moduloId: "direitos-garantias",
  assunto: "Direitos individuais e coletivos com um título longo para validar o celular",
  assuntoId: "direitos-individuais",
  banca: "AOCP",
  dificuldade: "Difícil",
  enunciado:
    "Considerando a Constituição Federal e um enunciado propositalmente longo para reproduzir a leitura de uma questão real no celular, assinale a alternativa correta.",
  alternativas: {
    A: "Alternativa A com texto longo para conferir a leitura e a quebra de linha.",
    B: "Alternativa B com outro texto comprido para simular uma prova real.",
    C: "Alternativa C com conteúdo de tamanho semelhante ao de concursos.",
    D: "Alternativa D usada para validar o comportamento visual responsivo.",
    E: "Alternativa E usada para validar o comportamento visual responsivo.",
  },
  respostaCorreta: "A",
  explicacao: "Explicação de teste.",
};

async function fecharRecompensaSeAberta(page: Page) {
  const fechar = page.getByRole("button", {
    name: "Fechar recompensa de login",
    exact: true,
  });

  try {
    await fechar.waitFor({ state: "visible", timeout: 2_500 });
    await fechar.click();
  } catch {
    // A recompensa pode já ter sido fechada nesta sessão de teste.
  }
}

async function entrar(page: Page) {
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("E-mail").fill(email!);
  await page.getByLabel("Senha").fill(senha!);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page).not.toHaveURL(/\/login(?:$|\?)/, { timeout: 15_000 });
  await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });
  await fecharRecompensaSeAberta(page);
}

async function anexarScreenshot(
  page: Page,
  testInfo: import("@playwright/test").TestInfo,
  nome: string
) {
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(500);

  const imagem = await page.screenshot({
    fullPage: true,
    animations: "disabled",
  });

  await testInfo.attach(`${nome}-360px`, {
    body: imagem,
    contentType: "image/png",
  });
}

test.describe("capturas da auditoria visual mobile", () => {
  test.skip(!email || !senha, "Configure a conta E2E dedicada.");

  test("captura telas principais e prova em 360px", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "Teste exclusivo do projeto mobile.");
    await page.setViewportSize({ width: 360, height: 740 });

    await entrar(page);

    for (const [nome, rota] of telas) {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      await expect(page.locator(".layout")).toBeVisible({ timeout: 15_000 });
      await fecharRecompensaSeAberta(page);
      await anexarScreenshot(page, testInfo, nome);
    }

    await page.evaluate((questao) => {
      localStorage.setItem("pmpe_questoes_ia", JSON.stringify([questao]));
      localStorage.removeItem("pmpe_resultados_simulados_ia");
    }, questaoTeste);

    await page.goto("/resolver-simulado-ia/prova", { waitUntil: "domcontentloaded" });
    await expect(page.locator(".resolver-ia-container")).toBeVisible({ timeout: 15_000 });

    const bloqueio = page.locator(".questoes-crono-bloqueio");
    if (await bloqueio.isVisible()) {
      await anexarScreenshot(page, testInfo, "prova-inicio-cronometro");
      await bloqueio.evaluate((elemento) => {
        (elemento as HTMLElement).style.display = "none";
      });
    }

    await anexarScreenshot(page, testInfo, "prova-questao");
  });
});
