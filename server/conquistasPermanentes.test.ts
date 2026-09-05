import assert from "node:assert/strict";
import test from "node:test";

import type {
  ConfiguracoesApp,
  Materia,
  RegistroQuestao,
  SessaoEstudo,
  Simulado,
} from "../src/types/index";
import {
  calcularConquistasPermanentes,
  idRecompensaConquista,
} from "../src/services/conquistasPermanentes";
import {
  aplicarRecompensasPendentes,
  listarRecompensasConquistadas,
  obterEstadoEconomia,
} from "../src/services/economiaGamificacao";

const configuracoes: ConfiguracoesApp = {
  nomeUsuario: "Aluno",
  concurso: "PMPE",
  bancaPadrao: "AOCP",
  metaQuestoesDiaria: 30,
  metaMinutosDiaria: 120,
  metaRevisoesDiaria: 1,
  missoesPorDia: 1,
  tema: "escuro",
};

const materias: Materia[] = [
  { id: "port", nome: "Português", assuntos: [] },
  { id: "rlm", nome: "RLM", assuntos: [] },
];

function calcular(params?: {
  sessoes?: SessaoEstudo[];
  questoes?: RegistroQuestao[];
  simulados?: Simulado[];
  recompensasRecebidas?: string[];
}) {
  return calcularConquistasPermanentes({
    sessoes: params?.sessoes ?? [],
    questoes: params?.questoes ?? [],
    revisoes: [],
    simulados: params?.simulados ?? [],
    materias,
    missoesConcluidas: [],
    configuracoes,
    recompensasRecebidas: params?.recompensasRecebidas,
  });
}

test("catálogo possui 20 conquistas permanentes com raridade e moedas", () => {
  const conquistas = calcular();
  assert.equal(conquistas.length, 20);
  assert.ok(conquistas.every((item) => item.moedas > 0));
  assert.ok(
    conquistas.some(
      (item) => item.id === "questoes-5000" && item.raridade === "lendaria"
    )
  );
});

test("sequência de sete dias desbloqueia Sem Desculpas", () => {
  const sessoes = Array.from({ length: 7 }, (_, indice): SessaoEstudo => ({
    id: `s-${indice}`,
    data: `2026-08-${String(indice + 1).padStart(2, "0")}T18:00:00-03:00`,
    tipo: "estudo",
    materia: indice % 2 ? "RLM" : "Português",
    assunto: "Treino",
    minutos: 30,
  }));

  const conquista = calcular({ sessoes }).find(
    (item) => item.id === "sequencia-7"
  );
  assert.equal(conquista?.desbloqueada, true);
  assert.equal(conquista?.progresso, 100);
});

test("Gabaritou exige bloco perfeito com pelo menos dez questões", () => {
  const pequeno: RegistroQuestao = {
    id: "q-5",
    materia: "Português",
    assunto: "Fonologia",
    banca: "AOCP",
    certas: 5,
    erradas: 0,
    minutos: 5,
    data: "2026-08-01T19:00:00-03:00",
  };
  const completo: RegistroQuestao = {
    ...pequeno,
    id: "q-10",
    certas: 10,
  };

  assert.equal(
    calcular({ questoes: [pequeno] }).find((item) => item.id === "gabaritou")
      ?.desbloqueada,
    false
  );
  assert.equal(
    calcular({ questoes: [completo] }).find((item) => item.id === "gabaritou")
      ?.desbloqueada,
    true
  );
});

test("conquista permanece desbloqueada depois de registrada na economia", () => {
  const id = idRecompensaConquista("simulado-90");
  const conquista = calcular({ recompensasRecebidas: [id] }).find(
    (item) => item.id === "simulado-90"
  );

  assert.equal(conquista?.desbloqueada, true);
  assert.equal(conquista?.progresso, 100);
});

test("nova conquista gera moedas apenas uma vez", () => {
  const sessao: SessaoEstudo = {
    id: "s-primeira",
    data: "2026-08-10T18:00:00-03:00",
    tipo: "estudo",
    materia: "Português",
    assunto: "Fonologia",
    minutos: 20,
  };

  const recompensas = listarRecompensasConquistadas({
    sessoes: [sessao],
    questoes: [],
    revisoes: [],
    simulados: [],
    materias,
    missoesConcluidas: [],
    configuracoes,
    nivelAtual: 1,
  });
  const premio = recompensas.find(
    (item) => item.id === idRecompensaConquista("primeiro-passo")
  );

  assert.equal(premio?.categoria, "conquista");
  assert.equal(premio?.moedas, 5);

  const estado = obterEstadoEconomia(configuracoes);
  const primeira = aplicarRecompensasPendentes(estado, [premio!]);
  const segunda = aplicarRecompensasPendentes(primeira.estado, [premio!]);

  assert.equal(primeira.estado.moedas, 5);
  assert.equal(segunda.estado.moedas, 5);
  assert.equal(segunda.novas.length, 0);
});
