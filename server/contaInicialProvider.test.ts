import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import { build } from "esbuild";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { gerarMateriasDoPlano } from "../src/utils/materiasDoPlano";
import { criarDadosIniciaisDaConta } from "../src/utils/contaInicial";

test("Provider real cria vazio, troca conta sem herdar estado e descarta fila anterior ao reinício", async () => {
  // Apenas a fronteira de autenticação/rede é simulada. Hidratação, reconciliação,
  // hooks React e fila offline são exatamente os usados pelo aplicativo.
  const nuvem = new Map<string, any>();
  const ambiente: any = { usuario: { id: "conta-a", user_metadata: { nome: "Ana" } } };
  const supabase = {
    rpc(nome: string, dados: { p_expected_revision: number; p_estado: object }) {
      assert.equal(nome, "salvar_estado_app_cas");
      const usuario = ambiente.usuario.id;
      const revisaoAtual = nuvem.get(usuario)?.syncRevision ?? 0;
      const ok = revisaoAtual === dados.p_expected_revision;
      const revisao = revisaoAtual + Number(ok);
      if (ok) nuvem.set(usuario, { ...structuredClone(dados.p_estado), syncRevision: revisao });
      return Promise.resolve({ data: [{ ok, revisao_atual: revisao }], error: null });
    },
    from(tabela: string) {
      let uid = "";
      const query: any = {
        select() { return query; }, eq(_campo: string, valor: string) { uid = valor; return query; },
        order() { return query; }, limit() { return Promise.resolve({ data: [], error: null }); },
        maybeSingle() { return Promise.resolve({ data: nuvem.has(uid) ? { user_id: uid, dados: { appState: structuredClone(nuvem.get(uid)) } } : null, error: null }); },
        upsert(linha: any) {
          if (tabela !== "backups") {
            assert.equal(tabela, "configuracoes");
            nuvem.set(linha.user_id, structuredClone(linha.dados.appState));
          }
          return Promise.resolve({ error: null });
        },
      };
      return query;
    },
  };
  const resultado = await build({
    stdin: { contents: 'export * from "./src/context/AppContext"; export * from "./src/services/seguranca/protecaoSincronizacaoService";', resolveDir: process.cwd(), loader: "ts" },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
    define: { "import.meta.env": "{}" },
    plugins: [{ name: "fronteira-teste", setup(builder) {
      builder.onLoad({ filter: /[\\/]src[\\/]lib[\\/]supabase\.ts$/ }, () => ({ contents: "export const supabase = globalThis.__contaInicialTeste.supabase; export const SUPABASE_PUBLIC_URL = ''; export const SUPABASE_PUBLIC_KEY = '';", loader: "ts" }));
      builder.onLoad({ filter: /[\\/]src[\\/]context[\\/]AuthContext\.tsx$/ }, () => ({ contents: "export function useAuth() { return globalThis.__contaInicialTeste.ambiente; }", loader: "tsx" }));
    } }],
  });
  const globals: any = globalThis;
  globals.__contaInicialTeste = { ambiente, supabase };
  const modulo = { exports: {} as any };
  runInThisContext(`(function(require,module,exports){${resultado.outputFiles[0].text}\n})`)(createRequire(import.meta.url), modulo, modulo.exports);
  const app = modulo.exports;
  const { window, document } = parseHTML('<html><body><main id="root"></main></body></html>');
  const eventoNativo = globals.Event;
  function storage() { const mapa = new Map(); return { getItem: (k: string) => mapa.get(k) ?? null, setItem: (k: string, v: string) => mapa.set(k, v), removeItem: (k: string) => mapa.delete(k) }; }
  const local = storage(); const sessao = storage();
  Object.assign(globals, { window, document, Event: window.Event, localStorage: local, sessionStorage: sessao, IS_REACT_ACT_ENVIRONMENT: true });
  Object.defineProperty(window, "localStorage", { configurable: true, value: local });
  Object.defineProperty(window, "sessionStorage", { configurable: true, value: sessao });
  local.setItem("pmpe_cadernos_simulados_ia", '[{"id":"de-outra-conta"}]');
  let atual: any;
  function Sonda() { atual = app.useApp(); return createElement("output", null, `${atual.configuracoes.nomeUsuario}:${atual.materias.length}`); }
  const root = createRoot(document.getElementById("root")!);
  async function render(chave: string) {
    await act(async () => { root.render(createElement(app.AppProvider, { key: chave }, createElement(Sonda))); });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 5)); });
  }
  try {
    await render("primeiro");
    assert.equal(document.querySelector("output")?.textContent, "Ana:0");
    assert.equal(nuvem.get("conta-a").materias.length, 0);
    assert.equal(nuvem.get("conta-a").configuracoes.planoPadraoAtivo, false);
    const anterior = structuredClone(nuvem.get("conta-a"));
    anterior.materias = [{ id: "minha", nome: "Minha matéria", cor: "#123456", modulos: [{ id: "meu", nome: "Meu módulo", assuntos: [] }] }];
    nuvem.set("conta-a", anterior);
    await render("reabrir");
    assert.equal(atual.materias.length, 1);
    const aula = { id: "minha-aula", nome: "Crase", ordem: 0, concluida: true, concluidaEm: anterior.salvoEm };
    const assunto = { id: "meu-assunto", nome: "Crase", prioridade: "media", concluido: true, aulas: [aula] };
    const manual = { id: "portugues-manual", nome: "Português", origemConteudo: "manual",
      assuntos: [assunto], modulos: [{ id: "meu-modulo", nome: "Oficina", ordem: 0, assuntos: [assunto] }] };
    const oficial = gerarMateriasDoPlano().find(m => m.id === "portugues");
    assert.ok(oficial);
    const referencia = { materiaId: manual.id, moduloId: "meu-modulo", assuntoId: assunto.id,
      materia: manual.nome, modulo: "Oficina", assunto: assunto.nome };
    const sessaoEstudo = { ...referencia, id: "sessao-manual", aulaId: aula.id, data: anterior.salvoEm,
      tipo: "aula", minutos: 15 };
    const revisao = { ...referencia, id: "revisao-manual", etapa: 1, dataCriacao: anterior.salvoEm,
      dataPrevista: anterior.salvoEm, concluida: false };
    nuvem.set("conta-a", { ...anterior, materias: [oficial, manual], sessoes: [sessaoEstudo], revisoes: [revisao],
      configuracoes: { ...anterior.configuracoes, planoPadraoAtivo: true }, syncRevision: anterior.syncRevision + 1 });
    await render("recarregar-portugues");
    const preservada = atual.materias.find((materia: { id: string }) => materia.id === manual.id);
    assert.equal(preservada.origemConteudo, "manual");
    assert.deepEqual(preservada.modulos.map((modulo: { id: string }) => modulo.id), ["meu-modulo"]);
    assert.equal(preservada.assuntos[0].aulas[0].id, aula.id);
    assert.equal(preservada.assuntos[0].aulas[0].concluidaEm, aula.concluidaEm);
    assert.deepEqual(atual.sessoes.find((item: { id: string }) => item.id === sessaoEstudo.id), sessaoEstudo);
    assert.deepEqual(atual.revisoes.find((item: { id: string }) => item.id === revisao.id), revisao);
    ambiente.usuario = { id: "conta-b", user_metadata: { nome: "Bruno" } };
    await render("reabrir");
    assert.equal(document.querySelector("output")?.textContent, "Bruno:0");
    const outraConta = JSON.stringify(nuvem.get("conta-b"));
    app.registrarEstadoPendenteSincronizacao("conta-a", anterior, anterior.syncRevision);
    const reiniciado = { ...anterior, ...criarDadosIniciaisDaConta("Ana"), syncRevision: anterior.syncRevision + 1 };
    reiniciado.configuracoes.dadosReiniciadosEm = "2026-09-03T18:00:00Z";
    nuvem.set("conta-a", reiniciado);
    ambiente.usuario = { id: "conta-a", user_metadata: { nome: "Ana" } };
    await render("reabrir");
    assert.equal(document.querySelector("output")?.textContent, "Ana:0");
    assert.equal(app.obterEstadoPendenteSincronizacao("conta-a"), null);
    assert.equal(nuvem.get("conta-a").materias.length, 0);
    assert.equal(JSON.stringify(nuvem.get("conta-b")), outraConta);
    assert.equal(local.getItem("pmpe_cadernos_simulados_ia"), '[{"id":"de-outra-conta"}]');
  } finally {
    await act(async () => root.unmount());
    for (const chave of ["window", "document", "localStorage", "sessionStorage", "IS_REACT_ACT_ENVIRONMENT", "__contaInicialTeste"]) Reflect.deleteProperty(globals, chave);
    globals.Event = eventoNativo;
  }
});
