import type { Revisao } from "../types";
import { materiaComRevisaoManual } from "./revisoesRegulares";
import { chaveAssuntoPrincipal } from "./revisoesAssuntoPrincipal";
import { encontrarDataDisponivelParaReforco } from "./agendadorReforcos";

export const MINIMO_QUESTOES_REVISAO_ADAPTATIVA = 5;

export type PrioridadeRevisaoAdaptativa =
  | "urgente"
  | "prioritaria"
  | "antecipada";

export type DiagnosticoRevisaoAdaptativa = {
  percentual: number;
  total: number;
  prioridade: PrioridadeRevisaoAdaptativa;
  diasParaRevisao: number;
};

export type ModoRevisaoRecomendado =
  | "teoria_questoes"
  | "questoes"
  | "ciclo_normal";

export type OrientacaoRevisao = {
  percentual: number;
  total: number;
  modo: ModoRevisaoRecomendado;
  quantidadeQuestoes: number;
  titulo: string;
  descricao: string;
};

export type PlanoRevisaoPendente = {
  modo: ModoRevisaoRecomendado | "teoria";
  formatoInicial: "teoria" | "questoes";
  quantidadeQuestoes: number;
  titulo: string;
  descricao: string;
  percentual?: number;
  total?: number;
};

export function planejarRevisaoPendente(
  revisao: Pick<Revisao, "etapa" | "certas" | "erradas" | "reforcoTeoriaRecomendado">
): PlanoRevisaoPendente {
  if (revisao.reforcoTeoriaRecomendado) {
    return {
      modo: "teoria_questoes",
      formatoInicial: "teoria",
      quantidadeQuestoes: 5,
      titulo: "Rever teoria e erros antes de novo treino",
      descricao: "Dois resultados seguidos abaixo de 60%: revise a explicação dos erros e resolva 5 questões direcionadas. A revisão atual permanece na data marcada, sem criar um ciclo paralelo.",
      percentual: typeof revisao.certas === "number" && typeof revisao.erradas === "number"
        ? calcularAproveitamentoQuestoes(revisao.certas, revisao.erradas)
        : undefined,
      total: typeof revisao.certas === "number" && typeof revisao.erradas === "number"
        ? revisao.certas + revisao.erradas : undefined,
    };
  }
  const orientacao = orientarRevisaoPorResultado(
    revisao.certas,
    revisao.erradas
  );

  if (revisao.etapa <= 2) {
    return {
      modo: "teoria",
      formatoInicial: "teoria",
      quantidadeQuestoes: orientacao?.quantidadeQuestoes ?? 10,
      titulo: "Revisão de teoria",
      descricao: "Nas duas primeiras etapas, consolide a teoria. Se desejar, resolva questões para medir o domínio do assunto.",
      percentual: orientacao?.percentual,
      total: orientacao?.total,
    };
  }

  if (orientacao) {
    return {
      ...orientacao,
      formatoInicial: orientacao.modo === "teoria_questoes" ? "teoria" : "questoes",
    };
  }

  return {
    modo: "questoes",
    formatoInicial: "questoes",
    quantidadeQuestoes: 10,
    titulo: "Questões — medir domínio",
    descricao:
      "A partir da terceira etapa, priorize questões mesmo sem nota anterior. Resolva 10 questões para medir o domínio e orientar o próximo retorno.",
  };
}

