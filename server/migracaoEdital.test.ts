import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import type { Materia } from "../src/types/index.ts";
import type { CursoImportado } from "../src/types/cursos.ts";
import type {
  AnaliseEdital,
  ConfiguracoesComEdital,
} from "../src/types/editalInteligente.ts";
import { planejarMigracaoEdital } from "../src/utils/migracaoEdital.ts";
import {
  gerarPlanoEdital,
  preservarIdsPlanoAnterior,
} from "../src/utils/planoEdital.ts";

const AGORA = "2026-10-03T10:00:00.000Z";

function editalAnterior(): AnaliseEdital {
  return {
    concursoDetectado: "PMPE 2024",
    bancaDetectada: "AOCP",
    analisadoEm: AGORA,
    materias: [
      {
        id: "ed24-dh",
        nome: "Direitos Humanos",
        incidenciaEstimada: 4,
        assuntos: [
          {
            id: "ed24-teoria",
            nome: "Teoria geral dos Direitos Humanos",
            prioridade: "alta",
          },
          {
            id: "ed24-dudh",
            nome: "Declaração Universal dos Direitos Humanos",
            prioridade: "alta",
          },
          {
            id: "ed24-antigo",
            nome: "Conteúdo antigo que saiu",
            prioridade: "baixa",
          },
        ],
      },
    ],
  };
}

function editalNovo(): AnaliseEdital {
  return {
    concursoDetectado: "PMPE 2026",
    bancaDetectada: "AOCP",
    analisadoEm: "2026-10-03T10:01:00.000Z",
    materias: [
      {
        id: "ed26-dh",
        nome: "Direitos Humanos",
        incidenciaEstimada: 5,
        assuntos: [
          {
            id: "ed26-teoria",
            nome: "Teoria geral dos Direitos Humanos: conceito, terminologia e fundamentos",
            prioridade: "alta",
          },
          {
            id: "ed26-dudh",
            nome: "Declaração Universal dos Direitos Humanos",
            prioridade: "alta",
          },
          {
            id: "ed26-novo",
            nome: "Convenção Americana sobre Direitos Humanos",
            prioridade: "media",
          },
        ],
      },
    ],
  };
}

function materiasAtuais(): Materia[] {
  const assuntos = [
    {
      id: "conteudo-dh-teoria",
      nome: "Teoria geral dos Direitos Humanos",
      concluido: true,
      concluidoEm: AGORA,
      prioridade: "alta" as const,
      origemEditalId: "ed24-teoria",
      referenciasEdital: ["ed24-teoria"],
      questoes: "https://questoes.test/dh/teoria",
      anotacoes: "Minha anotação antiga",
      aulas: [
        {
          id: "aula-antiga",
          nome: "Aula antiga",
          url: "https://curso-antigo.test/teoria",
          ordem: 1,
          concluida: true,
          concluidaEm: AGORA,
        },
      ],
    },
    {
      id: "conteudo-dh-dudh",
      nome: "Declaração Universal dos Direitos Humanos",
      concluido: false,
      prioridade: "alta" as const,
      origemEditalId: "ed24-dudh",
      referenciasEdital: ["ed24-dudh"],
      questoes: "https://questoes.test/dh/dudh",
      aulas: [],
    },
    {
      id: "conteudo-dh-antigo",
      nome: "Conteúdo antigo que saiu",
      concluido: true,
      prioridade: "baixa" as const,
      origemEditalId: "ed24-antigo",
      referenciasEdital: ["ed24-antigo"],
      questoes: "https://questoes.test/dh/antigo",
      aulas: [],
    },
  ];

  return [
    {
      id: "conteudo-dh",
      nome: "Direitos Humanos",
      assuntos,
      modulos: [
        {
          id: "modulo-geral-conteudo-dh",
          nome: "Geral",
          ordem: 0,
          assuntos,
        },
      ],
    },
  ];
}

