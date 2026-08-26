import assert from "node:assert/strict";
import test from "node:test";

import { encontrarAulasParaMissao } from "../src/utils/relacionarCursoEdital.ts";
import type { CursoImportado } from "../src/types/cursos.ts";

const curso: CursoImportado = {
  id: "cetem",
  nome: "CETEM",
  origem: "captura-json",
  criadoEm: "2026-08-26T10:00:00.000Z",
  atualizadoEm: "2026-08-26T10:00:00.000Z",
  materias: [
    {
      id: "portugues",
      nome: "Língua Portuguesa",
      ordem: 1,
      modulos: [
        {
          id: "fonologia",
          nome: "Fonologia",
          ordem: 1,
          aulas: [
            { id: "1", nome: "Fonema, letra e dígrafos", url: "https://curso/aula-1", ordem: 1 },
            { id: "2", nome: "Crase", url: "https://curso/aula-2", ordem: 2 },
          ],
        },
      ],
    },
    {
      id: "rlm",
      nome: "Raciocínio Lógico e Matemática",
      ordem: 2,
      modulos: [
        {
          id: "proposicoes",
          nome: "Proposições lógicas",
          ordem: 1,
          aulas: [
            { id: "3", nome: "Tabela verdade e proposições", url: "https://curso/aula-3", ordem: 1 },
          ],
        },
      ],
    },
  ],
};

test("encontra aula compatível por matéria e assunto", () => {
  const aulas = encontrarAulasParaMissao(
    [curso],
    [curso.id],
    "Português",
    "Fonologia: fonema, letra e dígrafos"
  );

  assert.equal(aulas[0]?.url, "https://curso/aula-1");
  assert.equal(aulas[0]?.curso, "CETEM");
});

test("não usa curso desativado", () => {
  const aulas = encontrarAulasParaMissao(
    [curso],
    [],
    "Português",
    "Fonologia"
  );
  assert.equal(aulas.length, 0);
});

test("não cruza aula de matéria incompatível", () => {
  const aulas = encontrarAulasParaMissao(
    [curso],
    [curso.id],
    "Direito Penal",
    "Crase"
  );
  assert.equal(aulas.length, 0);
});
