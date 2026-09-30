import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("diagnóstico do simulado mantém resumo enxuto e sem rótulos antigos", async () => {
  const codigo = await readFile(
    "src/components/AnaliseSimuladoStudyPro/AnaliseSimuladoStudyPro.tsx",
    "utf8"
  );

  assert.match(codigo, /Prioridades principais/);
  assert.match(codigo, /Plano de revisão/);
  assert.match(codigo, /Até 8 focos/);
  assert.match(codigo, /analise\.assuntos\.slice\(0, 12\)/);
  assert.match(codigo, /Ver todos os \$\{analise\.assuntos\.length\} assuntos/);

  assert.doesNotMatch(codigo, /Assuntos com mais erros/);
  assert.doesNotMatch(codigo, /Prioridades de revisão/);
});

test("diagnóstico continua usando somente o plano condensado como contador de prioridades", async () => {
  const codigo = await readFile(
    "src/components/AnaliseSimuladoStudyPro/AnaliseSimuladoStudyPro.tsx",
    "utf8"
  );

  assert.match(
    codigo,
    /const prioridades = analise\.planoRevisao/
  );
  assert.match(
    codigo,
    /<strong>\{analise\.planoRevisao\.length\}<\/strong>/
  );
});
