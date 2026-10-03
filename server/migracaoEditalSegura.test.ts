import assert from "node:assert/strict";
import test from "node:test";

import type {
  Materia,
} from "../src/types/index.ts";
import type {
  AnaliseEdital,
  EditalAtivo,
  PlanoEdital,
} from "../src/types/editalInteligente.ts";
import type { CursoImportado } from "../src/types/cursos.ts";
import {
  criarEditalAnteriorSintetico,
  prepararMigracaoEditalSegura,
  remapearMissoesConcluidasPorConteudo,
  validarPreservacaoMigracao,
} from "../src/utils/migracaoEditalSegura.ts";
import {
  preservarIdsPlanoAnterior,
} from "../src/utils/planoEdital.ts";

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
    /link.*questões/
  );
});


test("curso novo substitui aula importada antiga sem apagar link de questões", () => {
  const materias = materiasAtuais();
  const teoria = materias[0].assuntos.find((item) => item.id === "dh-teoria");
  assert.ok(teoria);

  teoria.aulas = [
    {
      id: "curso:rdc:aula:teoria:link",
      nome: "Teoria Geral — aula antiga",
      url: "https://curso.test/antiga",
      ordem: 1,
      concluida: true,
      origemCurso: {
        cursoId: "rdc",
        cursoNome: "Resumo do Concurseiro — PMPE",
        materiaCursoId: "rdc-dh",
        materiaCursoNome: "Direitos Humanos",
        moduloCursoId: "rdc-teoria",
        moduloCursoNome: "Teoria geral dos Direitos Humanos",
        aulaCursoId: "teoria",
      },
    },
  ];
  materias[0].modulos![0].assuntos = materias[0].assuntos;

  const cursoNovo: CursoImportado = {
    id: "rdc",
    nome: "Resumo do Concurseiro — PMPE",
    origem: "captura-json",
    criadoEm: AGORA,
    atualizadoEm: AGORA,
    materias: [
      {
        id: "rdc-dh",
        nome: "Direitos Humanos",
        ordem: 1,
        categoria: "disciplina",
        modulos: [
          {
            id: "rdc-teoria",
            nome: "Teoria geral dos Direitos Humanos",
            ordem: 1,
            aulas: [
              {
                id: "teoria",
                nome: "Teoria Geral — aula atualizada",
                url: "https://curso.test/nova",
                ordem: 1,
              },
            ],
          },
        ],
      },
    ],
  };

  const resultado = prepararMigracaoEditalSegura({
    materiasAtuais: materias,
    editalAnterior: editalAnterior(),
    editalNovoId: "edital-2026",
    editalNovoNome: "PMPE 2026",
    analiseNova: novoEdital(),
    cursos: [cursoNovo],
    cursosAtivosIds: [cursoNovo.id],
    contagens: contagens(),
  });

  const materia = resultado.materiasMigradas.find(
    (item) => item.id === "materia-dh-canonica"
  );
  assert.ok(materia);
  const migrada = materia.assuntos.find((item) => item.id === "dh-teoria");
  assert.ok(migrada);

  assert.equal(migrada.questoes, "https://questoes.test/dh/teoria");
  assert.ok(
    migrada.aulas?.some((aula) => aula.url === "https://curso.test/nova")
  );
  assert.ok(
    !migrada.aulas?.some((aula) => aula.url === "https://curso.test/antiga")
  );
});

