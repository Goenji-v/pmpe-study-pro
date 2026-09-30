import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { gerarPdfE2EControlado } from "./e2eSimuladoPdfTemporario.ts";

test("fixture E2E gera PDF válido com 60 questões e gabarito", () => {
  const fixture = gerarPdfE2EControlado();

  assert.equal(fixture.bytes.subarray(0, 5).toString("ascii"), "%PDF-");
  assert.equal(fixture.questoes.length, 60);
  assert.equal(new Set(fixture.questoes.map((item) => item.numero)).size, 60);
  assert.ok(
    fixture.questoes.every((item) =>
      ["A", "B", "C", "D", "E"].includes(item.resposta)
    )
  );
});

test("rota E2E temporária fica antes da autenticação comum e exige token", async () => {
  const codigo = await readFile("server/secureEntry.ts", "utf8");

  const rota = codigo.indexOf('"/api/internal/e2e-simulado-pdf"');
  const autenticacao = codigo.indexOf(
    'app.use("/api", autenticarEControlarUso)'
  );

  assert.ok(rota >= 0);
  assert.ok(autenticacao > rota);
  assert.match(codigo, /E2E_SIMULADO_TOKEN/);
  assert.match(codigo, /tokenRecebido !== tokenConfigurado/);
});
