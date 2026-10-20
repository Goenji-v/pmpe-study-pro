import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import { build } from "esbuild";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";

// A página real permanece montada enquanto a conta recebe uma recompensa.
// Somente contextos externos são substituídos; nenhuma conexão é feita ao Supabase.
test("configurações preservam atualizações recebidas com o formulário aberto", async (t) => {
  const globals = globalThis as any;
  const bundle = await build({
    stdin: { contents: "export { default as Configuracoes } from './src/pages/Configuracoes/Configuracoes'; export { MemoryRouter } from 'react-router-dom';", resolveDir: process.cwd(), loader: "tsx" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
    define: { "import.meta.env": "{}" }, loader: { ".css": "empty" },
    plugins: [{ name: "contextos-sinteticos", setup(builder) {
      builder.onLoad({ filter: /\/context\/AppContext\.tsx$/ }, () => ({ contents: "export const useApp = () => globalThis.__configuracoesTeste;", loader: "ts" }));
      builder.onLoad({ filter: /\/context\/ToastContext\.tsx$/ }, () => ({ contents: "export const useToast = () => ({showToast: () => {}});", loader: "ts" }));
    } }],
  });
  const { window, document } = parseHTML('<html><body><main id="root"></main></body></html>');
  const chaves = ["window", "document", "Event", "IS_REACT_ACT_ENVIRONMENT", "__configuracoesTeste"];
  const anteriores = new Map(chaves.map(chave => [chave, Object.getOwnPropertyDescriptor(globals, chave)]));
  Object.assign(globals, { window, document, Event: window.Event, IS_REACT_ACT_ENVIRONMENT: true });
  const modulo = { exports: {} as any };
  runInThisContext(`(function(require,module,exports){${bundle.outputFiles[0].text}\n})`)(createRequire(import.meta.url), modulo, modulo.exports);
  const { Configuracoes, MemoryRouter } = modulo.exports;
  let root: ReturnType<typeof createRoot> | undefined;
  const ambiente: any = { materias: [] };
  ambiente.setConfiguracoes = (atualizacao: any) => {
    ambiente.configuracoes = typeof atualizacao === "function" ? atualizacao(ambiente.configuracoes) : atualizacao;
  };
  globals.__configuracoesTeste = ambiente;
  async function renderizar() {
    await act(async () => { root!.render(createElement(MemoryRouter, null, createElement(Configuracoes))); });
  }
  async function clicar(classe: string) {
    await act(async () => { document.querySelector(classe)!.dispatchEvent(new window.Event("click", { bubbles: true })); });
  }
  async function preparar() {
    await desmontar();
    ambiente.configuracoes = {
      nomeUsuario: "Ana", concurso: "PMPE", bancaPadrao: "AOCP", tema: "escuro",
      metaQuestoesDiaria: 12, metaMinutosDiaria: 45, metaRevisoesDiaria: 2,
      economia: { moedas: 10, recompensasRecebidas: ["recompensa-antiga"] },
      diasEstudo: ["seg"], materiasPorDia: 2, salvarMarcacoesPdf: true,
    };
    window.confirm = () => true;
    root = createRoot(document.getElementById("root")!);
    await renderizar();
    // Dados que chegaram depois da cópia local mantida por useState.
    ambiente.configuracoes = {
      ...ambiente.configuracoes,
      economia: { moedas: 25, recompensasRecebidas: ["recompensa-antiga", "recompensa-nova"] },
      dadosReiniciadosEm: "2026-10-20T15:00:00Z", semanaAtualPlano: 8,
      editalOnboardingVisto: true, editalAtivo: { confirmadoEm: "2026-10-20T15:01:00Z" },
    };
    await renderizar();
  }
  function conferirAtualizacoes() {
    assert.equal(ambiente.configuracoes.economia.moedas, 25);
    assert.deepEqual(ambiente.configuracoes.economia.recompensasRecebidas, ["recompensa-antiga", "recompensa-nova"]);
    assert.equal(ambiente.configuracoes.dadosReiniciadosEm, "2026-10-20T15:00:00Z");
    assert.equal(ambiente.configuracoes.semanaAtualPlano, 8);
    assert.equal(ambiente.configuracoes.editalOnboardingVisto, true);
    assert.equal(ambiente.configuracoes.editalAtivo.confirmadoEm, "2026-10-20T15:01:00Z");
  }
  async function desmontar() { if (root) await act(async () => root!.unmount()); root = undefined; }
  try {
    await t.test("salvar não repõe saldo, recompensas ou metadados antigos", async () => {
      await preparar();
      await clicar('.configuracoes-dias button[title="Terça"]');
      await clicar(".configuracoes-salvar");
      conferirAtualizacoes();
      assert.equal(ambiente.configuracoes.metaQuestoesDiaria, 12);
      assert.equal(ambiente.configuracoes.materiasPorDia, 2);
      assert.deepEqual(ambiente.configuracoes.diasEstudo, ["seg", "ter"]);
      await desmontar();
    });
    await t.test("salvar usa o estado mais recente mesmo antes de um novo render", async () => {
      await preparar();
      ambiente.configuracoes = {
        ...ambiente.configuracoes,
        economia: { moedas: 40, recompensasRecebidas: ["recompensa-final"] },
        semanaAtualPlano: 9,
      };
      await clicar(".configuracoes-salvar");
      assert.equal(ambiente.configuracoes.economia.moedas, 40);
      assert.deepEqual(ambiente.configuracoes.economia.recompensasRecebidas, ["recompensa-final"]);
      assert.equal(ambiente.configuracoes.semanaAtualPlano, 9);
      await desmontar();
    });
    await t.test("restaurar padrões altera preferências sem reverter dados recentes", async () => {
      await preparar();
      await clicar(".configuracoes-restaurar");
      conferirAtualizacoes();
      assert.equal(ambiente.configuracoes.metaQuestoesDiaria, 30);
      assert.equal(ambiente.configuracoes.metaMinutosDiaria, 120);
      assert.equal(ambiente.configuracoes.metaRevisoesDiaria, 5);
      assert.equal(ambiente.configuracoes.materiasPorDia, 1);
      assert.equal(ambiente.configuracoes.salvarMarcacoesPdf, false);
      await clicar(".configuracoes-salvar");
      conferirAtualizacoes();
      assert.equal(ambiente.configuracoes.metaQuestoesDiaria, 30);
      await desmontar();
    });
    await t.test("recusar restauração mantém o estado intacto", async () => {
      await preparar();
      const antes = structuredClone(ambiente.configuracoes);
      window.confirm = () => false;
      await clicar(".configuracoes-restaurar");
      assert.deepEqual(ambiente.configuracoes, antes);
      await desmontar();
    });
  } finally {
    await desmontar();
    for (const chave of chaves) {
      const anterior = anteriores.get(chave);
      if (anterior) Object.defineProperty(globals, chave, anterior);
      else Reflect.deleteProperty(globals, chave);
    }
  }
});
