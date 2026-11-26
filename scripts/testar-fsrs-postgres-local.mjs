import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "../.ferramentas-fsrs/node_modules/@electric-sql/pglite/dist/index.js";
import { enfileirar, filaVazia, sincronizarFsrs } from "../src/services/inteligenciaRevisao/sincronizacao.ts";
import { carregarMemoria, versaoMemoria } from "../src/services/inteligenciaRevisao/memoria.ts";
import { planejarRevisoes } from "../src/services/inteligenciaRevisao/plano.ts";
import { prepararCheckpoint } from "../src/services/inteligenciaRevisao/checkpoint.ts";

const db = new PGlite();
const dono = "00000000-0000-4000-8000-000000000101";
const terceiro = "00000000-0000-4000-8000-000000000102";
const escopo = { usuarioId: dono, epoca: "inicial" };
const evento = (id, dia, certas = 8) => ({
  evento: { usuarioId: dono, origem: "sessao", ocorrenciaId: id, tipo: "recuperacao",
    ocorridoEm: `2027-01-${dia}T15:00:00Z`, conteudo: { materiaId: "m", assuntoId: "a" } },
  evidencia: { modo: "recuperacao", certas, erradas: 10 - certas },
});
const a = evento("celular-offline", "01");
const b = evento("desktop-offline", "02");
const relogio = new Date("2027-01-03T15:00:00Z");
const materias = [{ id: "m", nome: "Matéria", assuntos: [{ id: "a", nome: "A", prioridade: "alta", concluido: true }] }];

