import type {
  EtapaRevisao,
  Revisao,
} from "../types";

const INTERVALOS_DIAS: Record<EtapaRevisao, number> = {
  1: 1,
  2: 7,
  3: 30,
  4: 90,
};

export function adicionarDias(
  data: Date,
  quantidadeDias: number
) {
  const novaData = new Date(data);

  novaData.setDate(
    novaData.getDate() + quantidadeDias
  );

  return novaData;
}

export function criarPrimeiraRevisao(params: {
  materiaId: string;
  moduloId?: string;
  assuntoId: string;
  materia: string;
  modulo?: string;
  assunto: string;
}): Revisao {
  const agora = new Date();

  return {
    id: crypto.randomUUID(),
    materiaId: params.materiaId,
    moduloId: params.moduloId,
    assuntoId: params.assuntoId,
    materia: params.materia,
    modulo: params.modulo,
    assunto: params.assunto,
    etapa: 1,
    dataCriacao: agora.toISOString(),
    dataPrevista: adicionarDias(
      agora,
      INTERVALOS_DIAS[1]
    ).toISOString(),
    concluida: false,
  };
}

export function criarProximaRevisao(
  revisaoAtual: Revisao
): Revisao | null {
  if (revisaoAtual.etapa >= 4) {
    return null;
  }

  const proximaEtapa = (
    revisaoAtual.etapa + 1
  ) as EtapaRevisao;

  const agora = new Date();

  return {
    id: crypto.randomUUID(),
    materiaId: revisaoAtual.materiaId,
    moduloId: revisaoAtual.moduloId,
    assuntoId: revisaoAtual.assuntoId,
    materia: revisaoAtual.materia,
    modulo: revisaoAtual.modulo,
    assunto: revisaoAtual.assunto,
    etapa: proximaEtapa,
    dataCriacao: agora.toISOString(),
    dataPrevista: adicionarDias(
      agora,
      INTERVALOS_DIAS[proximaEtapa]
    ).toISOString(),
    concluida: false,
  };
}

export function inicioDoDia(data: Date) {
  const resultado = new Date(data);

  resultado.setHours(0, 0, 0, 0);

  return resultado;
}

export function calcularDiasDiferenca(
  dataPrevista: string
) {
  const hoje = inicioDoDia(new Date());

  const prevista = inicioDoDia(
    new Date(dataPrevista)
  );

  const diferenca =
    prevista.getTime() - hoje.getTime();

  return Math.round(
    diferenca / (1000 * 60 * 60 * 24)
  );
}

export function statusDaRevisao(
  dataPrevista: string
) {
  const diferenca =
    calcularDiasDiferenca(dataPrevista);

  if (diferenca < 0) {
    return "atrasada";
  }

  if (diferenca === 0) {
    return "hoje";
  }

  return "futura";
}

export function formatarDataRevisao(
  data: string
) {
  return new Date(data).toLocaleDateString(
    "pt-BR"
  );
}