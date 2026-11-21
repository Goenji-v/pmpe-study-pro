import { expect, test, type Page } from "@playwright/test";

// Two truly separate Chromium browser contexts share ONLY a fake in-memory
// Supabase server. Tests front-end conflict behavior, not real Auth/JWT/RLS.
const endpoint = "https://isjzyyoqvftrltkctanw.supabase.co";
const userId = "11111111-3333-4333-8333-111111111111";
const backupId = "22222222-3333-4333-8333-222222222222";
const now = new Date().toISOString();
const state = (revision: number) => ({
  schemaVersion: 18, versao: 18, materias: [], questoes: [], sessoes: [],
  revisoes: [], simulados: [], bancoQuestoes: [], simuladosGerados: [],
  missoesConcluidas: [],
  configuracoes: {
    nomeUsuario: "Aluno compartilhado de teste", concurso: "", bancaPadrao: "",
    metaQuestoesDiaria: 30, metaMinutosDiaria: 120,
    metaRevisoesDiaria: 5, missoesPorDia: 1,
    tema: "escuro", planoPadraoAtivo: false, armazenamentoPorConta: true,
  },
  syncRevision: revision, salvoEm: now, atualizadoEm: now,
});
const makeSession = () => {
  const user = {
    id: userId, aud: "authenticated", role: "authenticated",
    email: "study-pro-device-fixture@example.invalid",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { nome: "Aluno compartilhado de teste" },
    created_at: now, last_sign_in_at: now, identities: [],
  };
  const enc = (v: object) => Buffer.from(JSON.stringify(v)).toString("base64url");
  return {
    access_token: enc({ alg: "none" }) + "." +
      enc({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }) + ".mock",
    refresh_token: "browser-fixture-only", token_type: "bearer",
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user,
  };
};

test("dois navegadores: restauração no PC impede sobrescrita obsoleta do celular", async ({ browser }) => {
  test.setTimeout(100_000);
  const target = new URL(process.env.E2E_BASE_URL ?? "");
  expect(process.env.E2E_LOCAL_STAGING_MOCKS).toBe("true");
  expect(target.hostname).toBe("127.0.0.1");
  expect(target.port).toBe("4173");

  // The shared fake DB is the ONLY common resource between contexts.
  let remote = state(2);
  let restoreCalls = 0;
  let directWrites = 0;
  let casWrites = 0;
  const snapshot = state(1);
  const contexts = [await browser.newContext(), await browser.newContext()];
  const pages = [await contexts[0].newPage(), await contexts[1].newPage()];
  try {
    async function install(page: Page) {
      await page.addInitScript(({ key, session }) => {
        window.localStorage.setItem(key, JSON.stringify(session));
      }, {
        key: "sb-isjzyyoqvftrltkctanw-auth-token",
        session: makeSession(),
      });
      await page.route(endpoint + "/**", async route => {
        const req = route.request();
        const url = new URL(req.url());
        const ok = (status: number, data: unknown) => route.fulfill({
          status, contentType: "application/json", body: JSON.stringify(data),
        });
        if (url.pathname.includes("/auth/v1/user")) return ok(200, makeSession().user);
        if (url.pathname.includes("/auth/v1/")) return ok(200, {});
        if (url.pathname.endsWith("/rpc/meu_contexto_comercial"))
          return ok(404, { code: "PGRST202", message: "mock only" });
        if (url.pathname.endsWith("/rpc/salvar_estado_app_cas")) {
          const payload = req.postDataJSON() as {
            p_expected_revision: number;
            p_estado: ReturnType<typeof state>;
          };
          if (payload.p_expected_revision !== remote.syncRevision) {
            return ok(200, [{ ok: false, revisao_atual: remote.syncRevision }]);
          }
          expect(payload.p_estado.syncRevision).toBe(remote.syncRevision + 1);
          remote = payload.p_estado;
          casWrites++;
          return ok(200, [{ ok: true, revisao_atual: remote.syncRevision }]);
        }
        if (url.pathname.endsWith("/rpc/restaurar_backup_cas")) {
          restoreCalls++;
          const payload = req.postDataJSON() as {
            p_expected_revision: number;
            p_backup_id: string;
            p_confirmacao: string;
          };
          expect(payload.p_backup_id).toBe(backupId);
          expect(payload.p_confirmacao).toBe("CONFIRMO_RESTAURACAO");
          if (payload.p_expected_revision !== remote.syncRevision) {
            return ok(200, [{ ok: false, revisao_atual: remote.syncRevision }]);
          }
          remote = { ...snapshot, syncRevision: remote.syncRevision + 1 };
          return ok(200, [{
            ok: true, revisao_atual: remote.syncRevision,
            backup_seguranca_id: "33333333-3333-4333-8333-333333333333",
            estado_restaurado: remote,
          }]);
        }
        if (url.pathname.endsWith("/configuracoes")) {
          if (req.method() === "GET") {
            return ok(200, { user_id: userId, dados: { appState: remote } });
          }
          directWrites++;
          return ok(403, { code: "42501", message: "direct write forbidden" });
        }
        if (url.pathname.endsWith("/backups")) {
          if (req.method() === "GET") {
            return ok(200, [{
              id: backupId, user_id: userId, nome: "Backup compartilhado",
              created_at: now, dados: {
                tipo: "backup_incremental", diaLocal: now.slice(0, 10),
                criadoEm: now, syncRevision: 1, estado: snapshot,
              },
            }]);
          }
          if (req.method() === "POST" && url.searchParams.has("on_conflict"))
            return ok(200, []);
          return ok(403, { code: "42501", message: "unexpected backup write" });
        }
        return ok(200, []);
      });
      await page.route("https://study-pro-staging-api.invalid/**", route =>
        route.fulfill({ status: 503, body: "{}" })
      );
      page.on("dialog", dialog => dialog.accept());
    }
    await install(pages[0]);
    await install(pages[1]);

    // Load the PC first to allow any initial application migration/autosave
    // to settle before the mobile context fetches the shared revision.
    await pages[0].goto("/backup", { waitUntil: "domcontentloaded" });
    const pcButton = pages[0].getByRole("button", { name: "Comparar e restaurar" }).first();
    await expect(pcButton).toBeEnabled({ timeout: 25_000 });
    await pages[1].goto("/backup", { waitUntil: "domcontentloaded" });
    const phoneButton = pages[1].getByRole("button", { name: "Comparar e restaurar" }).first();
    await expect(phoneButton).toBeEnabled({ timeout: 25_000 });

    const revisionBefore = remote.syncRevision;
    await pcButton.click();
    await expect(pages[0].getByText("Backup da linha do tempo restaurado com segurança."))
      .toBeVisible({ timeout: 20_000 });
    expect(remote.syncRevision).toBe(revisionBefore + 1);
    expect(restoreCalls).toBe(1);

    // Mobile still has its older cloud revision. It must refuse the write,
    // without ever invoking the destructive restore RPC again.
    await phoneButton.click();
    await expect(pages[1].getByText(/Outro aparelho alterou o estado na nuvem|Conflito de sincronização/i))
      .toBeVisible({ timeout: 20_000 });
    expect(restoreCalls).toBe(1);
    expect(remote.syncRevision).toBe(revisionBefore + 1);
    expect(directWrites).toBe(0);
    expect(casWrites).toBeGreaterThanOrEqual(0);
  } finally {
    await Promise.all(contexts.map(ctx => ctx.close()));
  }
});
