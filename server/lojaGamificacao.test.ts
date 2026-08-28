import assert from "node:assert/strict";
import test from "node:test";

import type { ConfiguracoesApp } from "../src/types/index.ts";
import {
  obterEstadoEconomia,
  type EstadoEconomia,
} from "../src/services/economiaGamificacao.ts";
import {
  comprarItemLoja,
  equiparItemLoja,
  itemEstaEquipado,
} from "../src/services/lojaGamificacao.ts";

function economiaComMoedas(moedas: number): EstadoEconomia {
  return {
    moedas,
    recompensasRecebidas: [],
    inventario: [],
    compras: [],
  };
}

test("compra desconta moedas uma vez e adiciona item permanentemente ao inventario", () => {
  const inicial = economiaComMoedas(300);
  const primeira = comprarItemLoja(inicial, "moldura-aco", new Date("2026-08-28T12:00:00Z"));

  assert.equal(primeira.erro, undefined);
  assert.equal(primeira.estado.moedas, 150);
  assert.deepEqual(primeira.estado.inventario, ["moldura-aco"]);
  assert.equal(primeira.estado.compras?.length, 1);

  const repetida = comprarItemLoja(primeira.estado, "moldura-aco");
  assert.match(repetida.erro ?? "", /já está/i);
  assert.equal(repetida.estado.moedas, 150);
  assert.equal(repetida.estado.compras?.length, 1);
});

test("nao permite comprar item sem saldo suficiente", () => {
  const resultado = comprarItemLoja(economiaComMoedas(20), "moldura-elite");

  assert.match(resultado.erro ?? "", /Faltam 400 moedas/i);
  assert.equal(resultado.estado.moedas, 20);
  assert.deepEqual(resultado.estado.inventario, []);
});

test("moldura e tema usam slots independentes", () => {
  let estado = economiaComMoedas(1000);

  for (const itemId of ["moldura-aco", "tema-roxo-estrategico"]) {
    estado = comprarItemLoja(estado, itemId).estado;
    estado = equiparItemLoja(estado, itemId).estado;
  }

  assert.equal(estado.molduraEquipada, "moldura-aco");
  assert.equal(estado.temaEquipado, "tema-roxo-estrategico");

  const moldura = comprarItemLoja(economiaComMoedas(300), "moldura-aco").item;
  assert.ok(moldura);
  assert.equal(itemEstaEquipado(estado, moldura), true);
});

test("nao equipa item que nao foi comprado", () => {
  const resultado = equiparItemLoja(economiaComMoedas(500), "tema-dourado-elite");
  assert.match(resultado.erro ?? "", /Compre este item/i);
  assert.equal(resultado.estado.temaEquipado, undefined);
});

test("normalizacao da economia preserva inventario compras e dados legados para migracao", () => {
  const configuracoes = {
    nomeUsuario: "Teste",
    concurso: "PMPE",
    bancaPadrao: "AOCP",
    metaQuestoesDiaria: 30,
    metaMinutosDiaria: 120,
    metaRevisoesDiaria: 2,
    tema: "escuro",
    economia: {
      moedas: 99,
      recompensasRecebidas: ["nivel:2"],
      inventario: ["titulo-disciplinado", "titulo-disciplinado", "moldura-aco"],
      compras: [
        {
          id: "c1",
          itemId: "titulo-disciplinado",
          preco: 120,
          compradoEm: "2026-08-28T12:00:00.000Z",
        },
      ],
      tituloEquipado: "titulo-disciplinado",
      molduraEquipada: "moldura-aco",
      temaEquipado: "tema-azul-operacional",
    },
  } as ConfiguracoesApp & { economia: EstadoEconomia };

  const estado = obterEstadoEconomia(configuracoes);
  assert.equal(estado.moedas, 99);
  assert.deepEqual(estado.inventario, ["titulo-disciplinado", "moldura-aco"]);
  assert.equal(estado.compras?.length, 1);
  assert.equal(estado.tituloEquipado, "titulo-disciplinado");
  assert.equal(estado.molduraEquipada, "moldura-aco");
  assert.equal(estado.temaEquipado, "tema-azul-operacional");
});
