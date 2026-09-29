import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("simulado PDF separa extração do PDF e resolução textual", async () => {
  const codigo = await readFile(
    "server/processarSimuladoPdfPersistente.ts",
    "utf8"
  );

  assert.match(
    codigo,
    /extrairQuestoesBasicasComRecuperacao/
  );
  assert.match(
    codigo,
    /resolverQuestaoExtraida/
  );
  assert.match(
    codigo,
    /Não há PDF nesta etapa\. Use somente o texto fornecido\./
  );
  assert.match(
    codigo,
    /await gerarJsonTexto\([\s\S]*resolução da questão/
  );
  assert.match(
    codigo,
    /etapaPipeline: "extraida"/
  );
  assert.match(
    codigo,
    /etapaPipeline: "resolvida"/
  );
});

test("pipeline de produção salva extração e resolução por questão", async () => {
  const codigo = await readFile(
    "server/processarSimuladoPdfPersistente.ts",
    "utf8"
  );

  assert.match(
    codigo,
    /executarPipelineQuestaoAPorQuestao/
  );
  assert.match(
    codigo,
    /temExtracao: questaoSimuladoPdfTemExtracaoConfiavel/
  );
  assert.match(
    codigo,
    /estaPronta: questaoSimuladoPdfProntaParaCorrecao/
  );
  assert.match(
    codigo,
    /fase === "extraindo" \? "gerando" : "corrigindo"/
  );
});
