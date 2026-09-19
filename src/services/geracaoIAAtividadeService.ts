import { armazenamentoLocalDaConta as localStorage } from "./armazenamentoConta";

export type EtapaGeracaoIA =
  | "preparando"
  | "gerando"
  | "revisando"
  | "corrigindo"
  | "salvando"
  | "concluida"
  | "erro";

export type AtividadeGeracaoIA = {
  id: string;
  etapa: EtapaGeracaoIA;
  titulo: string;
  descricao: string;
  quantidade: number;
  blocoAtual: number;
  blocosTotal: number;
  criadaEm: string;
  atualizadaEm: string;
  erro?: string;
};

const CHAVE_ATIVIDADE_GERACAO_IA = "pmpe:geracao-ia:atividade";
export const EVENTO_ATIVIDADE_GERACAO_IA = "pmpe:geracao-ia:atividade-atualizada";

export function carregarAtividadeGeracaoIA(): AtividadeGeracaoIA | null {
  const salvo = localStorage.getItem(CHAVE_ATIVIDADE_GERACAO_IA);
  if (!salvo) return null;

  try {
    const valor = JSON.parse(salvo) as Partial<AtividadeGeracaoIA>;

    if (
      typeof valor.id !== "string" ||
      !etapaValida(valor.etapa) ||
      typeof valor.titulo !== "string" ||
      typeof valor.descricao !== "string"
    ) {
      localStorage.removeItem(CHAVE_ATIVIDADE_GERACAO_IA);
      return null;
    }

    return {
      id: valor.id,
      etapa: valor.etapa,
      titulo: valor.titulo,
      descricao: valor.descricao,
      quantidade: Math.max(0, Number(valor.quantidade) || 0),
      blocoAtual: Math.max(1, Number(valor.blocoAtual) || 1),
      blocosTotal: Math.max(1, Number(valor.blocosTotal) || 1),
      criadaEm:
        typeof valor.criadaEm === "string"
          ? valor.criadaEm
          : new Date().toISOString(),
      atualizadaEm:
        typeof valor.atualizadaEm === "string"
          ? valor.atualizadaEm
          : new Date().toISOString(),
      erro: typeof valor.erro === "string" ? valor.erro : undefined,
    };
  } catch {
    localStorage.removeItem(CHAVE_ATIVIDADE_GERACAO_IA);
    return null;
  }
}

export function salvarAtividadeGeracaoIA(
  atividade: AtividadeGeracaoIA | null
) {
  if (atividade) {
    localStorage.setItem(
      CHAVE_ATIVIDADE_GERACAO_IA,
      JSON.stringify({
        ...atividade,
        atualizadaEm: new Date().toISOString(),
      })
    );
  } else {
    localStorage.removeItem(CHAVE_ATIVIDADE_GERACAO_IA);
  }

  window.dispatchEvent(new Event(EVENTO_ATIVIDADE_GERACAO_IA));
}

export function calcularProgressoAtividadeGeracaoIA(
  atividade: AtividadeGeracaoIA
) {
  if (atividade.etapa === "concluida") return 100;
  if (atividade.etapa === "erro") return Math.max(8, progressoPorBloco(atividade));

  if (atividade.etapa === "salvando") return 92;

  return progressoPorBloco(atividade);
}

function progressoPorBloco(atividade: AtividadeGeracaoIA) {
  const total = Math.max(1, atividade.blocosTotal);
  const atual = Math.min(total, Math.max(1, atividade.blocoAtual));
  const anterior = (atual - 1) / total;
  const fracaoEtapa =
    atividade.etapa === "revisando"
      ? 0.72
      : atividade.etapa === "corrigindo"
        ? 0.86
        : atividade.etapa === "gerando"
          ? 0.36
          : 0.12;

  return Math.min(90, Math.round((anterior + fracaoEtapa / total) * 90));
}

function etapaValida(valor: unknown): valor is EtapaGeracaoIA {
  return (
    valor === "preparando" ||
    valor === "gerando" ||
    valor === "revisando" ||
    valor === "corrigindo" ||
    valor === "salvando" ||
    valor === "concluida" ||
    valor === "erro"
  );
}
