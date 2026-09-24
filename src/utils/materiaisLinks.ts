export type CategoriaLinkMaterial =
  | "aula"
  | "questoes"
  | "personalizado";

export function resolverCategoriaLinkMaterial(params: {
  tipo: "arquivo" | "link";
  nome: string;
  categoria?: unknown;
}): CategoriaLinkMaterial {
  if (
    params.categoria === "aula" ||
    params.categoria === "questoes" ||
    params.categoria === "personalizado"
  ) {
    return params.categoria;
  }

  if (params.tipo !== "link") {
    return "personalizado";
  }

  const nome =
    params.nome
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  if (
    nome === "aula" ||
    nome === "aulas"
  ) {
    return "aula";
  }

  if (
    nome === "questao" ||
    nome === "questoes"
  ) {
    return "questoes";
  }

  return "personalizado";
}
