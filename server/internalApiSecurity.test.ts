import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("proxy público sobrescreve identidade e segredo antes da API interna", async () => {
  const codigo = await readFile("server/secureEntry.ts", "utf8");

  assert.match(codigo, /randomBytes\(32\)\.toString\("hex"\)/);
  assert.match(codigo, /process\.env\.INTERNAL_PROXY_SECRET = segredoProxyInterno/);
  assert.match(codigo, /"x-study-user-id": String\(res\.locals\.userId \|\| ""\)/);
  assert.match(codigo, /"x-supabase-anon-key": anonKeyServidor/);
  assert.match(codigo, /"x-study-internal-secret": segredoProxyInterno/);
  assert.doesNotMatch(
    codigo,
    /req\.header\("x-supabase-anon-key"\)/,
    "O backend não deve confiar na chave Supabase enviada pelo navegador"
  );
});

test("API interna exige segredo, não aceita CORS direto e escuta só loopback", async () => {
  const codigo = await readFile("server/index.ts", "utf8");

  assert.match(codigo, /INTERNAL_PROXY_SECRET/);
  assert.match(codigo, /x-study-internal-secret/);
  assert.match(codigo, /timingSafeEqual/);
  assert.match(codigo, /"127\.0\.0\.1"/);
  assert.doesNotMatch(codigo, /import cors from "cors"/);
  assert.doesNotMatch(codigo, /origin:\s*true/);
});

test("API usa chave Supabase do servidor e protege rota de diagnóstico", async () => {
  const [codigo, render] = await Promise.all([
    readFile("server/index.ts", "utf8"),
    readFile("render.yaml", "utf8"),
  ]);

  assert.match(codigo, /const supabaseServerKey =/);
  assert.match(codigo, /const anonKey = supabaseServerKey/);
  assert.match(codigo, /const chavePublica = supabaseServerKey/);
  assert.match(
    codigo,
    /app\.get\(\s*"\/api\/modelos",\s*exigirAdministrador,/
  );
  assert.match(render, /- key: SUPABASE_ANON_KEY\s+sync: false/);
});

test("endpoint de saúde não expõe modelo nem estado de segredo", async () => {
  const codigo = await readFile("server/index.ts", "utf8");
  const inicio = codigo.indexOf('app.get(\n  "/api/saude"');
  const fim = codigo.indexOf('app.get(\n  "/api/modelos"', inicio);

  assert.ok(inicio >= 0 && fim > inicio);
  const bloco = codigo.slice(inicio, fim);

  assert.match(bloco, /ok:\s*true/);
  assert.doesNotMatch(bloco, /modelo/);
  assert.doesNotMatch(bloco, /chaveCarregada/);
});

test("proxy público envia cabeçalhos defensivos e não cacheia respostas", async () => {
  const codigo = await readFile("server/secureEntry.ts", "utf8");

  assert.match(codigo, /X-Content-Type-Options/);
  assert.match(codigo, /X-Frame-Options/);
  assert.match(codigo, /Referrer-Policy/);
  assert.match(codigo, /Cache-Control", "no-store"/);
});
