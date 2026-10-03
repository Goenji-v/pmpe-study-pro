import assert from "node:assert/strict";
import test from "node:test";

import type {
  Materia,
} from "../src/types/index.ts";
import type {
  AnaliseEdital,
  EditalAtivo,
} from "../src/types/editalInteligente.ts";
import {
  prepararMigracaoEditalSegura,
  validarPreservacaoMigracao,
} from "../src/utils/migracaoEditalSegura.ts";

const AGORA = "2026-10-03T09:00:00.000Z";

function editalAnterior(): EditalAtivo {
  return {
    id: "edital-2024",
    nomeArquivo: "PMPE 2024",
    storagePath: "editais/pmpe-2024.pdf",
    confirmadoEm: "2024-01-01T00:00:00.000Z",
    analise: {
      concursoDetectado: "PMPE",
      bancaDetectada: "AOCP",
      analisadoEm: "2024-01-01T00:00:00.000Z",
      materias: [
        {
          id: "ed-dh",
          nome: "Direitos Humanos",
          incidenciaEstimada: 4,
          assuntos: [
            {
              id: "dh-teoria",
              nome: "Teoria geral dos Direitos Humanos",
              prioridade: "alta",
            },
            {
              id: "dh-dudh",
              nome: "Declaração Universal dos Direitos Humanos",
              prioridade: "alta",
            },
            {
              id: "dh-antigo",
              nome: "Tópico antigo que saiu do edital",
              prioridade: "media",
            },
          ],
        },
      ],
    },
    plano: {
      versao: 4,
      id: "plano-2024",
      titulo: "Plano 2024",
      geradoEm: "2024-01-01T00:00:00.000Z",
      totalAssuntos: 3,
      totalSemanas: 1,
      diasEstudo: ["seg"],
      materiasPorDia: 1,
      minutosPorDia: 60,
      revisoesPorDia: 1,
      semanas: [],
    },
  };
}

function materiasAtuais(): Materia[] {
  return [
    {
      id: "materia-dh-canonica",
      nome: "Direitos Humanos",
      idsLegados: ["ed-dh"],
      modulos: [
        {
          id: "geral-dh",
          nome: "Geral",
          ordem: 0,
          assuntos: [
            {
              id: "dh-teoria",
              nome: "Teoria geral dos Direitos Humanos",
              concluido: true,
              prioridade: "alta",
              origemEditalId: "dh-teoria",
              questoes: "https://questoes.test/dh/teoria",
              anotacoes: "Minha anotação antiga",
              aulas: [
                {
                  id: "aula-antiga",
                  nome: "Aula antiga",
                  url: "https://curso-antigo.test/dh/teoria",
                  ordem: 1,
                  concluida: true,
                },
              ],
            },
            {
              id: "dh-dudh",
              nome: "Declaração Universal dos Direitos Humanos",
              concluido: false,
              prioridade: "alta",
              origemEditalId: "dh-dudh",
              questoes: "https://questoes.test/dh/dudh",
              aulas: [],
            },
            {
              id: "dh-antigo",
              nome: "Tópico antigo que saiu do edital",
              concluido: true,
              prioridade: "media",
              origemEditalId: "dh-antigo",
              questoes: "https://questoes.test/dh/antigo",
              anotacoes: "Histórico que não pode sumir",
              materiais: [
                {
                  id: "mat-antigo",
                  tipo: "link",
                  nome: "Material antigo",
                  url: "https://material.test/antigo",
                  criadoEm: AGORA,
                },
              ],
              aulas: [],
            },
          ],
        },
      ],
      assuntos: [],
    },
  ].map((materia) => ({
    ...materia,
    assuntos: materia.modulos?.flatMap((modulo) => modulo.assuntos) ?? [],
  }));
}

function novoEdital(): AnaliseEdital {
  return {
    concursoDetectado: "PMPE 2026",
    bancaDetectada: "AOCP",
    analisadoEm: AGORA,
    materias: [
      {
        id: "novo-dh",
        nome: "Direitos Humanos",
        incidenciaEstimada: 5,
        assuntos: [
          {
            id: "novo-teoria",
            nome: "Teoria geral dos Direitos Humanos: conceito, terminologia e fundamentos",
            prioridade: "alta",
          },
          {
            id: "novo-dudh",
            nome: "Declaração Universal dos Direitos Humanos",
            prioridade: "alta",
          },
          {
            id: "novo-pacto",
            nome: "Convenção Americana sobre Direitos Humanos",
            prioridade: "media",
          },
        ],
      },
    ],
  };
}

function contagens() {
  return {
    questoes: 7,
    sessoes: 11,
    revisoes: 4,
    simulados: 2,
    bancoQuestoes: 25,
    simuladosGerados: 3,
    missoesConcluidas: 8,
  };
}

test("migração reutiliza IDs canônicos e preserva links, anotações e progresso", () => {
  const resultado = prepararMigracaoEditalSegura({
    materiasAtuais: materiasAtuais(),
    editalAnterior: editalAnterior(),
    editalNovoId: "edital-2026",
    editalNovoNome: "PMPE 2026",
    analiseNova: novoEdital(),
    cursos: [],
    cursosAtivosIds: [],
    contagens: contagens(),
  });

  const materia = resultado.materiasMigradas.find(
    (item) => item.id === "materia-dh-canonica"
  );
  assert.ok(materia);

  const teoria = materia.assuntos.find((item) => item.id === "dh-teoria");
  assert.ok(teoria);
  assert.match(teoria.nome, /conceito/i);
  assert.equal(teoria.concluido, true);
  assert.equal(teoria.questoes, "https://questoes.test/dh/teoria");
  assert.equal(teoria.anotacoes, "Minha anotação antiga");

  const vinculoNovo = teoria.vinculosEdital?.find(
    (item) => item.editalId === "edital-2026"
  );
  assert.equal(vinculoNovo?.ativo, true);
  assert.equal(vinculoNovo?.assuntoEditalId, "novo-teoria");

  assert.equal(
    resultado.analiseCanonica.materias[0].assuntos[0].id,
    "dh-teoria"
  );
  assert.equal(resultado.relatorio.preservacao.questoes, 7);
  assert.equal(resultado.relatorio.preservacao.linksQuestoes, 3);
});

