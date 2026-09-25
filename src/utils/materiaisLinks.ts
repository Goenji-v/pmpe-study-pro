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

export function separarMateriaisPorUso<
  T extends {
    tipo: "arquivo" | "link";
    nome: string;
    categoriaLink?: CategoriaLinkMaterial;
    url?: string;
  },
>(materiais: T[]) {
  let aula: T | undefined;
  let questoes: T | undefined;
  const vinculados: T[] = [];

  materiais.forEach((material) => {
    const categoria = resolverCategoriaLinkMaterial({
      tipo: material.tipo,
      nome: material.nome,
      categoria: material.categoriaLink,
    });

    if (material.tipo === "link" && material.url && categoria === "aula") {
      aula ??= material;
      return;
    }

    if (material.tipo === "link" && material.url && categoria === "questoes") {
      questoes ??= material;
      return;
    }

    vinculados.push(material);
  });

  return {
    aula,
    questoes,
    vinculados,
  };
}

