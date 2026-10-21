import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const central = readFileSync("src/pages/CentralEstudos/CentralEstudos.tsx", "utf8");
const css = readFileSync("src/pages/CentralEstudos/CentralEstudos.css", "utf8");

test("grupos recebem cores distintas, com rótulos acessíveis por texto", () => {
  assert.match(central, /central-estudos-grupo-revisoes grupo-\$\{grupo\.id\}/);
  for (const [grupo, cor] of [
    ["atrasadas", "#f87171"],
    ["hoje", "#4ade80"],
    ["amanha", "#fbbf24"],
  ] as const) {
    assert.match(css, new RegExp(`\\.grupo-${grupo}\\s*\\{[^}]*--revisao-cor: ${cor}`));
  }
  assert.match(central, /\{grupo\.titulo\}/);
  assert.match(css, /border-left: 4px solid var\(--revisao-cor\)/);
  assert.match(css, /border-left: 3px solid var\(--revisao-cor\)/);
});

test("identificação separa matéria, assunto, data, módulo e origem do simulado", () => {
  assert.match(central, /central-estudos-revisao-materia/);
  assert.match(central, /\{revisao\.assunto\}/);
  assert.match(central, /<time className="central-estudos-revisao-etiqueta"/);
  assert.match(central, /rotuloOrigemRevisaoSimulado\(revisao, nomesSimulados\)/);
  assert.match(css, /central-estudos-revisao-etiquetas/);
});

test("aparência não modifica a seleção, a quantidade nem o encerramento das revisões", () => {
  assert.match(central, /resumoRevisoes\.grupos\.map/);
  assert.match(central, /selecionarRevisaoPendente\(revisao\)/);
  assert.match(central, /navigate\("\/revisoes"\)/);
  const selecionar = central.split("function selecionarRevisaoPendente(")[1]?.split("function alterarTipo(")[0];
  assert.ok(selecionar);
  assert.match(selecionar, /revisaoId: revisao\.id/);
  assert.doesNotMatch(selecionar, /setRevisoes|concluirRevisao/);
});