test("assunto removido do novo edital continua preservado como complemento", () => {
  const resultado = prepararMigracaoEditalSegura({
    materiasAtuais: materiasAtuais(),
    editalAnterior: editalAnterior(),
    editalNovoId: "edital-2026",
    editalNovoNome: "PMPE 2026",
    analiseNova: novoEdital(),
    cursos: [],
    cursosAtivosIds: [],
    contagens: contagens(),
  });

  const materia = resultado.materiasMigradas.find(
    (item) => item.id === "materia-dh-canonica"
  );
  assert.ok(materia);

  const antigo = materia.assuntos.find((item) => item.id === "dh-antigo");
  assert.ok(antigo);
  assert.equal(antigo.complementarAoEdital, true);
  assert.equal(antigo.prioridade, "baixa");
  assert.equal(antigo.questoes, "https://questoes.test/dh/antigo");
  assert.equal(antigo.anotacoes, "Histórico que não pode sumir");
  assert.equal(antigo.materiais?.length, 1);
  assert.equal(
    resultado.relatorio.resumo.removidosPreservados,
    1
  );
});

test("assunto novo recebe ID novo e não herda progresso de outro conteúdo", () => {
  const resultado = prepararMigracaoEditalSegura({
    materiasAtuais: materiasAtuais(),
    editalAnterior: editalAnterior(),
    editalNovoId: "edital-2026",
    editalNovoNome: "PMPE 2026",
    analiseNova: novoEdital(),
    cursos: [],
    cursosAtivosIds: [],
    contagens: contagens(),
  });

  const materia = resultado.materiasMigradas.find(
    (item) => item.id === "materia-dh-canonica"
  );
  assert.ok(materia);

  const pacto = materia.assuntos.find(
    (item) => item.nome === "Convenção Americana sobre Direitos Humanos"
  );
  assert.ok(pacto);
  assert.equal(pacto.id, "novo-pacto");
  assert.equal(pacto.concluido, false);
  assert.equal(pacto.complementarAoEdital, false);
});

test("associação ambígua não funde assuntos automaticamente", () => {
  const materias: Materia[] = [
    {
      id: "m-const",
      nome: "Direito Constitucional",
      modulos: [
        {
          id: "geral",
          nome: "Geral",
          ordem: 0,
          assuntos: [
            {
              id: "sociais-servidores",
              nome: "Direitos sociais dos servidores",
              concluido: true,
              prioridade: "alta",
              origemEditalId: "sociais-servidores",
              aulas: [],
            },
            {
              id: "sociais-trabalhistas",
              nome: "Direitos sociais trabalhistas",
              concluido: false,
              prioridade: "alta",
              origemEditalId: "sociais-trabalhistas",
              aulas: [],
            },
          ],
        },
      ],
      assuntos: [],
    },
  ].map((materia) => ({
    ...materia,
    assuntos: materia.modulos?.flatMap((modulo) => modulo.assuntos) ?? [],
  }));

  const analise: AnaliseEdital = {
    concursoDetectado: "Teste",
    analisadoEm: AGORA,
    materias: [
      {
        id: "novo-const",
        nome: "Direito Constitucional",
        incidenciaEstimada: 3,
        assuntos: [
          {
            id: "novo-sociais",
            nome: "Direitos sociais",
            prioridade: "alta",
          },
        ],
      },
    ],
  };

  const resultado = prepararMigracaoEditalSegura({
    materiasAtuais: materias,
    editalNovoId: "edital-novo",
    editalNovoNome: "Edital novo",
    analiseNova: analise,
    cursos: [],
    cursosAtivosIds: [],
    contagens: {
      questoes: 0,
      sessoes: 0,
      revisoes: 0,
      simulados: 0,
      bancoQuestoes: 0,
      simuladosGerados: 0,
      missoesConcluidas: 0,
    },
  });

  assert.equal(resultado.relatorio.resumo.ambiguos, 1);
  assert.equal(
    resultado.analiseCanonica.materias[0].assuntos[0].id,
    "novo-sociais"
  );
});

test("validação aborta se histórico ou links de questões diminuírem", () => {
  const antes = {
    materias: materiasAtuais(),
    questoes: [{ id: "q1" }],
    sessoes: [{ id: "s1" }],
    revisoes: [{ id: "r1" }],
    simulados: [],
    bancoQuestoes: [],
    simuladosGerados: [],
    missoesConcluidas: ["missao-1"],
  };

  assert.throws(
    () =>
      validarPreservacaoMigracao({
        antes,
        depois: {
          ...antes,
          questoes: [],
        },
      }),
    /redução inesperada/
  );

  const semLinks = materiasAtuais().map((materia) => ({
    ...materia,
    modulos: materia.modulos?.map((modulo) => ({
      ...modulo,
      assuntos: modulo.assuntos.map((assunto) => ({
        ...assunto,
        questoes: undefined,
      })),
    })),
    assuntos: materia.assuntos.map((assunto) => ({
      ...assunto,
      questoes: undefined,
    })),
  }));

  assert.throws(
    () =>
      validarPreservacaoMigracao({
        antes,
        depois: {
          ...antes,
          materias: semLinks,
        },
      }),
    /links de questões/
  );
});
