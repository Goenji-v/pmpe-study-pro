import assert from "node:assert/strict";
import test from "node:test";

import { normalizarRespostaAnaliseEdital } from "./editalInteligente.ts";
import { gerarPlanoEdital } from "../src/utils/planoEdital.ts";
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

test("cronograma respeita dias escolhidos e quantidade de matérias por dia", () => {
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
  const dias = plano.semanas.flatMap((semana) => semana.dias);

  assert.equal(plano.totalAssuntos, 6);
  assert.equal(plano.totalSemanas, 1);
  assert.deepEqual(
    dias.map((dia) => dia.diaSemana),
    ["seg", "qua", "sex"]
  );
  assert.ok(dias.every((dia) => dia.missoes.length <= 2));
  assert.ok(dias.every((dia) => dia.revisoesPlanejadas === 2));
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
