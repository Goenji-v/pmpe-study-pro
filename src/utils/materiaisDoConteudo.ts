import type { MaterialAssunto } from "../types";

export function listarMateriaisDaEstrutura(
  assunto?: { pdf?: string; materiais?: readonly MaterialAssunto[] }
): Array<Pick<MaterialAssunto, "id" | "nome" | "tipo" | "url">> {
  if (!assunto) return [];
  const itens = [
    ...(assunto.materiais ?? []),
    ...(assunto.pdf
      ? [{ id: "pdf-do-assunto", nome: "PDF do assunto", tipo: "pdf" as const, url: assunto.pdf }]
      : []),
  ];

  const vistos = new Set<string>();
  return itens.filter((item) => {
    const url = item.url?.trim();
    if (!url || !/^https?:\/\//i.test(url) || vistos.has(url)) return false;
    vistos.add(url);
    return true;
  });
}