export function orientarRevisaoPorResultado(
  certas?: number,
  erradas?: number
): OrientacaoRevisao | null {
  if (
    typeof certas !== "number" ||
    typeof erradas !== "number" ||
    !Number.isInteger(certas) ||
    !Number.isInteger(erradas) ||
    certas < 0 ||
    erradas < 0
  ) {
    return null;
  }

  const total = certas + erradas;
  if (total < MINIMO_QUESTOES_REVISAO_ADAPTATIVA) return null;

  const percentual = Math.round((certas / total) * 100);

  if (percentual < 50) {
    return {
      percentual,
      total,
      modo: "teoria_questoes",
      quantidadeQuestoes: 12,
      titulo: "Teoria + questões",
      descricao:
        "Revise a teoria deste assunto e depois resolva de 10 a 15 novas questões do mesmo conteúdo.",
    };
  }

  if (percentual < 70) {
    return {
      percentual,
      total,
      modo: "questoes",
      quantidadeQuestoes: 8,
      titulo: "Revisão curta + questões",
      descricao:
        "Faça uma revisão curta dos pontos errados e depois resolva de 5 a 10 novas questões.",
    };
  }

  if (percentual < 80) {
    return {
      percentual,
      total,
      modo: "questoes",
      quantidadeQuestoes: 5,
      titulo: "Questões + revisão espaçada",
      descricao:
        "Confirme o domínio com novas questões e mantenha o assunto no ciclo de revisão espaçada.",
    };
  }

  return {
    percentual,
    total,
    modo: "ciclo_normal",
    quantidadeQuestoes: 5,
    titulo: "Assunto consolidado — manter revisão",
    descricao:
      "Bom domínio do assunto. Continue avançando no edital e mantenha a revisão espaçada por questões.",
  };
}

type AcaoRevisaoAdaptativa =
  | "ignorada"
  | "registrada"
  | "diagnostico"
  | "criada"
  | "atualizada";

type AplicarRevisaoAdaptativaParams = {
  revisoes: Revisao[];
  materiaId: string;
  moduloId?: string;
  assuntoId: string;
  materia: string;
  modulo?: string;
  assunto: string;
  certas: number;
  erradas: number;
  /** Obrigatório: resultado de questões isoladas não comprova aula concluída. */
  conteudoEstudado: boolean;
  limiteDiario?: number;
  /** ID da tentativa salva, para impedir repetição do mesmo resultado. */
  resultadoId?: string;
  agora?: Date;
  criarId?: () => string;
};

export type ResultadoRevisaoAdaptativa = {
  revisoes: Revisao[];
  acao: AcaoRevisaoAdaptativa;
  diagnostico: DiagnosticoRevisaoAdaptativa | null;
  /** Data efetiva após aplicar capacidade, não apenas data ideal do reforço. */
  dataAgendada?: string;
  adiadaPorCapacidade?: boolean;
  teoriaRecomendada?: boolean;
};

const PESO_PRIORIDADE: Record<PrioridadeRevisaoAdaptativa, number> = {
  urgente: 0,
  prioritaria: 1,
  antecipada: 2,
};

export function calcularAproveitamentoQuestoes(
  certas: number,
  erradas: number
) {
  const total = certas + erradas;
  if (total <= 0) return 0;
  return Math.round((certas / total) * 100);
}

export function diagnosticarRevisaoAdaptativa(
  certas: number,
  erradas: number
): DiagnosticoRevisaoAdaptativa | null {
  const total = certas + erradas;

  if (
    certas < 0 ||
    erradas < 0 ||
    total < MINIMO_QUESTOES_REVISAO_ADAPTATIVA
  ) {
    return null;
  }

  const percentualExato = (certas / total) * 100;
  const percentual = Math.round(percentualExato);

  if (percentualExato >= 75) {
    return null;
  }

  if (percentualExato < 40) {
    return {
      percentual,
      total,
      prioridade: "urgente",
      diasParaRevisao: 0,
    };
  }

  if (percentualExato < 60) {
    return {
      percentual,
      total,
      prioridade: "prioritaria",
      diasParaRevisao: 1,
    };
  }

  return {
    percentual,
    total,
    prioridade: "antecipada",
    diasParaRevisao: 2,
  };
}

