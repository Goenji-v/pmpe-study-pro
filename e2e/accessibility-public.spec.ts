import { expect, test, type Page } from "@playwright/test";

type ProblemaAcessibilidade = {
  tipo: string;
  seletor: string;
  detalhe: string;
};

async function auditarPagina(page: Page) {
  return page.evaluate(() => {
    const problemas: ProblemaAcessibilidade[] = [];

    const visivel = (elemento: Element) => {
      if (!(elemento instanceof HTMLElement)) return false;
      const estilo = window.getComputedStyle(elemento);
      const caixa = elemento.getBoundingClientRect();

      return (
        estilo.display !== "none" &&
        estilo.visibility !== "hidden" &&
        estilo.opacity !== "0" &&
        caixa.width > 0 &&
        caixa.height > 0 &&
        elemento.getAttribute("aria-hidden") !== "true"
      );
    };

    const seletor = (elemento: Element) => {
      const tag = elemento.tagName.toLowerCase();
      const id = elemento.id ? `#${elemento.id}` : "";
      const classe =
        elemento instanceof HTMLElement && elemento.classList.length > 0
          ? "." + Array.from(elemento.classList).slice(0, 2).join(".")
          : "";
      return `${tag}${id}${classe}`;
    };

    const textoAcessivel = (elemento: Element) => {
      const ariaLabel = elemento.getAttribute("aria-label")?.trim();
      if (ariaLabel) return ariaLabel;

      const labelledBy = elemento.getAttribute("aria-labelledby")?.trim();
      if (labelledBy) {
        const texto = labelledBy
          .split(/\s+/)
          .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
          .filter(Boolean)
          .join(" ");
        if (texto) return texto;
      }

      const title = elemento.getAttribute("title")?.trim();
      if (title) return title;

      const texto = elemento.textContent?.replace(/\s+/g, " ").trim();
      if (texto) return texto;

      if (elemento instanceof HTMLInputElement) {
        const valor = elemento.value?.trim();
        if (valor) return valor;
      }

      return "";
    };

    if (!document.documentElement.lang.trim()) {
      problemas.push({
        tipo: "documento-sem-idioma",
        seletor: "html",
        detalhe: "Defina o atributo lang no elemento html.",
      });
    }

    if (!document.title.trim()) {
      problemas.push({
        tipo: "documento-sem-titulo",
        seletor: "head > title",
        detalhe: "A página precisa de um título.",
      });
    }

    document.querySelectorAll("button, a[href]").forEach((elemento) => {
      if (!visivel(elemento)) return;
      if (textoAcessivel(elemento)) return;

      problemas.push({
        tipo: "controle-sem-nome",
        seletor: seletor(elemento),
        detalhe: "Botão ou link visível sem nome acessível.",
      });
    });

    document.querySelectorAll("img").forEach((elemento) => {
      if (!visivel(elemento)) return;
      if (elemento.hasAttribute("alt")) return;

      problemas.push({
        tipo: "imagem-sem-alt",
        seletor: seletor(elemento),
        detalhe: "Imagem visível sem atributo alt.",
      });
    });

    document
      .querySelectorAll("input:not([type='hidden']), select, textarea")
      .forEach((elemento) => {
        if (!visivel(elemento)) return;

        const possuiRotuloNativo =
          "labels" in elemento &&
          Array.from((elemento as HTMLInputElement).labels ?? []).some(
            (label) => Boolean(label.textContent?.trim())
          );

        const possuiRotuloAria =
          Boolean(elemento.getAttribute("aria-label")?.trim()) ||
          Boolean(elemento.getAttribute("aria-labelledby")?.trim());

        if (possuiRotuloNativo || possuiRotuloAria) return;

        problemas.push({
          tipo: "campo-sem-rotulo",
          seletor: seletor(elemento),
          detalhe: "Campo de formulário visível sem label ou aria-label.",
        });
      });

    const ids = new Map<string, number>();
    document.querySelectorAll("[id]").forEach((elemento) => {
      const id = elemento.id.trim();
      if (!id) return;
      ids.set(id, (ids.get(id) ?? 0) + 1);
    });

    for (const [id, total] of ids) {
      if (total <= 1) continue;
      problemas.push({
        tipo: "id-duplicado",
        seletor: `#${id}`,
        detalhe: `O id aparece ${total} vezes na página.`,
      });
    }

    return problemas;
  });
}

test.describe("acessibilidade das áreas públicas", () => {
  for (const rota of ["/login", "/demo"]) {
    test(`${rota} não possui problemas básicos de acessibilidade`, async ({
      page,
    }) => {
      await page.goto(rota, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => undefined);

      const problemas = await auditarPagina(page);

      expect(
        problemas,
        problemas
          .map(
            (problema) =>
              `[${problema.tipo}] ${problema.seletor}: ${problema.detalhe}`
          )
          .join("\n")
      ).toEqual([]);
    });
  }
});
