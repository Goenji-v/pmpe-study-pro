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

  // Apenas nomes legados inequivocamente usados como atalhos.
  // Uma categoria "personalizado" explícita continua sendo respeitada.
  if (
    /^(aulas?|video\s*aulas?|vidoe aula|aula no youtube)$/.test(nome)
  ) {
    return "aula";
  }

  if (
    /^(questao|questoes)( qc| qconcursos)?$/.test(nome)
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
      if (!aula) {
        aula = material;
        return;
      }

      vinculados.push(material);
      return;
    }

    if (material.tipo === "link" && material.url && categoria === "questoes") {
      if (!questoes) {
        questoes = material;
        return;
      }

      vinculados.push(material);
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