test("plano novo preserva ID da missão equivalente já existente", () => {
  const anterior: PlanoEdital = {
    versao: 4,
    id: "plano-antigo",
    titulo: "Plano antigo",
    geradoEm: AGORA,
    totalAssuntos: 1,
    totalSemanas: 1,
    diasEstudo: ["seg"],
    materiasPorDia: 1,
    minutosPorDia: 60,
    revisoesPorDia: 0,
    semanas: [
      {
        numero: 1,
        dias: [
          {
            id: "dia-antigo",
            semana: 1,
            diaSemana: "seg",
            nomeDia: "Segunda",
            minutosDisponiveis: 60,
            revisoesPlanejadas: 0,
            missoes: [
              {
                id: "missao-concluida-2024",
                ordem: 1,
                materiaId: "materia-dh-canonica",
                materia: "Direitos Humanos",
                assuntoId: "dh-dudh",
                assunto: "Declaração Universal dos Direitos Humanos",
                prioridade: "alta",
                duracaoMinutos: 60,
                metaQuestoes: 10,
              },
            ],
          },
        ],
      },
    ],
  };

  const novo: PlanoEdital = {
    ...anterior,
    id: "plano-novo",
    titulo: "Plano novo",
    semanas: [
      {
        numero: 1,
        dias: [
          {
            ...anterior.semanas[0].dias[0],
            id: "dia-novo",
            missoes: [
              {
                ...anterior.semanas[0].dias[0].missoes[0],
                id: "id-gerado-pelo-plano-novo",
                assunto: "Declaração Universal dos Direitos Humanos",
              },
            ],
          },
        ],
      },
    ],
  };

  const preservado = preservarIdsPlanoAnterior(novo, anterior);
  assert.equal(
    preservado.semanas[0].dias[0].missoes[0].id,
    "missao-concluida-2024"
  );
});


test("remapeia conclusão do plano legado só quando matéria e assunto canônicos coincidem", () => {
  const planoNovo: PlanoEdital = {
    versao: 4,
    id: "plano-2026",
    titulo: "Plano 2026",
    geradoEm: AGORA,
    totalAssuntos: 2,
    totalSemanas: 1,
    diasEstudo: ["seg"],
    materiasPorDia: 2,
    minutosPorDia: 120,
    revisoesPorDia: 0,
    semanas: [
      {
        numero: 1,
        dias: [
          {
            id: "novo-dia",
            semana: 1,
            diaSemana: "seg",
            nomeDia: "Segunda",
            minutosDisponiveis: 120,
            revisoesPlanejadas: 0,
            missoes: [
              {
                id: "nova-missao-equivalente",
                ordem: 1,
                materiaId: "direitos-humanos",
                materia: "Direitos Humanos",
                assuntoId: "direitos-humanos-dudh",
                assunto: "Declaração Universal dos Direitos Humanos",
                prioridade: "alta",
                duracaoMinutos: 60,
                metaQuestoes: 10,
              },
              {
                id: "nova-missao-dividida",
                ordem: 2,
                materiaId: "direitos-humanos",
                materia: "Direitos Humanos",
                assuntoId: "direitos-humanos-dudh-parte-2",
                assunto: "DUDH — parte nova",
                prioridade: "alta",
                duracaoMinutos: 60,
                metaQuestoes: 10,
              },
            ],
          },
        ],
      },
    ],
  };

  const resultado = remapearMissoesConcluidasPorConteudo({
    planoNovo,
    concluidasAtuais: ["s1-d1-m1"],
    referenciasLegadas: [
      {
        missaoId: "s1-d1-m1",
        materiaId: "direitos-humanos",
        assuntoId: "direitos-humanos-dudh",
      },
    ],
  });

  assert.ok(resultado.includes("s1-d1-m1"));
  assert.ok(resultado.includes("nova-missao-equivalente"));
  assert.ok(!resultado.includes("nova-missao-dividida"));
});


test("conta legada sem edital ativo ganha origem sintética antes da migração", () => {
  const sintetico = criarEditalAnteriorSintetico({
    materias: materiasAtuais(),
    concurso: "PMPE",
    banca: "AOCP",
  });

  assert.equal(sintetico.id, "estado-anterior-study-pro");
  assert.equal(sintetico.analise.materias.length, 1);
  assert.equal(sintetico.analise.materias[0].id, "materia-dh-canonica");
  assert.equal(sintetico.analise.materias[0].assuntos.length, 3);

  const resultado = prepararMigracaoEditalSegura({
    materiasAtuais: materiasAtuais(),
    editalAnterior: sintetico,
    editalNovoId: "edital-2026",
    editalNovoNome: "PMPE 2026",
    analiseNova: novoEdital(),
    cursos: [],
    cursosAtivosIds: [],
    contagens: contagens(),
  });

  assert.equal(resultado.relatorio.editalAnteriorId, "estado-anterior-study-pro");
  assert.equal(resultado.relatorio.resumo.removidosPreservados, 1);
});
