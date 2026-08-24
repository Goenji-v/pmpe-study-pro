import assert from "node:assert/strict";
import test from "node:test";

import { calcularGamificacao } from "../src/services/gamificacaoService.ts";
import { calcularCentralInteligencia } from "../src/services/inteligencia/calcularCentralInteligencia.ts";
import { gerarRelatorioInteligente } from "../src/services/inteligencia/relatorioInteligenteService.ts";
import type { Simulado } from "../src/types/index.ts";

function criarSimuladoHoje(): Simulado {
  return {
    id: "simulado-manual-hoje",
    nome: "Simulado completo",
    banca: "AOCP",
    certas: 48,
    erradas: 12,
    anuladas: 0,
    emBranco: 0,
    totalQuestoes: 60,
    minutos: 180,
    data: new Date().toISOString(),
    origem: "manual",
  };
}

test("Central de Inteligência inclui simulado manual nas métricas de hoje, semana e total", () => {
  const dados = calcularCentralInteligencia({
    questoes: [],
    sessoes: [],
    revisoes: [],
    simulados: [criarSimuladoHoje()],
    metaMinutos: 120,
    metaQuestoes: 20,
    metaRevisoes: 3,
  });

  assert.equal(dados.hoje.questoes, 60);
  assert.equal(dados.hoje.certas, 48);
  assert.equal(dados.hoje.erradas, 12);
  assert.equal(dados.hoje.percentual, 80);
  assert.equal(dados.semana.questoes, 60);
  assert.equal(dados.total.questoes, 60);
  assert.equal(dados.total.minutos, 180);
  assert.equal(dados.total.simulados, 1);
});

test("Relatório Inteligente inclui simulado manual na semana atual", () => {
  const relatorio = gerarRelatorioInteligente({
    questoes: [],
    sessoes: [],
    revisoes: [],
    simulados: [criarSimuladoHoje()],
    metaMinutosDiaria: 120,
  });

  assert.equal(relatorio.semanaAtual.questoes, 60);
  assert.equal(relatorio.semanaAtual.certas, 48);
  assert.equal(relatorio.semanaAtual.erradas, 12);
  assert.equal(relatorio.semanaAtual.aproveitamento, 80);
  assert.equal(relatorio.semanaAtual.minutos, 180);
  assert.equal(relatorio.semanaAtual.simulados, 1);
});

test("Gamificação usa a mesma fonte de verdade para simulado manual", () => {
  const resumo = calcularGamificacao({
    questoes: [],
    sessoes: [],
    revisoes: [],
    simulados: [criarSimuladoHoje()],
  });

  assert.equal(resumo.questoes, 60);
  assert.equal(resumo.acertos, 48);
  assert.equal(resumo.minutos, 180);
  assert.equal(resumo.simulados, 1);
  assert.equal(resumo.xp, 58);
});
