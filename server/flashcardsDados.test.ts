import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

type Questao = {
  id: string;
  pergunta: string;
  alternativas: Array<{ id: string; texto: string }>;
  correta: string;
  explicacao: string;
  dica?: string;
};

type ArquivoQuestoes = {
  materia: string;
  topico: string;
  questoes: Questao[];
};

test("arquivo inicial de flashcards possui questões válidas", () => {
  const arquivo = JSON.parse(
    readFileSync(
      new URL(
        "../src/data/questoes/direitos-humanos.json",
        import.meta.url
      ),
      "utf8"
    )
  ) as ArquivoQuestoes;

  assert.equal(arquivo.materia, "Direitos Humanos");
  assert.equal(arquivo.questoes.length, 3);

  const ids = new Set<string>();

  for (const questao of arquivo.questoes) {
    assert.ok(questao.id);
    assert.ok(questao.pergunta);
    assert.ok(questao.explicacao);
    assert.ok(questao.alternativas.length >= 2);
    assert.ok(
      questao.alternativas.some(
        (alternativa) => alternativa.id === questao.correta
      )
    );
    assert.equal(ids.has(questao.id), false);
    ids.add(questao.id);
  }
});