export function aplicarRevisaoAdaptativa(
  params: AplicarRevisaoAdaptativaParams
): ResultadoRevisaoAdaptativa {
  if (materiaComRevisaoManual(params.materia)) return { revisoes: params.revisoes, acao: "ignorada", diagnostico: null };
  const diagnostico = diagnosticarRevisaoAdaptativa(
    params.certas, params.erradas
  );
  const total = params.certas + params.erradas;

  // Nota isolada não é comprovação de aula concluída.
  if (!params.conteudoEstudado) {
    return { revisoes: params.revisoes, acao: "diagnostico", diagnostico };
  }
  if (total < MINIMO_QUESTOES_REVISAO_ADAPTATIVA) {
    return { revisoes: params.revisoes, acao: "ignorada", diagnostico: null };
  }

  const indiceExistente = params.revisoes.findIndex((revisao) =>
    !revisao.concluida && !revisao.integradaEmId &&
    mesmaReferencia(revisao, params)
  );

  if (indiceExistente >= 0) {
    const existente = params.revisoes[indiceExistente];
    if (params.resultadoId &&
        existente.ultimaTentativaAdaptativaId === params.resultadoId) {
      return {
        revisoes: params.revisoes, acao: "ignorada", diagnostico,
        dataAgendada: existente.dataPrevista,
        teoriaRecomendada: Boolean(existente.reforcoTeoriaRecomendado),
      };
    }

    const baixo60 = params.certas / total < 0.6;
    const sequenciaAntiga = existente.sequenciaResultadosBaixos ??
      (existente.motivoAdaptativo === "baixo_desempenho" &&
        typeof existente.certas === "number" &&
        typeof existente.erradas === "number" &&
        existente.certas + existente.erradas >= MINIMO_QUESTOES_REVISAO_ADAPTATIVA &&
        existente.certas / (existente.certas + existente.erradas) < 0.6 ? 1 : 0);
    const sequencia = baixo60 ? Math.min(2, sequenciaAntiga + 1) : 0;
    const diagnosticoExistente =
      typeof existente.certas === "number" &&
      typeof existente.erradas === "number"
        ? diagnosticarRevisaoAdaptativa(existente.certas, existente.erradas)
        : null;
    const manterResultadoMaisCritico = Boolean(diagnostico &&
      diagnosticoExistente &&
      PESO_PRIORIDADE[diagnosticoExistente.prioridade] <=
        PESO_PRIORIDADE[diagnostico.prioridade]);

    // Uma revisão já aberta é a mesma pendência. Nova nota baixa NÃO
    // antecipa sua data nem reinicia a etapa. O treino permanece auditável
    // no histórico de questões, separado do ciclo de revisão.
    const atualizada: Revisao = {
      ...existente,
      certas: manterResultadoMaisCritico ? existente.certas : params.certas,
      erradas: manterResultadoMaisCritico ? existente.erradas : params.erradas,
      sequenciaResultadosBaixos: sequencia,
      reforcoTeoriaRecomendado: sequencia >= 2,
      ...(params.resultadoId
        ? { ultimaTentativaAdaptativaId: params.resultadoId } : {}),
    };
    return {
      revisoes: params.revisoes.map((item, indice) =>
        indice === indiceExistente ? atualizada : item
      ),
      acao: diagnostico ? "atualizada" : "registrada",
      diagnostico,
      dataAgendada: existente.dataPrevista,
      teoriaRecomendada: sequencia >= 2,
    };
  }

  if (!diagnostico) {
    return { revisoes: params.revisoes, acao: "ignorada", diagnostico: null };
  }

  // A família é a unidade da agenda. ID/título diferentes dentro da
  // mesma família não devem produzir uma segunda pendência.
  const chave = chaveAssuntoPrincipal(params);
  if (chave && params.revisoes.some((revisao) =>
    !revisao.concluida && !revisao.integradaEmId &&
    chaveAssuntoPrincipal(revisao) === chave
  )) {
    return { revisoes: params.revisoes, acao: "diagnostico", diagnostico };
  }

  const agora = params.agora ?? new Date();
  const dataIdeal = criarDataPrevista(agora, diagnostico.diasParaRevisao);
  const dataPrevista = encontrarDataDisponivelParaReforco({
    dataIdeal, agora, revisoes: params.revisoes,
    limiteDiario: params.limiteDiario ?? 0,
  });
  if (!dataPrevista) {
    // O treino foi salvo na tabela de questões, mas não prometemos uma
    // data de revisão fora da capacidade definida pelo estudante.
    return { revisoes: params.revisoes, acao: "diagnostico", diagnostico };
  }

  const novaRevisao: Revisao = {
    id: params.criarId?.() ?? crypto.randomUUID(),
    materiaId: params.materiaId,
    moduloId: params.moduloId,
    assuntoId: params.assuntoId,
    materia: params.materia,
    modulo: params.modulo,
    assunto: params.assunto,
    etapa: 1,
    dataCriacao: agora.toISOString(),
    dataPrevista: dataPrevista.toISOString(),
    concluida: false,
    certas: params.certas,
    erradas: params.erradas,
    motivoAdaptativo: "baixo_desempenho",
    sequenciaResultadosBaixos: params.certas / total < 0.6 ? 1 : 0,
    reforcoTeoriaRecomendado: false,
    ...(params.resultadoId
      ? { ultimaTentativaAdaptativaId: params.resultadoId } : {}),
  };
  return {
    revisoes: [novaRevisao, ...params.revisoes],
    acao: "criada",
    diagnostico,
    dataAgendada: novaRevisao.dataPrevista,
    adiadaPorCapacidade: dataPrevista.toDateString() !== dataIdeal.toDateString(),
    teoriaRecomendada: false,
  };
}

