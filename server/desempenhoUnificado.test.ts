import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseHTML } from "linkedom";
import { consolidarPorMateria, consolidarPorAssunto } from "../src/utils/estatisticasConsolidadas.ts";
import { filtrarQuestoesDesempenho, filtrarSessoesDesempenho, filtrarRevisoesDesempenho } from "../src/utils/filtrosDesempenho.ts";

const data = "2026-10-16T12:00:00Z";
const registro = (materia: string, certas = 8, erradas = 2) => ({ id: materia, materia, assunto: "Geral", banca: "Teste", certas, erradas, minutos: 0, data });

test("estatísticas somam aliases e calculam aproveitamento ponderado sem alterar registros", () => {
  const questoes = [registro("Português", 8, 2), registro("Língua Portuguesa", 1, 9), registro("RLM"), registro("Raciocínio Lógico-Matemático"), registro("Leis Extravagantes"), registro("Legislação Extravagante")];
  const antes = JSON.stringify(questoes);
  const linhas = consolidarPorMateria({ materias: [], questoes, sessoes: [{ materia: "Língua Portuguesa", minutos: 90 }] as any, revisoes: [{ materia: "Português", concluida: true }] as any });
  assert.equal(linhas.length, 3);
  const portugues = linhas.find(x => x.chave === "portugues")!;
  assert.equal(portugues.questoes, 20);
  assert.equal(portugues.certas, 9);
  assert.equal(portugues.aproveitamento, 45);
  assert.equal(portugues.minutos, 90);
  assert.equal(portugues.revisoes, 1);
  assert.equal(JSON.stringify(questoes), antes);
});

test("agrupa assuntos da mesma matéria equivalente sem fundir matérias distintas", () => {
  const linhas = consolidarPorAssunto({ questoes: [registro("Português"), registro("Língua Portuguesa"), registro("Direito Penal"), registro("Direito Penal Militar")], sessoes: [], revisoes: [] });
  assert.equal(linhas.length, 3);
  assert.equal(linhas.find(x => x.chave.startsWith("portugues::"))?.questoes, 20);
});

test("filtro selecionado inclui aliases em questões, sessões e revisões", () => {
  const filtro = { materia: "RLM", inicio: new Date("2026-10-01"), fim: new Date("2026-10-31") };
  const registros = [registro("RLM"), registro("Raciocínio Lógico e Matemática"), registro("Português"), { ...registro("RLM"), data: "2026-09-01" }];
  assert.equal(filtrarQuestoesDesempenho(registros, filtro).length, 2);
  assert.equal(filtrarSessoesDesempenho(registros as any, filtro).length, 2);
  assert.equal(filtrarRevisoesDesempenho(registros.map(x => ({ ...x, dataPrevista: x.data })) as any, filtro).length, 2);
});

test("sessões de redação respeitam período e filtro da matéria", () => {
  const sessoes = [{ ...registro("Redação"), tipo: "redacao", minutos: 45 }, { ...registro("Redação"), tipo: "redacao", minutos: 30, data: "2026-09-01" }];
  assert.equal(filtrarSessoesDesempenho(sessoes as any, { inicio: new Date("2026-10-01") }).length, 1);
  assert.equal(filtrarSessoesDesempenho(sessoes as any, { materia: "Português" }).length, 0);
});

test("tela real exibe horas de redação e uma opção por matéria, inclusive sem questões", async () => {
  const bundle = await build({
    entryPoints: ["src/pages/Estatisticas/Estatisticas.tsx"], bundle: true, write: false,
    platform: "node", format: "cjs", packages: "external", jsx: "automatic", loader: { ".css": "empty" },
    plugins: [{ name: "app-fixture", setup(b) {
      b.onLoad({ filter: /\/context\/AppContext\.tsx$/ }, () => ({ contents: 'export const useApp = () => globalThis.__desempenhoFixture;', loader: "ts" }));
    } }],
  });
  const g = globalThis as any;
  const anterior = g.__desempenhoFixture;
  g.__desempenhoFixture = { materias: [], questoes: [registro("Português"), registro("Língua Portuguesa"), registro("RLM"), registro("Raciocínio Lógico-Matemático")], revisoes: [], simulados: [], sessoes: [
    { ...registro("Redação"), tipo: "redacao", minutos: 45 },
    { ...registro("Redação"), tipo: "redacao", minutos: 30 },
    { ...registro("Português"), tipo: "teoria", minutos: 120 },
  ] };
  try {
    const modulo = { exports: {} as any };
    runInThisContext(`(function(require,module,exports){${bundle.outputFiles[0].text}\n})`)(createRequire(import.meta.url), modulo, modulo.exports);
    const { document } = parseHTML(renderToStaticMarkup(createElement(modulo.exports.default)));
    const opcoes = [...document.querySelectorAll("select")][0].textContent!;
    assert.ok(opcoes.includes("Redação"));
    assert.ok(opcoes.includes("Português")); assert.ok(!opcoes.includes("Língua Portuguesa"));
    assert.ok(opcoes.includes("RLM")); assert.ok(!opcoes.includes("Raciocínio Lógico-Matemático"));
    const cartao = [...document.querySelectorAll(".estatistica-card")].find(x => x.textContent?.includes("Horas de redação"));
    assert.ok(cartao, "cartão de horas de redação visível");
    assert.match(cartao.textContent!, /1,25h/);
  } finally {
    if (anterior === undefined) delete g.__desempenhoFixture; else g.__desempenhoFixture = anterior;
  }
});