function dispositivo() {
  let fila = filaVazia();
  return {
    ler: async () => structuredClone(fila),
    atualizar: async (_, aplicar) => structuredClone(fila = aplicar(fila)),
  };
}
const trocar = (usuario, escopo, lote, proposta, role = "authenticated") => db.transaction(async tx => {
  await tx.exec(`set local role ${role}`);
  await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [usuario]);
  const { rows } = await tx.query("select public.sincronizar_fsrs_v1($1,$2,$3::jsonb,$4,$5,$6::jsonb) r",
    [escopo.usuarioId, escopo.epoca, JSON.stringify(lote), proposta?.revisao ?? null,
      proposta?.revisaoEventos ?? null, proposta ? JSON.stringify(proposta.checkpoint) : null]);
  return rows[0].r;
});
const transporte = { trocar: (...args) => trocar(dono, ...args) };
try {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    grant usage on schema auth to anon, authenticated;
    create table auth.users(id uuid primary key);
    create table public.configuracoes(user_id uuid primary key, dados jsonb not null);
  `);
  await db.query("insert into auth.users values ($1),($2)", [dono, terceiro]);
  await db.query("insert into public.configuracoes values ($1, $2::jsonb)", [dono, JSON.stringify({ appState: { syncRevision: 12, configuracoes: {} } })]);
  await db.exec(await readFile(new URL("../supabase/migrations/20261126083243_fsrs_sincronizacao_compartilhada.sql", import.meta.url), "utf8"));
  await assert.rejects(trocar(dono, escopo, []), { code: "42501" });
  await db.query("insert into study_pro_internal.fsrs_pilotos values ($1,true),($2,true)", [dono, terceiro]);
  await assert.rejects(trocar(terceiro, escopo, [a]), { code: "42501" });
  await assert.rejects(trocar(dono, escopo, [], undefined, "anon"), { code: "42501" });
  await assert.rejects(db.transaction(async tx => {
    await tx.exec("set local role authenticated");
    await tx.exec("select * from study_pro_internal.fsrs_diarios");
  }), { code: "42501" });

  await assert.rejects(trocar(terceiro, { usuarioId: terceiro, epoca: "inicial" }, []), { code: "40001" });
  await db.query("insert into public.configuracoes values ($1, $2::jsonb)", [terceiro,
    JSON.stringify({ appState: { syncRevision: 1, configuracoes: {} } })]);

  const celular = dispositivo();
  const desktop = dispositivo();
  await enfileirar(celular, escopo, [a, a]);
  await enfileirar(desktop, escopo, [b]);
  await assert.rejects(sincronizarFsrs(celular, { async trocar(...args) {
    await transporte.trocar(...args);
    throw new Error("Resposta perdida");
  } }, escopo), /Resposta perdida/);
  assert.equal((await celular.ler()).pendentes.length, 1);

  // A chamada da segunda sessão pode ser iniciada antes de a primeira receber o ACK.
  await Promise.all([sincronizarFsrs(celular, transporte, escopo), sincronizarFsrs(desktop, transporte, escopo)]);
  const fotos = await Promise.all([sincronizarFsrs(celular, transporte, escopo), sincronizarFsrs(desktop, transporte, escopo)]);
  for (const { fila } of fotos) {
    assert.equal(fila.pendentes.length, 0);
    assert.equal(fila.confirmado.eventos.length, 2);
    const motor = await carregarMemoria(materias, { versao: versaoMemoria, retencao: .9, observacoes: fila.confirmado.eventos }, relogio);
    assert.equal([...motor.estados.values()][0].historico.filter(x => x.log).length, 2);
  }
  const base = fotos[0].fila.confirmado;
  assert.equal(base.revisaoEventos, 2);
  assert.equal(base.revisaoLegado, 12);
  const entrada = { materias, revisoes: [], agora: relogio, compromissos: [],
    limites: { minutos: 60, revisoes: 2, semana: [0,1,2,3,4,5,6] },
    diario: { versao: versaoMemoria, retencao: .9, observacoes: base.eventos } };
  const checkpoint = prepararCheckpoint(escopo, entrada, await planejarRevisoes(entrada), 12);
  const proposta = { revisao: base.revisao, revisaoEventos: base.revisaoEventos, checkpoint };
  const [x, y] = await Promise.all([trocar(dono, escopo, [], proposta),
    trocar(dono, escopo, [], { ...proposta, checkpoint: { ...checkpoint, agendamentos: [] } })]);
  assert.equal(x.resultado, "ok");
  assert.equal(y.resultado, "conflito");
  const retry = await trocar(dono, escopo, [], proposta);
  assert.equal(retry.resultado, "ok");
  assert.equal(retry.revisao, x.revisao);
  assert.equal(retry.checkpoint.avaliados.length, 2);
  assert.equal((await trocar(terceiro, { usuarioId: terceiro, epoca: "inicial" }, [])).eventos.length, 0);
  // Concede SELECT só nesta transação de teste para verificar a política de defesa em profundidade.
  await db.transaction(async tx => {
    await tx.exec("grant select on study_pro_internal.fsrs_diarios to authenticated");
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [terceiro]);
    const { rows } = await tx.query("select usuario from study_pro_internal.fsrs_diarios");
    assert.deepEqual(rows, [{ usuario: terceiro }]);
    await tx.exec("reset role; revoke select on study_pro_internal.fsrs_diarios from authenticated;");
  });
  await assert.rejects(trocar(dono, escopo, [{ ...a, evento: { ...a.evento, usuarioId: terceiro } }]), { code: "22023" });
  assert.equal((await trocar(dono, escopo, [])).revisao, retry.revisao);
  const entraram = await trocar(dono, escopo, [evento("celular-offline", "01", 5)], proposta);
  assert.equal(entraram.resultado, "conflito");
  assert.equal(entraram.eventos.length, 3);
  assert.equal(entraram.checkpoint, null);
  const reconciliado = await carregarMemoria(materias, { ...entrada.diario, observacoes: entraram.eventos }, relogio);
  assert.equal(reconciliado.reconciliacao.conflitos, 1);
  assert.equal([...reconciliado.estados.values()][0].historico.length, 1);

  await db.query("update public.configuracoes set dados = $1::jsonb where user_id = $2",
    [JSON.stringify({ appState: { syncRevision: 13, configuracoes: { dadosReiniciadosEm: "reiniciado" } } }), dono]);
  await assert.rejects(trocar(dono, escopo, [b]), { code: "40001" });
  assert.equal((await trocar(dono, { ...escopo, epoca: "reiniciado" }, [])).eventos.length, 0);
  console.log("Postgres local: migração, autenticação, isolamento, duas filas offline, retry, epoch e CAS aprovados.");
  if (process.env.FSRS_BROWSER_SQL_PORT) {
    const { chromium, devices } = await import("@playwright/test");
    const origin = "http://127.0.0.1:" + Number(process.env.FSRS_BROWSER_SQL_PORT);
    const navegador = await chromium.launch({ channel: "msedge", headless: true });
    try {
      const dispositivos = await Promise.all(["Desktop Edge", "Pixel 5"].map(device =>
        navegador.newContext({ ...devices[device], serviceWorkers: "block" })));
      const escopoNovo = { ...escopo, epoca: "reiniciado" };
      let perderAck = true;
      const telas = await Promise.all(dispositivos.map(async contexto => {
        await contexto.route("**/*", async route => {
          const url = new URL(route.request().url());
          if (url.origin !== origin) return route.abort();
          if (url.pathname === "/fsrs-teste-vazio") return route.fulfill({ contentType: "text/html", body: "<title>Fixture FSRS</title>" });
          if (url.pathname !== "/rest/v1/rpc/sincronizar_fsrs_v1") return route.continue();
          const { p_usuario, p_epoca, p_eventos } = route.request().postDataJSON();
          const r = await trocar(dono, { usuarioId: p_usuario, epoca: p_epoca }, p_eventos);
          if (p_eventos.length && perderAck) {
            perderAck = false;
            return route.fulfill({ status: 500, json: { code: "ACK", message: "Resposta perdida" } });
          }
          return route.fulfill({ json: r });
        });
        return contexto.newPage();
      }));
      async function iniciar(tela) {
        await tela.goto(origin + "/fsrs-teste-vazio");
        await tela.evaluate(async () => {
          const { filaFsrsLocal } = await import("/src/services/inteligenciaRevisao/filaFsrsLocal.ts");
          const { diarioFsrsSupabase } = await import("/src/services/inteligenciaRevisao/diarioFsrsSupabase.ts");
          const { enfileirar, sincronizarFsrs } = await import("/src/services/inteligenciaRevisao/sincronizacao.ts");
          Object.assign(window, { filaFsrsLocal, diarioFsrsSupabase, enfileirar, sincronizarFsrs });
        });
      }
      await Promise.all(telas.map(iniciar));
      await Promise.all(dispositivos.map(c => c.setOffline(true)));
      for (const [i, tela] of telas.entries()) {
        const offline = await tela.evaluate(async ({ escopo, evento }) => {
          await window.enfileirar(window.filaFsrsLocal, escopo, [evento, evento]);
          return { online: navigator.onLine, pendentes: (await window.filaFsrsLocal.ler(escopo)).pendentes.length };
        }, { escopo: escopoNovo, evento: [a, b][i] });
        assert.deepEqual(offline, { online: false, pendentes: 1 });
      }
      await Promise.all(dispositivos.map(c => c.setOffline(false)));
      // Recarrega os dois dispositivos antes de qualquer ACK, exercitando a fila durável.
      await Promise.all(telas.map(iniciar));
      const executar = tela => tela.evaluate(async escopo => {
        return window.sincronizarFsrs(window.filaFsrsLocal, window.diarioFsrsSupabase, escopo);
      }, escopoNovo);
      const r = await Promise.allSettled(telas.map(executar));
      assert.equal(r.filter(x => x.status === "rejected").length, 1);
      const rejeitada = telas[r.findIndex(x => x.status === "rejected")];
      const pendentes = await rejeitada.evaluate(async escopo => (await window.filaFsrsLocal.ler(escopo)).pendentes.length, escopoNovo);
      assert.equal(pendentes, 1);
      await executar(rejeitada);
      const finais = await Promise.all(telas.map(executar));
      for (const { fila } of finais) {
        assert.equal(fila.pendentes.length, 0);
        assert.deepEqual(fila.confirmado.eventos.map(o => o.evento.ocorrenciaId).sort(), ["celular-offline", "desktop-offline"]);
        const final = await carregarMemoria(materias, { versao: versaoMemoria, retencao: .9, observacoes: fila.confirmado.eventos }, relogio);
        assert.equal([...final.estados.values()][0].historico.filter(x => x.log).length, 2);
      }
      await Promise.all(dispositivos.map(c => c.close()));
      console.log("Navegadores independentes: IndexedDB offline, recarga, reconexão, ACK perdido e replay aprovados.");
    } finally {
      await navegador.close();
    }
  }
} finally {
  await db.close();
}
