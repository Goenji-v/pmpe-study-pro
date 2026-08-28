import assert from "node:assert/strict";
import test from "node:test";

import type { ConfiguracoesApp } from "../src/types/index.ts";
import {
  obterEstadoEconomia,
  type EstadoEconomia,
} from "../src/services/economiaGamificacao.ts";
import {
  comprarItemLoja,
  desequiparTipoLoja,
  equiparItemLoja,
  itemEstaEquipado,
  itensDoInventario,
  obterWallpaperEquipadoId,
  type ItemLoja,
} from "../src/services/lojaGamificacao.ts";

function economiaComMoedas(moedas: number): EstadoEconomia {
  return {
    moedas,
    recompensasRecebidas: [],
    inventario: [],
    compras: [],
  };
}

const wallpaperTeste: ItemLoja = {
  id: "wallpaper:abc",
  idBanco: "abc",
  tipo: "wallpaper",
  nome: "Patrulha Noturna",
  descricao: "Teste de wallpaper responsivo.",
  preco: 260,
  raridade: "raro",
  icone: "🖼️",
  valorVisual: "patrulha-noturna",
  ativo: true,
  wallpaperDesktopUrl: "https://example.com/desktop.webp",
  wallpaperMobileUrl: "https://example.com/mobile.webp",
  wallpaperPreviewUrl: "https://example.com/preview.webp",
};

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

test("wallpaper remoto pode ser comprado e equipado sem misturar marcador com inventario visual", () => {
  const catalogo = [wallpaperTeste];
  const compra = comprarItemLoja(
    economiaComMoedas(500),
    wallpaperTeste.id,
    new Date("2026-08-28T13:00:00Z"),
    catalogo
  );

  assert.equal(compra.erro, undefined);
  assert.equal(compra.estado.moedas, 240);
  assert.deepEqual(compra.estado.inventario, [wallpaperTeste.id]);

  const equipado = equiparItemLoja(compra.estado, wallpaperTeste.id, new Date(), catalogo);
  assert.equal(equipado.erro, undefined);
  assert.equal(obterWallpaperEquipadoId(equipado.estado), wallpaperTeste.id);
  assert.equal(itemEstaEquipado(equipado.estado, wallpaperTeste), true);
  assert.deepEqual(itensDoInventario(equipado.estado, catalogo).map((item) => item.id), [wallpaperTeste.id]);
  assert.equal(equipado.estado.inventario?.filter((id) => id === wallpaperTeste.id).length, 1);
});

test("desequipar wallpaper preserva a compra no inventario", () => {
  const catalogo = [wallpaperTeste];
  let estado = comprarItemLoja(economiaComMoedas(500), wallpaperTeste.id, new Date(), catalogo).estado;
  estado = equiparItemLoja(estado, wallpaperTeste.id, new Date(), catalogo).estado;
  estado = desequiparTipoLoja(estado, "wallpaper");

  assert.equal(obterWallpaperEquipadoId(estado), undefined);
  assert.equal(estado.inventario?.includes(wallpaperTeste.id), true);
  assert.equal(itensDoInventario(estado, catalogo).length, 1);
});

test("wallpaper oculto nao aceita nova compra", () => {
  const oculto: ItemLoja = { ...wallpaperTeste, ativo: false };
  const resultado = comprarItemLoja(economiaComMoedas(1000), oculto.id, new Date(), [oculto]);
  assert.match(resultado.erro ?? "", /não está disponível/i);
  assert.equal(resultado.estado.moedas, 1000);
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
