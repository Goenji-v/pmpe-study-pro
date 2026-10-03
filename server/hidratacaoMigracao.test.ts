import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizarMateriasSemDuplicatasIdenticas,
} from "../src/utils/normalizarEstruturaEstado.ts";
import type { EstadoAppNuvem } from "../src/services/sincronizacaoService.ts";
import { deveAplicarMigracaoEstruturalRemota } from "../src/utils/migracaoEstruturalConta.ts";

function estado(
  migracaoEstruturalEm: string | undefined,
  assuntoId: string
): EstadoAppNuvem {
  return {
    schemaVersion: 18,
    versao: 18,
    materias: [
      {
        id: "historia",
        nome: "História de Pernambuco",
        modulos: [
          {
            id: "geral",
            nome: "Geral",
            ordem: 0,
            assuntos: [
              {
                id: assuntoId,
                nome: assuntoId,
                concluido: false,
                prioridade: "media",
                aulas: [],
              },
            ],
          },
        ],
        assuntos: [],
      },
    ],
    questoes: [],
    sessoes: [],
    revisoes: [],
    simulados: [],
    bancoQuestoes: [],
    simuladosGerados: [],
    configuracoes: {
      nomeUsuario: "Teste",
      concurso: "PMPE",
      bancaPadrao: "AOCP",
      metaQuestoesDiaria: 30,
      metaMinutosDiaria: 120,
      metaRevisoesDiaria: 2,
      missoesPorDia: 1,
      tema: "escuro",
      planoPadraoAtivo: false,
      migracaoEstruturalEm,
    },
    missoesConcluidas: [],
    salvoEm: "2026-10-03T17:37:24.861Z",
    syncRevision: 1,
    atualizadoEm: "2026-10-03T17:37:24.861Z",
  };
}

test("mesma geração remota vence quando a árvore local ficou parcialmente migrada", () => {
  const marcador = "2026-10-03T17:37:24.861Z";
  const local = estado(marcador, "historia-antiga");
  const remoto = estado(marcador, "historia-edital-2026");

  assert.equal(
    deveAplicarMigracaoEstruturalRemota(local, remoto),
    true
  );
});

test("mesma geração e mesma estrutura não força substituição", () => {
  const marcador = "2026-10-03T17:37:24.861Z";
  const local = estado(marcador, "historia-edital-2026");
  const remoto = estado(marcador, "historia-edital-2026");

  assert.equal(
    deveAplicarMigracaoEstruturalRemota(local, remoto),
    false
  );
});

test("normalização remove apenas duplicatas exatamente idênticas", () => {
  const aula = {
    id: "aula-25",
    nome: "Explicações iniciais",
    ordem: 1,
    url: "https://curso.test/25",
  };
  const assunto = {
    id: "historia-explicacoes-iniciais",
    nome: "Explicações iniciais",
    concluido: false,
    prioridade: "baixa" as const,
    aulas: [aula, { ...aula }],
  };

  const materias = normalizarMateriasSemDuplicatasIdenticas([
    {
      id: "historia",
      nome: "História de Pernambuco",
      modulos: [
        {
          id: "geral",
          nome: "Geral",
          ordem: 0,
          assuntos: [assunto, structuredClone(assunto)],
        },
      ],
      assuntos: [],
    },
  ]);

  assert.equal(materias[0].modulos?.[0].assuntos.length, 1);
  assert.equal(materias[0].modulos?.[0].assuntos[0].aulas?.length, 1);
});

