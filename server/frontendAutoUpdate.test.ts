import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("frontend detecta deploy novo e recarrega a aba apenas uma vez", async () => {
  const [main, vite, vercel] = await Promise.all([
    readFile("src/main.tsx", "utf8"),
    readFile("vite.config.ts", "utf8"),
    readFile("vercel.json", "utf8"),
  ]);

  assert.match(main, /verificarNovaVersao/);
  assert.match(main, /visibilitychange/);
  assert.match(main, /version\.json/);
  assert.match(main, /window\.location\.reload\(\)/);
  assert.match(main, /study-pro:version-reload/);

  assert.match(vite, /fileName: "version\.json"/);
  assert.match(vite, /version: versaoApp/);

  const config = JSON.parse(vercel);
  const versionHeader = config.headers.find(
    (item: { source?: string }) =>
      item.source === "/version.json"
  );
  const htmlHeader = config.headers.find(
    (item: { source?: string }) =>
      item.source === "/index.html"
  );

  assert.ok(versionHeader);
  assert.ok(htmlHeader);
  assert.match(
    JSON.stringify(versionHeader),
    /no-cache, no-store, must-revalidate/
  );
  assert.match(
    JSON.stringify(htmlHeader),
    /no-cache, no-store, must-revalidate/
  );
});
