import test from "node:test";
import assert from "node:assert/strict";
import type { Materia } from "../src/types";
import { resolverUnidade, referenciaDoEdital } from "../src/services/conteudos/identidadeAprendizagem";
import { registrarEvento, type EventoAprendizagem } from "../src/services/conteudos/eventoAprendizagem";

const assunto = { id: "x", nome: "Tema", concluido: false, prioridade: "media" as const, idsLegados: ["antigo"] };
const materia: Materia = { id: "m", nome: "Disciplina", assuntos: [assunto] };
const ref = { materiaId: "m", assuntoId: "x" };
const vinculo = resolverUnidade([materia], ref);
const evento: EventoAprendizagem = { conteudo: ref, usuarioId: "aluno", origem: "tentativa", ocorrenciaId: "t",
  tipo: "recuperacao", ocorridoEm: "2030-01-01T10:00:00Z" };

test("identidade aceita alias e título alterado, exige escopo para colisão", () => {
  assert.equal(vinculo.status, "validado");
  const alias = resolverUnidade([{ ...materia, nome: "Outro" }], { ...ref, assuntoId: "antigo" });
  assert.equal(alias.unidadeId, vinculo.unidadeId);
  const modulos = ["a", "b"].map(id => ({ id, nome: "Mesmo", ordem: 1, assuntos: [assunto] }));
  const grade = [{ ...materia, modulos }];
  assert.equal(resolverUnidade(grade, ref).status, "ambiguo");
  assert.notEqual(resolverUnidade(grade, { ...ref, moduloId: "a" }).unidadeId,
    resolverUnidade(grade, { ...ref, moduloId: "b" }).unidadeId);
  assert.equal(resolverUnidade(grade, { ...ref, assuntoId: "Tema" }).status, "sem_vinculo");
});

test("aulas individualizadas e edital preservam identidades explícitas", () => {
  const aulas = ["a", "b"].map(id => ({ id, nome: "Homônimo", ordem: 1, concluida: false }));
  const grade = [{ ...materia, assuntos: [{ ...assunto, aulas }] }];
  const aula = resolverUnidade(grade, { ...ref, aulaId: "a" });
  assert.equal(aula.status, "validado");
  assert.equal(aula.unidadeId, resolverUnidade(grade, { ...ref, topicoId: "x:aula:a" }).unidadeId);
  assert.notEqual(aula.unidadeId, resolverUnidade(grade, { ...ref, aulaId: "b" }).unidadeId);
  const oficial = { ...assunto, id: "oficial", conteudoCanonicoId: "x" };
  const edital = { id: "disciplina", nome: "Curso", assuntos: [oficial], incidenciaEstimada: 1, conteudoCanonicoId: "m" };
  assert.deepEqual(referenciaDoEdital(edital, oficial), ref);
  assert.equal(referenciaDoEdital({ ...edital, assuntos: [] }, oficial), undefined);
});

test("replay, conflito, usuário, item e vínculo pendente", () => {
  const novo = registrarEvento(new Map(), evento, vinculo);
  assert.equal(novo.status, "novo");
  const indice = new Map([[novo.chave, novo.registro]]);
  assert.equal(registrarEvento(indice, evento, vinculo).status, "repetido");
  assert.equal(registrarEvento(indice, { ...evento, tipo: "estudo" }, vinculo).status, "conflito");
  for (const variante of [{ itemId: "2" }, { usuarioId: "outro" }])
    assert.equal(registrarEvento(indice, { ...evento, ...variante }, vinculo).status, "novo");
  assert.equal(registrarEvento(indice, evento, resolverUnidade([], ref)).status, "pendente");
  assert.throws(() => registrarEvento(indice, { ...evento, ocorridoEm: "ontem" }, vinculo));
  assert.equal(indice.size, 1);
});
