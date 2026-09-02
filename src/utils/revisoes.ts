import type {
  EtapaRevisao,
  Revisao,
  SessaoEstudo,
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
  limiteDiario = 0,
  agora = new Date(),
  id: string = crypto.randomUUID()
): Revisao | null {
  const repetir = revisaoAtual.desempenho === "dificil" || revisaoAtual.desempenho === "media";
  if (!repetir && revisaoAtual.etapa >= 4) return null;
  const proximaEtapa = repetir ? revisaoAtual.etapa : (revisaoAtual.etapa + 1) as EtapaRevisao;

  const jaExiste = revisoesExistentes.some(
    (item) =>
      !item.concluida &&
      item.id !== revisaoAtual.id &&
      item.materiaId === revisaoAtual.materiaId &&
      item.assuntoId === revisaoAtual.assuntoId &&
      (!item.moduloId || !revisaoAtual.moduloId || item.moduloId === revisaoAtual.moduloId)
  );
  if (jaExiste) return null;

  const intervalo = revisaoAtual.desempenho === "dificil" ? 1
    : revisaoAtual.desempenho === "media" ? 3 : INTERVALOS_DIAS[proximaEtapa];
  const dataIdeal = adicionarDias(agora, intervalo);
  const dataPrevista = encontrarDataDisponivelParaRevisao({
    dataBase: dataIdeal,
    revisoes: revisoesExistentes,
    limiteDiario,
  });

  return {
    id,
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

export function avaliarRevisaoPorQuestoes(total?: number, acertos?: number): NonNullable<Revisao["desempenho"]> | null {
  if (typeof total !== "number" || typeof acertos !== "number" ||
    !Number.isInteger(total) || !Number.isInteger(acertos) || total <= 0 || acertos < 0 || acertos > total) return null;
  const percentual = acertos / total;
  return percentual >= 0.8 ? "facil" : percentual >= 0.5 ? "media" : "dificil";
}

export function revisaoCorrespondeASessao(revisao: Revisao, sessao: Pick<SessaoEstudo, "tipo" | "revisaoId" | "materiaId" | "moduloId" | "assuntoId" | "materia" | "assunto">) {
  const igual = (a: string, b: string) => a.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase() === b.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return sessao.tipo === "revisao" && revisao.id === sessao.revisaoId &&
    (sessao.materiaId ? sessao.materiaId === revisao.materiaId : igual(sessao.materia, revisao.materia)) &&
    (sessao.assuntoId ? sessao.assuntoId === revisao.assuntoId : igual(sessao.assunto, revisao.assunto)) &&
    (!sessao.moduloId || !revisao.moduloId || sessao.moduloId === revisao.moduloId);
}

/** Conclusão e próxima revisão entram juntas na mesma atualização do estado. */
export function concluirRevisaoNaLista(params: {
  revisoes: Revisao[];
  revisaoId: string;
  desempenho: NonNullable<Revisao["desempenho"]>;
  limiteDiario: number;
  agora: Date;
  proximaId: string;
  sessao?: SessaoEstudo;
}): Revisao[] {
  const { revisoes, revisaoId, desempenho, limiteDiario, agora, proximaId, sessao } = params;
  const atual = revisoes.find((item) => item.id === revisaoId);
  if (!atual || atual.concluida || (sessao && !revisaoCorrespondeASessao(atual, sessao))) return revisoes;
  const concluida: Revisao = {
    ...atual, concluida: true, desempenho, dataConclusao: agora.toISOString(),
    ...(sessao ? { sessaoId: sessao.id, certas: sessao.quantidadeAcertos, erradas: sessao.quantidadeErros } : {}),
  };
  const atualizadas = revisoes.map((item) => item.id === revisaoId ? concluida : item);
  const proxima = criarProximaRevisao(concluida, atualizadas, limiteDiario, agora, proximaId);
  return proxima ? [proxima, ...atualizadas] : atualizadas;
}

export function reagendarRevisao(revisao: Revisao, dias: number): Revisao {
  const base = inicioDoDia(new Date());
  const dataPrevista = adicionarDias(base, Math.max(1, Math.round(dias)));
  dataPrevista.setHours(12, 0, 0, 0);
  return {
    ...revisao,
    dataPrevista: dataPrevista.toISOString(),
    reagendadaEm: new Date().toISOString(),
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
        a.etapa - b.etapa ||
        new Date(a.dataCriacao).getTime() - new Date(b.dataCriacao).getTime()
    );

  const hoje = inicioDoDia(new Date());

  const reorganizadas = pendentes.map((revisao, indice) => {
    const deslocamentoDias = Math.floor(indice / limiteDiario);
    const prevista = adicionarDias(hoje, deslocamentoDias);
    prevista.setHours(12, 0, 0, 0);

    return {
      ...revisao,
      dataPrevista: prevista.toISOString(),
    };
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
