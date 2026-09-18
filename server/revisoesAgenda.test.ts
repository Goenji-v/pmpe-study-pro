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
  const valor = new Date(data);
  return [
    valor.getFullYear(),
    String(valor.getMonth() + 1).padStart(2, "0"),
    String(valor.getDate()).padStart(2, "0"),
  ].join("-");
}

test("excesso no mesmo dia é empurrado para frente conforme a meta diária", () => {
  const base = new Date();
  base.setDate(base.getDate() + 3);
  base.setHours(12, 0, 0, 0);

  const originais = Array.from({ length: 6 }, (_, indice) =>
    revisao(`Revisão ${indice + 1}`, base.toISOString())
  );

  const reorganizadas = redistribuirRevisoesPendentes(originais, 2);
  const dias = reorganizadas.map((item) => dia(item.dataPrevista));

  assert.equal(new Set(dias).size, 3);
  for (const data of new Set(dias)) {
    assert.equal(dias.filter((item) => item === data).length, 2);
  }
  assert.equal(dias[0], dia(base.toISOString()));
});

test("revisões futuras já distribuídas não são antecipadas para compactar a fila", () => {
  const base = new Date();
  base.setHours(12, 0, 0, 0);

  const originais = Array.from({ length: 18 }, (_, indice) => {
    const data = new Date(base);
    data.setDate(data.getDate() + indice + 1);
    return revisao(`Revisão ${indice + 1}`, data.toISOString());
  });

  const reorganizadas = redistribuirRevisoesPendentes(originais, 2);
  const datasOriginais = originais.map((item) => dia(item.dataPrevista));
  const datasReorganizadas = reorganizadas.map((item) => dia(item.dataPrevista));

  assert.deepEqual(datasReorganizadas, datasOriginais);
  assert.equal(new Set(datasReorganizadas).size, 18);
});

test("meta 1 distribui uma revisão por dia sem antecipar datas futuras", () => {
  const base = new Date();
  base.setHours(12, 0, 0, 0);

  const originais = Array.from({ length: 4 }, (_, indice) => {
    const data = new Date(base);
    data.setDate(data.getDate() + indice + 5);
    return revisao(`Revisão ${indice + 1}`, data.toISOString());
  });

  const reorganizadas = redistribuirRevisoesPendentes(originais, 1);
  const dias = reorganizadas.map((item) => dia(item.dataPrevista));

  assert.deepEqual(dias, originais.map((item) => dia(item.dataPrevista)));
  assert.equal(new Set(dias).size, 4);
});
