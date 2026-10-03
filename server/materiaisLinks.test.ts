import assert from "node:assert/strict";
import test from "node:test";

import {
  resolverCategoriaLinkMaterial,
  separarMateriaisPorUso,
} from "../src/utils/materiaisLinks.ts";

test("reconhece Aula e Questões mesmo em materiais antigos sem categoria salva", () => {
  assert.equal(
    resolverCategoriaLinkMaterial({
      tipo: "link",
      nome: "Aula",
    }),
    "aula"
  );

  assert.equal(
    resolverCategoriaLinkMaterial({
      tipo: "link",
      nome: "questoes",
    }),
    "questoes"
  );

  assert.equal(
    resolverCategoriaLinkMaterial({
      tipo: "link",
      nome: "Questões",
    }),
    "questoes"
  );
});

test("categoria explícita personalizada não é sobrescrita pelo nome", () => {
  assert.equal(
    resolverCategoriaLinkMaterial({
      tipo: "link",
      nome: "Questões",
      categoria: "personalizado",
    }),
    "personalizado"
  );
});

test("arquivos nunca viram atalhos rápidos por causa do nome", () => {
  assert.equal(
    resolverCategoriaLinkMaterial({
      tipo: "arquivo",
      nome: "Aula",
    }),
    "personalizado"
  );
});


test("primeiro Aula e Questões viram atalhos; links extras continuam visíveis", () => {
  const materiais = [
    {
      id: "aula-nova",
      tipo: "link" as const,
      nome: "Aula",
      categoriaLink: "aula" as const,
      url: "https://exemplo.com/aula-nova",
    },
    {
      id: "aula-antiga",
      tipo: "link" as const,
      nome: "Aula",
      categoriaLink: "aula" as const,
      url: "https://exemplo.com/aula-antiga",
    },
    {
      id: "questoes",
      tipo: "link" as const,
      nome: "Questões",
      categoriaLink: "questoes" as const,
      url: "https://exemplo.com/questoes",
    },
    {
      id: "questoes-extra",
      tipo: "link" as const,
      nome: "Questões complementares",
      categoriaLink: "questoes" as const,
      url: "https://exemplo.com/questoes-extra",
    },
    {
      id: "pdf",
      tipo: "arquivo" as const,
      nome: "Resumo em PDF",
    },
    {
      id: "site",
      tipo: "link" as const,
      nome: "Lei comentada",
      categoriaLink: "personalizado" as const,
      url: "https://exemplo.com/lei",
    },
  ];

  const separados = separarMateriaisPorUso(materiais);

  assert.equal(separados.aula?.id, "aula-nova");
  assert.equal(separados.questoes?.id, "questoes");
  assert.deepEqual(
    separados.vinculados.map((item) => item.id),
    ["aula-antiga", "questoes-extra", "pdf", "site"]
  );
});
