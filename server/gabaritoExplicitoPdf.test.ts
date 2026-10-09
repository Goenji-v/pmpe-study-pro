import assert from "node:assert/strict";
import test from "node:test";
import { validarGabaritoExplicitoDoCaderno } from "./gabaritoExplicitoPdf.ts";
import { analisarSimuladoStudyPro } from "../src/utils/analiseSimuladoStudyPro.ts";

// Referência transcrita do quadro GABARITO 04, ao final do
// "Simulado 04 – PM-PE (Soldado) – Pré-Edital 2026" (60 questões).
// Cada linha representa questões n, n+10, n+20, n+30, n+40, n+50.
const linhas = [
  "B A D E A C",
  "D D C B E C",
  "C C D E B D",
  "A E C A A D",
  "B E A B D B",
  "D A A C B B",
  "E D A D E D",
  "B A E A E D",
  "B B A E A C",
  "C B D B E E",
];

const referencia = linhas.flatMap((linha, indice) =>
  linha.split(" ").map((resposta, coluna) => ({
    numero: indice + 1 + coluna * 10,
    resposta,
    anulada: false,
  }))
).sort((a, b) => a.numero - b.numero);

function gabaritoDoCaderno(itens = referencia) {
  return {
    secaoGabaritoEncontrada: true,
    cabecalho: "GABARITO 04",
    itens,
  };
}

test("Simulado 04: gabarito impresso confirma 60 números únicos e 60 letras A–E", () => {
  assert.equal(referencia.length, 60);
  assert.deepEqual(referencia.map((item) => item.numero),
    Array.from({ length: 60 }, (_, indice) => indice + 1));
  assert.ok(referencia.every((item) => /^[A-E]$/.test(item.resposta)));
  const validado = validarGabaritoExplicitoDoCaderno(gabaritoDoCaderno(), 60);
  assert.equal(validado.length, 60);
  for (const numero of [1, 4, 16, 18, 21, 32, 42, 51, 60]) {
    assert.equal(validado[numero - 1].resposta, referencia[numero - 1].resposta);
  }
  assert.equal(validado[31].resposta, "B"); // Q32: confirmação cruzada no enunciado
});

test("não confunde resposta solta dentro da questão com quadro completo", () => {
  assert.deepEqual(
    validarGabaritoExplicitoDoCaderno(gabaritoDoCaderno([
      { numero: 32, resposta: "B", anulada: false },
    ]), 60), []
  );
  assert.deepEqual(
    validarGabaritoExplicitoDoCaderno({
      secaoGabaritoEncontrada: false,
      cabecalho: "",
      itens: referencia,
    }, 60), []
  );
});

test("rejeita gabarito incompleto, conflitante, cabeçalho inventado ou letras inválidas", () => {
  assert.deepEqual(
    validarGabaritoExplicitoDoCaderno(gabaritoDoCaderno(referencia.slice(0, 50)), 60),
    []
  );
  assert.deepEqual(
    validarGabaritoExplicitoDoCaderno(gabaritoDoCaderno([
      ...referencia,
      { numero: 32, resposta: "A", anulada: false },
    ]), 60), []
  );
  assert.deepEqual(
    validarGabaritoExplicitoDoCaderno({ ...gabaritoDoCaderno(), cabecalho: "ENUNCIADOS" }, 60),
    []
  );
  assert.deepEqual(
    validarGabaritoExplicitoDoCaderno(gabaritoDoCaderno(referencia.map((item) =>
      item.numero === 32 ? { ...item, resposta: "AB" } : item
    )), 60), []
  );
});

test("diagnóstico de 60 questões respeita gabarito real e separa seis disciplinas", () => {
  const materias = [
    "Língua Portuguesa",
    "História de Pernambuco",
    "Raciocínio Lógico",
    "Informática",
    "Direito Constitucional",
    "Direitos Humanos e Legislação Extravagante",
  ];
  const topicosConhecidos = new Map([
    [4, "Crase"],
    [16, "Guerra dos Mascates"],
    [18, "Confederação do Equador"],
    [19, "Confederação do Equador"],
    [21, "Simbologia e conectivos lógicos"],
    [32, "Hardware: tipos de memória"],
    [42, "Direitos e garantias fundamentais"],
    [56, "Lei de Drogas: flagrante e prova"],
  ]);
  const questoes = referencia.map((item) => ({
    id: `q-${item.numero}`,
    numero: item.numero,
    materia: materias[Math.floor((item.numero - 1) / 10)],
    assunto: topicosConhecidos.get(item.numero) ?? `Assunto da questão ${item.numero}`,
    dificuldade: "Média" as const,
    enunciado: `Questão ${item.numero}`,
    alternativas: "ABCDE".split("").map((id) => ({ id, texto: `Alternativa ${id}` })),
    gabarito: item.resposta,
  }));
  // Respostas de teste, não desempenho do usuário: cinco certas e cinco
  // erradas em cada disciplina, mantendo a mesma chave de 60 questões.
  const respostas = Object.fromEntries(questoes.map((item, indice) => [
    item.id,
    indice % 2 === 0
      ? item.gabarito
      : item.gabarito === "A" ? "B" : "A",
  ]));
  const diagnostico = analisarSimuladoStudyPro({
    tentativaId: "benchmark-simulado-04",
    nome: "Benchmark de regressão — Simulado 04",
    data: "2026-10-09",
    questoes,
    respostas,
  });
  assert.equal(diagnostico.resumo.totalQuestoes, 60);
  assert.equal(diagnostico.resumo.totalValidas, 60);
  assert.equal(diagnostico.resumo.totalAcertos, 30);
  assert.equal(diagnostico.resumo.totalErros, 30);
  assert.equal(diagnostico.correcao.length, 60);
  assert.equal(diagnostico.materias.length, 6);
  for (const materia of materias) {
    const total = diagnostico.materias.find((item) => item.materia === materia);
    assert.ok(total, `Faltou disciplina ${materia}`);
    assert.equal(total.avaliadas, 10);
    assert.equal(total.acertos, 5);
  }
  assert.equal(diagnostico.correcao.find((q) => q.numero === 18)?.assunto,
    "Confederação do Equador");
  assert.equal(diagnostico.correcao.find((q) => q.numero === 32)?.gabarito, "B");
});
