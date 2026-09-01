import assert from "node:assert/strict";
import test from "node:test";

import type { QuestaoIA } from "../src/types/index.ts";
import {
  assinaturaCadernoIA,
  fingerprintQuestaoIA,
  selecionarQuestoesParaReuso,
} from "../src/services/catalogoQuestoesIAUtils.ts";

function questao(
  id: string,
  materia: string,
  assunto: string,
  enunciado: string
): QuestaoIA {
  return {
    id,
    materia,
    modulo: "Geral",
    assunto,
    banca: "AOCP",
    dificuldade: "Média",
    enunciado,
    alternativas: {
      A: "Alternativa A",
      B: "Alternativa B",
      C: "Alternativa C",
      D: "Alternativa D",
      E: "Alternativa E",
    },
    respostaCorreta: "A",
    explicacao: "Explicação",
  };
}

test("cadernos diferentes não colidem quando a IA repete IDs numéricos", () => {
  const direitosHumanos = Array.from(
    { length: 10 },
    (_, indice) => questao(
      String(indice + 1),
      "Direitos Humanos",
      "Teoria geral",
      `Direitos humanos ${indice + 1}`
    )
  );

  const portugues = Array.from(
    { length: 10 },
    (_, indice) => questao(
      String(indice + 1),
      "Português",
      "Subordinação",
      `Subordinação ${indice + 1}`
    )
  );

  assert.notEqual(
    assinaturaCadernoIA(direitosHumanos),
    assinaturaCadernoIA(portugues)
  );
});

test("modo não respondidas reutiliza inéditas e calcula apenas o déficit", () => {
  const catalogo = [
    questao("1", "Português", "Verbos", "Questão 1"),
    questao("2", "Português", "Verbos", "Questão 2"),
    questao("3", "Português", "Verbos", "Questão 3"),
  ];

  const selecao = selecionarQuestoesParaReuso(
    catalogo,
    new Set(["1", "2"]),
    4,
    "nao_respondidas",
    () => 0.5
  );

  assert.deepEqual(selecao.reutilizadas.map((item) => item.id), ["3"]);
  assert.equal(selecao.quantidadeGerar, 3);
});

test("modo misturar evita chamada à IA quando o catálogo já cobre o pedido", () => {
  const catalogo = Array.from(
    { length: 10 },
    (_, indice) => questao(
      String(indice + 1),
      "Português",
      "Verbos",
      `Questão ${indice + 1}`
    )
  );

  const selecao = selecionarQuestoesParaReuso(
    catalogo,
    new Set(catalogo.map((item) => item.id)),
    10,
    "misturar",
    () => 0.5
  );

  assert.equal(selecao.reutilizadas.length, 10);
  assert.equal(selecao.quantidadeGerar, 0);
});

test("fingerprint ignora diferenças cosméticas de caixa e acento", async () => {
  const primeira = questao("1", "Português", "Subordinação", "Analise a oração.");
  const segunda = questao("2", "PORTUGUES", "subordinacao", "  Analise   a oração. ");

  assert.equal(
    await fingerprintQuestaoIA(primeira),
    await fingerprintQuestaoIA(segunda)
  );
});

test("fingerprint coincide com o contrato usado pela Edge Function", async () => {
  const exemplo = questao("1", "Português", "Subordinação", "Analise a oração.");

  assert.equal(
    await fingerprintQuestaoIA(exemplo),
    "49c5f3c3e063dff719fbe238b2bfeab9453ac45a32e623309c5ef40a1630177b"
  );
});

test("caderno antigo perde itens indisponíveis e recebe gabarito atual sem mudar a ordem", async () => {
  const { reconciliarQuestoesComCatalogo } = await import("../src/services/catalogoQuestoesIAUtils");
  const base = { id: "q1", materia: "Português", assunto: "Fonologia", banca: "AOCP", dificuldade: "Média" as const,
    enunciado: "Enunciado", alternativas: { A: "A", B: "B", C: "C", D: "D", E: "E" },
    respostaCorreta: "A" as const, explicacao: "Explicação" };
  const local = [{ ...base, materiaId: "portugues" }, { ...base, id: "anulada" }];
  const atual = [{ ...base, respostaCorreta: "B" as const, explicacao: "Corrigida" }];
  const resultado = reconciliarQuestoesComCatalogo(local, atual);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].respostaCorreta, "B");
  assert.equal(resultado[0].materiaId, "portugues");
  assert.equal(local.length, 2);
  assert.deepEqual(reconciliarQuestoesComCatalogo(local, []), []);
});
