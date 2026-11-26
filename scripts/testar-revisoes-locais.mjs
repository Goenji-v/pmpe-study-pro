import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "@playwright/test";
import { mkdir } from "node:fs/promises";

const origin = "http://127.0.0.1:" + (process.env.FSRS_PORT ?? "5187");
const testarCheckpoint = process.env.FSRS_TESTAR_CHECKPOINT === "1";
const testarSync = process.env.FSRS_TESTAR_SYNC === "1";
const evidence = new URL("../.evidencias-fsrs/", import.meta.url);
await mkdir(evidence, { recursive: true });
const browser = await chromium.launch({
  channel: process.env.FSRS_BROWSER ?? "msedge",
  headless: true,
});
try {
  for (const device of ["Desktop Edge", "Pixel 5"]) {
    const context = await browser.newContext({ ...devices[device], serviceWorkers: "block" });
    const externas = [];
    await context.route("**/*", route => {
      const url = new URL(route.request().url());
      if (url.origin === origin) return route.continue();
      externas.push(url.origin);
      return route.abort();
    });
    const page = await context.newPage();
    const erros = [];
    page.on("pageerror", erro => erros.push(erro.message));
    await page.goto(origin + "/laboratorio-revisoes", { waitUntil: "networkidle" });
    const panel = page.getByRole("region", { name: "Planejamento adaptativo" });
    await panel.getByText("7 dias", { exact: false }).first().waitFor();
    const prefixo = device === "Pixel 5" ? "mobile" : "desktop";
    await page.screenshot({ path: fileURLToPath(new URL(prefixo + "-revisoes.png", evidence)), fullPage: true });
    const largura = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
    assert.ok(largura[0] <= largura[1], prefixo + " possui overflow");

    await panel.getByRole("combobox", { name: "Mostrar" }).selectOption("concluidas");
    await panel.getByText("Sem revisões medidas.").waitFor();
    await panel.getByRole("combobox", { name: "Mostrar" }).selectOption("hoje");
    await panel.getByRole("button", { name: "Revisar Direitos fundamentais" }).click();
    await page.getByRole("button", { name: "Cancelar", exact: true }).click();
    await panel.getByRole("button", { name: "Revisar Direitos fundamentais" }).click();
    await page.getByRole("spinbutton", { name: "Acertos" }).fill("7");
    await page.getByRole("spinbutton", { name: "Erros" }).fill("3");
    await page.getByRole("button", { name: "Registrar conclusão" }).click();
    await panel.getByRole("combobox", { name: "Mostrar" }).selectOption("concluidas");
    await panel.getByText("70.0% em 10 respostas válidas.", { exact: false }).last().waitFor();

    await panel.getByRole("combobox", { name: "Mostrar" }).selectOption("hoje");
    await panel.getByLabel("Preferência de data para Administração pública").fill("2027-01-05");
    await panel.getByRole("combobox", { name: "Mostrar" }).selectOption("proximas");
    await panel.getByText("Data existente preservada.", { exact: false }).first().waitFor();
    await page.getByRole("button", { name: "Calendário", exact: true }).click();
    await panel.getByRole("combobox", { name: "Visualização" }).selectOption("30");
    await panel.getByRole("button", { name: /05\/01/ }).click();
    await panel.getByText("Aula de controle de constitucionalidade", { exact: false }).waitFor();
    await panel.getByRole("combobox", { name: "Visualização" }).selectOption("1");
    await panel.getByLabel("Dia da agenda").fill("2027-01-10");
    await panel.getByText("Descanso · 0 min").waitFor();

    await panel.getByText("Configurar disponibilidade e retenção", { exact: true }).click();
    await panel.getByLabel("Início da janela").fill("19:00");
    await panel.getByLabel("Fim da janela").fill("18:00");
    await panel.getByRole("button", { name: "Recalcular agenda" }).click();
    await panel.getByRole("alert").waitFor();
    await panel.getByLabel("Fim da janela").fill("20:00");
    await panel.getByRole("spinbutton", { name: "Revisões por dia" }).fill("0");
    await panel.getByRole("button", { name: "Recalcular agenda" }).click();
    await panel.getByText("7 dias · Sobrecarga", { exact: true }).waitFor();
    await page.screenshot({ path: fileURLToPath(new URL(prefixo + "-calendario.png", evidence)), fullPage: true });
    assert.deepEqual(erros, []);
    assert.deepEqual(externas, []);
    await context.close();
    console.log(prefixo + ": fluxos, largura e isolamento aprovados");
  }
  const context = await browser.newContext({ serviceWorkers: "block" });
  const conta = { id: "00000000-0000-4000-8000-000000000101", aud: "authenticated", role: "authenticated",
    email: "sintetico@example.invalid", app_metadata: {}, user_metadata: { nome: "Conta sintética" } };
  const ontem = new Date(Date.now() - 86_400_000).toISOString();
  const config = { nomeUsuario: "Conta sintética", concurso: "Demonstração", bancaPadrao: "",
    metaQuestoesDiaria: 10, metaMinutosDiaria: 90, metaRevisoesDiaria: 5, planoPadraoAtivo: false, tema: "escuro" };
  const materias = [{ id: "mat", nome: "Direito de teste", assuntos: [
    { id: "tema", nome: "Tema sintético vinculado", prioridade: "alta", concluido: true },
  ] }];
  const sessoes = testarCheckpoint ? [] : [{ id: "aula", data: ontem, finalizadaEm: ontem, tipo: "aula", materia: "Direito de teste",
    materiaId: "mat", assunto: "Tema sintético vinculado", assuntoId: "tema", minutos: 15, conteudoConcluido: true }];
  const dados = { appState: { schemaVersion: 18, versao: 18, materias, sessoes, configuracoes: config,
    revisoes: [], questoes: [], simulados: [], bancoQuestoes: [], simuladosGerados: [],
    missoesConcluidas: [], salvoEm: ontem, syncRevision: 1 } };
  let syncFsrs = { revisao: 0, revisaoEventos: 0, eventos: [], checkpoint: null };
  await context.route("**/*", async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    if (url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/auth/v1/")) {
      if (testarSync && url.pathname === "/rest/v1/rpc/sincronizar_fsrs_v1") {
        const req = route.request().postDataJSON();
        assert.equal(req.p_usuario, conta.id);
        assert.equal(req.p_epoca, "inicial");
        const eventos = [...new Map([...syncFsrs.eventos, ...req.p_eventos].map(e => [JSON.stringify(e), e])).values()];
        const houveEventos = eventos.length !== syncFsrs.eventos.length;
        const revisaoEventos = syncFsrs.revisaoEventos + Number(houveEventos);
        let resultado = "ok";
        let checkpoint = houveEventos ? null : syncFsrs.checkpoint;
        if (req.p_checkpoint && (req.p_revisao !== syncFsrs.revisao || req.p_revisao_eventos !== revisaoEventos ||
            req.p_checkpoint.revisaoLegado !== dados.appState.syncRevision)) resultado = "conflito";
        if (req.p_checkpoint && resultado === "ok") checkpoint = req.p_checkpoint;
        syncFsrs = { eventos, revisaoEventos, checkpoint,
          revisao: syncFsrs.revisao + Number(houveEventos || (!!req.p_checkpoint && resultado === "ok")) };
        return route.fulfill({ json: { ...syncFsrs, resultado, revisaoLegado: dados.appState.syncRevision } });
      }
      if (url.pathname === "/rest/v1/rpc/salvar_estado_app_cas") {
        const { p_expected_revision, p_estado } = route.request().postDataJSON();
        if (p_expected_revision !== dados.appState.syncRevision)
          return route.fulfill({ json: [{ ok: false, revisao_atual: dados.appState.syncRevision }] });
        dados.appState = { ...p_estado, syncRevision: p_expected_revision + 1 };
        return route.fulfill({ json: [{ ok: true, revisao_atual: dados.appState.syncRevision }] });
      }
      const json = url.pathname === "/rest/v1/configuracoes" ? [{ user_id: conta.id, dados }] :
        url.pathname === "/rest/v1/rpc/meu_contexto_comercial" ? { acesso_permitido: true } :
        url.pathname === "/auth/v1/user" ? conta : [];
      return route.fulfill({ json });
    }
    return route.continue();
  });
  await context.addInitScript(({ conta, config, materias, sessoes }) => {
    localStorage.setItem("sb-127-auth-token", JSON.stringify({ user: conta, access_token: "synthetic",
      refresh_token: "synthetic", expires_at: Math.floor(Date.now() / 1000) + 3600, token_type: "bearer" }));
    for (const [chave, dados] of Object.entries({ configuracoes: config, materias, sessoes }))
      localStorage.setItem(`pmpe:${conta.id}:${chave}`, JSON.stringify(dados));
  }, { conta, config, materias, sessoes });
  const page = await context.newPage();
  if (testarCheckpoint) {
    await page.goto(origin + "/central-estudos", { waitUntil: "networkidle" });
    const porOpcao = nome => page.locator("select").filter({ has: page.getByRole("option", { name: nome, exact: true }) });
    await porOpcao("Direito de teste").selectOption("mat");
    await porOpcao("Tema sintético vinculado").selectOption({ label: "Tema sintético vinculado" });
    await page.getByRole("button", { name: /Iniciar sessão/ }).click();
    await page.getByRole("button", { name: /Finalizar e salvar/ }).click();
    const aula = page.getByRole("dialog", { name: "Finalizar sessão" });
    await aula.getByLabel("Terminou todo o conteúdo planejado desta aula?").selectOption("sim");
    await aula.getByRole("button", { name: "Salvar sessão" }).click();
    await aula.waitFor({ state: "hidden" });
    for (let tentativa = 0; !dados.appState.sessoes.length && tentativa < 50; tentativa++)
      await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(dados.appState.sessoes.some(item => item.tipo === "aula" && item.conteudoConcluido));
  }
  await page.goto(origin + "/revisoes", { waitUntil: "networkidle" });
  const panel = page.getByRole("region", { name: "Planejamento adaptativo" });
  await panel.getByRole("combobox", { name: "Mostrar" }).selectOption("todas");
  await panel.getByRole("button", { name: "Revisar Tema sintético vinculado" }).click();
  await page.waitForURL("**/central-estudos");
  await page.getByText("Tema sintético vinculado", { exact: true }).first().waitFor();
  await page.screenshot({ path: fileURLToPath(new URL("central-autenticada.png", evidence)), fullPage: true });
  await page.getByRole("button", { name: /Iniciar sessão/ }).click();
  await page.getByRole("button", { name: /Finalizar e salvar/ }).click();
  const finalizacao = page.getByRole("dialog", { name: "Finalizar sessão" });
  await finalizacao.getByLabel("Questões realizadas").fill("10");
  await finalizacao.getByLabel("Acertos", { exact: true }).fill("8");
  await finalizacao.getByRole("button", { name: "Salvar sessão" }).click();
  await finalizacao.waitFor({ state: "hidden" });
  await page.goBack();
  await panel.getByRole("combobox", { name: "Mostrar" }).selectOption("concluidas");
  await panel.getByText("80.0% em 10 respostas válidas.", { exact: false }).waitFor();
  if (testarSync) {
    await panel.getByText(/Diário compartilhado · online · 0 pendente/).waitFor();
    for (let tentativa = 0; dados.appState.sessoes.length < 2 && tentativa < 50; tentativa++)
      await new Promise(resolve => setTimeout(resolve, 100));
    // Um foco força pull da revisão oficial já reconhecida pelo CAS do fixture.
    const atualizou = page.waitForResponse(response => response.url().includes("/rpc/sincronizar_fsrs_v1") && response.ok());
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await atualizou;
    await panel.getByRole("button", { name: "Confirmar checkpoint compartilhado" }).click();
    await panel.getByText("Checkpoint compartilhado confirmado.", { exact: true }).waitFor();
    assert.equal(syncFsrs.eventos.length, 2);
    assert.equal(syncFsrs.checkpoint.avaliados.length, 1);
    await panel.getByText(/Agenda compartilhada de/).waitFor();
    console.log("Conta sintética: ponte AppContext, sincronização de eventos e checkpoint compartilhado aprovados.");
  }
  if (testarCheckpoint) {
    const salvar = panel.getByRole("button", { name: "Salvar checkpoint local" });
    await salvar.click();
    const atual = panel.getByText("Checkpoint local · revisão 1", { exact: true });
    await atual.waitFor();
    await salvar.click();
    await atual.waitFor();
    for (let tentativa = 0; dados.appState.sessoes.length < 2 && tentativa < 50; tentativa++)
      await new Promise(resolve => setTimeout(resolve, 100));
    assert.ok(dados.appState.sessoes.length >= 2, "a sessão foi gravada no CAS sintético");
    await page.reload({ waitUntil: "networkidle" });
    await atual.waitFor();
    await panel.getByRole("combobox", { name: "Mostrar" }).selectOption("concluidas");
    await panel.getByText("80.0% em 10 respostas válidas.", { exact: false }).waitFor();

    const aba = await context.newPage();
    await aba.goto(origin + "/revisoes", { waitUntil: "networkidle" });
    await aba.getByText("Checkpoint local · revisão 1", { exact: true }).waitFor();
    // Duas bases iguais e propostas diferentes. Só uma pode avançar.
    for (const [tela, valor] of [[page, "92"], [aba, "93"]]) {
      const bloco = tela.getByRole("region", { name: "Planejamento adaptativo" });
      await bloco.getByText("Configurar disponibilidade e retenção", { exact: true }).click();
      await bloco.getByRole("spinbutton", { name: "Retenção desejada (%)" }).fill(valor);
      await bloco.getByRole("button", { name: "Recalcular agenda" }).click();
    }
    await Promise.all([salvar.click(), aba.getByRole("button", { name: "Salvar checkpoint local" }).click()]);
    const resultados = await Promise.all([page, aba].map(tela => tela.waitForFunction(() =>
      document.body.textContent.includes("Checkpoint local · revisão 2") ? "gravado" :
        document.body.textContent.includes("Outra aba salvou uma versão diferente") ? "conflito" : null)));
    assert.deepEqual((await Promise.all(resultados.map(r => r.jsonValue()))).sort(), ["conflito", "gravado"]);
    await aba.close();
    await page.reload({ waitUntil: "networkidle" });
    await panel.getByText("Checkpoint local · revisão 2", { exact: true }).waitFor();
    await panel.getByRole("combobox", { name: "Mostrar" }).selectOption("todas");
    const preferencia = panel.getByLabel("Preferência de data para Tema sintético vinculado");
    const fim = await preferencia.getAttribute("max");
    assert.ok(fim);
    await preferencia.fill(fim);
    await panel.getByText("Data existente preservada.", { exact: false }).waitFor();
    await salvar.click();
    await panel.getByText("Checkpoint local · revisão 3", { exact: true }).waitFor();
    await page.reload({ waitUntil: "networkidle" });
    await panel.getByRole("combobox", { name: "Mostrar" }).selectOption("todas");
    assert.equal(await preferencia.inputValue(), fim);

    const verifica = await page.evaluate(async ({ usuarioId, fim }) => {
      const { transporteFsrsLocal } = await import("/src/services/inteligenciaRevisao/checkpointLocal.ts");
      const escopo = { usuarioId, epoca: "inicial" };
      const anterior = await transporteFsrsLocal.ler(escopo);
      let abortou = false;
      try {
        await transporteFsrsLocal.confirmar({
          ...anterior.checkpoint,
          revisaoLegado: 1,
          // Simula falha após a leitura mas antes do commit da transação.
          naoClonavel: () => null,
        }, anterior.revisao);
      } catch {
        abortou = true;
      }
      const depois = await transporteFsrsLocal.ler(escopo);
      return { abortou, revisao: depois?.revisao,
        novoDia: depois?.checkpoint.agendamentos.some(a => a.agendada === fim),
        dataReidratada: depois?.checkpoint.estados.some(e => e.cartao?.dueAt instanceof Date) };
    }, { usuarioId: conta.id, fim });
    assert.deepEqual(verifica, { abortou: true, revisao: 3, novoDia: true, dataReidratada: true });
  }
  await panel.getByText("Configurar disponibilidade e retenção", { exact: true }).click();
  await panel.getByRole("spinbutton", { name: "Retenção desejada (%)" }).fill("91");
  await panel.getByRole("button", { name: "Recalcular agenda" }).click();
  await panel.getByText("7 dias", { exact: false }).first().waitFor();
  await page.goto(origin + "/calendario", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Agenda adaptativa" }).waitFor();
  await panel.getByText("Configurar disponibilidade e retenção", { exact: true }).click();
  assert.equal(await panel.getByRole("spinbutton", { name: "Retenção desejada (%)" }).inputValue(), "91");
  await context.close();
  console.log("conta sintética: Revisões → Central de Estudos → conclusão → histórico e Calendário aprovados");
} finally {
  await browser.close();
}
