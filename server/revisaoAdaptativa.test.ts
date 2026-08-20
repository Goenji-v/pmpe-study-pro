import assert from "node:assert/strict";
import test from "node:test";

import {
  aplicarRevisaoAdaptativa,
  diagnosticarRevisaoAdaptativa,
} from "../src/utils/revisaoAdaptativa";

import type { Revisao } from "../src/types";

const AGORA = new Date("2026-08-20T15:00:00");

const referencia = {
  materiaId: "portugues",
  moduloId: "fonologia",
  assuntoId: "encontros-vocalicos",
  materia: "Português",
  modulo: "Fonologia",
  assunto: "Encontros vocálicos",
};

test("não dispara revisão com menos de cinco questões", () => {
  assert.equal(diagnosticarRevisaoAdaptativa(0, 4), null);
});

test("classifica 2 de 8 como revisão urgente para hoje", () => {
  const diagnostico = diagnosticarRevisaoAdaptativa(2, 6);

  assert.deepEqual(diagnostico, {
    percentual: 25,
    total: 8,
    prioridade: "urgente",
    diasParaRevisao: 0,
  });
});

test("classifica faixas intermediárias sem criar revisão acima de 75%", () => {
  assert.equal(
    diagnosticarRevisaoAdaptativa(2, 3)?.prioridade,
    "prioritaria"
  );
  assert.equal(
    diagnosticarRevisaoAdaptativa(7, 3)?.prioridade,
    "antecipada"
  );
  assert.equal(diagnosticarRevisaoAdaptativa(8, 2), null);
});

test("cria revisão urgente no mesmo dia e registra o resultado crítico", () => {
  const resultado = aplicarRevisaoAdaptativa({
    revisoes: [],
    ...referencia,
    certas: 2,
    erradas: 6,
    agora: AGORA,
    criarId: () => "rev-urgente",
  });

  assert.equal(resultado.acao, "criada");
  assert.equal(resultado.revisoes.length, 1);
  assert.equal(resultado.revisoes[0].id, "rev-urgente");
  assert.equal(resultado.revisoes[0].certas, 2);
  assert.equal(resultado.revisoes[0].erradas, 6);
  assert.equal(
    new Date(resultado.revisoes[0].dataPrevista).getDate(),
    AGORA.getDate()
  );
});

test("antecipa revisão já existente em vez de duplicar", () => {
  const existente = criarRevisao({
    dataPrevista: "2026-08-27T12:00:00",
  });

  const resultado = aplicarRevisaoAdaptativa({
    revisoes: [existente],
    ...referencia,
    certas: 2,
    erradas: 6,
    agora: AGORA,
  });

  assert.equal(resultado.acao, "atualizada");
  assert.equal(resultado.revisoes.length, 1);
  assert.equal(resultado.revisoes[0].id, existente.id);
  assert.equal(
    new Date(resultado.revisoes[0].dataPrevista).getDate(),
    AGORA.getDate()
  );
});

test("não enfraquece uma revisão urgente pendente após um resultado menos crítico", () => {
  const existente = criarRevisao({
    dataPrevista: "2026-08-20T12:00:00",
    certas: 2,
    erradas: 6,
  });

  const resultado = aplicarRevisaoAdaptativa({
    revisoes: [existente],
    ...referencia,
    certas: 7,
    erradas: 3,
    agora: AGORA,
  });

  assert.equal(resultado.revisoes.length, 1);
  assert.equal(resultado.revisoes[0].certas, 2);
  assert.equal(resultado.revisoes[0].erradas, 6);
  assert.equal(
    new Date(resultado.revisoes[0].dataPrevista).getDate(),
    AGORA.getDate()
  );
});

function criarRevisao(
  alteracoes: Partial<Revisao> = {}
): Revisao {
  return {
    id: "rev-existente",
    ...referencia,
    etapa: 2,
    dataCriacao: "2026-08-18T12:00:00",
    dataPrevista: "2026-08-27T12:00:00",
    concluida: false,
    ...alteracoes,
  };
}