function cursoNovo(): CursoImportado {
  return {
    id: "curso-2026",
    nome: "Resumo do Concurseiro — PMPE 2026",
    origem: "captura-json",
    criadoEm: AGORA,
    atualizadoEm: AGORA,
    materias: [
      {
        id: "curso-2026-dh",
        nome: "Direitos Humanos",
        ordem: 1,
        categoria: "disciplina",
        modulos: [
          {
            id: "curso-2026-teoria",
            nome: "Teoria geral dos Direitos Humanos",
            ordem: 1,
            aulas: [
              {
                id: "curso-2026-teoria-aula",
                nome: "Teoria geral — aula nova",
                url: "https://curso-novo.test/teoria",
                ordem: 1,
              },
            ],
          },
        ],
      },
    ],
  };
}

function config(): ConfiguracoesComEdital {
  return {
    nomeUsuario: "Teste",
    concurso: "PMPE",
    bancaPadrao: "AOCP",
    metaQuestoesDiaria: 20,
    metaMinutosDiaria: 120,
    metaRevisoesDiaria: 2,
    missoesPorDia: 1,
    materiasPorDia: 1,
    tema: "escuro",
    diasEstudo: ["seg", "ter", "qua", "qui", "sex", "sab"],
  };
}

test("migração reaproveita ID canônico e preserva dados do assunto", () => {
  const plano = planejarMigracaoEdital({
    materiasAtuais: materiasAtuais(),
    editalAnterior: editalAnterior(),
    novoEdital: editalNovo(),
    cursos: [cursoNovo()],
    cursosAtivosIds: ["curso-2026"],
  });

  const materia = plano.materiasMigradas.find(
    (item) => item.id === "conteudo-dh"
  );
  assert.ok(materia);

  const teoria = materia.assuntos.find(
    (item) => item.id === "conteudo-dh-teoria"
  );
  assert.ok(teoria);
  assert.equal(teoria.concluido, true);
  assert.equal(teoria.anotacoes, "Minha anotação antiga");
  assert.equal(teoria.questoes, "https://questoes.test/dh/teoria");
  assert.equal(teoria.origemEditalId, "ed26-teoria");
  assert.ok(teoria.referenciasEdital?.includes("ed24-teoria"));
  assert.ok(teoria.referenciasEdital?.includes("ed26-teoria"));
});

test("curso novo atualiza aulas sem apagar link de questões existente", () => {
  const plano = planejarMigracaoEdital({
    materiasAtuais: materiasAtuais(),
    editalAnterior: editalAnterior(),
    novoEdital: editalNovo(),
    cursos: [cursoNovo()],
    cursosAtivosIds: ["curso-2026"],
  });

  const teoria = plano.materiasMigradas[0].assuntos.find(
    (item) => item.id === "conteudo-dh-teoria"
  );
  assert.ok(teoria);
  assert.equal(
    teoria.questoes,
    "https://questoes.test/dh/teoria"
  );
  assert.ok(
    teoria.aulas?.some(
      (aula) => aula.url === "https://curso-novo.test/teoria"
    )
  );
});

test("conteúdo que sai do edital é preservado e marcado como fora do edital atual", () => {
  const plano = planejarMigracaoEdital({
    materiasAtuais: materiasAtuais(),
    editalAnterior: editalAnterior(),
    novoEdital: editalNovo(),
    cursos: [],
    cursosAtivosIds: [],
  });

  const antigo = plano.materiasMigradas[0].assuntos.find(
    (item) => item.id === "conteudo-dh-antigo"
  );
  assert.ok(antigo);
  assert.equal(antigo.foraDoEditalAtual, true);
  assert.equal(antigo.complementarAoEdital, true);
  assert.equal(
    antigo.questoes,
    "https://questoes.test/dh/antigo"
  );
  assert.ok(
    plano.relatorio.itens.some(
      (item) =>
        item.status === "removido" &&
        item.assuntoCanonicoId === "conteudo-dh-antigo"
    )
  );
});

