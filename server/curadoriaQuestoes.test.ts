import assert from "node:assert/strict";
import test from "node:test";

import {
  encontrarNumerosDuplicados,
  motivosImpedimentoPublicacao,
  normalizarIdentificadorEditorial,
  questaoElegivelParaPublicacao,
} from "../src/services/curadoriaQuestoesUtils";

import type { QuestaoBanco } from "../src/types";

const identidadePMPE = {
  concursoAlvo: "PMPE",
  editalAlvo: "PMPE 2024",
  concursoOrigem: "PMPE",
  cargoOrigem: "Soldado",
  anoOrigem: 2024,
  banca: "AOCP",
};

test("normaliza acentos, caixa e espaços da identidade editorial", () => {
  assert.equal(
    normalizarIdentificadorEditorial("  Polícia   Militar  "),
    "policia militar"
  );
});

test("detecta números repetidos da mesma prova mesmo com variação textual", () => {
  const duplicados = encontrarNumerosDuplicados(
    [
      {
        ...identidadePMPE,
        concursoAlvo: " pmpe ",
        cargoOrigem: "SOLDADO",
        banca: "aocp",
        numeroOriginal: 3,
      },
      { ...identidadePMPE, numeroOriginal: 4 },
      { ...identidadePMPE, cargoOrigem: "Oficial", numeroOriginal: 5 },
    ],
    identidadePMPE,
    [3, 4, 5, 6]
  );

  assert.deepEqual(duplicados, [3, 4]);
});

test("considera elegível somente questão pendente e editorialmente completa", () => {
  const questao = criarQuestao();

  assert.equal(questaoElegivelParaPublicacao(questao, true, true), true);
  assert.deepEqual(motivosImpedimentoPublicacao(questao, true, true), []);
});

test("bloqueia lote sem gabarito, fora do edital ou com edição incompleta", () => {
  const questao = criarQuestao({
    respostaCorretaId: "",
    compatibilidadeEdital: "fora",
    assunto: "",
    alternativas: [],
  });
  const motivos = motivosImpedimentoPublicacao(questao, true);

  assert.equal(motivos.includes("gabarito inválido ou ausente"), true);
  assert.equal(
    motivos.includes("compatibilidade com o edital não permite publicação"),
    true
  );
  assert.equal(motivos.includes("assunto não informado"), true);
  assert.equal(motivos.includes("alternativas insuficientes"), true);
});

test("não permite republicar em lote questão que deixou de estar pendente", () => {
  const questao = criarQuestao({ statusEditorial: "ativa" });

  assert.equal(questaoElegivelParaPublicacao(questao, true), false);
  assert.equal(
    motivosImpedimentoPublicacao(questao, true)
      .includes("a questão não está pendente"),
    true
  );
});

test("reserva publicação em lote para classificações de confiança alta", () => {
  const questao = criarQuestao({ confiancaClassificacao: "media" });

  assert.equal(questaoElegivelParaPublicacao(questao, true, true), false);
  assert.equal(
    motivosImpedimentoPublicacao(questao, true, true)
      .includes("confiança da classificação não é alta"),
    true
  );
  assert.equal(questaoElegivelParaPublicacao(questao, false, false), true);
});

function criarQuestao(alteracoes: Partial<QuestaoBanco> = {}): QuestaoBanco {
  return {
    id: "questao-3",
    materiaId: "portugues",
    materia: "Português",
    moduloId: "geral",
    modulo: "Geral",
    assuntoId: "semantica",
    assunto: "Semântica",
    banca: "AOCP",
    dificuldade: "media",
    enunciado: "Assinale a alternativa correta.",
    alternativas: [
      { id: "A", texto: "Alternativa A" },
      { id: "B", texto: "Alternativa B" },
    ],
    respostaCorretaId: "A",
    dataCriacao: "2026-08-20T00:00:00.000Z",
    statusEditorial: "pendente",
    compatibilidadeEdital: "direta",
    confiancaClassificacao: "alta",
    origem: "prova_oficial",
    ...alteracoes,
  };
}
