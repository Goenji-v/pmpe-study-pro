import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { QuestaoSimuladoPdfAnalisada } from "../src/services/simuladoPdfAnaliseService";
import type { CorrecaoQuestaoSimulado } from "../src/utils/analiseSimuladoStudyPro";
import { contarResultadoSimuladoPdf } from "../src/utils/contagemSimuladoPdf";
import {
  questoesDoAssuntoSalvo,
  rotuloStatusQuestaoSalva,
} from "../src/utils/diagnosticoHistoricoPdf";

function questao(numero: number): QuestaoSimuladoPdfAnalisada {
  return {
    numero,
    materia: "História",
    assunto: "Confederação do Equador",
    dificuldade: "Média",
    enunciado: "Enunciado de teste",
    alternativas: [],
    gabarito: "A",
    comentario: "",
    fonteGabarito: "ia",
    confianca: 99,
    status: "valida",
  };
}

test("simulado PDF de 60 questões separa acertos, erros e brancos", () => {
  const analise = {
    totalQuestoes: 60,
    questoes: Array.from({ length: 60 }, (_, i) => questao(i + 1)),
  };
  const respostas = Object.fromEntries(
    Array.from({ length: 50 }, (_, i) => [String(i + 1), i < 20 ? "A" : "B"])
  );
  assert.deepEqual(contarResultadoSimuladoPdf(analise, respostas), {
    certas: 20,
    erradas: 30,
    emBranco: 10,
    anuladas: 0,
    totalQuestoes: 60,
  });
});

test("anuladas e gabaritos não confiáveis não viram erro nem branco", () => {
  const analise = {
    totalQuestoes: 4,
    questoes: [
      questao(1),
      { ...questao(2), status: "anulada" as const },
      { ...questao(3), confianca: 30 },
      questao(4),
    ],
  };
  assert.deepEqual(contarResultadoSimuladoPdf(analise, { "1": "A", "2": "B" }), {
    certas: 1,
    erradas: 0,
    emBranco: 1,
    anuladas: 2,
    totalQuestoes: 4,
  });
});

function correcao(
  numero: number,
  modificacoes: Partial<CorrecaoQuestaoSimulado> = {}
): CorrecaoQuestaoSimulado {
  return {
    id: "pdf-" + numero,
    numero,
    materia: "Língua Portuguesa",
    modulo: "Geral",
    assunto: "Crase",
    subassunto: "Uso da crase",
    assuntoEspecifico: "Uso da crase",
    dificuldade: "Média",
    respostaAluno: "B",
    gabarito: "A",
    marcacao: "normal",
    status: "erro",
    ...modificacoes,
  };
}

test("o assunto consolidado reúne vários subassuntos sem misturar outra matéria", () => {
  const itens = [
    correcao(6, { subassunto: "Casos proibidos", status: "acerto" }),
    correcao(2),
    correcao(3, { materia: "História" }),
    correcao(4, { assunto: "Concordância" }),
    correcao(5, { status: "anulada" }),
    correcao(8, { modulo: "Outro módulo" }),
  ];
  const resultado = questoesDoAssuntoSalvo(itens, {
    chave: "lingua portuguesa::geral::crase",
  });
  assert.deepEqual(resultado.map((item) => item.numero), [2, 6]);
  assert.equal(rotuloStatusQuestaoSalva("erro"), "Erro");
  assert.equal(rotuloStatusQuestaoSalva("nao_respondida"), "Em branco");
  assert.equal(rotuloStatusQuestaoSalva("acerto_chute"), "Acerto por chute");
});

test("fechamento e histórico do PDF usam os dados detalhados preservados", async () => {
  const [sala, historico] = await Promise.all([
    readFile("src/pages/SimuladoPdf/SimuladoPdf.tsx", "utf8"),
    readFile("src/pages/Simulados/Simulados.tsx", "utf8"),
  ]);
  assert.match(sala, /contarResultadoSimuladoPdf\(analise, respostas\)/);
  assert.match(sala, /emBranco,\s*totalQuestoes: analise\.totalQuestoes/);
  assert.match(historico, /registro\.analise\.assuntos/);
  assert.match(historico, /questoesDoAssuntoSalvo\(/);
  assert.match(historico, /registro\.analise\.evolucao/);
  assert.match(historico, /Gabarito:/);
});
