import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import { build } from "esbuild";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";

test("cartão e perfil reais compartilham minutos e deixam os estados de revisão explícitos", async () => {
  const bundle = await build({
    stdin: { contents: 'export {default as Estudos} from "./src/pages/Estudos/Estudos"; export {MemoryRouter} from "react-router-dom";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, write: false,
    platform: "node", format: "cjs", packages: "external", jsx: "automatic",
    loader: { ".css": "empty" }, define: { "import.meta.env": "{}" },
    plugins: [{ name: "fronteiras-offline", setup(b) {
      b.onLoad({ filter: /\/context\/AppContext\.tsx$/ }, () => ({ contents: "export const useApp=()=>globalThis.__metricasAssuntoTeste;", loader: "ts" }));
      b.onLoad({ filter: /\/context\/ToastContext\.tsx$/ }, () => ({ contents: "export const useToast=()=>({showToast:()=>{}});", loader: "ts" }));
      b.onLoad({ filter: /\/services\/armazenamentoConta\.ts$/ }, () => ({ contents: "export const armazenamentoSessaoDaConta={getItem:()=>null,setItem:()=>{}};", loader: "ts" }));
      b.onLoad({ filter: /\/(MateriaisDoAssunto|FlashcardsQuizPanel)\.tsx$/ }, () => ({ contents: "export default function Mock(){return null}", loader: "tsx" }));
      b.onLoad({ filter: /\/data\/questoes\/index\.ts$/ }, () => ({ contents: "export const buscarPacoteQuestoesFlashcards=()=>null;", loader: "ts" }));
      b.onLoad({ filter: /\/lib\/supabase\.ts$/ }, () => { throw new Error("Um mock deixou escapar o cliente remoto"); });
    } }],
  });
  const data = "2026-10-17T12:00:00Z";
  const assunto = { id: "principios", nome: "Dos princípios fundamentais", prioridade: "media", concluido: false };
  const modulo = { id: "geral", nome: "Geral", ordem: 1, assuntos: [assunto] };
  const materia = { id: "constitucional", nome: "Direito Constitucional", assuntos: [assunto], modulos: [modulo] };
  const ref = { materiaId: materia.id, materia: materia.nome, moduloId: modulo.id, modulo: modulo.nome, assuntoId: assunto.id, assunto: assunto.nome, data };
  const g = globalThis as any;
  const anteriores = Object.fromEntries(["window", "document", "Event", "IS_REACT_ACT_ENVIRONMENT", "__metricasAssuntoTeste", "fetch"].map(k => [k, g[k]]));
  const { window, document } = parseHTML('<html><body><main id="root"></main></body></html>');
  // Apenas os dados de contexto e materiais remotos são simulados; ambas as telas são reais.
  Object.assign(g, { window, document, Event: window.Event, IS_REACT_ACT_ENVIRONMENT: true,
    fetch: () => { throw new Error("Rede proibida neste teste"); },
    __metricasAssuntoTeste: {
      materias: [materia], configuracoes: {},
      sessoes: [{ ...ref, id: "sessao-questoes", tipo: "questoes", minutos: 98 }, { ...ref, id: "sessao-leitura", tipo: "leitura", minutos: 125 }],
      questoes: [{ ...ref, id: "registro", certas: 100, erradas: 40, emBranco: 0, minutos: 98, banca: "Teste" }],
      revisoes: Array.from({ length: 7 }, (_, i) => ({ ...ref, id: `revisao-${i}`, concluida: i !== 0, dataConclusao: i ? data : undefined, dataPrevista: data, dataCriacao: data, etapa: 1 })),
    },
  });
  window.HTMLElement.prototype.showModal = function () { this.setAttribute("open", ""); };
  const m = { exports: {} as any };
  let root: ReturnType<typeof createRoot> | undefined;
  try {
    runInThisContext(`(function(require,module,exports){${bundle.outputFiles[0].text}\n})`)(createRequire(import.meta.url), m, m.exports);
    root = createRoot(document.getElementById("root")!);
    await act(async () => root!.render(createElement(m.exports.MemoryRouter, null, createElement(m.exports.Estudos))));
    await act(async () => document.querySelector(".conteudos-modulo-toggle")!.dispatchEvent(new window.Event("click", { bubbles: true })));
    const cartao = document.querySelector(".conteudos-metricas-aula")!;
    assert.match(cartao.textContent!, /223 min/);
    assert.match(cartao.textContent!, /140 questões/);
    assert.match(cartao.textContent!, /1 revisão pendente/);
    assert.match(cartao.textContent!, /6 revisões concluídas/);
    await act(async () => document.querySelector(".conteudos-nome-perfil")!.dispatchEvent(new window.Event("click", { bubbles: true })));
    const perfil = document.querySelector("dialog.perfil-assunto")!;
    const metricas = new Map([...perfil.querySelectorAll(".perfil-assunto-metricas article")].map(el => [el.querySelector("small")!.textContent, el.querySelector("strong")!.textContent]));
    assert.equal(metricas.get("Horas estudadas"), "3,72h");
    assert.equal(metricas.get("Questões"), "140");
    assert.equal(metricas.get("Revisões pendentes"), "1");
    assert.equal(metricas.get("Revisões concluídas"), "6");
  } finally {
    if (root) await act(async () => root!.unmount());
    for (const [k, v] of Object.entries(anteriores)) { if (v === undefined) delete g[k]; else g[k] = v; }
  }
});
