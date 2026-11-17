import assert from "node:assert/strict";
import test from "node:test";
import type { Revisao } from "../src/types/index.ts";
import {
  agruparRevisoesParaEstudo,
  concluirBlocoDeRevisoes,
} from "../src/utils/blocosRevisoes.ts";

const data = new Date(2026, 10, 17, 12).toISOString();

function item(id: string, materia: string, assunto: string, etapa: Revisao["etapa"] = 3): Revisao {
  return {
    id, materia, assunto,
    materiaId: id + "-materia",
    assuntoId: id + "-assunto",
    etapa,
    dataCriacao: new Date(2026, 10, 10, 12).toISOString(),
    dataPrevista: data,
    concluida: false,
  };
}

test("RLM: tabela-verdade e conectivos viram um só bloco visível sem fundir IDs ou etapas", () => {
  const um = item("rlm-1", "RLM", "Conectivos, tabelas-verdade e negação", 5);
  const dois = item("rlm-2", "Raciocínio Lógico e Matemática", "Conectivos lógicos", 3);
  const entrada = [um, dois];
  const original = JSON.stringify(entrada);
  const blocos = agruparRevisoesParaEstudo(entrada);
  assert.equal(blocos.length, 1);
  assert.equal(blocos[0].revisoes.length, 2);
  assert.deepEqual(blocos[0].revisoes.map((rev) => rev.id), ["rlm-1", "rlm-2"]);
  assert.deepEqual(blocos[0].revisoes.map((rev) => rev.etapa), [5, 3]);
  assert.equal(JSON.stringify(entrada), original);
});

test("Português: dígrafo, encontros e monossílabos no mesmo bloco, mas crase em separado", () => {
  const lista = [
    item("a", "Português", "Dígrafos"),
    item("b", "Língua Portuguesa", "Encontros consonantais"),
    item("c", "Português", "Monossílabos e divisão silábica"),
    item("d", "Português", "Crase"),
    item("e", "Português", "Regência nominal"),
  ];
  const resultado = agruparRevisoesParaEstudo(lista);
  assert.equal(resultado.length, 3);
  assert.deepEqual(resultado[0].revisoes.map((rev) => rev.id), ["a", "b", "c"]);
  assert.deepEqual(resultado.slice(1).map((x) => x.revisoes[0].id), ["d", "e"]);
});

test("não agrupa leis ou eventos históricos por compartilharem apenas a disciplina", () => {
  const lista = [
    item("lei28", "Legislação", "Lei de Drogas, art. 28"),
    item("lei33", "Legislação", "Lei de Drogas, art. 33"),
    item("hist1", "História de Pernambuco", "Guerra dos Mascates"),
    item("hist2", "História de Pernambuco", "Confederação do Equador"),
  ];
  assert.equal(agruparRevisoesParaEstudo(lista).length, 4);
});

test("não antecipa revisão de outro dia, nem agrupa simulado, concluída ou bloco existente", () => {
  const a = item("a", "RLM", "Conectivos lógicos");
  const b = { ...item("b", "RLM", "Tabela verdade"), dataPrevista: new Date(2026, 10, 18, 12).toISOString() };
  const c = { ...item("c", "RLM", "Conectivos lógicos"), origemSimulado: { tentativaId: "id", materiaDiagnostico: "RLM", assuntoDiagnostico: "Conectivos lógicos", vinculo: "conteudo" as const } };
  const d = { ...item("d", "RLM", "Conectivos lógicos"), concluida: true };
  const e = { ...item("e", "RLM", "Conectivos lógicos"), escopoGrupo: true, grupoAssuntosIds: ["a", "b"] };
  assert.equal(agruparRevisoesParaEstudo([a, b, c, d, e]).length, 5);
});

test("conclusão explícita conjunta mantém histórico separado e próximo ciclo de cada uma", () => {
  const a = item("a", "RLM", "Conectivos lógicos", 5);
  const b = item("b", "RLM", "Tabelas-verdade", 3);
  const entrada = [a, b];
  const dados = {
    revisoes: entrada,
    revisoesIds: ["a", "b"],
    desempenho: "media" as const,
    limiteDiario: 3,
    agora: new Date(2026, 10, 17, 13),
    proximosIds: { a: "a-nova", b: "b-nova" },
  };
  const resultado = concluirBlocoDeRevisoes(dados);
  assert.equal(entrada.every((rev) => !rev.concluida), true);
  assert.equal(resultado.find((rev) => rev.id === "a")?.concluida, true);
  assert.equal(resultado.find((rev) => rev.id === "b")?.concluida, true);
  assert.equal(resultado.find((rev) => rev.id === "a-nova"), undefined);
  assert.equal(resultado.find((rev) => rev.id === "b-nova")?.etapa, 4);
  assert.equal(resultado.length, 3);
  assert.deepEqual(concluirBlocoDeRevisoes({ ...dados, revisoes: resultado }), resultado);
  assert.deepEqual(concluirBlocoDeRevisoes(dados), resultado);
});
