import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import test from "node:test";
import { frontendStaging, geminiDesativadoNoStaging, validateBackend } from "./backendEnvironment";
import { stagingSupabase } from "../scripts/previewEnvironment";

const payload = Buffer.from(JSON.stringify({ ref: "isjzyyoqvftrltkctanw", role: "anon" })).toString("base64url");
const staging = {
  RENDER_SERVICE_ID: "srv-damnctou01pc7389opcg", RENDER_GIT_BRANCH: "preview/fsrs-revisoes-20261123",
  SUPABASE_URL: stagingSupabase, SUPABASE_ANON_KEY: `fixture.${payload}.fixture`,
  FRONTEND_URL: frontendStaging, STAGING_GEMINI_DISABLED: "true",
};

test("desativação explícita só afeta staging e preserva validações de isolamento", () => {
  assert.equal(geminiDesativadoNoStaging({ STAGING_GEMINI_DISABLED: "true", NODE_ENV: "production" }), false);
  assert.equal(geminiDesativadoNoStaging({ ...staging, STAGING_GEMINI_DISABLED: "1" }), false);
  assert.doesNotThrow(() => validateBackend(staging, "24.0.0"));
  for (const override of [{ SUPABASE_URL: "https://production.invalid" }, { SUPABASE_ANON_KEY: "" },
    { FRONTEND_URL: "https://production.invalid" }, { RENDER_GIT_BRANCH: "main" }, { SENTRY_DSN: "fixture" }]) {
    assert.throws(() => validateBackend({ ...staging, ...override }, "24.0.0"));
  }
  assert.throws(() => validateBackend(staging, "20.0.0"));
});

test("Gemini ativo distingue ausência, fingerprint incorreto e override de endpoint", () => {
  const ativo = { ...staging, STAGING_GEMINI_DISABLED: "false" };
  const credencial = "synthetic";
  const hash = createHash("sha256").update(credencial).digest("hex");
  assert.throws(() => validateBackend(ativo, "24.0.0"), /credencial Gemini ausente/);
  assert.throws(() => validateBackend({ ...ativo, GEMINI_API_KEY: credencial }, "24.0.0"), /hexadecimal válido/);
  assert.throws(() => validateBackend({ ...ativo, GEMINI_API_KEY: credencial, STAGING_GEMINI_KEY_SHA256: "0".repeat(64) }, "24.0.0"),
    /não corresponde/);
  const completo = { ...ativo, GEMINI_API_KEY: credencial, STAGING_GEMINI_KEY_SHA256: ` ${hash.toUpperCase()} ` };
  assert.doesNotThrow(() => validateBackend(completo, "24.0.0"));
  assert.throws(() => validateBackend({ ...completo, GOOGLE_GEMINI_BASE_URL: "https://endpoint.invalid" }, "24.0.0"), /overrides/);
});

async function portaLivre() {
  const s = createServer().listen(0, "127.0.0.1");
  await once(s, "listening");
  const endereco = s.address();
  assert.ok(endereco && typeof endereco !== "string");
  await new Promise<void>((resolve, reject) => s.close(erro => erro ? reject(erro) : resolve()));
  return endereco.port;
}

test("proxy e API reais sobem sem Gemini e bloqueiam geração, fallback e retomada", { timeout: 45_000 }, async t => {
  const porta = await portaLivre();
  let interna = await portaLivre();
  while (interna === porta) interna = await portaLivre();
  const preload = `
    globalThis.fetch = async (input, init) => {
      const url = new URL(String(input));
      if (url.origin === ${JSON.stringify(stagingSupabase)}) {
        if (url.pathname === "/auth/v1/user") return Response.json({ id: "sintetico" });
        if (url.pathname === "/rest/v1/rpc/sou_admin") return Response.json(true);
        if (url.pathname === "/rest/v1/geracoes_ia_jobs" && (!init?.method || init.method === "GET")) {
          const id = url.searchParams.get("request_id")?.slice(3) || "revisao-pendente";
          const concluida = id.endsWith("concluida");
          return Response.json([{ request_id: id, status: concluida ? "concluida" : "fila",
            etapa: concluida ? "concluida" : "fila", payload: id.startsWith("simulado-pdf-") ? { tipo: "simulado_pdf" } : {}, resultado: concluida ? { ok: true } : null }]);
        }
      }
      console.error("REQUISICAO_NAO_AUTORIZADA_NO_TESTE");
      throw new Error("Bloqueado pelo teste.");
    };
  `;
  const filho = spawn(process.execPath, ["--import", "tsx", "--import", "data:text/javascript," + encodeURIComponent(preload),
    "server/secureEntry.ts"], {
    env: { ...process.env, ...staging, PORT: String(porta), INTERNAL_API_PORT: String(interna),
      GEMINI_API_KEY: "", STAGING_GEMINI_KEY_SHA256: "", SENTRY_DSN: "", GOOGLE_GEMINI_BASE_URL: "https://bloqueado.invalid" },
    stdio: ["ignore", "pipe", "pipe"], windowsHide: true,
  });
  const terminou = once(filho, "exit");
  t.after(async () => { if (filho.exitCode === null) filho.kill(); await terminou; });
  let logs = "";
  filho.stderr.on("data", dados => { logs += String(dados); });
  filho.stdout.on("data", dados => { logs += String(dados); });
  const url = `http://127.0.0.1:${porta}`;
  const headers = { Authorization: "Bearer synthetic", Origin: frontendStaging, "Content-Type": "application/json" };
  const chamar = (caminho: string, method = "GET") => fetch(url + "/api/" + caminho, { method, headers, signal: AbortSignal.timeout(3000) });
  for (let i = 0; i < 550 && !logs.includes("Proxy seguro da API online") && filho.exitCode === null; i++)
    await new Promise(resolve => setTimeout(resolve, 50));
  assert.ok(logs.includes("Proxy seguro da API online"), JSON.stringify({ logs, exitCode: filho.exitCode }));
  assert.deepEqual(await (await chamar("saude")).json(), { ok: true });
  for (const rota of ["analisar-edital", "analisar-curso-midia", "gerar", "coach", "cronograma",
    "analisar-prova", "geracoes", "simulados-pdf/jobs"]) {
    const resposta = await chamar(rota, "POST");
    assert.equal(resposta.status, 503, rota);
    assert.equal((await resposta.json()).codigo, "GEMINI_DESATIVADO_STAGING", rota);
  }
  assert.equal((await chamar("modelos")).status, 503);
  assert.equal((await chamar("geracoes/revisao-pendente")).status, 503);
  assert.equal((await chamar("geracoes/revisao-concluida")).status, 200);
  assert.equal((await chamar("geracoes")).status, 200);
  assert.equal((await chamar("simulados-pdf/jobs/simulado-pdf-pendente")).status, 503);
  assert.equal((await fetch(url + "/api/coach", { method: "POST" })).status, 401);
  assert.doesNotMatch(logs, /REQUISICAO_NAO_AUTORIZADA_NO_TESTE/);
});
