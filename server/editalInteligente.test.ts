import assert from "node:assert/strict";
import test from "node:test";

import { normalizarRespostaAnaliseEdital } from "./editalInteligente.ts";
import type { DiagnosticoSemanalPlano } from "../src/utils/adaptacaoPlano.ts";
import { adaptarPlanoEditalAoDesempenho } from "../src/utils/adaptacaoPlanoEdital.ts";
import {
  destrincharAssuntoParaPlano,
  gerarPlanoEdital,
  mesclarMateriasDoEdital,
} from "../src/utils/planoEdital.ts";
import type { ConfiguracoesComEdital } from "../src/types/editalInteligente.ts";
import type { Materia } from "../src/types/index.ts";

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

  assert.equal(plano.versao, 3);
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

test("duas primeiras semanas equilibram básicas e específicas", () => {
  const analise = normalizarRespostaAnaliseEdital({
    concursoDetectado: "Teste",
    materias: [
      materiaBruta("Língua Portuguesa", 5, 6),
      materiaBruta("Raciocínio Lógico e Matemática", 5, 6),
      materiaBruta("Noções de Direito Penal", 5, 6),
      materiaBruta("Legislação Extravagante", 5, 6),
    ],
  });

  const plano = gerarPlanoEdital(analise, configuracoes);
  const primeiras = plano.semanas
    .slice(0, 2)
    .flatMap((semana) => semana.dias.flatMap((dia) => dia.missoes));

  const basicas = new Set(["Língua Portuguesa", "Raciocínio Lógico e Matemática"]);
  assert.ok(primeiras.length >= 8);

  primeiras.slice(0, 8).forEach((missao, indice) => {
    if (indice % 2 === 0) assert.ok(basicas.has(missao.materia));
    else assert.ok(!basicas.has(missao.materia));
  });
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

test("trocar edital remove conteúdo importado antigo sem apagar módulo próprio", () => {
  const atuais: Materia[] = [
    {
      id: "portugues",
      nome: "Português",
      assuntos: [
        assunto("base", "Fonologia"),
        assunto("antigo", "Crase antiga"),
      ],
      modulos: [
        {
          id: "portugues-base",
          nome: "Curso base",
          ordem: 1,
          assuntos: [assunto("base", "Fonologia")],
        },
        {
          id: "portugues-edital-importado",
          nome: "Conteúdo do edital",
          ordem: 2,
          assuntos: [assunto("antigo", "Crase antiga")],
        },
      ],
    },
    {
      id: "edital-direito-velho-1",
      nome: "Direito Velho",
      assuntos: [assunto("velho", "Assunto velho")],
      modulos: [
        {
          id: "edital-direito-velho-1-edital-atual",
          nome: "Edital atual",
          ordem: 1,
          assuntos: [assunto("velho", "Assunto velho")],
        },
      ],
    },
  ];

  const novaAnalise = normalizarRespostaAnaliseEdital({
    concursoDetectado: "Novo concurso",
    materias: [
      {
        nome: "Português",
        incidenciaEstimada: 5,
        assuntos: [{ nome: "Interpretação", prioridade: "alta" }],
      },
      {
        nome: "Matemática",
        incidenciaEstimada: 5,
        assuntos: [{ nome: "Porcentagem", prioridade: "alta" }],
      },
    ],
  });

  const resultado = mesclarMateriasDoEdital(atuais, novaAnalise);
  const portugues = resultado.find((materia) => materia.nome === "Português");

  assert.equal(resultado.some((materia) => materia.nome === "Direito Velho"), false);
  assert.ok(portugues?.assuntos.some((item) => item.nome === "Fonologia"));
  assert.equal(portugues?.assuntos.some((item) => item.nome === "Crase antiga"), false);
  assert.ok(portugues?.assuntos.some((item) => item.nome === "Interpretação"));
  assert.equal(
    portugues?.modulos?.filter((modulo) => modulo.nome === "Edital atual").length,
    1
  );
  assert.ok(resultado.some((materia) => materia.nome === "Matemática"));
});

test("após a semana dois o pior desempenho sobe no cronograma sem mexer em concluídas", () => {
  const analise = normalizarRespostaAnaliseEdital({
    concursoDetectado: "Teste",
    materias: [
      materiaBruta("Português", 5, 10),
      materiaBruta("RLM", 5, 10),
      materiaBruta("Direito Penal", 4, 10),
    ],
  });
  const plano = gerarPlanoEdital(analise, {
    ...configuracoes,
    materiasPorDia: 1,
    diasEstudo: ["seg", "ter", "qua"],
  });

  const futuraOriginal = plano.semanas
    .filter((semana) => semana.numero > 2)
    .flatMap((semana) => semana.dias.flatMap((dia) => dia.missoes));
  const concluida = futuraOriginal[0];
  assert.ok(concluida);

  const diagnostico: DiagnosticoSemanalPlano = {
    inicio: "2026-08-12",
    fim: "2026-08-26",
    janelaDias: 14,
    materiaPrioritaria: "RLM",
    prioridade: 92,
    confianca: 85,
    motivos: ["Baixo aproveitamento."],
    possuiDados: true,
    materias: [
      diagnosticoMateria("RLM", 42, 92, 85),
      diagnosticoMateria("Português", 90, 15, 85),
      diagnosticoMateria("Direito Penal", 75, 35, 70),
    ],
  };

  const adaptado = adaptarPlanoEditalAoDesempenho(
    plano,
    diagnostico,
    [concluida.id]
  );
  const futuras = adaptado.semanas
    .filter((semana) => semana.numero > 2)
    .flatMap((semana) => semana.dias.flatMap((dia) => dia.missoes));

  assert.equal(futuras[0].materia, concluida.materia);
  assert.equal(futuras[0].assunto, concluida.assunto);
  assert.equal(futuras[1].materia, "RLM");
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

function materiaBruta(nome: string, incidenciaEstimada: number, quantidade: number) {
  return {
    nome,
    incidenciaEstimada,
    assuntos: Array.from({ length: quantidade }, (_, indice) => ({
      nome: `${nome} assunto ${indice + 1}`,
      prioridade: indice < 3 ? "alta" : "media",
    })),
  };
}

function assunto(id: string, nome: string) {
  return {
    id,
    nome,
    concluido: false,
    prioridade: "media" as const,
  };
}

function diagnosticoMateria(
  materia: string,
  percentualAcertos: number,
  prioridade: number,
  confianca: number
): DiagnosticoSemanalPlano["materias"][number] {
  return {
    materia,
    questoes: 20,
    percentualAcertos,
    minutos: 120,
    sessoes: 2,
    revisoesAtrasadas: 0,
    diasSemEstudar: 1,
    prioridade,
    confianca,
    motivos: [],
  };
}
