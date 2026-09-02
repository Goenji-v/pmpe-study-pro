import assert from "node:assert/strict";
import test from "node:test";

import {
  executarComFallbackGemini,
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

test("troca para o modelo reserva depois de erro 503", async () => {
  const chamadas: string[] = [];
  const trocas: string[] = [];

  const resultado = await executarComFallbackGemini(
    async (modelo) => {
      chamadas.push(modelo);
      if (modelo === "primario") throw erroComStatus(503);
      return "ok";
    },
    {
      rotulo: "questões 1 a 10",
      modelos: ["primario", "reserva"],
      tentativasPorModelo: [2, 3],
      atrasosMs: [0],
      esperar: async () => undefined,
      aoTrocarModelo: ({ modeloAnterior, modeloSeguinte }) => {
        trocas.push(`${modeloAnterior}->${modeloSeguinte}`);
      },
    }
  );

  assert.equal(resultado, "ok");
  assert.deepEqual(chamadas, ["primario", "primario", "reserva"]);
  assert.deepEqual(trocas, ["primario->reserva"]);
});

test("não usa o modelo reserva quando o erro é de limite", async () => {
  const chamadas: string[] = [];

  await assert.rejects(
    executarComFallbackGemini(
      async (modelo) => {
        chamadas.push(modelo);
        throw erroComStatus(429);
      },
      {
        rotulo: "gabarito",
        modelos: ["primario", "reserva"],
        esperar: async () => undefined,
      }
    ),
    /limite de uso do Gemini/
  );

  assert.deepEqual(chamadas, ["primario"]);
});

function erroModeloIndisponivel() {
  return Object.assign(new Error(JSON.stringify({ error: {
    code: 404, status: "NOT_FOUND",
    message: "This model models/gemini-2.5-flash is no longer available to new users. Please update your code to use models/gemini-3.6-flash.",
  } })), { status: 404 });
}

test("404 de modelo indisponível troca imediatamente sem repetir o modelo removido", async () => {
  const chamadas: string[] = [];
  const esperas: number[] = [];
  const resultado = await executarComFallbackGemini(async (modelo) => {
    chamadas.push(modelo);
    if (modelo === "antigo") throw erroModeloIndisponivel();
    return { itens: [{ numero: 1, resposta: "E" }] };
  }, {
    rotulo: "gabarito", modelos: ["antigo", "atual"],
    esperar: async (ms) => { esperas.push(ms); },
  });
  assert.deepEqual(chamadas, ["antigo", "atual"]);
  assert.deepEqual(esperas, []);
  assert.equal(resultado.itens[0].resposta, "E");
});

test("quando todos os modelos falham, informa indisponibilidade sem expor o JSON do provedor", async () => {
  let chamadas = 0;
  await assert.rejects(executarComFallbackGemini(async () => {
    chamadas += 1;
    throw erroModeloIndisponivel();
  }, { rotulo: "gabarito", modelos: ["primario", "reserva"] }), (erro: unknown) => {
    assert.ok(erro instanceof Error);
    assert.match(erro.message, /modelo de IA está indisponível/);
    assert.doesNotMatch(erro.message, /\{"error"|models\/gemini/);
    assert.equal(obterStatusErro(erro), 404);
    return true;
  });
  assert.equal(chamadas, 2);
});

test("404 de arquivo, autenticação e entrada inválida não provocam troca de modelo", async () => {
  for (const erro of [Object.assign(new Error("File not found"), { status: 404 }), erroComStatus(400), erroComStatus(401), erroComStatus(403)]) {
    const chamadas: string[] = [];
    await assert.rejects(executarComFallbackGemini(async (modelo) => {
      chamadas.push(modelo);
      throw erro;
    }, { rotulo: "gabarito", modelos: ["primario", "reserva"] }));
    assert.deepEqual(chamadas, ["primario"]);
  }
});
