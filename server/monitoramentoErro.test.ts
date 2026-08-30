import assert from "node:assert/strict";
import test from "node:test";

import {
  criarFingerprintErro,
  descreverAmbiente,
} from "../src/utils/monitoramentoErro";

test("agrupa o mesmo erro mesmo quando ids e números mudam", () => {
  const primeiro = criarFingerprintErro(
    "Falha no recurso abcdef1234567890 durante tentativa 123",
    "/central-estudos"
  );
  const segundo = criarFingerprintErro(
    "Falha no recurso fedcba0987654321 durante tentativa 999",
    "/central-estudos"
  );

  assert.equal(primeiro, segundo);
});

test("rotas diferentes geram fingerprints diferentes", () => {
  assert.notEqual(
    criarFingerprintErro("Falha de rede", "/central-estudos"),
    criarFingerprintErro("Falha de rede", "/simulados")
  );
});

test("identifica ambiente Android Chrome", () => {
  const ambiente = descreverAmbiente(
    "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/151.0.0.0 Mobile Safari/537.36"
  );

  assert.equal(ambiente, "Chrome · Android");
});
