import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { solicitarBancaNaFinalizacao } from "../src/utils/bancasConcurso";

test("revisar teoria não pede banca, mesmo com seleção anterior de banca", () => {
  assert.equal(solicitarBancaNaFinalizacao("revisao", "teoria"), false);
  assert.equal(solicitarBancaNaFinalizacao("revisao"), false);
  const bancaAnterior = "Instituto AOCP";
  const solicitarBanca = solicitarBancaNaFinalizacao("revisao", "teoria");
  const bancaSalva = solicitarBanca ? bancaAnterior.trim() || undefined : undefined;
  assert.equal(bancaSalva, undefined);
});

test("revisão por questões, questões e simulado preservam opção de banca", () => {
  assert.equal(solicitarBancaNaFinalizacao("revisao", "questoes"), true);
  assert.equal(solicitarBancaNaFinalizacao("questoes"), true);
  assert.equal(solicitarBancaNaFinalizacao("simulado"), true);
  assert.equal(solicitarBancaNaFinalizacao("aula"), false);
});

test("o formulário e o salvamento da Central usam a mesma condição", () => {
  const central = readFileSync("src/pages/CentralEstudos/CentralEstudos.tsx", "utf8");
  assert.match(central, /const solicitarBanca = solicitarBancaNaFinalizacao\(/);
  assert.match(central, /\{solicitarBanca && \(/);
  assert.match(central, /banca: solicitarBanca \? banca\.trim\(\) \|\| undefined : undefined/);
  assert.match(central, /Como foi a revisão\?/);
});
