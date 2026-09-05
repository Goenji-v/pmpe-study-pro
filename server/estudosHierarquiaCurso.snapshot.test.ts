import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync("src/pages/Estudos/Estudos.tsx", "utf8");

test("Conteúdos usa a visão canônica em vez dos módulos brutos do curso", () => {
  assert.match(source, /materias\.map\(prepararMateriaParaConteudos\)/);
  assert.match(source, /moduloGerenciadoPorCurso\(modulo\)/);
  assert.match(source, /Curso importado/);
});
