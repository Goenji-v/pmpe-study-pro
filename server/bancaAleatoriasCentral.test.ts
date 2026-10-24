import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { solicitarBancaNaFinalizacao } from "../src/utils/bancasConcurso";

const source = readFileSync("src/pages/CentralEstudos/CentralEstudos.tsx", "utf8");
const datalist = source.split('<datalist id="bancas-concurso">')[1]?.split("</datalist>")[0] ?? "";

test("Aleatórias aparece como primeira opção de banca na Central de Estudos", () => {
  assert.match(datalist, /<option value="Aleatórias" label="Questões de bancas variadas" \/>/);
  assert.ok(datalist.indexOf('value="Aleatórias"') < datalist.indexOf("BANCAS_CONCURSO.map"));
  assert.doesNotMatch(datalist, /estado\.tipo === "revisao"/);
  assert.match(source, /placeholder="Selecione uma banca ou Aleatórias"/);
  assert.match(source, /Use “Aleatórias” quando resolver questões de bancas diferentes/);
});

test("a mesma lista atende questões, simulados e revisão por questões, sem banca na teoria", () => {
  assert.equal(solicitarBancaNaFinalizacao("questoes"), true);
  assert.equal(solicitarBancaNaFinalizacao("simulado"), true);
  assert.equal(solicitarBancaNaFinalizacao("revisao", "questoes"), true);
  assert.equal(solicitarBancaNaFinalizacao("revisao", "teoria"), false);
  assert.match(source, /\{solicitarBanca && \(/);
});

test("seleção Aleatórias é persistida literalmente, e não sorteia uma banca", () => {
  assert.match(source, /banca: solicitarBanca \? banca\.trim\(\) \|\| undefined : undefined/);
  assert.doesNotMatch(datalist, /Math\.random|sortear|selecionarBancaAleatoria/);
});
