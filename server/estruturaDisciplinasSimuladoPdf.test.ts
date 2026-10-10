import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import {
  validarSecoesDisciplinasDoPdf,
  materiaDoNumero,
  assuntoHistoricoDaAlternativaConfirmada,
  assuntoDeDocumentoCitadoNoEnunciado,
  subassuntoDeDocumentoCitadoNoEnunciado,
} from "./estruturaDisciplinasSimuladoPdf.ts";
import { analisarSimuladoStudyPro } from "../src/utils/analiseSimuladoStudyPro.ts";

// Cabeçalhos e intervalos do Simulado 04 de 60 questões, obtidos do
// caderno da PMPE (não de classificação inferida por questão).
const materias = [
  "LÍNGUA PORTUGUESA",
  "HISTÓRIA DE PERNAMBUCO",
  "RACIOCÍNIO LÓGICO",
  "INFORMÁTICA",
  "DIREITO CONSTITUCIONAL",
  "DIREITOS HUMANOS E LEGISLAÇÃO EXTRAVAGANTE",
];
const secoesBrutas = materias.map((materia, indice) => ({
  materia,
  cabecalho: materia,
  inicio: indice * 10 + 1,
  fim: (indice + 1) * 10,
}));

const chaves = [
  "B D C A B D E B B C",
  "A D C E E A D A B B",
  "D C D C A A A E A D",
  "E B E A B C D A E B",
  "A E B A D B E E A E",
  "C C D D B B D D C E",
].flatMap((linha) => linha.split(" "));

test("Simulado 04: respeita seis cabeçalhos e cobertura 1–60 sem inventar sétima matéria", () => {
  const secoes = validarSecoesDisciplinasDoPdf({ secoes: secoesBrutas }, 60);
  assert.equal(secoes.length, 6);
  assert.equal(new Set(secoes.map((item) => item.materia)).size, 6);
  assert.equal(chaves.length, 60);
  for (let numero = 1; numero <= 60; numero++) {
    assert.equal(materiaDoNumero(secoes, numero), materias[Math.floor((numero - 1) / 10)]);
  }
  assert.equal(materiaDoNumero(secoes, 0), null);
  assert.equal(materiaDoNumero(secoes, 61), null);
});

test("não aceita lacunas, sobreposições, título não impresso ou seção inventada", () => {
  const estrutura = { secoes: secoesBrutas };
  assert.deepEqual(validarSecoesDisciplinasDoPdf(estrutura, 100), []);
  assert.deepEqual(validarSecoesDisciplinasDoPdf({ secoes: [secoesBrutas[0]] }, 10), []);
  assert.deepEqual(validarSecoesDisciplinasDoPdf({
    secoes: secoesBrutas.map((s, i) => i === 2 ? { ...s, inicio: 19 } : s),
  }, 60), []);
  assert.deepEqual(validarSecoesDisciplinasDoPdf({
    secoes: secoesBrutas.map((s, i) => i === 3 ? { ...s, cabecalho: "MATEMÁTICA" } : s),
  }, 60), []);
  assert.deepEqual(validarSecoesDisciplinasDoPdf({
    secoes: secoesBrutas.map((s, i) => i === 3 ? { ...s, fim: 41 } : s),
  }, 60), []);
  assert.deepEqual(validarSecoesDisciplinasDoPdf({ secoes: [] }, 60), []);
});

const alternativas18 = [
  { id: "A", texto: "Confederação do Equador." },
  { id: "B", texto: "Insurreição Pernambucana." },
  { id: "C", texto: "Guerra dos Mascates." },
  { id: "D", texto: "Revolução Pernambucana." },
  { id: "E", texto: "Revolução Praieira." },
];
const alternativas19 = [
  { id: "A", texto: "Revolução Liberal" },
  { id: "B", texto: "Confederação do Equador." },
  { id: "C", texto: "Revolução Pernambucana." },
  { id: "D", texto: "Revolta de Felipe dos Santos." },
  { id: "E", texto: "Guerra dos Mascates." },
];

test("Q18 e Q19 identificam Confederação do Equador, não Brasil Império genérico", () => {
  assert.equal(assuntoHistoricoDaAlternativaConfirmada({
    materia: "HISTÓRIA DE PERNAMBUCO",
    enunciado: "O movimento republicano e separatista eclodiu em 1824 em Pernambuco. Estas informações referem-se à:",
    alternativas: alternativas18,
    gabarito: "A",
    gabaritoConfirmado: true,
  }), "Confederação do Equador");
  assert.equal(assuntoHistoricoDaAlternativaConfirmada({
    materia: "HISTÓRIA DE PERNAMBUCO",
    enunciado: "Foi um movimento político revolucionário de 1824 em Pernambuco. O texto acima refere-se a:",
    alternativas: alternativas19,
    gabarito: "B",
    gabaritoConfirmado: true,
  }), "Confederação do Equador");
});

test("não transforma alternativa em assunto se gabarito for palpite ou enunciado não pedir identificação", () => {
  const dados = {
    materia: "HISTÓRIA DE PERNAMBUCO",
    enunciado: "O texto refere-se à:",
    alternativas: alternativas18,
    gabarito: "A",
    gabaritoConfirmado: false,
  };
  assert.equal(assuntoHistoricoDaAlternativaConfirmada(dados), null);
  assert.equal(assuntoHistoricoDaAlternativaConfirmada({
    ...dados, gabaritoConfirmado: true, enunciado: "Assinale a afirmativa correta.",
  }), null);
  assert.equal(assuntoHistoricoDaAlternativaConfirmada({
    ...dados, materia: "RACIOCÍNIO LÓGICO", gabaritoConfirmado: true,
  }), null);
});

