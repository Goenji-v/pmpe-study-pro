import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build gera source maps e remove os mapas do deploy público", async () => {
  const [vite, pacote, upload] = await Promise.all([
    readFile("vite.config.ts", "utf8"),
    readFile("package.json", "utf8"),
    readFile("scripts/upload-sentry-sourcemaps.mjs", "utf8"),
  ]);

  assert.match(vite, /sourcemap:\s*true/);
  assert.match(vite, /__SENTRY_RELEASE__/);
  assert.match(
    pacote,
    /node scripts\/upload-sentry-sourcemaps\.mjs/
  );
  assert.match(upload, /SENTRY_AUTH_TOKEN/);
  assert.match(upload, /VITE_SENTRY_DSN/);
  assert.match(upload, /resolverOrganizacao/);
  assert.match(upload, /dsn\.hostname\.match/);
  assert.doesNotMatch(
    upload,
    /https:\/\/sentry\.io\/api\/0\/organizations\/$/
  );
  assert.match(upload, /study-pro-web/);
  assert.match(upload, /limparSourceMapsDoDeploy/);
  assert.match(upload, /sourceMappingURL/);
  assert.match(upload, /VERCEL_ENV !== "production"/);
  assert.match(
    upload,
    /projects\/\$\{encodeURIComponent\(orgIdOrSlug\)\}/
  );
});

test("frontend usa a mesma release sem voltar o Sentry para o bundle inicial", async () => {
  const codigo = await readFile("src/lib/sentry.ts", "utf8");

  assert.match(codigo, /release:/);
  assert.match(codigo, /__SENTRY_RELEASE__/);
  assert.match(codigo, /tunnel:\s*sentryTunnel/);
  assert.match(codigo, /import\("@sentry\/react"\)/);
  assert.doesNotMatch(codigo, /import \* as Sentry from "@sentry\/react"/);
});
