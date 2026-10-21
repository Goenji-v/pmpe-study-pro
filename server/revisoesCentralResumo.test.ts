import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import type { Revisao } from "../src/types";
import { resumoRevisoesDaCentral } from "../src/utils/revisoesCentral";

const hoje = new Date(2026, 9, 21, 9);
function revisao(id: string, dia: number, concluida = false): Revisao {
  return {
    id,
    materia: "Português",
    assunto: id,
    materiaId: "portugues",
    assuntoId: id,
    etapa: 1,
    dataCriacao: new Date(2026, 9, 20, 9).toISOString(),
    dataPrevista: new Date(2026, 9, dia, 12).toISOString(),
    concluida,
  };
}

test("Central exibe apenas atrasadas, hoje e amanhã, até três pendências", () => {
  const entrada = [
    revisao("amanha", 22),
    revisao("hoje", 21),
    revisao("ontem", 20),
    revisao("depois", 23),
    revisao("concluida", 20, true),
  ];
  const antes = JSON.stringify(entrada);
  const resultado = resumoRevisoesDaCentral(entrada, hoje);
  assert.deepEqual(resultado.grupos.map((item) => item.titulo), ["Atrasadas", "Hoje", "Amanhã"]);
  assert.deepEqual(resultado.grupos.flatMap((item) => item.itens.map((rev) => rev.id)), [
    "ontem", "hoje", "amanha",
  ]);
  assert.equal(resultado.quantidadeExibida, 3);
  assert.equal(resultado.totalPendentes, 4);
  assert.equal(resultado.totalNoPeriodo, 3);
  assert.equal(JSON.stringify(entrada), antes, "Consulta não pode alterar revisões");
});

test("Central respeita três no total, ordenando atrasadas pelas datas, sem mostrar futuras", () => {
  const entrada = [
    revisao("ontem", 20),
    revisao("anteontem", 19),
    revisao("hoje", 21),
    revisao("mais-antiga", 18),
    revisao("amanha", 22),
  ];
  const resultado = resumoRevisoesDaCentral(entrada, hoje);
  assert.deepEqual(resultado.grupos.flatMap((item) => item.itens.map((rev) => rev.id)), [
    "mais-antiga", "anteontem", "ontem",
  ]);
  assert.equal(resultado.totalNoPeriodo, 5);
  assert.equal(resultado.quantidadeExibida, 3);
});

test("Central trata data inválida e ausência no intervalo sem inventar pendências", () => {
  const incorreta = { ...revisao("corrompida", 21), dataPrevista: "não é data" };
  const resumo = resumoRevisoesDaCentral([incorreta, revisao("depois", 24)], hoje);
  assert.deepEqual(resumo.grupos, []);
  assert.equal(resumo.quantidadeExibida, 0);
  assert.equal(resumo.totalPendentes, 2);
  assert.deepEqual(resumoRevisoesDaCentral([], hoje).grupos, []);
});

test("Central usa botão de exibição e caminho para agenda completa sem concluir", () => {
  const fonte = readFileSync("src/pages/CentralEstudos/CentralEstudos.tsx", "utf8");
  assert.match(fonte, /mostrarRevisoes && \(/);
  assert.match(fonte, /Ver revisões/);
  assert.match(fonte, /aria-expanded=\{mostrarRevisoes\}/);
  assert.match(fonte, /resumoRevisoes\.grupos\.map/);
  assert.match(fonte, /navigate\("\/revisoes"\)/);
  assert.match(fonte, /Ver todas as revisões/);
  const selecao = fonte.split("function selecionarRevisaoPendente(")[1]?.split("function alterarTipo(")[0] ?? "";
  assert.match(selecao, /revisaoId: revisao\.id/);
  assert.doesNotMatch(selecao, /concluirRevisaoNaLista|setRevisoes/);
});