test("benchmark do diagnóstico respeita as seis disciplinas e 10 questões cada", () => {
  const secoes = validarSecoesDisciplinasDoPdf({ secoes: secoesBrutas }, 60);
  const questoes = chaves.map((gabarito, indice) => {
    const numero = indice + 1;
    return {
      id: `q${numero}`,
      numero,
      materia: materiaDoNumero(secoes, numero) as string,
      assunto: numero === 18 || numero === 19
        ? "Confederação do Equador"
        : `Tópico ${numero}`,
      dificuldade: "Média" as const,
      enunciado: `Enunciado ${numero}`,
      alternativas: "ABCDE".split("").map((id) => ({ id, texto: id })),
      gabarito,
    };
  });
  const respostas = Object.fromEntries(questoes.map((q) => [q.id, q.gabarito]));
  const diagnostico = analisarSimuladoStudyPro({
    tentativaId: "qa-simulado-04-estruturas",
    nome: "Regressão estrutura PDF 60Q",
    data: "2026-10-09",
    questoes,
    respostas,
  });
  assert.equal(diagnostico.resumo.totalQuestoes, 60);
  assert.equal(diagnostico.resumo.totalAcertos, 60);
  assert.equal(diagnostico.resumo.totalErros, 0);
  assert.equal(diagnostico.materias.length, 6);
  for (const materia of diagnostico.materias) {
    assert.equal(materia.avaliadas, 10, materia.materia);
  }
  assert.ok(diagnostico.assuntos.some((item) =>
    item.assunto === "Confederação do Equador"
  ));
});

test("pipeline real consulta seções do PDF e fixa a matéria na resolução e na conclusão", async () => {
  const codigo = await readFile("server/processarSimuladoPdfPersistente.ts", "utf8");
  assert.match(codigo, /extrairSecoesDisciplinasDoCaderno/);
  assert.match(codigo, /materiaDoNumero\(secoesDisciplinas, questao\.numero\)/);
  assert.match(codigo, /materia: materiaDoCaderno \?\? textoSeguro/);
  assert.match(codigo, /assuntoHistoricoDaAlternativaConfirmada/);
});

test("QA novo: questão 54 DUDH identifica documento e o artigo III pelo gabarito confirmado", () => {
  const enunciado = "A Declaração Universal dos Direitos Humanos prevê, no artigo III, que todo ser humano tem direito";
  const alternativas = [
    { id: "A", texto: "à vida, à liberdade e à democracia" },
    { id: "B", texto: "à vida, à família e ao trabalho" },
    { id: "C", texto: "à vida, à saúde e ao trabalho" },
    { id: "D", texto: "à vida, à segurança pessoal e ao pleno emprego" },
    { id: "E", texto: "à vida, à liberdade e à segurança pessoal" },
  ];
  assert.equal(
    assuntoDeDocumentoCitadoNoEnunciado(enunciado),
    "Declaração Universal dos Direitos Humanos (DUDH)"
  );
  assert.equal(
    subassuntoDeDocumentoCitadoNoEnunciado({
      enunciado,
      alternativas,
      gabarito: "E",
      gabaritoConfirmado: true,
    }),
    "Artigo III — direito à vida, à liberdade e à segurança pessoal"
  );
  assert.equal(
    subassuntoDeDocumentoCitadoNoEnunciado({
      enunciado, alternativas, gabarito: "E", gabaritoConfirmado: false,
    }), null
  );
  assert.equal(
    subassuntoDeDocumentoCitadoNoEnunciado({
      enunciado, alternativas, gabarito: "D", gabaritoConfirmado: true,
    }), null
  );
});

test("QA novo: questão 55 ECA não fica só como Crimes em espécie", () => {
  const enunciado = "É considerado crime previsto pelo Estatuto da Criança e do Adolescente (Lei nº 8069/90):";
  const alternativas = [
    { id: "A", texto: "vender, fornecer ainda que gratuitamente ou entregar, de qualquer forma, a criança ou adolescente arma, munição ou explosivo" },
    { id: "B", texto: "anunciar peças teatrais, filmes ou quaisquer representações" },
  ];
  assert.equal(
    assuntoDeDocumentoCitadoNoEnunciado(enunciado),
    "Estatuto da Criança e do Adolescente (ECA)"
  );
  assert.equal(
    subassuntoDeDocumentoCitadoNoEnunciado({
      enunciado, alternativas, gabarito: "A", gabaritoConfirmado: true,
    }),
    "Venda, fornecimento ou entrega de armas, munições ou explosivos a criança ou adolescente"
  );
  assert.equal(
    subassuntoDeDocumentoCitadoNoEnunciado({
      enunciado, alternativas, gabarito: "A", gabaritoConfirmado: false,
    }), null
  );
  assert.equal(
    assuntoDeDocumentoCitadoNoEnunciado("É considerado crime previsto na legislação especial:"),
    null
  );
  assert.equal(
    subassuntoDeDocumentoCitadoNoEnunciado({
      enunciado: "É considerado crime previsto na legislação especial:",
      alternativas, gabarito: "A", gabaritoConfirmado: true,
    }), null
  );
});

test("pipeline documental mantém assunto e subassunto específicos juntos", async () => {
  const codigo = await readFile("server/processarSimuladoPdfPersistente.ts", "utf8");
  assert.match(codigo, /subassuntoDeDocumentoCitadoNoEnunciado/);
  assert.match(codigo, /subassunto: subassuntoNormativo \?\? undefined/);
});
