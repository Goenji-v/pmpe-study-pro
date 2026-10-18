import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { criarBackupSegurancaSimuladoPdf } from "../src/utils/backupSegurancaSimuladoPdf.ts";
import type { ProcessoSimuladoPdfPersistido } from "../src/services/simuladoPdfPersistencia.ts";

function exemplo(): ProcessoSimuladoPdfPersistido {
  return {
    id: "simulado-antigo",
    nome: "Simulado de domingo",
    totalQuestoes: 60,
    respostas: Object.fromEntries(
      Array.from({ length: 59 }, (_, indice) => [String(indice + 1), "A"])
    ),
    questaoAtual: 60,
    segundos: 7240,
    pausado: true,
    finalizado: false,
    finalizarQuandoPronto: true,
    estadoAnalise: "erro",
    progressoAnalise: 77,
    erroAnalise: "A IA não retornou a leitura de resolução da questão 43.",
    criadoEm: "2026-10-08T08:44:00.000Z",
    atualizadoEm: "2026-10-08T09:57:00.000Z",
  };
}

test("backup local preserva 59 respostas, cronômetro e progresso sem carregar PDF", () => {
  const processo = exemplo();
  const anotacoes = { pagina1: [{ ferramenta: "marcador", x: 10 }] };
  const backup = criarBackupSegurancaSimuladoPdf(processo, anotacoes);
  const restauravel = JSON.parse(JSON.stringify(backup));
  assert.equal(restauravel.formato, "pmpe-study-pro-simulado-pdf");
  assert.equal(restauravel.versao, 1);
  assert.equal(restauravel.incluiArquivoPdf, false);
  assert.equal(restauravel.processo.id, processo.id);
  assert.equal(Object.keys(restauravel.processo.respostas).length, 59);
  assert.equal(restauravel.processo.segundos, 7240);
  assert.equal(restauravel.processo.pausado, true);
  assert.equal(restauravel.processo.progressoAnalise, 77);
  assert.deepEqual(restauravel.anotacoes, anotacoes);
  processo.respostas["1"] = "B";
  assert.equal(restauravel.processo.respostas["1"], "A");
});

test("restauração sem PDF não pode apagar processo automaticamente", async () => {
  const codigo = await readFile("src/pages/SimuladoPdf/SimuladoPdf.tsx", "utf8");
  const inicio = codigo.indexOf("async function continuarProcessoAnterior()");
  const fim = codigo.indexOf("async function excluirProcessoAnterior()");
  assert.ok(inicio > 0 && fim > inicio);
  const recuperacao = codigo.slice(inicio, fim);
  assert.doesNotMatch(recuperacao, /excluirProcessoSimuladoPdf\(/);
  assert.match(recuperacao, /setFaltaPdfRecuperacao\(true\)/);
  assert.match(recuperacao, /pdfReanexado/);
  assert.match(recuperacao, /salvarArquivosSimuladoPdf/);
  assert.match(codigo, /baixarBackup\(processoRecuperavel\)/);
  assert.match(codigo, /baixarBackupAtual/);
});
