import assert from "node:assert/strict";
import test from "node:test";

import type { Revisao } from "../src/types/index.ts";
import { redistribuirRevisoesPendentes } from "../src/utils/revisoes.ts";

function revisao(id: string, dataPrevista: string): Revisao {
  return {
    id,
    materiaId: "portugues",
    assuntoId: id,
    materia: "Português",
    assunto: id,
    etapa: 1,
    dataCriacao: dataPrevista,
    dataPrevista,
    concluida: false,
  };
}

function dia(data: string) {
  return new Date(data).toISOString().slice(0, 10);
}

test("reorganização compacta a fila conforme a meta diária", () => {
  const base = new Date();
  base.setHours(12, 0, 0, 0);

  const originais = Array.from({ length: 6 }, (_, indice) => {
    const data = new Date(base);
    data.setDate(data.getDate() + indice + 1);
    return revisao(`Revisão ${indice + 1}`, data.toISOString());
  });

  const reorganizadas = redistribuirRevisoesPendentes(originais, 2);
  const dias = reorganizadas.map((item) => dia(item.dataPrevista));

  assert.equal(new Set(dias).size, 3);
  for (const data of new Set(dias)) {
    assert.equal(dias.filter((item) => item === data).length, 2);
  }
});

test("18 revisões com meta 2 ocupam exatamente 9 dias", () => {
  const base = new Date();
  base.setHours(12, 0, 0, 0);

  const originais = Array.from({ length: 18 }, (_, indice) => {
    const data = new Date(base);
    data.setDate(data.getDate() + indice + 1);
    return revisao(`Revisão ${indice + 1}`, data.toISOString());
  });

  const reorganizadas = redistribuirRevisoesPendentes(originais, 2);
  const dias = reorganizadas.map((item) => dia(item.dataPrevista));
  const diasUnicos = [...new Set(dias)];

  assert.equal(diasUnicos.length, 9);
  for (const data of diasUnicos) {
    assert.equal(dias.filter((item) => item === data).length, 2);
  }
});

test("meta 1 distribui uma revisão por dia", () => {
  const base = new Date();
  base.setHours(12, 0, 0, 0);

  const originais = Array.from({ length: 4 }, (_, indice) => {
    const data = new Date(base);
    data.setDate(data.getDate() + indice + 5);
    return revisao(`Revisão ${indice + 1}`, data.toISOString());
  });

  const reorganizadas = redistribuirRevisoesPendentes(originais, 1);
  const dias = reorganizadas.map((item) => dia(item.dataPrevista));

  assert.equal(new Set(dias).size, 4);
});
