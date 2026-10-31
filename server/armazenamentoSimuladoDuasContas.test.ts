import assert from "node:assert/strict";
import test from "node:test";
import {
  criarEscopoArmazenamento,
  chaveArmazenamentoConta,
} from "../src/services/armazenamentoConta.ts";

test("simulados PDF de contas isoladas não compartilham chave de rascunho, respostas ou processo", () => {
  const config = { armazenamentoPorConta: true, dadosReiniciadosEm: "" };
  const contaA = criarEscopoArmazenamento("teste-A", config);
  const contaB = criarEscopoArmazenamento("teste-B", config);
  for (const chave of ["simulado-pdf-processo", "simulado-pdf-rascunho", "simulado-pdf-respostas"]) {
    const a = chaveArmazenamentoConta(chave, contaA);
    const b = chaveArmazenamentoConta(chave, contaB);
    assert.notEqual(a, b);
    assert.match(a, /teste-A/);
    assert.match(b, /teste-B/);
  }
});

test("reiniciar dados de uma conta não reutiliza seu cache antigo", () => {
  const anterior = criarEscopoArmazenamento("teste-A", { armazenamentoPorConta:true, dadosReiniciadosEm:"2026-10-01" });
  const atual = criarEscopoArmazenamento("teste-A", { armazenamentoPorConta:true, dadosReiniciadosEm:"2026-10-31" });
  assert.notEqual(chaveArmazenamentoConta("simulado-pdf-processo", anterior), chaveArmazenamentoConta("simulado-pdf-processo", atual));
});
