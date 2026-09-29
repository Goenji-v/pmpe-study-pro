import assert from "node:assert/strict";
import test from "node:test";

import {
  executarBlocosSimuladoPdfPersistentes,
  resultadoSimuladoPdfPrecisaRetomar,
  type QuestaoSimuladoPdfProcessada,
  type ResultadoSimuladoPdfProcessado,
} from "./processarSimuladoPdfPersistente.ts";
import { analisarSimuladoStudyPro } from "../src/utils/analiseSimuladoStudyPro.ts";

function criarQuestao(numero: number): QuestaoSimuladoPdfProcessada {
  const letras = ["A", "B", "C", "D", "E"];
  return {
    numero,
    materia: numero <= 30 ? "Português" : "Matemática",
    assunto: numero <= 30 ? "Interpretação" : "Aritmética",
    dificuldade:
      numero % 3 === 0 ? "Difícil" : numero % 2 === 0 ? "Média" : "Fácil",
    enunciado: `Questão ${numero}`,
    alternativas: letras.map((id) => ({ id, texto: `Alternativa ${id}` })),
    gabarito: letras[(numero - 1) % letras.length],
    comentario: `Comentário da questão ${numero}`,
    fonteGabarito: "ia",
    confianca: 90,
    status: "valida",
  };
}

function questoesDoIntervalo(inicio: number, fim: number) {
  return Array.from(
    { length: fim - inicio + 1 },
    (_, indice) => criarQuestao(inicio + indice)
  );
}

test("60 questões: salva 1/6, falha, retoma de 2/6 e conclui 6/6 sem repetir bloco salvo", async () => {
  let parcial: ResultadoSimuladoPdfProcessado | undefined;
  const salvamentosPrimeiraExecucao: Array<{
    progresso: number;
    concluidos: number;
    quantidade: number;
  }> = [];
  const blocosPrimeiraExecucao: string[] = [];

  await assert.rejects(
    executarBlocosSimuladoPdfPersistentes({
      totalQuestoes: 60,
      analisar: async ({ inicio, fim }) => {
        blocosPrimeiraExecucao.push(`${inicio}-${fim}`);

        if (inicio === 11) {
          throw Object.assign(new Error("Gemini temporariamente indisponível"), {
            status: 503,
          });
        }

        return questoesDoIntervalo(inicio, fim);
      },
      salvar: async ({ progresso, concluidos, resultado }) => {
        parcial = structuredClone(resultado);
        salvamentosPrimeiraExecucao.push({
          progresso,
          concluidos,
          quantidade: resultado.questoes.length,
        });
      },
    }),
    /temporariamente indisponível/
  );

  assert.deepEqual(blocosPrimeiraExecucao, ["1-10", "11-20"]);
  assert.ok(parcial);
  assert.equal(parcial.questoes.length, 10);
  assert.deepEqual(
    salvamentosPrimeiraExecucao.at(-1),
    { progresso: 28, concluidos: 1, quantidade: 10 }
  );

  const blocosRetomada: string[] = [];
  const salvamentosRetomada: Array<{
    progresso: number;
    concluidos: number;
    quantidade: number;
    descricao: string;
  }> = [];

  const retomada = await executarBlocosSimuladoPdfPersistentes({
    totalQuestoes: 60,
    resultadoAnterior: parcial,
    analisar: async ({ inicio, fim }) => {
      blocosRetomada.push(`${inicio}-${fim}`);
      return questoesDoIntervalo(inicio, fim);
    },
    salvar: async ({ progresso, concluidos, resultado, descricao }) => {
      parcial = structuredClone(resultado);
      salvamentosRetomada.push({
        progresso,
        concluidos,
        quantidade: resultado.questoes.length,
        descricao,
      });
    },
  });

  assert.deepEqual(blocosRetomada, [
    "11-20",
    "21-30",
    "31-40",
    "41-50",
    "51-60",
  ]);
  assert.equal(salvamentosRetomada[0].progresso, 28);
  assert.match(
    salvamentosRetomada[0].descricao,
    /Retomando análise: 1\/6 bloco\(s\) já estavam completos/
  );
  assert.deepEqual(
    salvamentosRetomada.at(-1) &&
      {
        progresso: salvamentosRetomada.at(-1)!.progresso,
        concluidos: salvamentosRetomada.at(-1)!.concluidos,
        quantidade: salvamentosRetomada.at(-1)!.quantidade,
      },
    { progresso: 90, concluidos: 6, quantidade: 60 }
  );

  const questoes = Array.from(retomada.porNumero.values()).sort(
    (a, b) => a.numero - b.numero
  );
  assert.equal(questoes.length, 60);
  assert.deepEqual(
    questoes.map((questao) => questao.numero),
    Array.from({ length: 60 }, (_, indice) => indice + 1)
  );

  const questoesDiagnostico = questoes.map((questao) => ({
    id: `q-${questao.numero}`,
    numero: questao.numero,
    materia: questao.materia,
    assunto: questao.assunto,
    dificuldade: questao.dificuldade,
    enunciado: questao.enunciado,
    alternativas: questao.alternativas,
    gabarito: questao.gabarito,
    explicacao: questao.comentario,
  }));

  const respostas = Object.fromEntries(
    questoesDiagnostico.map((questao, indice) => {
      const correta = questao.gabarito;
      const resposta =
        indice < 30
          ? correta
          : correta === "A"
            ? "B"
            : "A";
      return [questao.id, resposta];
    })
  );

  const diagnostico = analisarSimuladoStudyPro({
    tentativaId: "teste-60",
    nome: "Simulado automático 60 questões",
    data: "2026-09-28",
    questoes: questoesDiagnostico,
    respostas,
  });

  assert.equal(diagnostico.resumo.totalQuestoes, 60);
  assert.equal(diagnostico.resumo.totalValidas, 60);
  assert.equal(diagnostico.resumo.totalAcertos, 30);
  assert.equal(diagnostico.resumo.totalErros, 30);
  assert.equal(diagnostico.correcao.length, 60);
  assert.ok(diagnostico.materias.length >= 2);
  assert.ok(diagnostico.assuntos.length >= 2);
  assert.ok(diagnostico.cadernoErros.length > 0);
  assert.ok(diagnostico.planoRevisao.length > 0);
});


