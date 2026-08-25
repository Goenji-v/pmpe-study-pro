import assert from "node:assert/strict";
import test from "node:test";

import type { RegistroQuestao } from "../src/types/index.ts";
import {
  classificarDesempenho,
  filtrarQuestoesDesempenho,
  resumirQuestoes,
} from "../src/utils/filtrosDesempenho.ts";

function registro(
  id: string,
  materia: string,
  assunto: string,
  data: string,
  certas: number,
  erradas: number
): RegistroQuestao {
  return {
    id,
    materia,
    assunto,
    banca: "AOCP",
    certas,
    erradas,
    minutos: 0,
    data,
  };
}

test("filtra por matéria e assunto ignorando caixa e acento", () => {
  const dados = [
    registro("1", "Português", "Acentuação", "2026-08-20T12:00:00Z", 8, 2),
    registro("2", "Português", "Fonologia", "2026-08-20T12:00:00Z", 4, 6),
    registro("3", "Informática", "Internet", "2026-08-20T12:00:00Z", 9, 1),
  ];

  const filtrados = filtrarQuestoesDesempenho(dados, {
    materia: "portugues",
    assunto: "acentuacao",
  });

  assert.equal(filtrados.length, 1);
  assert.equal(filtrados[0].id, "1");
});

test("filtra por período inclusivo", () => {
  const dados = [
    registro("1", "Português", "Fonologia", "2026-08-01T12:00:00Z", 5, 5),
    registro("2", "Português", "Fonologia", "2026-08-10T12:00:00Z", 7, 3),
    registro("3", "Português", "Fonologia", "2026-08-25T12:00:00Z", 8, 2),
  ];

  const inicio = new Date("2026-08-05T00:00:00Z");
  const fim = new Date("2026-08-20T23:59:59Z");
  const filtrados = filtrarQuestoesDesempenho(dados, { inicio, fim });

  assert.deepEqual(filtrados.map((item) => item.id), ["2"]);
});

test("resume certas erradas total e aproveitamento", () => {
  const dados = [
    registro("1", "Português", "Fonologia", "2026-08-20T12:00:00Z", 8, 2),
    registro("2", "Português", "Acentuação", "2026-08-20T12:00:00Z", 4, 6),
  ];

  assert.deepEqual(resumirQuestoes(dados), {
    certas: 12,
    erradas: 8,
    total: 20,
    aproveitamento: 60,
  });
});

test("classifica as faixas de desempenho", () => {
  assert.equal(classificarDesempenho(85, 20), "forte");
  assert.equal(classificarDesempenho(70, 20), "atencao");
  assert.equal(classificarDesempenho(50, 20), "fraco");
  assert.equal(classificarDesempenho(30, 20), "urgente");
  assert.equal(classificarDesempenho(0, 0), "sem-dados");
});
