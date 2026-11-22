import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const revisoes = readFileSync(new URL("../src/pages/Revisoes/Revisoes.tsx", import.meta.url), "utf8");

test("resolver abre aulas e materiais, não o gerador de questões", () => {
  assert.match(revisoes, /onClick=\{\(\) => abrirRevisao\(revisao\)\}/);
  assert.doesNotMatch(revisoes, /relacionadas\.length > 1 \? abrirQuestoesIA\(revisao\)/);
  assert.match(revisoes, /revisaoEmExibicaoId === revisao\.id && \(/);
  assert.match(revisoes, /<ConteudoDaRevisao/);
  assert.match(revisoes, /Aulas vinculadas/);
  assert.match(revisoes, /Materiais vinculados/);
});

test("geração de questões continua opcional e separada", () => {
  assert.match(revisoes, /Fazer questões IA \(opcional\)/);
  assert.match(revisoes, /Rever teoria — iniciar sessão/);
  assert.match(revisoes, /const linkSeguro =/);
});

test("bloco de revisão não força geração de questões", () => {
  const inicio = revisoes.indexOf("function iniciarSessaoRevisao");
  const fim = revisoes.indexOf("function abrirQuestoesIA", inicio);
  assert.ok(inicio > -1 && fim > inicio);
  assert.doesNotMatch(revisoes.slice(inicio, fim), /abrirQuestoesIA\(revisao\)/);
});
