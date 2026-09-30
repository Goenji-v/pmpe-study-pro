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
  assert.doesNotMatch(tiposVisiveis, /tipo:\s*"redacao"/);

  assert.match(bridge, /const MATERIA_REDACAO = "Redação"/);
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
