import { expect, test } from "@playwright/test";

const esperado = process.env.E2E_EXPECTED_COMMIT?.slice(0, 8);
const apiUrl = process.env.E2E_API_URL || "https://pmpe-study-pro-api.onrender.com";

test("produção está no mesmo commit no frontend e backend", async ({ page, request }) => {
  test.skip(!esperado, "Commit esperado não informado.");
  test.setTimeout(300_000);

  let versaoFrontend = "";
  let versaoBackend = "";

  for (let tentativa = 0; tentativa < 50; tentativa += 1) {
    await page.goto(`/login?deploy_check=${Date.now()}`, {
      waitUntil: "domcontentloaded",
    });

    versaoFrontend = await page.evaluate(
      () => document.documentElement.dataset.appVersion || ""
    );

    try {
      const resposta = await request.get(`${apiUrl}/api/saude?deploy_check=${Date.now()}`, {
        failOnStatusCode: false,
      });
      if (resposta.ok()) {
        const corpo = await resposta.json() as { versao?: string };
        versaoBackend = corpo.versao || "";
      }
    } catch {
      versaoBackend = "";
    }

    if (
      versaoFrontend.includes(esperado!) &&
      versaoBackend === esperado
    ) {
      break;
    }

    await page.waitForTimeout(5_000);
  }

  expect(
    versaoFrontend,
    "O frontend não chegou ao commit esperado dentro da janela de publicação."
  ).toContain(esperado!);
  expect(
    versaoBackend,
    "O backend não chegou ao commit esperado dentro da janela de publicação."
  ).toBe(esperado);
});
