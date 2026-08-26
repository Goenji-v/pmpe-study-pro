import assert from "node:assert/strict";
import test from "node:test";

import { normalizarRespostaAnaliseEdital } from "./editalInteligente.ts";
import {
  destrincharAssuntoParaPlano,
  gerarPlanoEdital,
} from "../src/utils/planoEdital.ts";
import type { ConfiguracoesComEdital } from "../src/types/editalInteligente.ts";

const configuracoes: ConfiguracoesComEdital = {
  nomeUsuario: "Teste",
  concurso: "PMPE",
  bancaPadrao: "AOCP",
  metaQuestoesDiaria: 40,
  metaMinutosDiaria: 120,
  metaRevisoesDiaria: 2,
  missoesPorDia: 1,
  materiasPorDia: 2,
  diasEstudo: ["seg", "qua", "sex"],
  tema: "escuro",
};

test("normaliza matérias e remove assuntos duplicados da análise", () => {
  const analise = normalizarRespostaAnaliseEdital({
    concursoDetectado: "PMPE",
    materias: [
      {
        nome: "Português",
        incidenciaEstimada: 5,
        assuntos: [
          { nome: "Interpretação de textos", prioridade: "alta" },
          { nome: "Interpretação de textos", prioridade: "baixa" },
          { nome: "Crase", prioridade: "invalida" },
        ],
      },
    ],
  });

  assert.equal(analise.materias.length, 1);
  assert.equal(analise.materias[0].assuntos.length, 2);
  assert.equal(analise.materias[0].assuntos[1].prioridade, "media");
});

test("cronograma mostra os sete dias e usa missões apenas nos dias escolhidos", () => {
  const analise = normalizarRespostaAnaliseEdital({
    concursoDetectado: "PMPE",
    materias: [
      {
        nome: "Português",
        incidenciaEstimada: 5,
        assuntos: [
          { nome: "Interpretação", prioridade: "alta" },
          { nome: "Crase", prioridade: "media" },
          { nome: "Sintaxe", prioridade: "baixa" },
        ],
      },
      {
        nome: "RLM",
        incidenciaEstimada: 4,
        assuntos: [
          { nome: "Proposições", prioridade: "alta" },
          { nome: "Probabilidade", prioridade: "media" },
          { nome: "Conjuntos", prioridade: "baixa" },
        ],
      },
    ],
  });

  const plano = gerarPlanoEdital(analise, configuracoes);
  const dias = plano.semanas[0].dias;

  assert.equal(plano.totalAssuntos, 6);
  assert.equal(plano.totalSemanas, 1);
  assert.equal(dias.length, 7);
  assert.deepEqual(
    dias.map((dia) => dia.diaSemana),
    ["seg", "ter", "qua", "qui", "sex", "sab", "dom"]
  );

  const diasComMissao = dias
    .filter((dia) => dia.missoes.length > 0)
    .map((dia) => dia.diaSemana);
  assert.deepEqual(diasComMissao, ["seg", "qua", "sex"]);

  const diasInativos = dias.filter(
    (dia) => !configuracoes.diasEstudo?.includes(dia.diaSemana)
  );
  assert.ok(diasInativos.every((dia) => dia.missoes.length === 0));
  assert.ok(diasInativos.every((dia) => dia.minutosDisponiveis === 0));
});

test("assuntos de prioridade alta entram antes dos baixos dentro da disciplina", () => {
  const analise = normalizarRespostaAnaliseEdital({
    concursoDetectado: "Teste",
    materias: [
      {
        nome: "Português",
        incidenciaEstimada: 5,
        assuntos: [
          { nome: "Baixo", prioridade: "baixa" },
          { nome: "Alto", prioridade: "alta" },
        ],
      },
    ],
  });

  const plano = gerarPlanoEdital(analise, {
    ...configuracoes,
    materiasPorDia: 1,
    diasEstudo: ["seg", "ter"],
  });

  const missoes = plano.semanas.flatMap((semana) =>
    semana.dias.flatMap((dia) => dia.missoes)
  );

  assert.equal(missoes[0].assunto, "Alto");
  assert.equal(missoes[1].assunto, "Baixo");
});

test("destrincha listas amplas do edital em blocos menores de estudo", () => {
  const partes = destrincharAssuntoParaPlano(
    "Ato administrativo (conceito, requisitos, atributos, classificação, espécies, invalidação, anulação, revogação)"
  );

  assert.deepEqual(partes, [
    "Ato administrativo — conceito e requisitos",
    "Ato administrativo — atributos e classificação",
    "Ato administrativo — espécies e invalidação",
    "Ato administrativo — anulação e revogação",
  ]);
});
