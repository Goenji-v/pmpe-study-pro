import assert from "node:assert/strict";
import test from "node:test";

import {
  limparTentativasLogin,
  obterSegundosBloqueioLogin,
  registrarFalhaLogin,
  type ArmazenamentoTentativasLogin,
} from "../src/utils/loginAttemptGuard";

function criarArmazenamento(): ArmazenamentoTentativasLogin {
  const dados = new Map<string, string>();
  return {
    getItem: (chave) => dados.get(chave) ?? null,
    setItem: (chave, valor) => {
      dados.set(chave, valor);
    },
    removeItem: (chave) => {
      dados.delete(chave);
    },
  };
}

test("bloqueia por 60 segundos após cinco falhas seguidas", () => {
  const armazenamento = criarArmazenamento();
  const inicio = 1_000_000;

  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    assert.equal(registrarFalhaLogin(armazenamento, inicio + tentativa * 1000), 0);
  }

  assert.equal(registrarFalhaLogin(armazenamento, inicio + 4000), 60);
  assert.equal(obterSegundosBloqueioLogin(armazenamento, inicio + 4000), 60);
  assert.equal(obterSegundosBloqueioLogin(armazenamento, inicio + 34_000), 30);
});

test("libera automaticamente depois do período de bloqueio", () => {
  const armazenamento = criarArmazenamento();
  const inicio = 2_000_000;

  for (let tentativa = 0; tentativa < 5; tentativa += 1) {
    registrarFalhaLogin(armazenamento, inicio + tentativa * 1000);
  }

  assert.equal(obterSegundosBloqueioLogin(armazenamento, inicio + 65_000), 0);
  assert.equal(registrarFalhaLogin(armazenamento, inicio + 66_000), 0);
});

test("login bem-sucedido pode limpar o contador local", () => {
  const armazenamento = criarArmazenamento();
  registrarFalhaLogin(armazenamento, 10_000);
  registrarFalhaLogin(armazenamento, 11_000);

  limparTentativasLogin(armazenamento);

  for (let tentativa = 0; tentativa < 4; tentativa += 1) {
    assert.equal(registrarFalhaLogin(armazenamento, 20_000 + tentativa * 1000), 0);
  }
});
