import assert from "node:assert/strict";
import test from "node:test";

import { redistribuirRevisoesPendentes } from "../src/utils/revisoes.ts";

function aoMeioDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(12, 0, 0, 0);
  return copia.toISOString();
}

function adicionarDias(data: Date, dias: number) {
  const copia = new Date(data);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function dia(valor: string) {
  const data = new Date(valor);
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, "0"),
    String(data.getDate()).padStart(2, "0"),
  ].join("-");
}

function revisao(id: string, dataPrevista: string, concluida = false) {
  return {
    id,
    materia: "Português",
    assunto: id,
    etapa: 2,
    dataCriacao: aoMeioDia(adicionarDias(new Date(), -20)),
    dataPrevista,
    concluida,
    ...(concluida
      ? { dataConclusao: aoMeioDia(adicionarDias(new Date(), -1)) }
      : {}),
  } as any;
}

test("reorganização não antecipa revisões futuras e preserva conclusões", () => {
  const futuro = adicionarDias(new Date(), 10);
  const concluida = revisao(
    "concluida",
    aoMeioDia(adicionarDias(new Date(), -5)),
    true
  );
  const entrada = [
    revisao("futura-1", aoMeioDia(futuro)),
    revisao("futura-2", aoMeioDia(futuro)),
    concluida,
  ];

  const saida = redistribuirRevisoesPendentes(entrada, 1);
  const primeira = saida.find((item) => item.id === "futura-1")!;
  const segunda = saida.find((item) => item.id === "futura-2")!;
  const concluidaDepois = saida.find((item) => item.id === "concluida")!;

  assert.equal(dia(primeira.dataPrevista), dia(aoMeioDia(futuro)));
  assert.equal(
    dia(segunda.dataPrevista),
    dia(aoMeioDia(adicionarDias(futuro, 1)))
  );
  assert.equal(concluidaDepois.dataPrevista, concluida.dataPrevista);
  assert.equal(concluidaDepois.dataConclusao, concluida.dataConclusao);
  assert.equal(concluidaDepois.concluida, true);
});

test("atrasos entram a partir de hoje e respeitam o limite diário", () => {
  const ontem = adicionarDias(new Date(), -1);
  const saida = redistribuirRevisoesPendentes(
    [
      revisao("atrasada-1", aoMeioDia(ontem)),
      revisao("atrasada-2", aoMeioDia(ontem)),
    ],
    1
  );
  const hoje = dia(aoMeioDia(new Date()));
  const amanha = dia(aoMeioDia(adicionarDias(new Date(), 1)));

  assert.equal(dia(saida.find((item) => item.id === "atrasada-1")!.dataPrevista), hoje);
  assert.equal(dia(saida.find((item) => item.id === "atrasada-2")!.dataPrevista), amanha);
});
