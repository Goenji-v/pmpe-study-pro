import assert from "node:assert/strict";
import test from "node:test";

import {
  calcularDiagnosticoSemanalPlano,
  calcularDistribuicaoAdaptativaSemanal,
} from "../src/utils/adaptacaoPlano";

test("planejamento adaptativo aumenta blocos da matéria fraca sem remover as demais", () => {
  const agora = new Date("2026-10-04T12:00:00-03:00");
  const diagnostico = calcularDiagnosticoSemanalPlano({
    agora,
    materiasDisponiveis: ["Português", "RLM", "Direitos Humanos"],
    questoes: [
      {
        id: "q-port",
        materia: "Português",
        assunto: "Interpretação",
        banca: "AOCP",
        certas: 8,
        erradas: 2,
        minutos: 0,
        data: "2026-10-03T10:00:00-03:00",
      },
      {
        id: "q-rlm",
        materia: "RLM",
        assunto: "Proposições",
        banca: "AOCP",
        certas: 4,
        erradas: 6,
        minutos: 0,
        data: "2026-10-03T11:00:00-03:00",
      },
      {
        id: "q-dh",
        materia: "Direitos Humanos",
        assunto: "Gerações",
        banca: "AOCP",
        certas: 9,
        erradas: 1,
        minutos: 0,
        data: "2026-10-03T12:00:00-03:00",
      },
    ],
    sessoes: [],
    revisoes: [],
  });

  const distribuicao = calcularDistribuicaoAdaptativaSemanal({
    diagnostico,
    materiasDisponiveis: ["Português", "RLM", "Direitos Humanos"],
    totalBlocos: 9,
  });

  const rlm = distribuicao.find((item) => item.materia === "RLM");
  const portugues = distribuicao.find((item) => item.materia === "Português");
  const direitos = distribuicao.find((item) => item.materia === "Direitos Humanos");

  assert.ok(rlm);
  assert.ok(portugues);
  assert.ok(direitos);
  assert.ok(rlm.blocosRecomendados > portugues.blocosRecomendados);
  assert.ok(rlm.blocosRecomendados > direitos.blocosRecomendados);
  assert.ok(portugues.blocosRecomendados >= 1);
  assert.ok(direitos.blocosRecomendados >= 1);
});

test("dúvida e aula incompleta entram no diagnóstico semanal", () => {
  const agora = new Date("2026-10-04T12:00:00-03:00");
  const diagnostico = calcularDiagnosticoSemanalPlano({
    agora,
    materiasDisponiveis: ["RLM"],
    questoes: [],
    revisoes: [],
    sessoes: [
      {
        id: "sessao-1",
        data: "2026-10-03T08:00:00-03:00",
        tipo: "aula",
        materia: "RLM",
        assunto: "Equivalências",
        minutos: 40,
        conteudoConcluido: false,
        pontoParada: "42:30",
      },
      {
        id: "sessao-2",
        data: "2026-10-03T09:00:00-03:00",
        tipo: "aula",
        materia: "RLM",
        assunto: "Negação",
        minutos: 35,
        conteudoConcluido: true,
        duvida: "Negação do se então",
      },
    ],
  });

  assert.equal(diagnostico.materias[0].sessoesIncompletas, 1);
  assert.equal(diagnostico.materias[0].sessoesComDuvida, 1);
  assert.ok(
    diagnostico.materias[0].motivos.some((motivo) =>
      motivo.includes("conteúdo ainda pendente")
    )
  );
  assert.ok(
    diagnostico.materias[0].motivos.some((motivo) =>
      motivo.includes("dúvida registrada")
    )
  );
});
