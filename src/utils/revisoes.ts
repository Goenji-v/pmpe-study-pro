import type {
  EtapaRevisao,
  Revisao,
} from "../types";

const INTERVALOS_DIAS: Record<EtapaRevisao, number> = {
  1: 0,
  2: 1,
  3: 7,
  4: 15,
};

export function adicionarDias(data: Date, quantidadeDias: number) {
  const novaData = new Date(data);
  novaData.setDate(novaData.getDate() + quantidadeDias);
  return novaData;
}

function chaveData(data: Date | string) {
  const valor = typeof data === "string" ? new Date(data) : data;
  const ano = valor.getFullYear();
  const mes = String(valor.getMonth() + 1).padStart(2, "0");
  const dia = String(valor.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

export function encontrarDataDisponivelParaRevisao(params: {
  dataBase: Date;
  revisoes: Revisao[];
  limiteDiario: number;
}): Date {
  const { dataBase, revisoes, limiteDiario } = params;
  if (!Number.isFinite(limiteDiario) || limiteDiario <= 0) return dataBase;

  const candidato = new Date(dataBase);
  candidato.setHours(12, 0, 0, 0);

  for (let i = 0; i < 365; i += 1) {
    const chave = chaveData(candidato);
    const quantidade = revisoes.filter(
      (revisao) => !revisao.concluida && chaveData(revisao.dataPrevista) === chave
    ).length;

    if (quantidade < limiteDiario) return candidato;
    candidato.setDate(candidato.getDate() + 1);
  }

  return candidato;
}

export function criarPrimeiraRevisao(params: {
  materiaId: string;
  moduloId?: string;
  assuntoId: string;
  materia: string;
  modulo?: string;
  assunto: string;
  revisoesExistentes?: Revisao[];
  limiteDiario?: number;
}): Revisao {
  const agora = new Date();
  const dataIdeal = adicionarDias(agora, INTERVALOS_DIAS[1]);
  const dataPrevista = encontrarDataDisponivelParaRevisao({
    dataBase: dataIdeal,
    revisoes: params.revisoesExistentes ?? [],
    limiteDiario: params.limiteDiario ?? 0,
  });

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
    dataPrevista: dataPrevista.toISOString(),
    concluida: false,
  };
}

export function criarProximaRevisao(
  revisaoAtual: Revisao,
  revisoesExistentes: Revisao[] = [],
  limiteDiario = 0
): Revisao | null {
  if (revisaoAtual.etapa >= 4) return null;

  const proximaEtapa = (revisaoAtual.etapa + 1) as EtapaRevisao;
  const agora = new Date();
  const dataIdeal = adicionarDias(agora, INTERVALOS_DIAS[proximaEtapa]);
  const dataPrevista = encontrarDataDisponivelParaRevisao({
    dataBase: dataIdeal,
    revisoes: revisoesExistentes,
    limiteDiario,
  });

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
    dataPrevista: dataPrevista.toISOString(),
    concluida: false,
  };
}

export function redistribuirRevisoesPendentes(
  revisoes: Revisao[],
  limiteDiario: number
): Revisao[] {
  if (!Number.isFinite(limiteDiario) || limiteDiario <= 0) return revisoes;

  const concluidas = revisoes.filter((revisao) => revisao.concluida);
  const pendentes = revisoes
    .filter((revisao) => !revisao.concluida)
    .sort(
      (a, b) =>
        new Date(a.dataPrevista).getTime() - new Date(b.dataPrevista).getTime() ||
        a.etapa - b.etapa
    );

  const ocupacao = new Map<string, number>();
  const hoje = inicioDoDia(new Date());

  const reorganizadas = pendentes.map((revisao) => {
    const original = inicioDoDia(new Date(revisao.dataPrevista));
    const inicio = original < hoje ? new Date(hoje) : new Date(original);
    const candidato = new Date(inicio);

    for (let i = 0; i < 365; i += 1) {
      const chave = chaveData(candidato);
      const quantidade = ocupacao.get(chave) ?? 0;
      if (quantidade < limiteDiario) {
        ocupacao.set(chave, quantidade + 1);
        const prevista = new Date(candidato);
        prevista.setHours(12, 0, 0, 0);
        return { ...revisao, dataPrevista: prevista.toISOString() };
      }
      candidato.setDate(candidato.getDate() + 1);
    }

    return revisao;
  });

  return [...reorganizadas, ...concluidas];
}

export function inicioDoDia(data: Date) {
  const resultado = new Date(data);
  resultado.setHours(0, 0, 0, 0);
  return resultado;
}

export function calcularDiasDiferenca(dataPrevista: string) {
  const hoje = inicioDoDia(new Date());
  const prevista = inicioDoDia(new Date(dataPrevista));
  const diferenca = prevista.getTime() - hoje.getTime();
  return Math.round(diferenca / (1000 * 60 * 60 * 24));
}

export function statusDaRevisao(dataPrevista: string) {
  const diferenca = calcularDiasDiferenca(dataPrevista);
  if (diferenca < 0) return "atrasada";
  if (diferenca === 0) return "hoje";
  return "futura";
}

export function formatarDataRevisao(data: string) {
  return new Date(data).toLocaleDateString("pt-BR");
}
