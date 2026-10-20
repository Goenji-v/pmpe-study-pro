import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";
import { runInThisContext } from "node:vm";
import { build } from "esbuild";
import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { parseHTML } from "linkedom";
import { criarDadosIniciaisDaConta } from "../src/utils/contaInicial.ts";

test("topo, cartão e dias marcados usam a mesma sequência com estudo curto e revisão sem tempo", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date(2026, 9, 20, 12) });
  const bundle = await build({
    stdin: { resolveDir: process.cwd(), loader: "tsx", contents: `
      import React from 'react';
      import {MemoryRouter} from 'react-router-dom';
      import Dashboard from './src/pages/Dashboard/Dashboard';
      import Spotlight from './src/components/DashboardGamificacaoSpotlight/DashboardGamificacaoSpotlight';
      export default function Fixture(){return <MemoryRouter><Dashboard/><Spotlight/></MemoryRouter>}
    ` },
    bundle: true, write: false, platform: "node", format: "cjs", packages: "external", jsx: "automatic",
    define: { "import.meta.env": "{}" }, loader: { ".css": "empty" },
    plugins: [{ name: "fronteiras-offline", setup(b) {
      b.onLoad({ filter: /\/context\/AppContext\.tsx$/ }, () => ({ contents: "export const useApp=()=>globalThis.__sequenciaDashboard;", loader: "ts" }));
      b.onLoad({ filter: /\/context\/CronometroContext\.tsx$/ }, () => ({ contents: "export const useCronometro=()=>({sessaoAtiva:null,segundosDecorridos:0,cronometroAtivo:false});", loader: "ts" }));
      b.onLoad({ filter: /\/context\/AuthContext\.tsx$/ }, () => ({ contents: "export const useAuth=()=>({usuario:null});", loader: "ts" }));
      b.onLoad({ filter: /\/lib\/supabase\.ts$/ }, () => ({ contents: "export const supabase=new Proxy({},{get(){throw new Error('Rede proibida neste teste')}});", loader: "ts" }));
      b.onLoad({ filter: /\/services\/armazenamentoConta\.ts$/ }, () => ({ contents: "export const armazenamentoSessaoDaConta=globalThis.sessionStorage; export const armazenamentoLocalDaConta=globalThis.localStorage;", loader: "ts" }));
    } }],
  });
  const globals = globalThis as any;
  const nomes = ["window", "document", "MutationObserver", "Event", "localStorage", "sessionStorage", "IS_REACT_ACT_ENVIRONMENT", "__sequenciaDashboard"];
  const anteriores = new Map(nomes.map(nome => [nome, Object.getOwnPropertyDescriptor(globals, nome)]));
  const { window, document } = parseHTML('<html><body><div id="root"></div></body></html>');
  const armazenamento = () => { const mapa = new Map(); return { getItem: (k: string) => mapa.get(k) ?? null, setItem: (k: string, v: string) => mapa.set(k, v), removeItem: (k: string) => mapa.delete(k) }; };
  Object.assign(globals, {
    window, document, MutationObserver: window.MutationObserver, Event: window.Event,
    localStorage: armazenamento(), sessionStorage: armazenamento(), IS_REACT_ACT_ENVIRONMENT: true,
    __sequenciaDashboard: {
      ...criarDadosIniciaisDaConta("Teste"),
      sessoes: [{ id: "curta", data: "2026-10-18", tipo: "estudo", minutos: 20, materia: "Português", assunto: "Verbos" }],
      revisoes: [{ id: "revisao", dataPrevista: "2026-10-19", concluida: true, dataConclusao: "2026-10-19", materia: "Português", assunto: "Verbos" }],
    },
  });
  const modulo = { exports: {} as any };
  const root = createRoot(document.getElementById("root")!);
  try {
    runInThisContext(`(function(require,module,exports){${bundle.outputFiles[0].text}\n})`)(createRequire(import.meta.url), modulo, modulo.exports);
    await act(async () => root.render(createElement(modulo.exports.default)));
    assert.equal(document.querySelector(".dashboard-xp-inline-streak strong")?.textContent, "2");
    assert.equal(document.querySelector(".dashboard-pro-streak-top strong")?.textContent, "2 dias");
    // Segunda (ontem) tem só uma revisão concluída e deve ser marcada.
    assert.equal(document.querySelector(".dashboard-pro-streak-week > div")?.classList.contains("feito"), true);
    // Ao voltar à aba após um dia completo parado, ambos expiram sem novos dados.
    t.mock.timers.setTime(new Date(2026, 9, 21, 0, 1).getTime());
    await act(async () => window.dispatchEvent(new window.Event("focus")));
    assert.equal(document.querySelector(".dashboard-xp-inline-streak strong")?.textContent, "0");
    assert.equal(document.querySelector(".dashboard-pro-streak-top strong")?.textContent, "0 dias");
    assert.match(document.querySelector(".dashboard-xp-inline-streak")?.getAttribute("title") ?? "", /Recorde: 2 dias/);
  } finally {
    await act(async () => root.unmount());
    for (const nome of nomes) {
      const descriptor = anteriores.get(nome);
      if (descriptor) Object.defineProperty(globals, nome, descriptor);
      else Reflect.deleteProperty(globals, nome);
    }
  }
});
