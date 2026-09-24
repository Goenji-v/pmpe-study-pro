import assert from "node:assert/strict";
import test from "node:test";

import {
  resolverCategoriaLinkMaterial,
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
