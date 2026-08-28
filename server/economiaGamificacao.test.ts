import assert from "node:assert/strict";
import test from "node:test";

import type { ConfiguracoesApp, RegistroQuestao, SessaoEstudo } from "../src/types/index";
import {
  aplicarRecompensasPendentes,
  listarRecompensasConquistadas,
  obterEstadoEconomia,
  resgatarRecompensaLogin,
  type EstadoEconomia,
} from "../src/services/economiaGamificacao";

const configuracoes: ConfiguracoesApp = {
  nomeUsuario: "Aluno",
  concurso: "PMPE",
  bancaPadrao: "AOCP",
  metaQuestoesDiaria: 100,
  metaMinutosDiaria: 120,
  metaRevisoesDiaria: 2,
  missoesPorDia: 1,
  tema: "escuro",
};

function recompensas(params: {
  sessoes?: SessaoEstudo[];
  questoes?: RegistroQuestao[];
  nivelAtual?: number;
}) {
  return listarRecompensasConquistadas({
    sessoes: params.sessoes ?? [],
    questoes: params.questoes ?? [],
    revisoes: [],
    simulados: [],
    missoesConcluidas: [],
    configuracoes,
    nivelAtual: params.nivelAtual ?? 1,
  });
}

test("meta de tempo paga o mesmo bônus ao bater ou ultrapassar a meta", () => {
  const sessao120: SessaoEstudo = {
    id: "s-120",
    data: "2026-08-01T18:00:00-03:00",
    tipo: "estudo",
    materia: "Português",
    assunto: "Interpretação",
    minutos: 120,
  };
  const sessao240: SessaoEstudo = {
    ...sessao120,
    id: "s-240",
    minutos: 240,
  };

  const premio120 = recompensas({ sessoes: [sessao120] }).find(
    (item) => item.id === "meta-tempo:2026-08-01"
  );
  const premio240 = recompensas({ sessoes: [sessao240] }).find(
    (item) => item.id === "meta-tempo:2026-08-01"
  );

  assert.equal(premio120?.moedas, 8);
  assert.equal(premio240?.moedas, 8);
});

test("questões usam marcos incrementais de 20 e 30 no mesmo dia", () => {
  const registro: RegistroQuestao = {
    id: "q-1",
    materia: "RLM",
    assunto: "Proposições",
    banca: "AOCP",
    certas: 24,
    erradas: 6,
    minutos: 35,
    data: "2026-08-02T19:00:00-03:00",
  };

  const premios = recompensas({ questoes: [registro] }).filter(
    (item) => item.categoria === "questoes"
  );

  assert.deepEqual(
    premios.map((item) => item.id).sort(),
    ["questoes:20:2026-08-02", "questoes:30:2026-08-02"]
  );
  assert.equal(premios.reduce((total, item) => total + item.moedas, 0), 6);
});

test("sequência entrega bônus nos marcos de 7, 14 e 30 dias", () => {
  const sessoes = Array.from({ length: 30 }, (_, indice): SessaoEstudo => ({
    id: `s-${indice + 1}`,
    data: `2026-07-${String(indice + 1).padStart(2, "0")}T18:00:00-03:00`,
    tipo: "estudo",
    materia: "Português",
    assunto: "Treino",
    minutos: 30,
  }));

  const premios = recompensas({ sessoes }).filter(
    (item) => item.categoria === "sequencia"
  );

  assert.deepEqual(premios.map((item) => item.moedas), [12, 20, 50]);
  assert.equal(premios.reduce((total, item) => total + item.moedas, 0), 82);
});

test("sétimo login consecutivo entrega 20 moedas e não duplica", () => {
  let estado: EstadoEconomia = {
    moedas: 0,
    recompensasRecebidas: [],
    sequenciaLoginAtual: 0,
  };

  let ultimoPremio = 0;
  for (let dia = 1; dia <= 7; dia += 1) {
    const data = `2026-08-${String(dia).padStart(2, "0")}`;
    const resultado = resgatarRecompensaLogin(
      estado,
      data,
      new Date(`${data}T12:00:00-03:00`)
    );
    estado = resultado.estado;
    ultimoPremio = resultado.recompensa?.moedas ?? 0;
  }

  assert.equal(ultimoPremio, 20);
  assert.equal(estado.sequenciaLoginAtual, 7);
  assert.equal(estado.moedas, 44);

  const repetido = resgatarRecompensaLogin(estado, "2026-08-07");
  assert.equal(repetido.recompensa, null);
  assert.equal(repetido.estado.moedas, 44);
});

test("uma recompensa só pode ser creditada uma vez", () => {
  const estado = obterEstadoEconomia(configuracoes);
  const lista = [
    {
      id: "nivel:2",
      moedas: 15,
      titulo: "Nível 2 alcançado",
      categoria: "nivel" as const,
    },
  ];

  const primeira = aplicarRecompensasPendentes(estado, lista);
  const segunda = aplicarRecompensasPendentes(primeira.estado, lista);

  assert.equal(primeira.estado.moedas, 15);
  assert.equal(segunda.estado.moedas, 15);
  assert.equal(segunda.novas.length, 0);
});
