import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("build gera e envia source maps sem publicá-los", async () => {
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
  assert.match(upload, /study-pro-web/);
  assert.match(upload, /apagarSourceMaps/);
  assert.match(upload, /projects\/\$\{encodeURIComponent\(orgSlug\)\}/);
});

test("frontend associa eventos à mesma release do build", async () => {
  const codigo = await readFile("src/lib/sentry.ts", "utf8");

  assert.match(codigo, /release:\s*__SENTRY_RELEASE__/);
  assert.match(codigo, /tunnel:\s*sentryTunnel/);
});
