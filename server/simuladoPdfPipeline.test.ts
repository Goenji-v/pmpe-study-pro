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

test("60 questões: falha 503 preserva checkpoint e retomada não refaz questões prontas", async () => {
  const totalQuestoes = 60;
  let persistidas: Item[] = [];
  const resolvidasAntes: number[] = [];
  const checkpoint = async ({ itens }: { itens: Item[] }) => {
    persistidas = structuredClone(itens);
  };

  await assert.rejects(
    executarPipelineQuestaoAPorQuestao<Item>({
      totalQuestoes,
      temExtracao: (item) => item?.extraida === true,
      estaPronta: (item) => item?.pronta === true,
      extrair: async (numeros) => numeros.map(itemExtraido),
      resolver: async (item) => {
        resolvidasAntes.push(item.numero);
        if (item.numero === 37) throw Object.assign(new Error("503 temporário"), { status: 503 });
        return itemPronto(item.numero);
      },
      salvar: checkpoint,
    }),
    /503 temporário/
  );

  assert.equal(persistidas.length, 60);
  assert.equal(persistidas.filter((item) => item.pronta).length, 36);
  assert.equal(persistidas.find((item) => item.numero === 37)?.pronta, false);

  const retomadas: number[] = [];
  const resultado = await executarPipelineQuestaoAPorQuestao<Item>({
    totalQuestoes,
    estadoAnterior: persistidas,
    temExtracao: (item) => item?.extraida === true,
    estaPronta: (item) => item?.pronta === true,
    extrair: async () => { throw new Error("extração duplicada"); },
    resolver: async (item) => {
      retomadas.push(item.numero);
      return itemPronto(item.numero);
    },
    salvar: checkpoint,
  });

  assert.deepEqual(retomadas, Array.from({length:24}, (_, i)=>i+37));
  assert.equal(resultado.prontas, 60);
  assert.equal(resultado.pendentes.length, 0);
  assert.equal(new Set(resultado.itens.map((item) => item.numero)).size, 60);
});
test("checkpoint interrompido em 429 preserva respostas já corrigidas", async () => {
  let salvo: Item[] = [];
  await assert.rejects(
    executarPipelineQuestaoAPorQuestao<Item>({
      totalQuestoes: 8,
      estadoAnterior: [itemPronto(1), itemPronto(2)],
      temExtracao: (item) => item?.extraida === true,
      estaPronta: (item) => item?.pronta === true,
      extrair: async (numeros) => numeros.map(itemExtraido),
      resolver: async (item) => {
        if (item.numero === 5) throw Object.assign(new Error("limite 429"), { status: 429 });
        return itemPronto(item.numero);
      },
      salvar: async ({ itens }) => { salvo = structuredClone(itens); },
    }),
    /429/
  );
  assert.deepEqual(salvo.filter(x=>x.pronta).map(x=>x.numero),[1,2,3,4]);
});
