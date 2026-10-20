import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { mesclarConfiguracoesEditadas } from "../src/utils/mesclarConfiguracoesEditadas.ts";
import { calcularCentralInteligencia } from "../src/services/inteligencia/calcularCentralInteligencia.ts";
import { minutosQuestaoSemDuplicidade } from "../src/utils/metricasConsolidadas.ts";

test("Configurações: salvar uma meta não reverte moedas e recompensas recentes", () => {
  const aoAbrir = {
    nomeUsuario: "Aluno",
    metaMinutosDiaria: 60,
    moedas: 10,
    conquistas: ["primeira"],
    materiasPorDiaSemana: { seg: 1, ter: 2 },
  };
  const recebidoEnquantoAberta = {
    ...aoAbrir,
    moedas: 25,
    conquistas: ["primeira", "disciplina-de-ferro"],
  };
  const resultado = mesclarConfiguracoesEditadas(recebidoEnquantoAberta, {
    metaMinutosDiaria: 90,
  });
  assert.equal(resultado.metaMinutosDiaria, 90);
  assert.equal(resultado.moedas, 25);
  assert.deepEqual(resultado.conquistas, recebidoEnquantoAberta.conquistas);
  assert.equal(resultado.nomeUsuario, "Aluno");
  assert.equal(aoAbrir.moedas, 10);
});

test("Configurações: alteração da segunda-feira não apaga terça atualizada em outra tela", () => {
  const resultado = mesclarConfiguracoesEditadas(
    { materiasPorDiaSemana: { seg: 1, ter: 4 }, moedas: 25 },
    {},
    { seg: 3 }
  );
  assert.deepEqual(resultado.materiasPorDiaSemana, { seg: 3, ter: 4 });
  assert.equal(resultado.moedas, 25);

  const padrao = mesclarConfiguracoesEditadas(resultado, {}, null);
  assert.equal(padrao.materiasPorDiaSemana, undefined);
  assert.equal(padrao.moedas, 25);
});

test("Configurações: restaurar padrão conserva progressos fora das preferências", async () => {
  const fonte = await readFile("src/pages/Configuracoes/Configuracoes.tsx", "utf8");
  const restaurar = fonte.slice(fonte.indexOf("function restaurarPadrao()"), fonte.indexOf("const diasSelecionados ="));
  assert.match(restaurar, /setConfiguracoes\(\(anterior\) =>/);
  assert.doesNotMatch(restaurar, /setConfiguracoes\(padrao\)/);
});

test("Inteligência: uma sessão de 30 minutos e seu registro-espelho não viram 60", () => {
  const data = new Date().toISOString();
  const sessoes = [{ id: "sessao", tipo: "questoes", materia: "Direito Constitucional", assunto: "Princípios", minutos: 30, data }];
  const questoes = [{ id: "questoes", materia: "Constitucional", assunto: "Princípios", certas: 4, erradas: 1, minutos: 30, data }];

  const resultado = calcularCentralInteligencia({
    questoes: questoes as any,
    sessoes: sessoes as any,
    revisoes: [],
    simulados: [],
    metaMinutos: 90,
    metaQuestoes: 20,
    metaRevisoes: 1,
  });
  assert.equal(resultado.total.minutos, 30);
  assert.equal(resultado.materias.length, 1);
  assert.equal(resultado.materias[0].minutos, 30);
  assert.equal(resultado.materias[0].total, 5);
  assert.equal(minutosQuestaoSemDuplicidade(questoes[0] as any, sessoes as any), 0);
});

test("Inteligência: sessões independentes continuam contando", () => {
  const data = new Date().toISOString();
  const sessao = [{ id: "sessao", tipo: "estudo", materia: "Português", assunto: "Verbos", minutos: 30, data }];
  const questao = { id: "questao", materia: "Português", assunto: "Crase", certas: 1, erradas: 0, minutos: 15, data };
  assert.equal(minutosQuestaoSemDuplicidade(questao as any, sessao as any), 15);
  const resultado = calcularCentralInteligencia({
    questoes: [questao] as any,
    sessoes: sessao as any,
    revisoes: [],
    simulados: [],
    metaMinutos: 90,
    metaQuestoes: 20,
    metaRevisoes: 1,
  });
  assert.equal(resultado.total.minutos, 45);
  assert.equal(resultado.materias[0].minutos, 45);
});
