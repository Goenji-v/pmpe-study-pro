import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("polling do simulado PDF não consome limite geral da IA", async () => {
  const codigo = await readFile("server/secureEntry.ts", "utf8");

  assert.match(codigo, /req\.method === "GET"/);
  assert.match(
    codigo,
    /req\.path\.startsWith\("\/simulados-pdf\/jobs"\)/
  );
  assert.match(codigo, /if \(consultaLeve\)/);
});
