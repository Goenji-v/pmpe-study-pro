import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Assunto, Materia, Revisao } from "../src/types";
import { aulasDeSubassuntosDistintos } from "../src/utils/aulasDeSubassuntosDistintos";
import { criarPrimeiraRevisao, criarProximaRevisao } from "../src/utils/revisoes";
import { chaveAssuntoPrincipal } from "../src/utils/revisoesAssuntoPrincipal";
import { reconciliarRevisoesComConteudos } from "../src/services/conteudos/sincronizacaoCanonica";

const assunto = (nomes: string[]): Assunto => ({
  id: "grupo-combinatoria", nome: "Análise Combinatória", prioridade: "alta", concluido: false,
  aulas: nomes.map((nome, i) => ({ id: "aula-" + i, nome, ordem: i, concluida: false })),
});

test("Arranjo, Permutação e Combinação são aulas e revisões independentes", () => {
  const aulas = aulasDeSubassuntosDistintos("Raciocínio Lógico e Matemática",
    assunto(["Permutação", "Arranjo", "Combinação simples"]));
  assert.deepEqual(aulas.map(a => a.nome), ["Permutação", "Arranjo", "Combinação simples"]);
  const r1 = criarPrimeiraRevisao({materiaId: "rlm", moduloId: "mod", assuntoId: "grupo-combinatoria",
    aulaId: aulas[0].id, materia: "Raciocínio Lógico e Matemática", assunto: aulas[0].nome});
  const r2 = criarPrimeiraRevisao({materiaId: "rlm", moduloId: "mod", assuntoId: "grupo-combinatoria",
    aulaId: aulas[1].id, materia: "Raciocínio Lógico e Matemática", assunto: aulas[1].nome,
    revisoesExistentes: [r1]});
  assert.notEqual(r1.aulaId, r2.aulaId);
  assert.equal(chaveAssuntoPrincipal(r1), null);
  const next = criarProximaRevisao({...r1, concluida: true}, [r2], 0, new Date("2026-11-22T12:00:00.000Z"));
  assert.ok(next);
  assert.equal(next.aulaId, r1.aulaId);
  assert.equal(next.assunto, "Permutação");
});

test("A versão do curso com título Análise combinatória (combinação) é reconhecida", () => {
  const aulas = aulasDeSubassuntosDistintos("Raciocínio Lógico e Matemática",
    assunto(["Permutação", "Arranjo", "Análise combinatória (combinação)"]));
  assert.equal(aulas.length, 3);
});

test("Aulas do mesmo conteúdo, materiais e nomes sem mapeamento não são artificialmente separados", () => {
  assert.deepEqual(aulasDeSubassuntosDistintos("Informática", assunto(["Windows parte 1", "Windows parte 2"])), []);
  assert.deepEqual(aulasDeSubassuntosDistintos("Raciocínio Lógico e Matemática", assunto(["Arranjo", "Arranjo simples"])), []);
  assert.deepEqual(aulasDeSubassuntosDistintos("Raciocínio Lógico e Matemática", assunto(["Permutação", "Aula sem identificação"])), []);
  assert.deepEqual(aulasDeSubassuntosDistintos("Raciocínio Lógico e Matemática", assunto(["Arranjo"])), []);
});

test("Conciliação com conteúdos não reescreve assunto de revisões individuais", () => {
  const revisao: Revisao = {
    id: "rev", materiaId: "rlm", moduloId: "mod", assuntoId: "grupo-combinatoria",
    aulaId: "aula-1", materia: "Raciocínio Lógico e Matemática", modulo: "Geral",
    assunto: "Arranjo", etapa: 2, dataCriacao: "2026-11-20T12:00:00.000Z",
    dataPrevista: "2026-11-27T12:00:00.000Z", concluida: false,
  };
  const materia: Materia = {
    id: "rlm", nome: revisao.materia,
    assuntos: [assunto(["Permutação", "Arranjo", "Combinação simples"])],
    modulos: [{id: "mod", nome: "Geral", ordem: 0, assuntos: [assunto(["Permutação", "Arranjo", "Combinação simples"])]}],
  };
  assert.deepEqual(reconciliarRevisoesComConteudos([materia], [revisao]), [revisao]);
});

test("Tela aprovada permanece Centro de Estudos, sem tela de revisão alternativa", () => {
  const page = readFileSync(new URL("../src/pages/Revisoes/Revisoes.tsx", import.meta.url), "utf8");
  const central = readFileSync(new URL("../src/pages/CentralEstudos/CentralEstudos.tsx", import.meta.url), "utf8");
  assert.match(page, /navigate\("\/central-estudos"\)/);
  assert.match(page, /aulaId: revisao\.aulaId/);
  assert.match(central, /aulaId: prefill\.aulaId/);
});
