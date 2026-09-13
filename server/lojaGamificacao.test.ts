import assert from "node:assert/strict";
import test from "node:test";

import type { ConfiguracoesApp } from "../src/types/index.ts";
import {
  obterEstadoEconomia,
  type EstadoEconomia,
} from "../src/services/economiaGamificacao.ts";
import {
  CATALOGO_LOJA,
  comprarItemLoja,
  desequiparTipoLoja,
  equiparItemLoja,
  itemEstaEquipado,
  itensDoInventario,
} from "../src/services/lojaGamificacao.ts";

function economiaComMoedas(moedas: number): EstadoEconomia {
  return {
    moedas,
    recompensasRecebidas: [],
    inventario: [],
    compras: [],
  };
}

test("catalogo da loja mantém apenas temas e molduras", () => {
  assert.ok(CATALOGO_LOJA.length > 0);
  assert.equal(CATALOGO_LOJA.every((item) => item.tipo === "tema" || item.tipo === "moldura"), true);
});

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
  const resultado = comprarItemLoja(economiaComMoedas(20), "tema-carbono");

  assert.match(resultado.erro ?? "", /Faltam 270 moedas/i);
  assert.equal(resultado.estado.moedas, 20);
  assert.deepEqual(resultado.estado.inventario, []);
});

test("moldura e tema usam slots independentes", () => {
  let estado = economiaComMoedas(1000);

  for (const itemId of ["moldura-aco", "tema-grafite"]) {
    estado = comprarItemLoja(estado, itemId).estado;
    estado = equiparItemLoja(estado, itemId).estado;
  }

  assert.equal(estado.molduraEquipada, "moldura-aco");
  assert.equal(estado.temaEquipado, "tema-grafite");

  const moldura = comprarItemLoja(economiaComMoedas(300), "moldura-aco").item;
  assert.ok(moldura);
  assert.equal(itemEstaEquipado(estado, moldura), true);
});

test("nao equipa item que nao foi comprado", () => {
  const resultado = equiparItemLoja(economiaComMoedas(500), "tema-carbono");
  assert.match(resultado.erro ?? "", /Compre este item/i);
  assert.equal(resultado.estado.temaEquipado, undefined);
});

test("desequipar tema preserva a compra no inventario", () => {
  let estado = economiaComMoedas(500);
  estado = comprarItemLoja(estado, "tema-grafite").estado;
  estado = equiparItemLoja(estado, "tema-grafite").estado;
  estado = desequiparTipoLoja(estado, "tema");

  assert.equal(estado.temaEquipado, undefined);
  assert.equal(estado.inventario?.includes("tema-grafite"), true);
  assert.equal(itensDoInventario(estado).some((item) => item.id === "tema-grafite"), true);
});

test("tema legado inativo sai das novas vendas sem sumir do inventario antigo", () => {
  const compraNova = comprarItemLoja(economiaComMoedas(1000), "tema-dourado-elite");
  assert.match(compraNova.erro ?? "", /não está disponível/i);

  const estadoAntigo: EstadoEconomia = {
    ...economiaComMoedas(0),
    inventario: ["tema-dourado-elite"],
  };
  const equipado = equiparItemLoja(estadoAntigo, "tema-dourado-elite");
  assert.equal(equipado.erro, undefined);
  assert.equal(equipado.estado.temaEquipado, "tema-dourado-elite");
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
