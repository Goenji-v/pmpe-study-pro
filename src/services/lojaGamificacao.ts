import type { EstadoEconomia } from "./economiaGamificacao";

export type TipoItemLoja = "tema" | "moldura";
export type RaridadeItemLoja = "comum" | "raro" | "epico" | "lendario";

export type ItemLoja = {
  id: string;
  tipo: TipoItemLoja;
  nome: string;
  descricao: string;
  preco: number;
  raridade: RaridadeItemLoja;
  icone: string;
  valorVisual: string;
};

export const CATALOGO_LOJA: ItemLoja[] = [
  {
    id: "moldura-aco",
    tipo: "moldura",
    nome: "Aço Azul",
    descricao: "Moldura limpa com brilho azul para o cartão de nível.",
    preco: 150,
    raridade: "comum",
    icone: "🔷",
    valorVisual: "aco",
  },
  {
    id: "moldura-tatica",
    tipo: "moldura",
    nome: "Tática",
    descricao: "Borda reforçada com aparência operacional.",
    preco: 240,
    raridade: "raro",
    icone: "🛡️",
    valorVisual: "tatica",
  },
  {
    id: "moldura-elite",
    tipo: "moldura",
    nome: "Elite Dourada",
    descricao: "Moldura dourada de alto destaque para o Dashboard.",
    preco: 420,
    raridade: "lendario",
    icone: "👑",
    valorVisual: "elite",
  },
  {
    id: "tema-azul-operacional",
    tipo: "tema",
    nome: "Azul Operacional",
    descricao: "Azul mais intenso nos destaques e na gamificação.",
    preco: 120,
    raridade: "comum",
    icone: "🔵",
    valorVisual: "azul-operacional",
  },
  {
    id: "tema-roxo-estrategico",
    tipo: "tema",
    nome: "Roxo Estratégico",
    descricao: "Acentos roxos para um visual mais tecnológico.",
    preco: 170,
    raridade: "raro",
    icone: "🟣",
    valorVisual: "roxo-estrategico",
  },
  {
    id: "tema-esmeralda-foco",
    tipo: "tema",
    nome: "Esmeralda Foco",
    descricao: "Destaques verdes para uma interface de foco e progresso.",
    preco: 190,
    raridade: "raro",
    icone: "🟢",
    valorVisual: "esmeralda-foco",
  },
  {
    id: "tema-dourado-elite",
    tipo: "tema",
    nome: "Dourado Elite",
    descricao: "Acentos dourados para quem quer o visual mais exclusivo.",
    preco: 330,
    raridade: "epico",
    icone: "🟡",
    valorVisual: "dourado-elite",
  },
];

export function encontrarItemLoja(itemId?: string | null) {
  if (!itemId) return undefined;
  return CATALOGO_LOJA.find((item) => item.id === itemId);
}

export function itensDoInventario(estado: EstadoEconomia) {
  const ids = new Set(estado.inventario ?? []);
  return CATALOGO_LOJA.filter((item) => ids.has(item.id));
}

export function itemEstaEquipado(estado: EstadoEconomia, item: ItemLoja) {
  if (item.tipo === "moldura") return estado.molduraEquipada === item.id;
  return estado.temaEquipado === item.id;
}

export function comprarItemLoja(
  estado: EstadoEconomia,
  itemId: string,
  agora = new Date()
): { estado: EstadoEconomia; item?: ItemLoja; erro?: string } {
  const item = encontrarItemLoja(itemId);
  if (!item) return { estado, erro: "Item não encontrado." };

  const inventario = new Set(estado.inventario ?? []);
  if (inventario.has(item.id)) {
    return { estado, item, erro: "Este item já está no seu inventário." };
  }

  if (estado.moedas < item.preco) {
    return {
      estado,
      item,
      erro: `Faltam ${item.preco - estado.moedas} moedas para comprar este item.`,
    };
  }

  inventario.add(item.id);
  const compradoEm = agora.toISOString();

  return {
    item,
    estado: {
      ...estado,
      moedas: estado.moedas - item.preco,
      inventario: [...inventario],
      compras: [
        ...(estado.compras ?? []),
        {
          id: `compra:${item.id}:${compradoEm}`,
          itemId: item.id,
          preco: item.preco,
          compradoEm,
        },
      ],
      atualizadoEm: compradoEm,
    },
  };
}

export function equiparItemLoja(
  estado: EstadoEconomia,
  itemId: string,
  agora = new Date()
): { estado: EstadoEconomia; item?: ItemLoja; erro?: string } {
  const item = encontrarItemLoja(itemId);
  if (!item) return { estado, erro: "Item não encontrado." };

  if (!(estado.inventario ?? []).includes(item.id)) {
    return { estado, item, erro: "Compre este item antes de equipar." };
  }

  const base = {
    ...estado,
    atualizadoEm: agora.toISOString(),
  };

  if (item.tipo === "moldura") {
    return { item, estado: { ...base, molduraEquipada: item.id } };
  }
  return { item, estado: { ...base, temaEquipado: item.id } };
}

export function desequiparTipoLoja(
  estado: EstadoEconomia,
  tipo: TipoItemLoja,
  agora = new Date()
): EstadoEconomia {
  const proximo = { ...estado, atualizadoEm: agora.toISOString() };
  if (tipo === "moldura") delete proximo.molduraEquipada;
  if (tipo === "tema") delete proximo.temaEquipado;
  return proximo;
}
