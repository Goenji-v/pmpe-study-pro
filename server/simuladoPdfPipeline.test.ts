import assert from "node:assert/strict";
import test from "node:test";

import { executarPipelineQuestaoAPorQuestao } from "./simuladoPdfPipeline.ts";

type Item = {
  numero: number;
  extraida: boolean;
  pronta: boolean;
};

function itemExtraido(numero: number): Item {
  return { numero, extraida: true, pronta: false };
}

function itemPronto(numero: number): Item {
  return { numero, extraida: true, pronta: true };
}

test("pipeline salva questão por questão e retoma exatamente da pendente após queda", async () => {
  let salvo: Item[] = [];
  const resolvidasPrimeira: number[] = [];

  await assert.rejects(
    executarPipelineQuestaoAPorQuestao<Item>({
      totalQuestoes: 30,
      estadoAnterior: Array.from(
        { length: 10 },
        (_, indice) => itemPronto(indice + 1)
      ),
      temExtracao: (item) => item?.extraida === true,
      estaPronta: (item) => item?.pronta === true,
      extrair: async (numeros) => numeros.map(itemExtraido),
      resolver: async (item) => {
        resolvidasPrimeira.push(item.numero);
        if (item.numero === 23) {
          throw Object.assign(new Error("Gemini 503"), { status: 503 });
        }
        return itemPronto(item.numero);
      },
      salvar: async ({ itens }) => {
        salvo = structuredClone(itens);
      },
    }),
    /Gemini 503/
  );

  assert.deepEqual(
    resolvidasPrimeira,
    Array.from({ length: 13 }, (_, indice) => indice + 11)
  );
  assert.equal(
    salvo.filter((item) => item.pronta).length,
    22
  );
  assert.equal(
    salvo.find((item) => item.numero === 23)?.pronta,
    false
  );

  const resolvidasRetomada: number[] = [];
  const retomada = await executarPipelineQuestaoAPorQuestao<Item>({
    totalQuestoes: 30,
    estadoAnterior: salvo,
    temExtracao: (item) => item?.extraida === true,
    estaPronta: (item) => item?.pronta === true,
    extrair: async () => {
      throw new Error("não deveria reextrair");
    },
    resolver: async (item) => {
      resolvidasRetomada.push(item.numero);
      return itemPronto(item.numero);
    },
    salvar: async ({ itens }) => {
      salvo = structuredClone(itens);
    },
  });

  assert.deepEqual(
    resolvidasRetomada,
    [23, 24, 25, 26, 27, 28, 29, 30]
  );
  assert.equal(retomada.prontas, 30);
  assert.deepEqual(retomada.pendentes, []);
});

test("pipeline não reenvia para extração questões que já estavam extraídas", async () => {
  const gruposExtraidos: number[][] = [];

  const resultado = await executarPipelineQuestaoAPorQuestao<Item>({
    totalQuestoes: 12,
    estadoAnterior: [
      ...Array.from({ length: 4 }, (_, indice) =>
        itemPronto(indice + 1)
      ),
      ...Array.from({ length: 4 }, (_, indice) =>
        itemExtraido(indice + 5)
      ),
    ],
    temExtracao: (item) => item?.extraida === true,
    estaPronta: (item) => item?.pronta === true,
    extrair: async (numeros) => {
      gruposExtraidos.push([...numeros]);
      return numeros.map(itemExtraido);
    },
    resolver: async (item) => itemPronto(item.numero),
    salvar: async () => undefined,
  });

  assert.deepEqual(gruposExtraidos, [[9, 10, 11, 12]]);
  assert.equal(resultado.prontas, 12);
});

test("pipeline persiste extração antes de começar a resolver", async () => {
  const fases: string[] = [];

  await executarPipelineQuestaoAPorQuestao<Item>({
    totalQuestoes: 5,
    temExtracao: (item) => item?.extraida === true,
    estaPronta: (item) => item?.pronta === true,
    extrair: async (numeros) => numeros.map(itemExtraido),
    resolver: async (item) => itemPronto(item.numero),
    salvar: async ({ fase }) => {
      fases.push(fase);
    },
  });

  const primeiraResolucao = fases.indexOf("resolvendo");
  const ultimaExtracao = fases.lastIndexOf("extraindo");

  assert.ok(ultimaExtracao >= 0);
  assert.ok(primeiraResolucao > ultimaExtracao);
});
