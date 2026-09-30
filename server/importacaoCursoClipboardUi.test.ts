import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Meus Cursos oferece importação simples pela área de transferência", async () => {
  const codigo = await readFile("src/pages/Cursos/Cursos.tsx", "utf8");

  assert.match(codigo, /Trazer curso sem arquivo ou código/);
  assert.match(codigo, /navigator\.clipboard\?\.read/);
  assert.match(codigo, /capturaDeHtml/);
  assert.match(codigo, /capturaDeTexto/);
  assert.match(codigo, /Colar curso/);
  assert.match(codigo, /Outras formas de importar/);
  assert.match(codigo, /O Study Pro não pede sua senha da plataforma/);
});
