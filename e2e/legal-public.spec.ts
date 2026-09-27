import { expect, test } from "@playwright/test";

const documentos = [
  { rota: "/termos", titulo: "Termos de Uso" },
  { rota: "/privacidade", titulo: "Política de Privacidade" },
];

async function esperarSemOverflow(page: import("@playwright/test").Page, rota: string) {
  const tamanho = await page.evaluate(() => ({
    viewport: window.innerWidth,
    html: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));

  expect(
    Math.max(tamanho.html, tamanho.body),
    `A rota ${rota} criou overflow horizontal.`
  ).toBeLessThanOrEqual(tamanho.viewport + 2);
}

test.describe("documentos legais públicos", () => {
  for (const documento of documentos) {
    test(`${documento.titulo} abre sem login e é responsivo`, async ({ page }) => {
      await page.goto(documento.rota, { waitUntil: "domcontentloaded" });

      await expect(page).toHaveURL(new RegExp(`${documento.rota.replace("/", "\\/")}$`));
      await expect(page.getByRole("heading", { level: 1, name: documento.titulo })).toBeVisible();
      await expect(page.getByText("27 de setembro de 2026")).toBeVisible();
      await expect(page.locator(".legal-content")).toBeVisible();
      await esperarSemOverflow(page, documento.rota);
    });
  }

  test("login expõe Termos e Privacidade antes do cadastro", async ({ page }) => {
    await page.goto("/login", { waitUntil: "domcontentloaded" });

    await expect(page.getByRole("link", { name: "Termos de Uso" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Política de Privacidade" })).toBeVisible();

    await page.getByRole("link", { name: "Política de Privacidade" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Política de Privacidade" })).toBeVisible();
  });

  test("documentos permitem navegação entre si", async ({ page }) => {
    await page.goto("/termos", { waitUntil: "domcontentloaded" });
    await page.getByRole("link", { name: "Política de Privacidade" }).last().click();

    await expect(page).toHaveURL(/\/privacidade$/);
    await expect(page.getByRole("heading", { level: 1, name: "Política de Privacidade" })).toBeVisible();
  });
});
