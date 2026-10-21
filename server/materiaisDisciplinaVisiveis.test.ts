import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  agruparMateriaisDaDisciplina,
  materialPertenceAMateria,
} from "../src/utils/correspondenciaMateriais";

const referencia = {
  materia: "Raciocínio Lógico e Matemática",
  materiaId: "rlm",
  modulo: "Geral",
  assunto: "Proposições lógicas",
  assuntoId: "prop",
};
const materiais = [
  { id: "mesmo-assunto", materia: referencia.materia, materiaId: "rlm", modulo: "Geral", assunto: referencia.assunto, assuntoId: "prop", nome: "Resumo de proposições" },
  { id: "outra-aula", materia: referencia.materia, materiaId: "rlm", modulo: "Geral", assunto: "Equivalências lógicas", assuntoId: "eq", nome: "Aula de equivalências" },
  { id: "outro-curso", materia: "Direito Constitucional", materiaId: "dirconst", modulo: "Geral", assunto: "Proposições lógicas", nome: "Material de outra matéria" },
];

test("selecionar apenas a matéria exibe todos os cadastros dessa matéria", () => {
  assert.deepEqual(
    materiais
      .filter((item) => materialPertenceAMateria(item, referencia))
      .map((item) => item.id),
    ["mesmo-assunto", "outra-aula"],
  );
});

test("ao escolher o assunto, manter os outros materiais separados e com origem", () => {
  const separados = agruparMateriaisDaDisciplina(materiais, referencia);
  assert.deepEqual(separados.vinculados.map((item) => item.id), ["mesmo-assunto"]);
  assert.deepEqual(separados.outrosDaDisciplina.map((item) => item.id), ["outra-aula"]);
});

test("materiais da matéria não ficam escondidos e não viram links da sessão sem assunto", () => {
  const fonte = readFileSync("src/components/MateriaisDoAssunto/MateriaisDoAssunto.tsx", "utf8");
  assert.match(fonte, /if \(!assunto\.trim\(\)\) \{/);
  assert.match(fonte, /setMateriais\(todos\.filter/);
  assert.match(fonte, /onAtalhosCarregados\?\.\(\{\}\)/);
  assert.match(fonte, /outrosDaDisciplina\.map/);
  assert.match(fonte, /Cadastro: \{material\.assunto\}/);
  assert.match(fonte, /MATERIAIS DA MATÉRIA/);
  assert.doesNotMatch(fonte, /<details className="materiais-assunto-outros"/);
});
