import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import { build } from "esbuild";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";

// Componentes, cronômetro, resultado e agendamento reais; somente serviços externos
// e o armazenamento do AppContext são substituídos. Não acessa dados do Supabase.
test("revisão IA: início, recarga, conclusão e cancelamento preservam o vínculo correto", async (t) => {
  const global = globalThis as any;
  const bundle = await build({
    stdin: { contents: `export { default as Bridge } from './src/components/QuestaoIACronometroBridge/QuestaoIACronometroBridge';
      export { default as Resolver } from './src/pages/ResolverSimuladoIA/ResolverSimuladoIA';
      export { CronometroProvider } from './src/context/CronometroContext'; export { MemoryRouter } from 'react-router-dom';`, resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
    define: { "import.meta.env": "{}" }, loader: { ".css": "empty" },
    plugins: [{ name: "fronteiras", setup(b) {
      const substituir = (filter: RegExp, contents: string) => b.onLoad({ filter }, () => ({ contents, loader: "tsx" }));
      substituir(/\/context\/AppContext\.tsx$/, 'export const useApp = () => globalThis.__revisaoTeste.app;');
      substituir(/\/context\/AuthContext\.tsx$/, 'export const useAuth = () => ({usuario:{id:"teste"}});');
      substituir(/\/context\/ToastContext\.tsx$/, 'export const useToast = () => ({showToast:()=>{}});');
      substituir(/\/services\/armazenamentoConta\.ts$/, 'export const armazenamentoLocalDaConta = globalThis.__revisaoTeste.local; export const armazenamentoSessaoDaConta = globalThis.__revisaoTeste.sessao;');
      substituir(/\/services\/catalogoQuestoesIAService\.ts$/, 'export const atualizarQuestoesAntesDoTreino = async q => q; export const registrarRespostasQuestoesIA = async () => {};');
      substituir(/\/services\/resultadosQuestoesIAService\.ts$/, 'export const salvarResultadoQuestoesIA = async () => {};');
      substituir(/\/services\/cadernosSimuladosIAService\.ts$/, `export const CHAVE_RASCUNHO_QUESTOES_IA = 'pmpe:questoes-ia:rascunho'; export const obterTipoSessaoQuestoesIAAtiva = () => 'questoes'; export const obterCadernoSimuladoIAAtivoId = () => null; export const definirTipoSessaoQuestoesIAAtiva = () => {}; export const limparCadernoSimuladoIAAtivo = () => {}; export const registrarResultadoCadernoSimuladoIA = async () => {};`);
      substituir(/\/components\/(QuestaoComunidade|ExplicacaoQuestao|AnaliseSimuladoStudyPro)\/.*\.tsx$/, 'export default function Auxiliar() { return null; }');
    } }],
  });
  const { window, document } = parseHTML('<html><body><main id="root"></main></body></html>');
  const anteriores = Object.fromEntries(["window", "document", "Event", "CustomEvent", "sessionStorage", "IS_REACT_ACT_ENVIRONMENT"].map(k => [k, global[k]]));
  function storage() { const m = new Map<string, string>(); return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), removeItem: (k: string) => m.delete(k), clear: () => m.clear() }; }
  const local = storage(), sessao = storage();
  Object.assign(global, { window, document, Event: window.Event, CustomEvent: window.CustomEvent, sessionStorage: sessao, IS_REACT_ACT_ENVIRONMENT: true });
  const ambiente: any = { local, sessao, app: {} };
  global.__revisaoTeste = ambiente;
  const modulo = { exports: {} as any };
  runInThisContext(`(function(require,module,exports){${bundle.outputFiles[0].text}\n})`)(createRequire(import.meta.url), modulo, modulo.exports);
  const { Bridge, Resolver, CronometroProvider, MemoryRouter } = modulo.exports;
  const chave = "pmpe:questoes-ia:origem-revisao";
  const ref = { materia: "Português", materiaId: "m", assunto: "Sintaxe", assuntoId: "a" };
  const questoes = Array.from({ length: 5 }, (_, i) => ({ ...ref, id: `q${i}`, banca: "Teste", dificuldade: "Fácil", enunciado: `Questão ${i}`, alternativas: { A: "Certa", B: "Errada", C: "C", D: "D", E: "E" }, respostaCorreta: "A", explicacao: "Teste" }));
  let root: ReturnType<typeof createRoot> | undefined;
  function preparar() {
    local.clear(); sessao.clear();
    const agora = new Date().toISOString();
    const app: any = { materias: [], revisoes: [{ ...ref, id: "alvo", etapa: 1, concluida: false, dataCriacao: agora, dataPrevista: agora }, { ...ref, assunto: "Morfologia", assuntoId: "b", id: "outra", etapa: 1, concluida: false, dataCriacao: agora, dataPrevista: agora }], sessoes: [], questoes: [], simulados: [], missoesConcluidas: [], configuracoes: { metaRevisoesDiaria: 10 } };
    for (const nome of ["Materias", "Revisoes", "Sessoes", "Questoes", "Simulados", "MissoesConcluidas"]) {
      const campo = nome[0].toLowerCase() + nome.slice(1);
      app[`set${nome}`] = (valor: any) => { app[campo] = typeof valor === "function" ? valor(app[campo]) : valor; };
    }
    ambiente.app = app;
    local.setItem("pmpe_questoes_ia", JSON.stringify(questoes));
    sessao.setItem(chave, JSON.stringify({ ...ref, revisaoId: "alvo", criadoEm: agora }));
    window.confirm = () => true;
  }
  async function montar(resolver = true) {
    await desmontar();
    root = createRoot(document.getElementById("root")!);
    await act(async () => { root!.render(createElement(MemoryRouter, { initialEntries: ["/resolver-simulado-ia/prova"] }, createElement(CronometroProvider, null, createElement(Bridge), resolver ? createElement(Resolver) : null))); });
  }
  async function desmontar() { if (root) await act(async () => root!.unmount()); root = undefined; }
  async function clicar(texto: string) {
    const botao = [...document.querySelectorAll("button")].find(b => b.textContent?.trim() === texto);
    assert.ok(botao, `Botão ausente: ${texto}`);
    await act(async () => { botao.dispatchEvent(new window.Event("click", { bubbles: true })); });
  }
  async function responderTudo() {
    for (let i = 0; i < 5; i++) {
      await act(async () => { document.querySelector(".resolver-ia-alternativa")!.dispatchEvent(new window.Event("click", { bubbles: true })); });
      if (i < 4) await clicar("Próxima →");
    }
    await clicar("Finalizar agora");
  }
  try {
    await t.test("preserva origem e respostas na recarga, conclui só o alvo e agenda uma próxima", async () => {
      preparar(); await montar(); await clicar("▶ Começar agora");
      assert.equal(JSON.parse(sessao.getItem(chave)!).revisaoId, "alvo");
      await act(async () => { document.querySelector(".resolver-ia-alternativa")!.dispatchEvent(new window.Event("click", { bubbles: true })); });
      await desmontar(); await montar();
      assert.match(document.body.textContent!, /progresso anterior foi recuperado/);
      await responderTudo();
      const app = ambiente.app;
      assert.equal(app.revisoes.find((r: any) => r.id === "alvo").concluida, true);
      assert.equal(app.revisoes.find((r: any) => r.id === "outra").concluida, false);
      const proximas = app.revisoes.filter((r: any) => r.etapa === 2);
      assert.equal(proximas.length, 1); assert.equal(proximas[0].assuntoId, "a");
      assert.equal(proximas[0].certas, 5);
      const dias = (Date.parse(proximas[0].dataPrevista) - Date.parse(proximas[0].dataCriacao)) / 86400000;
      assert.ok(dias >= 4 && dias <= 6);
      assert.equal(app.sessoes.length, 1); assert.equal(app.sessoes[0].revisaoId, "alvo");
      assert.equal(app.questoes.length, 1); assert.equal(app.questoes[0].certas, 5); assert.equal(sessao.getItem(chave), null);
      await desmontar();
    });
    await t.test("recusar cancelamento mantém origem; confirmar remove sem concluir", async () => {
      preparar(); await montar(false); await clicar("▶ Começar agora");
      window.confirm = () => false; await clicar("Cancelar"); assert.ok(sessao.getItem(chave));
      window.confirm = () => true; await clicar("Cancelar"); assert.equal(sessao.getItem(chave), null);
      assert.ok(ambiente.app.revisoes.every((r: any) => !r.concluida));
      await desmontar();
    });
    await t.test("fechar aviso remove a origem sem concluir revisão", async () => {
      preparar(); await montar(false); await clicar("Agora não"); assert.equal(sessao.getItem(chave), null);
      assert.equal(ambiente.app.sessoes.length, 0); await desmontar();
    });
    for (const [nome, valor] of [["expirado", JSON.stringify({ ...ref, revisaoId: "alvo", criadoEm: new Date(Date.now() - 7 * 3600000).toISOString() })], ["futuro", JSON.stringify({ ...ref, revisaoId: "alvo", criadoEm: new Date(Date.now() + 3600000).toISOString() })], ["inválido", "null"]]) {
      await t.test(`marcador ${nome} não conclui revisão`, async () => {
        preparar(); sessao.setItem(chave, valor); await montar(); await clicar("▶ Começar agora"); await responderTudo();
        assert.equal(ambiente.app.revisoes.find((r: any) => r.id === "alvo").concluida, false);
        assert.equal(sessao.getItem(chave), null); await desmontar();
      });
    }
    await t.test("marcador de outra revisão durante sessão não conclui a outra", async () => {
      preparar(); await montar(); await clicar("▶ Começar agora");
      ambiente.app.revisoes.push({ ...ambiente.app.revisoes[0], id: "duplicada" });
      sessao.setItem(chave, JSON.stringify({ ...ref, revisaoId: "duplicada", criadoEm: new Date().toISOString() }));
      await responderTudo();
      assert.equal(ambiente.app.revisoes.find((r: any) => r.id === "duplicada").concluida, false);
      assert.equal(ambiente.app.revisoes.find((r: any) => r.id === "alvo").concluida, true);
      await desmontar();
    });
  } finally {
    await desmontar(); delete global.__revisaoTeste;
    for (const [k, v] of Object.entries(anteriores)) { if (v === undefined) delete global[k]; else global[k] = v; }
  }
});
