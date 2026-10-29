import assert from "node:assert/strict";
import { test } from "node:test";
import { mensagemErroPublica } from "./erroPublico.ts";

test("erros internos não vazam detalhes de fornecedores", () => {
  for (const status of [500, 502, 503, 429]) {
    const mensagem = mensagemErroPublica(status);
    assert.ok(mensagem.length > 0);
    assert.doesNotMatch(mensagem, /supabase|gemini|token|api.?key/i);
  }
});
test("limites e indisponibilidade preservam mensagens próprias", () => {
  assert.match(mensagemErroPublica(429), /Aguarde/);
  assert.match(mensagemErroPublica(503), /indisponível/);
});