test("associação ambígua não reutiliza ID canônico automaticamente", () => {
  const novo = editalNovo();
  novo.materias[0].assuntos = [
    {
      id: "ed26-poder",
      nome: "Poder e organização",
      prioridade: "alta",
    },
  ];

  const assuntos = [
    {
      id: "poder-executivo",
      nome: "Poder Executivo e organização administrativa",
      concluido: false,
      prioridade: "alta" as const,
      aulas: [],
    },
    {
      id: "poder-legislativo",
      nome: "Poder Legislativo e organização",
      concluido: false,
      prioridade: "alta" as const,
      aulas: [],
    },
  ];

  const plano = planejarMigracaoEdital({
    materiasAtuais: [
      {
        id: "conteudo-dh",
        nome: "Direitos Humanos",
        assuntos,
        modulos: [
          {
            id: "geral",
            nome: "Geral",
            ordem: 0,
            assuntos,
          },
        ],
      },
    ],
    novoEdital: novo,
    cursos: [],
    cursosAtivosIds: [],
  });

  const item = plano.relatorio.itens.find(
    (registro) => registro.editalNovoId === "ed26-poder"
  );
  assert.ok(item);
  assert.notEqual(item.status, "mantido");
  assert.notEqual(item.status, "renomeado");
});

test("IDs de missões antigas são preservados quando o conteúdo canônico continua", () => {
  const migracao = planejarMigracaoEdital({
    materiasAtuais: materiasAtuais(),
    editalAnterior: editalAnterior(),
    novoEdital: editalNovo(),
    cursos: [],
    cursosAtivosIds: [],
  });

  const planoAntigo = gerarPlanoEdital(
    {
      ...editalAnterior(),
      materias: editalAnterior().materias.map((materia) => ({
        ...materia,
        conteudoCanonicoId: "conteudo-dh",
        assuntos: materia.assuntos.map((assunto) => ({
          ...assunto,
          conteudoCanonicoId:
            assunto.id === "ed24-teoria"
              ? "conteudo-dh-teoria"
              : assunto.id === "ed24-dudh"
                ? "conteudo-dh-dudh"
                : "conteudo-dh-antigo",
        })),
      })),
    },
    config(),
    materiasAtuais()
  );

  const planoNovo = gerarPlanoEdital(
    migracao.analiseMigrada,
    config(),
    migracao.materiasMigradas
  );
  const preservado = preservarIdsPlanoAnterior(
    planoNovo,
    planoAntigo
  );

  const missaoTeoriaAntiga = planoAntigo.semanas
    .flatMap((semana) => semana.dias)
    .flatMap((dia) => dia.missoes)
    .find((missao) => missao.assuntoId === "conteudo-dh-teoria");

  const missaoTeoriaNova = preservado.semanas
    .flatMap((semana) => semana.dias)
    .flatMap((dia) => dia.missoes)
    .find((missao) => missao.assuntoId === "conteudo-dh-teoria");

  assert.ok(missaoTeoriaAntiga);
  assert.ok(missaoTeoriaNova);
  assert.equal(missaoTeoriaNova.id, missaoTeoriaAntiga.id);
});

test("fluxo de aplicação exige backup pré-migração e gravação estrutural segura", async () => {
  const [pagina, contexto, backup] = await Promise.all([
    readFile("src/pages/MeuEdital/MeuEdital.tsx", "utf8"),
    readFile("src/context/AppContext.tsx", "utf8"),
    readFile(
      "src/services/seguranca/backupMigracaoEditalService.ts",
      "utf8"
    ),
  ]);

  assert.match(
    pagina,
    /criarBackupAutomaticoLocal\([\s\S]*"antes_migracao_edital"/
  );
  assert.match(
    pagina,
    /registrarBackupMigracaoEditalNaNuvem/
  );
  assert.match(
    pagina,
    /aplicarEstadoEstruturalSeguro/
  );
  assert.match(
    contexto,
    /salvarEstadoEstruturalComSeguranca/
  );
  assert.match(
    backup,
    /from\("backups"\)/
  );
});
