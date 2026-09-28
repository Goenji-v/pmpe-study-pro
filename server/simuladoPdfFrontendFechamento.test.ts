import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("recuperação do simulado PDF retoma mesmo com estado local desatualizado", async () => {
  const codigo = await readFile(
    "src/pages/SimuladoPdf/SimuladoPdf.tsx",
    "utf8"
  );

  assert.match(
    codigo,
    /Continuar de onde você parou\?/
  );
  assert.match(
    codigo,
    /atualização,[\s\S]*fechamento da página/
  );
  assert.match(
    codigo,
    /await iniciarOuRetomarJob\(\s*proximo,\s*true\s*\)/
  );
  assert.match(
    codigo,
    /processoRecuperavel\.progressoAnalise/
  );
  assert.match(
    codigo,
    /processoRecuperavel\.respostas/
  );
});

test("histórico de simulados exibe diagnósticos PDF salvos e reabríveis", async () => {
  const codigo = await readFile(
    "src/pages/Simulados/Simulados.tsx",
    "utf8"
  );

  assert.match(codigo, /listarAnalisesSimulados/);
  assert.match(
    codigo,
    /item\.origem === "pdf"/
  );
  assert.match(
    codigo,
    /Resultados dos simulados PDF/
  );
  assert.match(
    codigo,
    /Ver diagnóstico/
  );
  assert.match(
    codigo,
    /registro\.analise\.recomendacaoFinal/
  );
  assert.match(
    codigo,
    /registro\.analise\.planoRevisao/
  );
  assert.match(
    codigo,
    /navigate\(\s*"\/simulado-pdf"\s*\)/
  );
});

test("histórico PDF mantém layout utilizável em celular", async () => {
  const css = await readFile(
    "src/pages/Simulados/Simulados.css",
    "utf8"
  );

  assert.match(
    css,
    /\.simulado-pdf-diagnostico-grid[\s\S]*grid-template-columns:\s*repeat\(2/
  );
  assert.match(
    css,
    /@media \(max-width: 650px\)[\s\S]*\.simulado-pdf-diagnostico-grid[\s\S]*grid-template-columns:\s*1fr/
  );
  assert.match(
    css,
    /\.simulado-pdf-ver-diagnostico[\s\S]*width:\s*100%/
  );
});
