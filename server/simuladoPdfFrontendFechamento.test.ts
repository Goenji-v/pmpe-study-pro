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
    /processoRecuperavel\s*\.progressoAnalise/
  );
  assert.match(
    codigo,
    /processoRecuperavel\s*\.respostas/
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
    /item\.origem !== "pdf"/
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


test("frontend não aceita diagnóstico PDF com questões sem gabarito confiável", async () => {
  const [simuladoPdf, simulados] = await Promise.all([
    readFile(
      "src/pages/SimuladoPdf/SimuladoPdf.tsx",
      "utf8"
    ),
    readFile(
      "src/pages/Simulados/Simulados.tsx",
      "utf8"
    ),
  ]);

  assert.match(
    simuladoPdf,
    /analisePdfProntaParaCorrecao/
  );
  assert.match(
    simuladoPdf,
    /não vai calcular sua nota até recuperar todas as questões pendentes/
  );
  assert.match(
    simuladoPdf,
    /A análise salva estava incompleta/
  );
  assert.match(
    simuladoPdf,
    /setFinalizarQuandoPronto\(true\)/
  );
  assert.match(
    simulados,
    /resumo\.totalValidas >= minimoConfiavel/
  );
});


test("atividade semanal abre a sala dedicada do Simulado PDF", async () => {
  const [plano, app] = await Promise.all([
    readFile("src/pages/PlanoEstudos/PlanoEstudos.tsx", "utf8"),
    readFile("src/PrivateApp.tsx", "utf8"),
  ]);

  assert.match(plano, /guardarRascunhoSimuladoPdf/);
  assert.match(plano, /navigate\("\/simulado-pdf"\)/);
  assert.match(
    app,
    /<Route path="\/simulado-pdf" element={<SimuladoPdf \/>}/
  );
});


test("simulado PDF oficial não exibe rótulos de prévia", async () => {
  const codigo = await readFile(
    "src/pages/SimuladoPdf/SimuladoPdf.tsx",
    "utf8"
  );

  assert.doesNotMatch(codigo, /PRÉVIA/);
  assert.doesNotMatch(codigo, /preview-pdf/);
  assert.match(codigo, /SIMULADO DE DOMINGO/);
});


test("fechamento do PDF persiste o diagnóstico antes de depender da tela de relatório", async () => {
  const codigo = await readFile(
    "src/pages/SimuladoPdf/SimuladoPdf.tsx",
    "utf8"
  );

  assert.match(codigo, /const persistirResultadoFinal = useCallback/);
  assert.match(codigo, /analisarSimuladoStudyPro\(\{/);
  assert.match(
    codigo,
    /salvarAnaliseSimuladoLocal\(\{[\s\S]*origem: "pdf"/
  );
  assert.match(
    codigo,
    /await salvarAnaliseSimulado\(\{[\s\S]*origem: "pdf"/
  );
  assert.match(
    codigo,
    /async function encerrarEVoltar\(\)[\s\S]*await persistirResultadoFinal\(\)/
  );
  assert.match(
    codigo,
    /new Event\("pmpe-simulado-pdf-finalizado"\)/
  );
});
