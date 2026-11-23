import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { obterMateriaEfetivaDaSessao } from "../src/utils/vinculoPlano";

test("redação inicia com matéria efetiva mesmo sem matéria de Conteúdos", () => {
  assert.equal(
    obterMateriaEfetivaDaSessao("redacao", ""),
    "Redação"
  );
});

test("Central possui um único seletor nativo de Redação e o bridge inicializa seus dados", async () => {
  const [central, bridge] = await Promise.all([
    readFile("src/pages/CentralEstudos/CentralEstudos.tsx", "utf8"),
    readFile(
      "src/components/CentralRedacaoBridge/CentralRedacaoBridge.tsx",
      "utf8"
    ),
  ]);

  const inicio = central.indexOf("const TIPOS_ATIVIDADE_CENTRAL");
  const fim = central.indexOf("] as const;", inicio);
  assert.ok(inicio >= 0 && fim > inicio);

  const tiposVisiveis = central.slice(inicio, fim);
  assert.match(tiposVisiveis, /tipo:\s*"redacao"/);
  assert.equal((tiposVisiveis.match(/tipo:\s*"redacao"/g) ?? []).length, 1);

  assert.match(bridge, /const MATERIA_REDACAO = "Redação"/);
  assert.doesNotMatch(bridge, /destinoTipos/);
  assert.match(
    bridge,
    /prepararSessao\(\{[\s\S]*?materia:\s*MATERIA_REDACAO[\s\S]*?tipo:\s*TIPO_REDACAO/
  );
});

test("resumo da Central identifica a matéria da redação", async () => {
  const central = await readFile(
    "src/pages/CentralEstudos/CentralEstudos.tsx",
    "utf8"
  );

  assert.match(
    central,
    /if \(tipo === "redacao"\) \{\s*return "Redação";\s*\}/
  );
});


test("Redação possui iniciar dedicado, cronômetro visível e rascunho persistente", async () => {
  const bridge = await readFile(
    "src/components/CentralRedacaoBridge/CentralRedacaoBridge.tsx",
    "utf8"
  );

  assert.match(bridge, /CHAVE_RASCUNHO_REDACAO/);
  assert.match(bridge, /localStorage\.setItem\([\s\S]*?CHAVE_RASCUNHO_REDACAO/);
  assert.match(bridge, /function iniciarTreinoRedacao\(\)/);
  assert.match(
    bridge,
    /iniciar\(\{[\s\S]*?materia:\s*MATERIA_REDACAO[\s\S]*?tipo:\s*TIPO_REDACAO/
  );
  assert.match(bridge, /▶ Iniciar treino/);
  assert.match(bridge, /formatarTempo\(segundosDecorridos\)/);
  assert.match(bridge, /onClick=\{pausar\}/);
  assert.match(bridge, /onClick=\{continuar\}/);
  assert.match(bridge, /Rascunho da redação restaurado/);
});

test("cronômetro é persistido no mesmo evento de iniciar, pausar e continuar", async () => {
  const cronometro = await readFile(
    "src/context/CronometroContext.tsx",
    "utf8"
  );

  const inicio = cronometro.indexOf("function iniciar(");
  const pausa = cronometro.indexOf("function pausar(");
  const retomada = cronometro.indexOf("function continuar(");
  const finalizacao = cronometro.indexOf("function finalizar(");

  assert.ok(inicio >= 0 && pausa > inicio && retomada > pausa && finalizacao > retomada);

  assert.match(
    cronometro.slice(inicio, pausa),
    /localStorage\.setItem\([\s\S]*?chaveStorage[\s\S]*?JSON\.stringify\(novaSessao\)/
  );
  assert.match(
    cronometro.slice(pausa, retomada),
    /localStorage\.setItem\([\s\S]*?JSON\.stringify\(pausada\)/
  );
  assert.match(
    cronometro.slice(retomada, finalizacao),
    /localStorage\.setItem\([\s\S]*?JSON\.stringify\(retomada\)/
  );
});

test("redação só associa missão pendente e mostra a diferença para treino avulso", async () => {
  const [bridge, cronometro] = await Promise.all([
    readFile("src/components/CentralRedacaoBridge/CentralRedacaoBridge.tsx", "utf8"),
    readFile("src/context/CronometroContext.tsx", "utf8"),
  ]);
  assert.match(bridge, /obterSituacaoRedacaoDoDia/);
  assert.match(bridge, /missaoId: vinculoRedacaoHoje\?\.missaoId/);
  assert.doesNotMatch(bridge, /vinculoRedacaoHoje\?\.missaoId\s*\?\?\s*rascunho\?\.missaoId/);
  assert.match(bridge, /Este treino é avulso/);
  assert.match(bridge, /Missão de redação pendente encontrada para hoje/);
  assert.match(cronometro, /setMissoesConcluidas\(\(anteriores\) =>\s*Array\.from\(new Set\(\[\.\.\.anteriores, sessaoAtiva\.missaoId as string\]\)\)/);
  assert.match(cronometro, /finalizacaoConsumida\.current = true/);
  assert.match(cronometro, /anteriores\.some\(\(item\) => item\.id === novaSessao\.id\)/);
});
