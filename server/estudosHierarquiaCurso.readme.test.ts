import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const doc = readFileSync("src/pages/Estudos/README_HIERARQUIA.md", "utf8");

test("documenta a hierarquia canônica de cursos na tela Conteúdos", () => {
  assert.match(doc, /Matéria → Geral\/Curso → Assunto → Aula\/PDF/);
});
