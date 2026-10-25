import test from "node:test";
import assert from "node:assert/strict";
import type { SemanaPlano } from "../src/data/planoPMPE";
import { projetarPlanoCompactado } from "../src/utils/projecaoCronogramaIndividual";

test("compacta somente conteúdos e mantém histórico/IDs intactos", () => {
  const plano = [
    { numero: 1, nome: "Semana 01", dias: [
      { numero: 1, missoes: [{ id: "a", tipo: "conteudo" }] },
      { numero: 2, missoes: [{ id: "b", tipo: "conteudo" }] },
      { numero: 7, missoes: [{ id: "rev", tipo: "revisao" }] },
    ] },
    { numero: 2, nome: "Semana 02", dias: [
      { numero: 1, missoes: [{ id: "c", tipo: "conteudo" }] },
      { numero: 7, missoes: [{ id: "sim", tipo: "simulado" }] },
    ] },
  ] as unknown as SemanaPlano[];
  const antes = JSON.stringify(plano);
  const concluidas = ["b", "c"];
  const reorganizado = projetarPlanoCompactado(plano, concluidas);
  assert.deepEqual(reorganizado.flatMap(s => s.dias.flatMap(d => d.missoes.filter(m => m.tipo === "conteudo").map(m => m.id))), ["b", "c", "a"]);
  assert.equal(reorganizado[0].dias[2].missoes[0].id, "rev");
  assert.equal(reorganizado[1].dias[1].missoes[0].id, "sim");
  assert.equal(JSON.stringify(plano), antes);
  assert.deepEqual(concluidas, ["b", "c"]);
  assert.equal(projetarPlanoCompactado(reorganizado, concluidas)[0].dias[0].missoes[0].id, "b");
});

test("domingo permanece idêntico, mesmo se houver conteúdo concluído nele", () => {
  const plano = [
    { numero: 1, nome: "Semana 1", dias: [
      { numero: 1, missoes: [{id:"a",tipo:"conteudo"}] },
      { numero: 7, missoes: [{id:"dom",tipo:"conteudo"},{id:"sim",tipo:"simulado"}] },
    ] },
    { numero: 2, nome: "Semana 2", dias: [
      { numero: 1, missoes: [{id:"b",tipo:"conteudo"}] },
      { numero: 7, missoes: [{id:"red",tipo:"redacao"}] },
    ] },
  ] as unknown as SemanaPlano[];
  const resultado = projetarPlanoCompactado(plano, ["b", "dom"]);
  assert.equal(resultado[0].dias[0].missoes[0].id, "b");
  assert.equal(resultado[1].dias[0].missoes[0].id, "a");
  assert.deepEqual(resultado[0].dias[1], plano[0].dias[1]);
  assert.deepEqual(resultado[1].dias[1], plano[1].dias[1]);
});
