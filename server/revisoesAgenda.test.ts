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

test("reorganização preserva uma agenda que já respeita o limite", () => {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(12, 0, 0, 0);

  const depois = new Date(amanha);
  depois.setDate(depois.getDate() + 1);

  const originais = [
    revisao("Fonologia", amanha.toISOString()),
    revisao("Acentuação", depois.toISOString()),
  ];
  const reorganizadas = redistribuirRevisoesPendentes(originais, 2);

  assert.deepEqual(
    reorganizadas.map((item) => dia(item.dataPrevista)),
    originais.map((item) => dia(item.dataPrevista))
  );
});

test("reorganização move apenas o excedente do limite diário", () => {
  const amanha = new Date();
  amanha.setDate(amanha.getDate() + 1);
  amanha.setHours(12, 0, 0, 0);

  const originais = [
    revisao("Fonologia", amanha.toISOString()),
    revisao("Acentuação", amanha.toISOString()),
    revisao("Verbos", amanha.toISOString()),
  ];
  const reorganizadas = redistribuirRevisoesPendentes(originais, 2);
  const dias = reorganizadas.map((item) => dia(item.dataPrevista));

  assert.equal(dias.filter((item) => item === dias[0]).length, 2);
  assert.notEqual(dias[2], dias[0]);
});
