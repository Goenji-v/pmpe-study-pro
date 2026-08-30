import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const vercelConfig = JSON.parse(
  readFileSync(new URL("../vercel.json", import.meta.url), "utf8")
) as {
  headers?: Array<{
    headers?: Array<{ key?: string; value?: string }>;
  }>;
};

function obterCsp() {
  const csp = vercelConfig.headers
    ?.flatMap((regra) => regra.headers ?? [])
    .find((cabecalho) => cabecalho.key === "Content-Security-Policy")
    ?.value;

  assert.ok(csp, "Content-Security-Policy precisa estar configurada");
  return csp;
}

test("CSP bloqueia execução e incorporação não autorizadas", () => {
  const csp = obterCsp();

  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /script-src 'self'/);
  assert.match(csp, /script-src-attr 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /frame-src 'none'/);
  assert.match(csp, /form-action 'self'/);
  assert.doesNotMatch(csp, /'unsafe-eval'/);
});

test("CSP permite somente as conexões externas necessárias ao app", () => {
  const csp = obterCsp();

  assert.match(
    csp,
    /connect-src 'self' https:\/\/kibnmdwabpiwyprkrhvq\.supabase\.co wss:\/\/kibnmdwabpiwyprkrhvq\.supabase\.co https:\/\/pmpe-study-pro-api\.onrender\.com/
  );
});

test("CSP mantém compatibilidade com estilos e recursos gerados no navegador", () => {
  const csp = obterCsp();

  assert.match(csp, /style-src 'self' 'unsafe-inline'/);
  assert.match(csp, /img-src 'self' data: blob: https:/);
  assert.match(csp, /worker-src 'self' blob:/);
  assert.match(csp, /upgrade-insecure-requests/);
});
