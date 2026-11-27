import assert from "node:assert/strict";
import { test } from "node:test";
import { atividadeTaticaConcluida, montarTaticoSoldadoPMPE } from "../src/utils/planoTaticoSoldadoPMPE";
import type { Materia, Revisao } from "../src/types";

function materia(id: string, nome: string, concluidas: boolean[]): Materia {
  return { id, nome, assuntos: [{
    id: `${id}-assunto`,
    nome: `Assunto de ${nome}`,
    concluido: false,
    prioridade: "media",
    aulas: concluidas.map((concluida, ordem) => ({
      id: `${id}-aula-${ordem}`, nome: `Aula ${ordem + 1}`, concluida, ordem,
    })),
  }] };
}

function revisao(id: string, materia: string, dataPrevista: string): Revisao {
  return {
    id, materia, materiaId: "", assunto: "Assunto", assuntoId: "", etapa: 1, concluida: false,
    dataPrevista, dataCriacao: "2026-11-20",
  };
}

test("planeja três dias de Português e usa somente aulas e revisões pendentes, sem Redação", () => {
  const materias = [
    materia("port", "Português", [true, false, false]),
    materia("info", "Informática", [false, false]),
    materia("red", "Produção textual", [false]),
  ];
  const revisoes = [
    revisao("pendente", "Informática", "2026-11-25"),
    revisao("red", "Redação", "2026-11-26"),
    revisao("futura", "Português", "2026-12-10"),
    { ...revisao("concluida", "Português", "2026-11-26"), concluida: true },
  ];
  const snapshot = JSON.stringify({ materias, revisoes });
  const plano = montarTaticoSoldadoPMPE({
    materias, revisoes, periodo: "7-dias", diasPorSemana: 3, minutos: 45, questoesPorSessao: 5,
    agora: new Date(2026, 10, 27, 12),
  });
  assert.deepEqual([...new Set(plano.tarefas.filter((item) => item.materia === "Português").map((item) => item.dia))], [1, 4, 7]);
  assert.deepEqual(plano.tarefas.filter((item) => item.revisaoId).map((item) => item.revisaoId), ["pendente"]);
  assert.ok(plano.tarefas.some((item) => item.aulaId === "info-aula-0"));
  assert.ok(plano.tarefas.every((item) => item.materia !== "Redação" && item.materia !== "Produção textual" && item.aulaId !== "port-aula-0"));
  assert.ok(plano.tarefas.some((item) => item.tipo === "questoes"));
  assert.equal(JSON.stringify({ materias, revisoes }), snapshot);
  for (const dia of [1, 4, 7]) {
    assert.ok(plano.tarefas.filter((item) => item.dia === dia)
      .reduce((total, item) => total + item.duracaoMinutos, 0) <= 45);
  }
});

test("reconhece a conclusão da aula e da revisão pelos seus vínculos salvos", () => {
  const materias = [materia("port", "Português", [false])];
  const revisoes = [revisao("rev", "Português", "2026-11-25")];
  const plano = montarTaticoSoldadoPMPE({
    materias, revisoes, periodo: "hoje", diasPorSemana: 3, minutos: 45, questoesPorSessao: 5,
    agora: new Date(2026, 10, 27, 12),
  });
  assert.equal(plano.tarefas.length, 2);
  assert.ok(plano.tarefas.every((item) => !atividadeTaticaConcluida(item, materias, revisoes, [], [])));
  const atualizadas = [materia("port", "Português", [true])];
  const revisoesAtualizadas = [{ ...revisoes[0], concluida: true }];
  assert.ok(plano.tarefas.every((item) => atividadeTaticaConcluida(item, atualizadas, revisoesAtualizadas, [], [])));
});
