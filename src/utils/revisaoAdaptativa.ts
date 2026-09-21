import type { Revisao } from "../types";

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

  if (percentual < 60) {
    return {
      percentual,
      total,
      modo: "teoria_questoes",
      quantidadeQuestoes: 10,
      titulo: "Reforçar o conteúdo",
      descricao:
        "Revise a aula, resumo ou material deste assunto antes de resolver 10 novas questões.",
    };
  }

  if (percentual < 80) {
    return {
      percentual,
      total,
      modo: "questoes",
      quantidadeQuestoes: 10,
      titulo: "Fixar por questões",
      descricao:
        "Seu desempenho já permite seguir por questões. Resolva 10 novas para confirmar a evolução.",
    };
  }

  return {
    percentual,
    total,
    modo: "ciclo_normal",
    quantidadeQuestoes: 10,
    titulo: "Manter o ciclo normal",
    descricao:
      "Bom domínio do assunto. Continue a revisão no ciclo normal, priorizando questões.",
  };
}

type AcaoRevisaoAdaptativa =
  | "ignorada"
  | "registrada"
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
  agora?: Date;
  criarId?: () => string;
};

export type ResultadoRevisaoAdaptativa = {
  revisoes: Revisao[];
  acao: AcaoRevisaoAdaptativa;
  diagnostico: DiagnosticoRevisaoAdaptativa | null;
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
  const diagnostico = diagnosticarRevisaoAdaptativa(
    params.certas,
    params.erradas
  );

  if (!diagnostico) {
    const total = params.certas + params.erradas;
    if (total < MINIMO_QUESTOES_REVISAO_ADAPTATIVA) {
      return {
        revisoes: params.revisoes,
        acao: "ignorada",
        diagnostico: null,
      };
    }

    const indiceExistente = params.revisoes.findIndex(
      (revisao) =>
        !revisao.concluida &&
        mesmaReferencia(revisao, params)
    );

    if (indiceExistente < 0) {
      return {
        revisoes: params.revisoes,
        acao: "ignorada",
        diagnostico: null,
      };
    }

    return {
      revisoes: params.revisoes.map((revisao, indice) =>
        indice === indiceExistente
          ? {
              ...revisao,
              certas: params.certas,
              erradas: params.erradas,
            }
          : revisao
      ),
      acao: "registrada",
      diagnostico: null,
    };
  }

  const agora = params.agora ?? new Date();
  const dataPrevista = criarDataPrevista(
    agora,
    diagnostico.diasParaRevisao
  );

  const indiceExistente = params.revisoes.findIndex(
    (revisao) =>
      !revisao.concluida &&
      mesmaReferencia(revisao, params)
  );

  if (indiceExistente >= 0) {
    const existente = params.revisoes[indiceExistente];
    const previstaExistente = new Date(existente.dataPrevista);
    const deveAntecipar =
      Number.isNaN(previstaExistente.getTime()) ||
      dataPrevista.getTime() < previstaExistente.getTime();

    const diagnosticoExistente =
      typeof existente.certas === "number" &&
      typeof existente.erradas === "number"
        ? diagnosticarRevisaoAdaptativa(
            existente.certas,
            existente.erradas
          )
        : null;

    const manterResultadoMaisCritico =
      diagnosticoExistente !== null &&
      PESO_PRIORIDADE[diagnosticoExistente.prioridade] <=
        PESO_PRIORIDADE[diagnostico.prioridade];

    const revisaoAtualizada: Revisao = {
      ...existente,
      materiaId: params.materiaId,
      moduloId: params.moduloId ?? existente.moduloId,
      assuntoId: params.assuntoId,
      materia: params.materia,
      modulo: params.modulo ?? existente.modulo,
      assunto: params.assunto,
      dataPrevista: deveAntecipar
        ? dataPrevista.toISOString()
        : existente.dataPrevista,
      certas: manterResultadoMaisCritico
        ? existente.certas
        : params.certas,
      erradas: manterResultadoMaisCritico
        ? existente.erradas
        : params.erradas,
    };

    return {
      revisoes: params.revisoes.map((revisao, indice) =>
        indice === indiceExistente ? revisaoAtualizada : revisao
      ),
      acao: "atualizada",
      diagnostico,
    };
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
  };

  return {
    revisoes: [novaRevisao, ...params.revisoes],
    acao: "criada",
    diagnostico,
  };
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
  params: AplicarRevisaoAdaptativaParams
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