test("bloco parcial não conta como concluído e tenta recuperar somente as questões faltantes", async () => {
  const chamadas: Array<{
    inicio: number;
    fim: number;
    numerosEspecificos?: number[];
  }> = [];
  const salvamentos: Array<{
    concluidos: number;
    progresso: number;
    descricao: string;
  }> = [];

  const resultado = await executarBlocosSimuladoPdfPersistentes({
    totalQuestoes: 10,
    analisar: async (intervalo) => {
      chamadas.push(structuredClone(intervalo));

      if (!intervalo.numerosEspecificos) {
        return questoesDoIntervalo(1, 5);
      }

      return intervalo.numerosEspecificos.map(criarQuestao);
    },
    salvar: async ({ concluidos, progresso, descricao }) => {
      salvamentos.push({
        concluidos,
        progresso,
        descricao,
      });
    },
  });

  assert.equal(chamadas.length, 2);
  assert.deepEqual(chamadas[0], {
    inicio: 1,
    fim: 10,
  });
  assert.deepEqual(chamadas[1], {
    inicio: 6,
    fim: 10,
    numerosEspecificos: [6, 7, 8, 9, 10],
  });
  assert.equal(resultado.porNumero.size, 10);
  assert.equal(salvamentos.at(-1)?.concluidos, 1);
  assert.equal(salvamentos.at(-1)?.progresso, 90);
});

test("resultado com 50 questões em revisão não pode ser tratado como concluído", () => {
  const questoes = Array.from({ length: 60 }, (_, indice) => {
    const numero = indice + 1;

    if (numero >= 11 && numero <= 20) {
      return criarQuestao(numero);
    }

    return {
      ...criarQuestao(numero),
      materia: "Não classificada",
      assunto: "Revisão manual",
      gabarito: "",
      confianca: 0,
      status: "revisar" as const,
    };
  });

  assert.equal(
    resultadoSimuladoPdfPrecisaRetomar(
      {
        totalQuestoes: 60,
        questoes,
        alertas: [],
      },
      60
    ),
    true
  );

  assert.equal(
    resultadoSimuladoPdfPrecisaRetomar(
      {
        totalQuestoes: 60,
        questoes: Array.from(
          { length: 60 },
          (_, indice) => criarQuestao(indice + 1)
        ),
        alertas: [],
      },
      60
    ),
    false
  );
});
