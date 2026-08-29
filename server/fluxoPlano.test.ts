import assert from "node:assert/strict";
import test from "node:test";

import { planoPMPE } from "../src/data/planoPMPE";
import {
  aplicarAlteracoesComVinculoSeguro,
  missaoPossuiReferenciaCanonica,
  obterMateriaEfetivaDaSessao,
} from "../src/utils/vinculoPlano";

test("missão de conteúdo possui referência canônica e missão livre não", () => {
  const missaoConteudo = planoPMPE
    .flatMap((semana) => semana.dias)
    .flatMap((dia) => dia.missoes)
    .find((missao) => missao.tipo === "conteudo");

  const missaoLivre = planoPMPE
    .flatMap((semana) => semana.dias)
    .flatMap((dia) => dia.missoes)
    .find((missao) => missao.tipo === "livre");

  assert.ok(missaoConteudo);
  assert.ok(missaoLivre);
  assert.equal(missaoPossuiReferenciaCanonica(missaoConteudo), true);
  assert.equal(missaoPossuiReferenciaCanonica(missaoLivre), false);
});

test("alterar conteúdo de uma sessão do plano remove o vínculo com a missão original", () => {
  const anterior = {
    materia: "História",
    materiaId: "historia",
    modulo: "Geral",
    moduloId: "modulo-geral-historia",
    assunto: "Presença holandesa",
    assuntoId: "historia-presenca-holandesa",
    tipo: "aula",
    missaoId: "s1-d1-m1",
    semana: 1,
    dia: 1,
  };

  const atualizado = aplicarAlteracoesComVinculoSeguro(anterior, {
    assunto: "Revolução Praieira",
  });

  assert.equal(atualizado.assunto, "Revolução Praieira");
  assert.equal(atualizado.missaoId, undefined);
  assert.equal(atualizado.semana, undefined);
  assert.equal(atualizado.dia, undefined);
});

test("editar objetivo não remove o vínculo com a missão", () => {
  const anterior = {
    materia: "História",
    assunto: "Presença holandesa",
    tipo: "aula",
    objetivo: "Missão original",
    missaoId: "s1-d1-m1",
    semana: 1,
    dia: 1,
  };

  const atualizado = aplicarAlteracoesComVinculoSeguro(anterior, {
    objetivo: "Ler e fazer questões",
  });

  assert.equal(atualizado.missaoId, "s1-d1-m1");
  assert.equal(atualizado.semana, 1);
  assert.equal(atualizado.dia, 1);
});

test("simulado geral recebe matéria operacional sem exigir seleção manual", () => {
  assert.equal(obterMateriaEfetivaDaSessao("simulado", ""), "Simulados");
  assert.equal(obterMateriaEfetivaDaSessao("aula", "História"), "História");
});
