import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fonteProcessador = readFileSync(
  new URL("./processarGeracaoPersistente.ts", import.meta.url),
  "utf8"
);

test("job persistente submete o lote a revisão semântica independente", () => {
  assert.match(fonteProcessador, /montarPromptRevisaoQuestoesIA/);
  assert.match(fonteProcessador, /validarLoteRevisado/);
  assert.match(fonteProcessador, /"revisando"/);
  assert.match(fonteProcessador, /"corrigindo"/);
});

test("job só marca concluída depois que o lote revisado passa no validador", () => {
  const indiceValidacao = fonteProcessador.indexOf("validarLoteRevisado(");
  const indiceConcluida = fonteProcessador.indexOf('status: "concluida"');

  assert.ok(indiceValidacao >= 0);
  assert.ok(indiceConcluida > indiceValidacao);
  assert.match(fonteProcessador, /status: "erro"/);
  assert.match(fonteProcessador, /resultado: \{\s*questoes: loteRevisado/s);
});
