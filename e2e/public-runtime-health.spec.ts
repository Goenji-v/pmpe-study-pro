import { expect, test, type Page } from "@playwright/test";

type FalhaRuntime = {
  tipo: "console" | "request" | "response";
  detalhe: string;
};

const rotasPublicas = ["/login", "/demo"];

function instalarAuditoria(page: Page, falhas: FalhaRuntime[]) {
  page.on("console", (mensagem) => {
    if (mensagem.type() !== "error") return;

    const texto = mensagem.text();
    if (
      texto.includes("Failed to load resource") &&
      texto.includes("favicon")
    ) {
      return;
    }

    falhas.push({
      tipo: "console",
      detalhe: texto,
    });
  });

  page.on("requestfailed", (request) => {
    const url = request.url();
    if (url.startsWith("data:") || url.startsWith("blob:")) return;

    const erro = request.failure()?.errorText ?? "falha desconhecida";
    if (
      url.endsWith("/api/sentry-tunnel") &&
      erro === "net::ERR_ABORTED"
    ) {
      return;
    }

    falhas.push({
      tipo: "request",
      detalhe: `${request.method()} ${url} — ${erro}`,
    });
  });

  page.on("response", (response) => {
    const status = response.status();
    if (status < 400) return;

    const url = response.url();
    if (url.includes("favicon")) return;

    falhas.push({
      tipo: "response",
      detalhe: `${status} ${response.request().method()} ${url}`,
    });
  });
}

test.describe("saúde das telas públicas", () => {
  for (const rota of rotasPublicas) {
    test(`${rota} não gera erros de runtime ou rede`, async ({ page }) => {
      const falhas: FalhaRuntime[] = [];
      instalarAuditoria(page, falhas);

      await page.goto(rota, { waitUntil: "domcontentloaded", timeout: 30_000 });

      if (rota === "/login") {
        await expect(
          page.getByRole("heading", { name: "Entrar" })
        ).toBeVisible();
      } else {
        await expect(page.getByText("MODO DEMONSTRAÇÃO")).toBeVisible();
      }

      await page.waitForLoadState("load");
      await page.waitForTimeout(1_000);

      expect(
        falhas,
        falhas.map((falha) => `[${falha.tipo}] ${falha.detalhe}`).join("\n")
      ).toEqual([]);
    });
  }
});
