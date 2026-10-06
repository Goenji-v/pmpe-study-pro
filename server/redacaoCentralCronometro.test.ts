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

test("Central usa um único seletor de Redação, o fluxo dedicado", async () => {
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
  assert.equal(
    (tiposVisiveis.match(/tipo:\s*"redacao"/g) ?? []).length,
    1
  );

  assert.match(bridge, /const MATERIA_REDACAO = "Redação"/);
  assert.doesNotMatch(bridge, /central-tipo-redacao/);
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


test("CSS da Central não oculta o quarto tipo Redação", async () => {
  const css = await readFile(
    "src/pages/CentralEstudos/CentralEstudos.css",
    "utf8"
  );

  assert.doesNotMatch(
    css,
    /central-estudos-tipos\s*>\s*\.central-tipo:nth-child\(n\s*\+\s*4\)/
  );
  assert.match(
    css,
    /grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\)/
  );
});
