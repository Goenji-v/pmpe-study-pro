import assert from "node:assert/strict";
import test from "node:test";

import { deveExibirPrimeirosPassos } from "../src/utils/primeirosPassos";

test("exibe primeiros passos apenas no dashboard de uma conta sem conteúdo", () => {
  assert.equal(deveExibirPrimeirosPassos({ rota: "/", totalAssuntos: 0, ocultado: false }), true);
  assert.equal(deveExibirPrimeirosPassos({ rota: "/cursos", totalAssuntos: 0, ocultado: false }), false);
  assert.equal(deveExibirPrimeirosPassos({ rota: "/", totalAssuntos: 1, ocultado: false }), false);
  assert.equal(deveExibirPrimeirosPassos({ rota: "/", totalAssuntos: 0, ocultado: true }), false);
});
