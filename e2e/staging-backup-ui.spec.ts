import { expect, test } from "@playwright/test";

// Browser interaction test with mocked transport. No real user, JWT or database
// write. Independent HTTP/JWT and SQL integration tests are documented in PR #562.
const endpoint = "https://isjzyyoqvftrltkctanw.supabase.co";
const userId = "11111111-3333-4333-8333-111111111111";
const backupId = "22222222-3333-4333-8333-222222222222";
const now = new Date().toISOString();
const config = {
  nomeUsuario: "Aluno E2E fictício", concurso: "", bancaPadrao: "",
  metaQuestoesDiaria: 30, metaMinutosDiaria: 120,
  metaRevisoesDiaria: 5, missoesPorDia: 1,
  tema: "escuro", planoPadraoAtivo: false, armazenamentoPorConta: true,
};
function state(revision: number) {
  return {
    schemaVersion: 18, versao: 18, materias: [], questoes: [], sessoes: [],
    revisoes: [], simulados: [], bancoQuestoes: [], simuladosGerados: [],
    missoesConcluidas: [], configuracoes: config, syncRevision: revision,
    salvoEm: now, atualizadoEm: now,
  };
}
function fixtureSession() {
  const user = {
    id: userId, aud: "authenticated", role: "authenticated",
    email: "study-pro-fixture@example.invalid",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { nome: "Aluno E2E fictício" },
    created_at: now, last_sign_in_at: now, identities: [],
  };
  const b64 = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return {
    access_token: b64({ alg: "none", typ: "JWT" }) + "." +
      b64({ sub: userId, role: "authenticated", exp: Math.floor(Date.now() / 1000) + 3600 }) + ".test",
    refresh_token: "fixture-refresh-token", token_type: "bearer",
    expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };
}

test("prévia staging: botão de backup usa RPC CAS protegida por meio da interface", async ({ page }) => {
  test.setTimeout(60_000);
  const target = new URL(process.env.E2E_BASE_URL ?? "");
  if (process.env.E2E_LOCAL_STAGING_MOCKS === "true") {
    expect(target.hostname).toBe("127.0.0.1");
    expect(target.port).toBe("4173");
  } else {
    expect(target.hostname).toBe("pmpe-study-9qdvpurh6-pmpe-study-pro.vercel.app");
  }

  let current = state(2);
  const snapshot = state(1);
  let restorationCalls = 0;
  let wrongWriteCalls = 0;

  await page.addInitScript(({ key, session }) => {
    window.localStorage.setItem(key, JSON.stringify(session));
  }, {
    key: "sb-isjzyyoqvftrltkctanw-auth-token",
    session: fixtureSession(),
  });

  // Intercept ALL staging URLs: the test never contacts staging with a
  // forged JWT and never changes production or the staging database.
  await page.route(endpoint + "/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (status: number, payload: unknown) => route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });

    if (url.pathname.includes("/auth/v1/user")) {
      return json(200, fixtureSession().user);
    }
    if (url.pathname.includes("/auth/v1/")) {
      return json(200, {});
    }
    if (url.pathname.endsWith("/rpc/meu_contexto_comercial")) {
      return json(404, { code: "PGRST202", message: "meu_contexto_comercial unavailable in mocked session" });
    }
    if (url.pathname.endsWith("/rpc/restaurar_backup_cas")) {
      restorationCalls++;
      const body = req.postDataJSON() as Record<string, unknown>;
      expect(body.p_backup_id).toBe(backupId);
      expect(body.p_expected_revision).toBe(2);
      expect(body.p_confirmacao).toBe("CONFIRMO_RESTAURACAO");
      current = { ...snapshot, syncRevision: 3, atualizadoEm: now, salvoEm: now };
      return json(200, [{
        ok: true, revisao_atual: 3,
        backup_seguranca_id: "33333333-3333-4333-8333-333333333333",
        estado_restaurado: current,
      }]);
    }
    if (url.pathname.endsWith("/rpc/salvar_estado_app_cas")) {
      wrongWriteCalls++;
      return json(409, { code: "STAGING_MOCK_REJECTED", message: "unexpected auto-save during backup E2E" });
    }
    if (url.pathname.endsWith("/configuracoes")) {
      if (req.method() === "GET") {
        return json(200, { user_id: userId, dados: { appState: current } });
      }
      wrongWriteCalls++;
      return json(403, { code: "42501", message: "direct writes not allowed" });
    }
    if (url.pathname.endsWith("/backups")) {
      if (req.method() !== "GET") {
        return json(200, []);
      }
      return json(200, [{
        id: backupId, user_id: userId, nome: "Backup E2E fictício",
        created_at: now, dados: {
          tipo: "backup_incremental", syncRevision: 1,
          criadoEm: now, diaLocal: now.slice(0, 10),
          estado: snapshot,
          resumo: { sessoes: 0, questoes: 0, revisoes: 0, simulados: 0, missoesConcluidas: 0 },
        },
      }]);
    }
    return json(200, []);
  });
  await page.route("https://study-pro-staging-api.invalid/**", (route) =>
    route.fulfill({ status: 503, body: "{}" })
  );

  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/backup", { waitUntil: "domcontentloaded" });

  await expect(page.getByRole("heading", { name: /Histórico de segurança/i })).toBeVisible({ timeout: 25_000 });
  await expect(page.getByText("Prévia de testes:", { exact: false })).toBeVisible();

  const restore = page.getByRole("button", { name: "Comparar e restaurar" }).first();
  try {
    await expect(restore).toBeEnabled({ timeout: 8_000 });
  } catch (error) {
    // Debug only: show UI state without outputting session tokens or secrets.
    const summary = await page.locator("body").innerText();
    console.info("STAGING_BACKUP_UI_STATUS:", summary.slice(0, 4800));
    console.info("STAGING_BACKUP_UI_WRITE_COUNTS:", { restorationCalls, wrongWriteCalls });
    throw error;
  }
  await restore.click();
  await expect.poll(() => restorationCalls, { timeout: 15_000 }).toBe(1);
  await expect(page.getByText("Backup da linha do tempo restaurado com segurança.")).toBeVisible();
  expect(wrongWriteCalls).toBe(0);
  expect(pageErrors).toEqual([]);
});
