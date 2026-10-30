import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("polling do simulado PDF usa limite separado e controlado", async () => {
  const codigo = await readFile("server/secureEntry.ts", "utf8");

  assert.match(codigo, /req\.method === "GET"/);
  assert.match(codigo, /req\.path\.startsWith\("\/simulados-pdf\/jobs"\)/);
  assert.match(codigo, /const limiteConsultaLeve = 1200;/);
  assert.match(codigo, /consultaLeve \? "consulta"/);
  assert.match(codigo, /consultaLeve \? limiteConsultaLeve/);
  assert.match(codigo, /consultaLeve \? janelaConsultaLeveMs/);
  assert.doesNotMatch(codigo, /if \(consultaLeve\)\s*\{\s*res\.locals\.userId/);
});
