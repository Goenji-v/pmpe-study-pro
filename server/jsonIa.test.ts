import assert from "node:assert/strict";
import test from "node:test";

import {
  ErroJsonInvalidoIA,
  parsearJsonDaIA,
} from "./jsonIa.ts";

test("interpreta JSON puro", () => {
  assert.deepEqual(parsearJsonDaIA('{"questoes":[]}', "teste"), {
    questoes: [],
  });
});

test("remove cercas de markdown", () => {
  assert.deepEqual(
    parsearJsonDaIA('```json\n{"questoes":[1]}\n```', "teste"),
    { questoes: [1] }
  );
});

test("extrai o primeiro JSON completo quando a IA acrescenta explicação", () => {
  const resposta = 'Segue o resultado:\n{"texto":"chaves { dentro da string }","itens":[1,2]}\nFim.';

  assert.deepEqual(parsearJsonDaIA(resposta, "teste"), {
    texto: "chaves { dentro da string }",
    itens: [1, 2],
  });
});

test("não aceita JSON internamente malformado", () => {
  assert.throws(
    () => parsearJsonDaIA('{"questoes":[}', "questões 1 a 10"),
    (erro) =>
      erro instanceof ErroJsonInvalidoIA &&
      erro.message.includes("questões 1 a 10")
  );
});
