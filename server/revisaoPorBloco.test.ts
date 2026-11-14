import assert from "node:assert/strict";
import test from "node:test";
import type { Assunto, Materia, Modulo, Revisao } from "../src/types/index.ts";
import { planejarEscopoRevisao } from "../src/utils/revisaoPorBloco.ts";
import { reconciliarRevisoesComConteudos } from "../src/services/conteudos/sincronizacaoCanonica.ts";
import { criarProximaRevisao } from "../src/utils/revisoes.ts";

function assunto(id: string, nome: string, concluido = false): Assunto {
  return { id, nome, prioridade: "alta", concluido, aulas: [{ id: id + "-aula", nome: "Videoaula", ordem: 0, concluida: concluido }] };
}
function preparar(concluidas: number) {
  const nomes = ["Artigo, Substantivo e adjetivo", "Advérbio, numeral e pronome",
    "Preposição, conjunção e interjeição", "Verbos"];
  const assuntos = nomes.map((nome, i) => assunto("a" + i, nome, i < concluidas));
  const modulo: Modulo = { id: "geral", nome: "Geral", ordem: 0, assuntos };
  const materia: Materia = { id: "portugues", nome: "Língua Portuguesa", modulos: [modulo], assuntos };
  return { materia, modulo, assuntos };
}

test("a primeira aula do bloco não gera revisão autônoma", () => {
  const { materia, modulo, assuntos } = preparar(0);
  const escopo = planejarEscopoRevisao({ materia, modulo, assunto: assuntos[0], concluido: true });
  assert.equal(escopo.escopoGrupo, true);
  assert.equal(escopo.completo, false);
  assert.equal(escopo.assunto, "Classes de palavras");
  assert.equal(escopo.grupoAssuntosIds.length, 4);
});

test("somente a quarta parte fecha uma revisão de Classes de palavras", () => {
  const { materia, modulo, assuntos } = preparar(3);
  const escopo = planejarEscopoRevisao({ materia, modulo, assunto: assuntos[3], concluido: true });
  assert.equal(escopo.completo, true);
  assert.equal(escopo.escopoGrupo, true);
  assert.match(escopo.assuntoId, /^grupo-revisao:/);
});

test("assuntos independentes permanecem com revisão própria", () => {
  const { materia, modulo } = preparar(4);
  const crase = assunto("crase", "Uso do sinal grave indicativo de Crase");
  modulo.assuntos.push(crase);
  const escopo = planejarEscopoRevisao({ materia, modulo, assunto: crase, concluido: true });
  assert.equal(escopo.escopoGrupo, false);
  assert.equal(escopo.assuntoId, "crase");
});

test("sincronização preserva referência sintética e histórico do bloco", () => {
  const { materia } = preparar(4);
  const revisao: Revisao = {
    id: "r-bloco", materia: "Língua Portuguesa", materiaId: "portugues",
    modulo: "Classes de palavras", moduloId: "geral",
    assunto: "Classes de palavras", assuntoId: "grupo-revisao:portugues:geral:classes-de-palavras",
    escopoGrupo: true, grupoAssuntosIds: ["a0", "a1", "a2", "a3"],
    etapa: 1, dataCriacao: "2026-11-11T12:00:00Z",
    dataPrevista: "2026-11-12T12:00:00Z", concluida: true,
  };
  const resultado = reconciliarRevisoesComConteudos([materia], [revisao]);
  assert.deepEqual(resultado, [revisao]);
  const proxima = criarProximaRevisao(revisao, [], 0, new Date("2026-11-13T12:00:00Z"), "r-proxima");
  assert.equal(proxima?.escopoGrupo, true);
  assert.deepEqual(proxima?.grupoAssuntosIds, revisao.grupoAssuntosIds);
});
