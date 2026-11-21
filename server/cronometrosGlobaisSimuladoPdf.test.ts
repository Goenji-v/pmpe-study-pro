import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const central = readFileSync("src/context/CronometroContext.tsx", "utf8");
const pdf = readFileSync("src/pages/SimuladoPdf/SimuladoPdf.tsx", "utf8");

test("aula e revisão não iniciam nem são preparadas por cima de prova PDF não finalizada", () => {
 assert.match(central, /carregarProcessoSimuladoPdf\(\)/);
 assert.match(central, /processo && !processo\.finalizado/);
 assert.match(central, /const pdf = simuladoPdfEmExecucao\(\);/);
 assert.match(central, /setTrocaPendente\(\{ acao: "iniciar", dados, pdfId: pdf\?\.id \}\)/);
 assert.match(central, /setTrocaPendente\(\{ acao: "preparar", dados, pdfId: pdf\?\.id \}\)/);
});

test("descartar simulado PDF exige confirmação, preserva resultados já salvos e trata falhas", () => {
 const start = central.indexOf("async function confirmarTrocaSessao()");
 const end = central.indexOf("function cancelar(", start);
 const trecho = central.slice(start,end);
 assert.ok(start > 0 && end > start);
 assert.match(trecho,/await excluirProcessoSimuladoPdf\(trocaPendente\.pdfId\)/);
 assert.match(trecho,/catch \{/);
 assert.match(central,/onClick=\{\(\) => void confirmarTrocaSessao\(\)\}/);
 assert.match(central,/os arquivos e respostas locais da tentativa são excluídos/);
});

test("simulado PDF pede autorização ao iniciar ou recuperar enquanto outra sessão está ativa", () => {
 assert.match(pdf,/useCronometro\(\)/);
 assert.match(pdf,/solicitarInicioExterno\(\(\) => \{ void iniciarSemBloqueio\(proximo\); \}\)/);
 assert.match(pdf,/solicitarInicioExterno\(\(\) => \{ void continuarProcessoAnteriorSemBloqueio\(\); \}\)/);
 assert.match(central,/setTrocaPendente\(\{ acao: "externo", executar \}\)/);
});

test("não apaga automaticamente outra tentativa PDF em andamento nem a ressuscita após descarte", () => {
 assert.match(pdf,/if \(processoAnterior && !processoAnterior\.finalizado\)/);
 assert.match(pdf,/Retome-o ou faça backup e exclua explicitamente/);
 assert.match(pdf,/tentativaInicioAutomaticoRef\.current === rascunho\.id/);
 assert.match(pdf,/if \(!gravado \|\| gravado\.id !== rascunho\.id\) return/);
 assert.match(pdf,/window\.addEventListener\("storage", verificarDescarteOutraAba\)/);
});
