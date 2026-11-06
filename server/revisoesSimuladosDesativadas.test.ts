import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import type { Revisao } from "../src/types";
import {
  filtrarRevisoesRegulares,
  mesclarRevisoesRegulares,
  revisaoOriginadaDeSimulado,
} from "../src/utils/revisoesRegulares";
import { encontrarDataDisponivelParaRevisao } from "../src/utils/revisoes";

function criarRevisao(id: string, origemSimulado = false): Revisao {
  return {
    id,
    materiaId: "portugues",
    assuntoId: "crase",
    materia: "Português",
    assunto: "Crase",
    etapa: 1,
    dataCriacao: "2026-11-06T12:00:00.000Z",
    dataPrevista: "2026-11-10T12:00:00.000Z",
    concluida: false,
    ...(origemSimulado
      ? {
          origemSimulado: {
            tentativaId: id,
            nome: "Simulado PDF",
            materiaDiagnostico: "Português",
            assuntoDiagnostico: "Crase",
            vinculo: "sem_conteudo" as const,
          },
        }
      : {}),
  };
}

test("pendências de simulado PDF e do Simulado IA são ocultadas sem apagar histórico", () => {
  const pdf = criarRevisao("prova-pdf", true);
  const ia = criarRevisao("ia-123");
  const regular = criarRevisao("revisao-legitima");
  const comNomeSimulado = { ...regular, id: "normal", assunto: "Simulado: teoria" };
  const dados = [pdf, ia, regular, comNomeSimulado];
  assert.equal(revisaoOriginadaDeSimulado(pdf), true);
  assert.equal(revisaoOriginadaDeSimulado(ia), true);
  assert.equal(revisaoOriginadaDeSimulado(regular), false);
  assert.deepEqual(filtrarRevisoesRegulares(dados).map((r) => r.id), ["revisao-legitima", "normal"]);
  assert.equal(dados.length, 4);
  assert.equal(filtrarRevisoesRegulares([regular])[0], regular);
});

test("incluir, alterar e excluir revisão comum preserva registros desativados na nuvem", () => {
  const pdf = criarRevisao("prova-pdf", true);
  const ia = criarRevisao("ia-123");
  const regular = criarRevisao("regular");
  const historico = [pdf, regular, ia];
  const novas = [
    { ...regular, concluida: true },
    criarRevisao("nova"),
  ];
  const combinado = mesclarRevisoesRegulares(historico, novas);
  assert.deepEqual(combinado.map((r) => r.id), ["nova", "prova-pdf", "regular", "ia-123"]);
  assert.equal(combinado.find((r) => r.id === "prova-pdf"), pdf);
  assert.equal(combinado.find((r) => r.id === "ia-123"), ia);
  assert.equal(combinado.find((r) => r.id === "regular")?.concluida, true);
  assert.deepEqual(mesclarRevisoesRegulares(historico, []), [pdf, ia]);
  assert.equal(mesclarRevisoesRegulares(historico, filtrarRevisoesRegulares(historico)), historico);
});

test("revisão de simulado antiga não consome vaga do limite diário", () => {
  const base = new Date(2026, 10, 10, 12);
  const simulado = { ...criarRevisao("simulado", true), dataPrevista: base.toISOString() };
  const visivel = { ...criarRevisao("regular"), dataPrevista: base.toISOString() };
  const disponivel = encontrarDataDisponivelParaRevisao({
    dataBase: base, revisoes: [simulado], limiteDiario: 1,
  });
  assert.equal(disponivel.getDate(), base.getDate());
  const ocupado = encontrarDataDisponivelParaRevisao({
    dataBase: base, revisoes: [simulado, visivel], limiteDiario: 1,
  });
  assert.equal(ocupado.getDate(), 11);
});

test("nenhum diagnóstico cria automaticamente revisões a partir de simulados", () => {
  const app = readFileSync("src/context/AppContext.tsx", "utf8");
  const analise = readFileSync("src/components/AnaliseSimuladoStudyPro/AnaliseSimuladoStudyPro.tsx", "utf8");
  const diagnostico = readFileSync("src/components/DiagnosticoSimuladoIA/DiagnosticoSimuladoIA.tsx", "utf8");
  const revisoes = readFileSync("src/pages/Revisoes/Revisoes.tsx", "utf8");
  const resolver = readFileSync("src/pages/ResolverSimuladoIA/ResolverSimuladoIA.tsx", "utf8");

  assert.doesNotMatch(app, /listarAnalisesSimulados\(12\)/);
  assert.doesNotMatch(app, /adicionarErrosSimuladoARevisao/);
  assert.match(app, /revisoes: revisoesRegulares/);
  assert.match(app, /setRevisoes: setRevisoesRegulares/);
  assert.doesNotMatch(analise, /adicionarErrosSimuladoARevisao|Adicionar erros à revisão/);
  assert.match(analise, /Treinar com IA/);
  assert.doesNotMatch(diagnostico, /criarRevisoes\(|Criar revisões/);
  assert.match(diagnostico, /Treinar erros/);
  assert.doesNotMatch(revisoes, /importarRevisoesIA\(|carregarRevisoesIA\(/);
  assert.match(resolver, /revisaoAutomaticaPermitida = novoResultado\.tipo !== "simulado"/);
});
