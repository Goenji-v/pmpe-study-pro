import assert from "node:assert/strict";
import test from "node:test";

import type { Revisao } from "../src/types/index.ts";
import { redistribuirRevisoesPendentes } from "../src/utils/revisoes.ts";

function revisao(
  id: string,
  dataCriacao: string,
  dataPrevista: string,
  etapa: Revisao["etapa"] = 1,
  reagendadaEm?: string
): Revisao {
  return {
    id,
    materiaId: "portugues",
    assuntoId: id,
    materia: "Português",
    assunto: id,
    etapa,
    dataCriacao,
    dataPrevista,
    concluida: false,
    reagendadaEm,
  };
}

function dia(data: string) {
  return new Date(data).toISOString().slice(0, 10);
}

function aoMeioDiaComOffset(offset: number) {
  const data = new Date();
  data.setDate(data.getDate() + offset);
  data.setHours(12, 0, 0, 0);
  return data;
}

test("reorganização preenche vagas ao aumentar a meta diária", () => {
  const amanha = aoMeioDiaComOffset(1);
  const depois = aoMeioDiaComOffset(2);

  const originais = [
    revisao("Fonologia", amanha.toISOString(), amanha.toISOString()),
    revisao("Acentuação", amanha.toISOString(), depois.toISOString()),
  ];
  const reorganizadas = redistribuirRevisoesPendentes(originais, 2);

  assert.deepEqual(
    reorganizadas.map((item) => dia(item.dataPrevista)),
    [dia(amanha.toISOString()), dia(amanha.toISOString())]
  );
});

test("reorganização move o excedente quando o limite diário diminui", () => {
  const amanha = aoMeioDiaComOffset(1);

  const originais = [
    revisao("Fonologia", amanha.toISOString(), amanha.toISOString()),
    revisao("Acentuação", amanha.toISOString(), amanha.toISOString()),
    revisao("Verbos", amanha.toISOString(), amanha.toISOString()),
  ];
  const reorganizadas = redistribuirRevisoesPendentes(originais, 2);
  const dias = reorganizadas.map((item) => dia(item.dataPrevista));

  assert.equal(dias.filter((item) => item === dias[0]).length, 2);
  assert.notEqual(dias[2], dias[0]);
});

test("reorganização não antecipa o intervalo pedagógico da etapa", () => {
  const criacao = aoMeioDiaComOffset(0);
  const idealSeteDias = aoMeioDiaComOffset(7);
  const muitoDepois = aoMeioDiaComOffset(12);

  const originais = [
    revisao(
      "Concordância",
      criacao.toISOString(),
      muitoDepois.toISOString(),
      3
    ),
  ];
  const reorganizadas = redistribuirRevisoesPendentes(originais, 2);

  assert.equal(
    dia(reorganizadas[0].dataPrevista),
    dia(idealSeteDias.toISOString())
  );
});

test("reorganização preserva reagendamento manual", () => {
  const criacao = aoMeioDiaComOffset(0);
  const manual = aoMeioDiaComOffset(6);

  const originais = [
    revisao(
      "Crase",
      criacao.toISOString(),
      manual.toISOString(),
      1,
      new Date().toISOString()
    ),
  ];
  const reorganizadas = redistribuirRevisoesPendentes(originais, 2);

  assert.equal(
    dia(reorganizadas[0].dataPrevista),
    dia(manual.toISOString())
  );
});
