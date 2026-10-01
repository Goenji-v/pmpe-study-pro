import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Meus Cursos prioriza prints/PDF no PC e celular e mantém copiar/colar como alternativa", async () => {
  const codigo = await readFile("src/pages/Cursos/Cursos.tsx", "utf8");

  assert.match(codigo, /RECOMENDADO · PC E CELULAR/);
  assert.match(codigo, /Enviar prints, fotos ou PDF da grade/);
  assert.match(codigo, /accept="image\/\*,application\/pdf,\.pdf"/);
  assert.match(codigo, /multiple/);
  assert.match(codigo, /Ler e montar trilha/);
  assert.match(codigo, /analisarMidiasDoCurso/);

  assert.match(codigo, /Tentar copiar\/colar/);
  assert.match(codigo, /navigator\.clipboard\?\.read/);
  assert.match(codigo, /capturaDeHtml/);
  assert.match(codigo, /capturaDeTexto/);
  assert.match(codigo, /onPaste=\{analisarColagemManual\}/);
  assert.match(codigo, /Ctrl\+V/);

  assert.match(codigo, /Importar e começar/);
  assert.match(codigo, /Continuar curso/);
  assert.match(codigo, /pmpe:central-estudos:prefill/);
  assert.match(codigo, /navigate\("\/central-estudos"\)/);
  assert.match(codigo, /Outras formas de importar/);
  assert.match(codigo, /Não precisa copiar código nem informar sua senha/);
});
