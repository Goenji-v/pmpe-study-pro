import assert from "node:assert/strict";
import test from "node:test";

import { calcularGamificacao } from "../src/services/gamificacaoService";
import type { SessaoEstudo, Simulado, RegistroQuestao } from "../src/types";

const sessao: SessaoEstudo = {
  id: "estudo",
  materia: "Português",
  assunto: "Fonologia",
  tipo: "estudo",
  minutos: 4900,
  data: "2026-08-30T12:00:00",
};

test("nível e progresso continuam na virada do mês; ranking começa um novo mês", () => {
  const historico = { sessoes: [sessao], questoes: [], revisoes: [], simulados: [] };
  const agosto = calcularGamificacao({ ...historico, agora: new Date(2026, 7, 31, 23, 59) });
  const setembro = calcularGamificacao({ ...historico, agora: new Date(2026, 8, 1) });
  assert.equal(agosto.xp, 490);
  assert.equal(setembro.xp, 0);
  assert.equal(setembro.xpTotal, 490);
  assert.equal(setembro.nivel, agosto.nivel);
  assert.equal(setembro.nivel, 2);

  const comNovoEstudo = calcularGamificacao({
    ...historico,
    sessoes: [...historico.sessoes, { ...sessao, id: "novo", minutos: 100, data: "2026-09-01T12:00:00" }],
    agora: new Date(2026, 8, 1, 13),
  });
  assert.equal(comNovoEstudo.xp, 10);
  assert.equal(comNovoEstudo.xpTotal, 500);
  assert.equal(comNovoEstudo.nivel, 3);
  assert.equal(comNovoEstudo.tituloNivel, "Aluno");

  const proximoAno = calcularGamificacao({ ...historico, agora: new Date(2027, 0, 1) });
  assert.equal(proximoAno.xpTotal, 490);
  assert.equal(proximoAno.nivel, 2);
  assert.equal(proximoAno.xp, 0);
});

test("XP acumulado preserva bônus e não duplica registros espelhados de simulado IA", () => {
  const simulado: Simulado = {
    id: "simulado",
    tentativaId: "tentativa",
    nome: "Treino",
    banca: "AOCP",
    data: "2026-08-30T12:00:00",
    certas: 80,
    erradas: 20,
    anuladas: 0,
    minutos: 60,
  };
  const espelho: RegistroQuestao = {
    id: "espelho",
    tentativaId: "tentativa",
    origem: "simulado-ia",
    materia: "Português",
    assunto: "Fonologia",
    banca: "AOCP",
    data: simulado.data,
    certas: 80,
    erradas: 20,
    minutos: 0,
  };
  const entrada = { sessoes: [], simulados: [simulado], revisoes: [], agora: new Date(2026, 8, 1) };
  const semEspelho = calcularGamificacao({ ...entrada, questoes: [] });
  const comEspelho = calcularGamificacao({ ...entrada, questoes: [espelho] });
  assert.equal(comEspelho.xpTotal, 62); // 6 tempo + 20 questões + 16 acertos + 20 simulado
  assert.deepEqual(comEspelho, semEspelho);
  assert.equal(comEspelho.xp, 0);
});

test("conta sem histórico começa no nível 1 e atividades futuras não elevam seu nível", () => {
  const entrada = { sessoes: [], questoes: [], revisoes: [], simulados: [], agora: new Date(2026, 7, 1) };
  const vazio = calcularGamificacao(entrada);
  const futuro = calcularGamificacao({ ...entrada, sessoes: [sessao] });
  assert.equal(vazio.nivel, 1);
  assert.equal(vazio.xpTotal, 0);
  assert.equal(futuro.nivel, 1);
  assert.equal(futuro.xpTotal, 0);
});