type AplicarRevisaoPorDuvidaParams = {
  revisoes: Revisao[];
  materiaId: string;
  moduloId?: string;
  assuntoId: string;
  materia: string;
  modulo?: string;
  assunto: string;
  limiteDiario?: number;
  agora?: Date;
  criarId?: () => string;
};

/**
 * Dúvida da aula concluída é reforço, não outro ciclo de revisão.
 * A revisão pendente existente (mesmo assunto ou família curada) conserva
 * ID, data e etapa. Se não houver, o agendador central encontra uma vaga.
 */
export function aplicarRevisaoPorDuvida(
  params: AplicarRevisaoPorDuvidaParams
): Pick<ResultadoRevisaoAdaptativa, "revisoes" | "acao"> {
  if (materiaComRevisaoManual(params.materia)) return { revisoes: params.revisoes, acao: "ignorada" };
  const chave = chaveAssuntoPrincipal(params);
  const existente = params.revisoes.find((revisao) =>
    !revisao.concluida && !revisao.integradaEmId &&
    (mesmaReferencia(revisao, params) ||
      (Boolean(chave) && chaveAssuntoPrincipal(revisao) === chave))
  );
  if (existente) {
    // A dúvida permanece registrada na sessão de estudo original.
    // Não antecipar uma pendência já aberta nem mudar sua origem/resultado.
    return { revisoes: params.revisoes, acao: "registrada" };
  }

  const agora = params.agora ?? new Date();
  const dataIdeal = criarDataPrevista(agora, 1);
  const dataPrevista = encontrarDataDisponivelParaReforco({
    dataIdeal, agora, revisoes: params.revisoes,
    limiteDiario: params.limiteDiario ?? 0,
    categoria: "reforco",
  });
  if (!dataPrevista) {
    return { revisoes: params.revisoes, acao: "diagnostico" };
  }

  const novaRevisao: Revisao = {
    id: params.criarId?.() ?? crypto.randomUUID(),
    materiaId: params.materiaId,
    moduloId: params.moduloId,
    assuntoId: params.assuntoId,
    materia: params.materia,
    modulo: params.modulo,
    assunto: params.assunto,
    etapa: 1,
    dataCriacao: agora.toISOString(),
    dataPrevista: dataPrevista.toISOString(),
    concluida: false,
    motivoAdaptativo: "duvida",
  };
  return { revisoes: [novaRevisao, ...params.revisoes], acao: "criada" };
}

export function rotuloPrioridadeRevisaoAdaptativa(
  prioridade: PrioridadeRevisaoAdaptativa
) {
  if (prioridade === "urgente") return "Revisão urgente";
  if (prioridade === "prioritaria") return "Revisão prioritária";
  return "Revisão antecipada";
}

function criarDataPrevista(
  agora: Date,
  dias: number
) {
  const data = new Date(agora);
  data.setDate(data.getDate() + dias);
  data.setHours(12, 0, 0, 0);
  return data;
}

function mesmaReferencia(
  revisao: Revisao,
  params: Pick<
    AplicarRevisaoAdaptativaParams,
    "materiaId" | "assuntoId" | "materia" | "assunto"
  >
) {
  if (
    revisao.materiaId === params.materiaId &&
    revisao.assuntoId === params.assuntoId
  ) {
    return true;
  }

  return (
    normalizar(revisao.materia) === normalizar(params.materia) &&
    normalizar(revisao.assunto) === normalizar(params.assunto)
  );
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
