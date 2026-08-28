import type { EstadoEconomia } from "./economiaGamificacao";

const TITULOS_RETIRADOS = new Set([
  "titulo-disciplinado",
  "titulo-maquina-questoes",
  "titulo-mestre-revisao",
  "titulo-redator",
  "titulo-operacional",
]);

export function migrarTitulosRetiradosDaLoja(
  estado: EstadoEconomia,
  agora = new Date()
): { estado: EstadoEconomia; mudou: boolean; moedasReembolsadas: number } {
  const recebidas = new Set(estado.recompensasRecebidas);
  let moedasReembolsadas = 0;

  (estado.compras ?? []).forEach((compra) => {
    if (!TITULOS_RETIRADOS.has(compra.itemId)) return;
    const marcador = `reembolso-titulo:${compra.id}`;
    if (recebidas.has(marcador)) return;

    moedasReembolsadas += Math.max(0, Math.floor(Number(compra.preco) || 0));
    recebidas.add(marcador);
  });

  const inventarioAtual = estado.inventario ?? [];
  const inventario = inventarioAtual.filter((id) => !TITULOS_RETIRADOS.has(id));
  const tituloAntigoEquipado = Boolean(
    estado.tituloEquipado && TITULOS_RETIRADOS.has(estado.tituloEquipado)
  );

  const mudou =
    moedasReembolsadas > 0 ||
    inventario.length !== inventarioAtual.length ||
    tituloAntigoEquipado;

  if (!mudou) {
    return { estado, mudou: false, moedasReembolsadas: 0 };
  }

  const proximo: EstadoEconomia = {
    ...estado,
    moedas: estado.moedas + moedasReembolsadas,
    recompensasRecebidas: [...recebidas],
    inventario,
    atualizadoEm: agora.toISOString(),
  };

  if (tituloAntigoEquipado) delete proximo.tituloEquipado;

  return {
    estado: proximo,
    mudou: true,
    moedasReembolsadas,
  };
}
