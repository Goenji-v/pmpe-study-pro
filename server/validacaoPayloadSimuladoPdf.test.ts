import assert from "node:assert/strict";
import test from "node:test";
import { validarPayload } from "./processarSimuladoPdfPersistente.ts";

const prova = { nome: "prova.pdf", base64: "JVBERi0xLjQ=" };
const gabarito = { nome: "gabarito.pdf", base64: "JVBERi0xLjQ=" };

test("rejeita simulado enviado sem PDF de gabarito, inclusive por API", () => {
  assert.throws(() => validarPayload({ tipo: "simulado_pdf", totalInformado: 60, prova }), /gabarito oficial ou comentado/);
  assert.throws(() => validarPayload({ tipo: "simulado_pdf", totalInformado: 60, prova, comentado: null }), /gabarito oficial ou comentado/);
  assert.throws(() => validarPayload({ tipo: "simulado_pdf", totalInformado: 60, prova, comentado: { nome: "vazio.pdf", base64: "" } }), /gabarito oficial ou comentado/);
});

test("aceita prova e gabarito nos limites e preserva ambos os documentos", () => {
  const validado = validarPayload({ tipo: "simulado_pdf", totalInformado: 60, prova, comentado: gabarito });
  assert.equal(validado.totalInformado, 60);
  assert.deepEqual(validado.prova, prova);
  assert.deepEqual(validado.comentado, gabarito);
});

test("impede simulados acima de 200 questões e arquivo sem prova", () => {
  assert.throws(() => validarPayload({ tipo: "simulado_pdf", totalInformado: 201, prova, comentado: gabarito }), /200 questões/);
  assert.throws(() => validarPayload({ tipo: "simulado_pdf", totalInformado: 60, comentado: gabarito }), /caderno/);
});
