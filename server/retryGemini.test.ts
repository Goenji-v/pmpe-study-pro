import assert from "node:assert/strict";
import test from "node:test";

import {
  executarComRetryGemini,
  obterStatusErro,
} from "./retryGemini.ts";

function erroComStatus(status: number) {
  return Object.assign(new Error(`erro ${status}`), { status });
}

test("lê o status exposto pelo SDK do Gemini", () => {
  assert.equal(obterStatusErro(erroComStatus(503)), 503);
  assert.equal(obterStatusErro(new Error("sem status")), null);
});

test("repete erros 503 com espera progressiva", async () => {
  let chamadas = 0;
  const esperas: number[] = [];

  const resultado = await executarComRetryGemini(
    async () => {
      chamadas += 1;
      if (chamadas < 3) throw erroComStatus(503);
      return "ok";
    },
    {
      rotulo: "questões 1 a 10",
      atrasosMs: [2, 5, 10],
      esperar: async (ms) => {
        esperas.push(ms);
      },
    }
  );

  assert.equal(resultado, "ok");
  assert.equal(chamadas, 3);
  assert.deepEqual(esperas, [2, 5]);
});

test("não repete erro 429 de limite", async () => {
  let chamadas = 0;

  await assert.rejects(
    executarComRetryGemini(
      async () => {
        chamadas += 1;
        throw erroComStatus(429);
      },
      {
        rotulo: "gabarito",
        esperar: async () => undefined,
      }
    ),
    /limite de uso do Gemini/
  );

  assert.equal(chamadas, 1);
});

test("explica alta demanda depois de esgotar as tentativas", async () => {
  let chamadas = 0;

  await assert.rejects(
    executarComRetryGemini(
      async () => {
        chamadas += 1;
        throw erroComStatus(503);
      },
      {
        rotulo: "questões 1 a 10",
        maxTentativas: 3,
        atrasosMs: [0],
        esperar: async () => undefined,
      }
    ),
    /alta demanda.*3 tentativas/
  );

  assert.equal(chamadas, 3);
});
