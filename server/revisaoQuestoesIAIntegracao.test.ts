import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fonteProcessador = readFileSync(
  new URL("./processarGeracaoPersistente.ts", import.meta.url),
  "utf8"
);

const fonteRevisoes = readFileSync(
  new URL("../src/pages/Revisoes/Revisoes.tsx", import.meta.url),
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


test("revisão abre Questões IA já preenchidas e vinculadas à pendência", () => {
  assert.match(fonteRevisoes, /className="revisao-questoes-ia"/);
  assert.match(fonteRevisoes, /✨ Questões IA/);
  assert.match(fonteRevisoes, /"pmpe:gerar-ia:modo"/);
  assert.match(fonteRevisoes, /"pmpe:gerar-ia:prefill"/);
  assert.match(fonteRevisoes, /CHAVE_ORIGEM_REVISAO_QUESTOES/);
  assert.match(fonteRevisoes, /revisaoId: revisao\.id/);
  assert.match(fonteRevisoes, /navigate\("\/gerar-simulado-ia"\)/);
});
