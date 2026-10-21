import type { Revisao } from "../types";
import { inicioDoDia } from "./revisoes";

export type GrupoRevisoesCentral = {
  id: "atrasadas" | "hoje" | "amanha";
  titulo: string;
  itens: Revisao[];
};

/**
 * Resumo exclusivamente visual da Central de Estudos.
 * Mostra no máximo três revisões vencidas até amanhã; não cria nem altera
 * revisões, sessões, tempo ou métricas. A tela /revisoes é a lista completa.
 */
export function resumoRevisoesDaCentral(revisoes: Revisao[], agora = new Date()) {
  const totalPendentes = revisoes.filter((item) => !item.concluida).length;
  const hoje = inicioDoDia(agora).getTime();

  const elegiveis = revisoes
    .filter((item) => !item.concluida)
    .map((item) => {
      const instante = new Date(item.dataPrevista);
      if (!Number.isFinite(instante.getTime())) return null;
      const dias = Math.round(
        (inicioDoDia(instante).getTime() - hoje) / (24 * 60 * 60 * 1000)
      );
      return { item, dias, instante: instante.getTime() };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null && item.dias <= 1)
    .sort((a, b) => a.instante - b.instante || a.item.id.localeCompare(b.item.id));

  const selecionadas = elegiveis.slice(0, 3);
  const candidatos: GrupoRevisoesCentral[] = [
    {
      id: "atrasadas",
      titulo: "Atrasadas",
      itens: selecionadas.filter((item) => item.dias < 0).map((item) => item.item),
    },
    {
      id: "hoje",
      titulo: "Hoje",
      itens: selecionadas.filter((item) => item.dias === 0).map((item) => item.item),
    },
    {
      id: "amanha",
      titulo: "Amanhã",
      itens: selecionadas.filter((item) => item.dias === 1).map((item) => item.item),
    },
  ];
  const grupos = candidatos.filter((grupo) => grupo.itens.length > 0);

  return {
    grupos,
    totalPendentes,
    totalNoPeriodo: elegiveis.length,
    quantidadeExibida: selecionadas.length,
  };
}
