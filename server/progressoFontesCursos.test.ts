import assert from "node:assert/strict";
import test from "node:test";
import type { AulaAssunto } from "../src/types/index.ts";
import { aulasDaFontePrincipal } from "../src/utils/progressoFontesCursos.ts";

const aulas: AulaAssunto[] = [
  { id: "rdc-aula", nome: "Sintaxe pelo curso de Português", ordem: 0, concluida: true,
    origemCurso: { cursoId: "rdc", cursoNome: "Curso especializado", materiaCursoId: "p", materiaCursoNome: "Português", moduloCursoId: "s", moduloCursoNome: "Sintaxe", aulaCursoId: "1" } },
  { id: "completo-aula", nome: "Sintaxe pelo curso completo", ordem: 1, concluida: false,
    origemCurso: { cursoId: "curso-completo", cursoNome: "Curso completo", materiaCursoId: "p2", materiaCursoNome: "Português", moduloCursoId: "s2", moduloCursoNome: "Sintaxe", aulaCursoId: "2" } },
];

test("quando usuário escolhe fonte, só suas aulas determinam conclusão", () => {
  const exigidas = aulasDaFontePrincipal(aulas, "rdc");
  assert.equal(exigidas.length, 1);
  assert.equal(exigidas.every(a => a.concluida), true);
  assert.equal(aulas[1].concluida, false);
});

test("sem fonte escolhida mantém regra de conclusão antiga", () => {
  const exigidas = aulasDaFontePrincipal(aulas);
  assert.equal(exigidas.length, 2);
  assert.equal(exigidas.every(a => a.concluida), false);
});

test("fonte ausente não provoca conclusão indevida", () => {
  assert.equal(aulasDaFontePrincipal(aulas, "curso-inexistente").length, 2);
});
