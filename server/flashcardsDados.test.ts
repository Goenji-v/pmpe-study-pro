import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import test from "node:test";

type Questao = {
  id: string;
  pergunta: string;
  alternativas: Array<{ id: string; texto: string }>;
  correta: string;
  explicacao: string;
  dica?: string;
};

type Pacote = {
  materia: string;
  topico: string;
  aliases?: string[];
  questoes: Questao[];
};

type ArquivoQuestoes =
  | Pacote
  | {
      materia: string;
      topicos: Array<{
        topico: string;
        aliases?: string[];
        questoes: Questao[];
      }>;
    };

function listarPacotes(arquivo: ArquivoQuestoes): Pacote[] {
  if ("topico" in arquivo) return [arquivo];

  return arquivo.topicos.map((topico) => ({
    materia: arquivo.materia,
    ...topico,
  }));
}

test("todos os arquivos de flashcards possuem questões válidas e ids únicos", () => {
  const diretorio = new URL("../src/data/questoes/", import.meta.url);
  const arquivos = readdirSync(diretorio)
    .filter((nome) => nome.endsWith(".json"))
    .sort();

  assert.ok(arquivos.length >= 1);

  const ids = new Set<string>();
  let totalQuestoes = 0;

  for (const nome of arquivos) {
    const arquivo = JSON.parse(
      readFileSync(new URL(nome, diretorio), "utf8")
    ) as ArquivoQuestoes;

    assert.ok(arquivo.materia);

    for (const pacote of listarPacotes(arquivo)) {
      assert.ok(pacote.topico);
      assert.ok(pacote.questoes.length > 0);

      for (const questao of pacote.questoes) {
        totalQuestoes += 1;
        assert.ok(questao.id);
        assert.ok(questao.pergunta);
        assert.ok(questao.explicacao);
        assert.ok(questao.alternativas.length >= 2);
        assert.ok(
          questao.alternativas.some(
            (alternativa) => alternativa.id === questao.correta
          )
        );
        assert.equal(
          ids.has(questao.id),
          false,
          `ID duplicado: ${questao.id}`
        );
        ids.add(questao.id);
      }
    }
  }

  assert.ok(totalQuestoes >= 3);
});
