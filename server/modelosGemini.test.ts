import assert from "node:assert/strict";
import test from "node:test";
import { parametrosExtracaoGemini, resolverModelosGemini } from "./modelosGemini.ts";

test("prova e edital usam os mesmos modelos atuais, inclusive com ambiente vazio", () => {
  assert.deepEqual(resolverModelosGemini({}), {
    modelo: "gemini-3.1-flash-lite", modeloFallback: "gemini-3.6-flash",
  });
  assert.deepEqual(resolverModelosGemini({ GEMINI_MODEL: " ", GEMINI_FALLBACK_MODEL: " " }), resolverModelosGemini({}));
});

test("override legado do Render não recoloca o modelo indisponível em produção", () => {
  assert.equal(resolverModelosGemini({ GEMINI_FALLBACK_MODEL: "gemini-2.5-flash" }).modeloFallback, "gemini-3.6-flash");
  assert.equal(resolverModelosGemini({ GEMINI_MODEL: " models/gemini-2.5-flash " }).modelo, "gemini-3.6-flash");
});

test("preserva modelos personalizados e normaliza prefixo da API", () => {
  assert.deepEqual(resolverModelosGemini({ GEMINI_MODEL: " models/primario ", GEMINI_FALLBACK_MODEL: "reserva" }), {
    modelo: "primario", modeloFallback: "reserva",
  });
});

test("migração não envia temperature rejeitada pelos modelos 3.6 e 3.7", () => {
  assert.deepEqual(parametrosExtracaoGemini("gemini-3.1-flash-lite"), { temperature: 0 });
  assert.deepEqual(parametrosExtracaoGemini("gemini-3.6-flash"), {});
  assert.deepEqual(parametrosExtracaoGemini("gemini-3.7-flash"), {});
});
