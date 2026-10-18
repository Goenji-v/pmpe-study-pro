import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  criarBackupSegurancaSimuladoPdf,
  lerBackupSegurancaSimuladoPdf,
} from "../src/utils/backupSegurancaSimuladoPdf.ts";
import { deveAdiarAtualizacaoAutomatica } from "../src/utils/atualizacaoSegura.ts";
import type { ProcessoSimuladoPdfPersistido } from "../src/services/simuladoPdfPersistencia.ts";

const processo: ProcessoSimuladoPdfPersistido = {
  id: "tentativa-12345",
  nome: "Prova com uma questão em branco",
  totalQuestoes: 60,
  respostas: Object.fromEntries(Array.from({ length: 59 }, (_, i) => [String(i + 1), "B"])),
  questaoAtual: 60,
  segundos: 7240,
  pausado: true,
  finalizado: false,
  finalizarQuandoPronto: true,
  estadoAnalise: "erro",
  progressoAnalise: 77,
  erroAnalise: "Falha na questão 43",
  criadoEm: "2026-10-08T08:00:00.000Z",
  atualizadoEm: "2026-10-08T10:00:00.000Z",
};

test("restaurar backup conserva 59 respostas, uma em branco, tempo e anotações", () => {
  const backup = criarBackupSegurancaSimuladoPdf(processo, { pagina: 1 });
  const resultado = lerBackupSegurancaSimuladoPdf(JSON.stringify(backup));
  assert.equal(resultado.processo.id, processo.id);
  assert.equal(resultado.processo.segundos, 7240);
  assert.equal(resultado.processo.pausado, true);
  assert.equal(Object.keys(resultado.processo.respostas).length, 59);
  assert.equal(resultado.processo.respostas["60"], undefined);
  assert.equal(resultado.processo.estadoAnalise, "erro");
  assert.deepEqual(resultado.anotacoes, { pagina: 1 });
});

test("importação recusa JSON inválido ou outro tipo de backup", () => {
  assert.throws(() => lerBackupSegurancaSimuladoPdf("invalido"), /JSON válido/);
  assert.throws(() => lerBackupSegurancaSimuladoPdf(JSON.stringify({ tipo: "pmpe-study-pro-backup" })), /incompatível/);
  assert.throws(() => lerBackupSegurancaSimuladoPdf(" ".repeat(2_000_001)), /grande demais/);
});

test("importação recusa letras indevidas e números fora da prova", () => {
  const base = criarBackupSegurancaSimuladoPdf(processo, null);
  assert.throws(() => lerBackupSegurancaSimuladoPdf(JSON.stringify({
    ...base, processo: { ...base.processo, respostas: { "43": "Z" } },
  })), /marcações inválidas/);
  assert.throws(() => lerBackupSegurancaSimuladoPdf(JSON.stringify({
    ...base, processo: { ...base.processo, respostas: { "61": "A" } },
  })), /marcações inválidas/);
});

test("simulados e redação não são recarregados automaticamente", () => {
  for (const rota of [
    "/simulado-pdf", "/simulado-pdf/", "/resolver-simulado-ia/prova",
    "/simulado-oficial/abc123", "/inteligencia", "/central-estudos",
  ]) {
    assert.equal(deveAdiarAtualizacaoAutomatica(rota), true, rota);
  }
  for (const rota of ["/", "/login", "/demo", "/plano", "/desempenho"]) {
    assert.equal(deveAdiarAtualizacaoAutomatica(rota), false, rota);
  }
});

test("versionamento e recuperação de chunk respeitam atividades protegidas", async () => {
  const [main, runtime, persistencia, pagina, desempenho] = await Promise.all([
    readFile("src/main.tsx", "utf8"),
    readFile("src/components/RuntimeErrorGuard/RuntimeErrorGuard.tsx", "utf8"),
    readFile("src/services/simuladoPdfPersistencia.ts", "utf8"),
    readFile("src/pages/SimuladoPdf/SimuladoPdf.tsx", "utf8"),
    readFile("src/pages/CentralDesempenho/CentralDesempenho.tsx", "utf8"),
  ]);
  assert.match(main, /deveAdiarAtualizacaoAutomatica\(window\.location\.pathname\)/);
  assert.match(runtime, /deveAdiarAtualizacaoAutomatica/);
  assert.match(persistencia, /export function restaurarProcessoSimuladoPdfSeguro/);
  assert.match(persistencia, /if \(localStorage\.getItem\(CHAVE_PROCESSO\) !== null\)/);
  assert.match(pagina, /lerBackupSegurancaSimuladoPdf/);
  assert.match(pagina, /restaurarProcessoSimuladoPdfSeguro/);
  assert.match(pagina, /Restaurar backup JSON/);
  assert.match(desempenho, /lazy\(\(\) => import/);
  assert.match(desempenho, /<Suspense fallback=/);
});
