import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const revisions = readFileSync(new URL("../src/pages/Revisoes/Revisoes.tsx", import.meta.url), "utf8");
const central = readFileSync(new URL("../src/pages/CentralEstudos/CentralEstudos.tsx", import.meta.url), "utf8");

test("todos os cards abrem uma sessão de revisão no Centro de Estudos", () => {
  assert.match(revisions, /onClick=\{\(\) => abrirRevisao\(revisao\)\}/);
  assert.doesNotMatch(revisions, /relacionadas\.length > 1 \? abrirQuestoesIA\(revisao\)/);
  const start = revisions.indexOf("function abrirRevisao(revisao: Revisao)");
  const end = revisions.indexOf("function abrirQuestoesIA(revisao: Revisao)", start);
  assert.ok(start >= 0 && end > start);
  const body = revisions.slice(start, end);
  assert.match(body, /"pmpe:central-estudos:prefill"/);
  assert.match(body, /revisaoId: revisao\.id/);
  assert.match(body, /tipo: "revisao"/);
  assert.match(body, /formatoRevisao: "teoria"/);
  assert.match(body, /navigate\("\/central-estudos"\)/);
  assert.doesNotMatch(body, /abrirQuestoesIA\(revisao\)/);
  assert.doesNotMatch(body, /navigate\("\/gerar-simulado-ia"\)/);
});

test("Centro de Estudos possui os recursos da tela aprovada", () => {
  assert.match(central, /"pmpe:central-estudos:prefill"/);
  assert.match(central, /formatoRevisao === "teoria"/);
  assert.match(central, /formatoRevisao === "questoes"/);
  assert.match(central, /MATERIAIS VINCULADOS|Materiais vinculados/);
});
