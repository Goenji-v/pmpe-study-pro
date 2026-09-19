import assert from "node:assert/strict";
import test from "node:test";

import {
  descartarEstadoGeracao,
  executarGeracaoIdempotente,
  obterEstadoGeracao,
} from "./geracaoJobs.ts";

test("reutiliza a mesma geração concorrente sem executar cobrança duplicada", async () => {
  let chamadas = 0;
  let liberar!: (valor: string[]) => void;
  const lenta = new Promise<string[]>((resolve) => {
    liberar = resolve;
  });

  const executar = async () => {
    chamadas += 1;
    return lenta;
  };

  const primeira = executarGeracaoIdempotente("usuario:geracao-1", executar);
  const segunda = executarGeracaoIdempotente("usuario:geracao-1", executar);

  assert.equal(chamadas, 1);
  assert.deepEqual(obterEstadoGeracao("usuario:geracao-1"), {
    status: "processando",
  });

  liberar(["ok"]);
  assert.deepEqual(await primeira, ["ok"]);
  assert.deepEqual(await segunda, ["ok"]);
  assert.equal(chamadas, 1);
  assert.deepEqual(obterEstadoGeracao<string[]>("usuario:geracao-1"), {
    status: "concluida",
    resultado: ["ok"],
  });
});

test("uma falha libera o mesmo identificador para tentativa segura", async () => {
  let chamadas = 0;

  await assert.rejects(
    executarGeracaoIdempotente("usuario:geracao-2", async () => {
      chamadas += 1;
      throw new Error("falha temporária");
    }),
    /falha temporária/
  );

  assert.equal(obterEstadoGeracao("usuario:geracao-2"), null);

  const resultado = await executarGeracaoIdempotente(
    "usuario:geracao-2",
    async () => {
      chamadas += 1;
      return ["recuperado"];
    }
  );

  assert.deepEqual(resultado, ["recuperado"]);
  assert.equal(chamadas, 2);
});


test("permite invalidar apenas o resultado rejeitado e reutilizar o mesmo identificador", async () => {
  let chamadas = 0;
  const chave = "usuario:geracao-3:revisao";

  const primeira = await executarGeracaoIdempotente(chave, async () => {
    chamadas += 1;
    return ["revisao-invalida"];
  });

  assert.deepEqual(primeira, ["revisao-invalida"]);
  assert.equal(descartarEstadoGeracao(chave), true);
  assert.equal(obterEstadoGeracao(chave), null);

  const segunda = await executarGeracaoIdempotente(chave, async () => {
    chamadas += 1;
    return ["revisao-corrigida"];
  });

  assert.deepEqual(segunda, ["revisao-corrigida"]);
  assert.equal(chamadas, 2);
});
