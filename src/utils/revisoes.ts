import type {
  EtapaRevisao,
  Revisao,
  SessaoEstudo,
  TipoSessao,
} from "../types";

export const INTERVALOS_REVISAO_DIAS: Record<EtapaRevisao, number> = {
  1: 1,
  2: 5,
  3: 7,
  4: 14,
  5: 30,
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
  const dataIdeal = adicionarDias(agora, INTERVALOS_REVISAO_DIAS[1]);
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
  // Finalizar uma etapa sempre a encerra, independentemente da nota.
  // O desempenho controla apenas a data do próximo ciclo: uma nota baixa
  // não reabre a mesma etapa como se ela não tivesse sido concluída.
  if (revisaoAtual.etapa >= 5) return null;
  const proximaEtapa = (revisaoAtual.etapa + 1) as EtapaRevisao;

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
    : revisaoAtual.desempenho === "media" ? 3 : INTERVALOS_REVISAO_DIAS[proximaEtapa];
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
    ...(typeof revisaoAtual.certas === "number" ? { certas: revisaoAtual.certas } : {}),
    ...(typeof revisaoAtual.erradas === "number" ? { erradas: revisaoAtual.erradas } : {}),
  };
}

export function preverProximaRevisaoPorDesempenho(params: {
  revisao: Revisao;
  desempenho: NonNullable<Revisao["desempenho"]>;
  revisoesExistentes?: Revisao[];
  limiteDiario?: number;
  agora?: Date;
}): Revisao | null {
  const agora = params.agora ?? new Date();
  return criarProximaRevisao(
    {
      ...params.revisao,
      desempenho: params.desempenho,
      concluida: true,
      dataConclusao: agora.toISOString(),
    },
    params.revisoesExistentes ?? [params.revisao],
    params.limiteDiario ?? 0,
    agora,
    "previsao-proxima-revisao"
  );
}

export function avaliarRevisaoPorQuestoes(total?: number, acertos?: number): NonNullable<Revisao["desempenho"]> | null {
  if (typeof total !== "number" || typeof acertos !== "number" ||
    !Number.isInteger(total) || !Number.isInteger(acertos) || total <= 0 || acertos < 0 || acertos > total) return null;
  const percentual = acertos / total;
  return percentual >= 0.8 ? "facil" : percentual >= 0.6 ? "media" : "dificil";
}

export function sessaoExigeResultadoQuestoes(
  tipo: TipoSessao,
  formatoRevisao?: "teoria" | "questoes"
) {
  return tipo === "questoes" ||
    tipo === "simulado" ||
    (tipo === "revisao" && formatoRevisao === "questoes");
}

export function resolverAvaliacaoRevisao(params: {
  formato: "teoria" | "questoes";
  avaliacaoManual: NonNullable<Revisao["desempenho"]>;
  total?: number;
  acertos?: number;
}): NonNullable<Revisao["desempenho"]> | null {
  if (params.formato === "teoria") {
    return params.avaliacaoManual;
  }

  return avaliarRevisaoPorQuestoes(
    params.total,
    params.acertos
  );
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
  resultadoMedido?: {
    certas: number;
    erradas: number;
    sessaoId?: string;
  };
}): Revisao[] {
  const {
    revisoes,
    revisaoId,
    desempenho,
    limiteDiario,
    agora,
    proximaId,
    sessao,
    resultadoMedido,
  } = params;
  const atual = revisoes.find((item) => item.id === revisaoId);
  if (!atual || atual.concluida || (sessao && !revisaoCorrespondeASessao(atual, sessao))) return revisoes;
  const concluida: Revisao = {
    ...atual,
    concluida: true,
    desempenho,
    dataConclusao: agora.toISOString(),
    ...(sessao
      ? {
          sessaoId: sessao.id,
          certas: sessao.quantidadeAcertos,
          erradas: sessao.quantidadeErros,
        }
      : resultadoMedido
        ? {
            sessaoId: resultadoMedido.sessaoId,
            certas: resultadoMedido.certas,
            erradas: resultadoMedido.erradas,
          }
        : {
            // Avaliação manual não é uma nova medição objetiva. Limpar o placar
            // evita que a próxima revisão reutilize acertos/erros de uma sessão
            // anterior e recomende teoria/questões com base em uma nota velha.
            sessaoId: undefined,
            certas: undefined,
            erradas: undefined,
          }),
  };
  const atualizadas = revisoes.map((item) => item.id === revisaoId ? concluida : item);
  const proxima = criarProximaRevisao(concluida, atualizadas, limiteDiario, agora, proximaId);
  return proxima ? [proxima, ...atualizadas] : atualizadas;
}

const JANELA_RECUPERACAO_REVISAO_MS = 72 * 60 * 60 * 1000;

function normalizarComparacao(valor: string | undefined) {
  return String(valor ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function sessaoOrfaCorrespondeARevisao(
  revisao: Revisao,
  sessao: SessaoEstudo,
  agora: Date
) {
  const revisaoVinculada =
    sessao.tipo === "revisao" &&
    sessao.revisaoId === revisao.id &&
    (revisaoCorrespondeASessao(revisao, sessao) ||
      // Recuperação restrita: IDs da grade podem ter mudado após a sessão.
      // Exige revisão vinculada explicitamente e nomes de matéria, assunto
      // e módulo compatíveis; não afrouxa a conclusão online.
      (Boolean(sessao.materia && sessao.assunto && revisao.materia && revisao.assunto) &&
        normalizarComparacao(sessao.materia) === normalizarComparacao(revisao.materia) &&
        normalizarComparacao(sessao.assunto) === normalizarComparacao(revisao.assunto) &&
        (!sessao.modulo || !revisao.modulo ||
          normalizarComparacao(sessao.modulo) === normalizarComparacao(revisao.modulo))));
  const sessaoOrfa =
    sessao.tipo === "questoes" && !sessao.revisaoId;

  if (!revisaoVinculada && !sessaoOrfa) return false;

  // Revisão de teoria finalizada também é um resultado válido, sem
  // quantidade de questões. Questões seguem exigindo placar consistente.
  const exigePlacar = sessaoOrfa || sessao.formatoRevisao === "questoes";
  if (
    exigePlacar &&
    (!Number.isInteger(sessao.quantidadeQuestoes) ||
    !Number.isInteger(sessao.quantidadeAcertos) ||
    !Number.isInteger(sessao.quantidadeErros) ||
    (sessao.quantidadeQuestoes ?? 0) < 1 ||
    (sessao.quantidadeAcertos ?? -1) < 0 ||
    (sessao.quantidadeErros ?? -1) < 0 ||
    (sessao.quantidadeAcertos ?? 0) + (sessao.quantidadeErros ?? 0) !==
      sessao.quantidadeQuestoes)
  ) {
    return false;
  }

  const finalizadaEm = new Date(
    sessao.finalizadaEm ?? sessao.data
  ).getTime();
  const criadaEm = new Date(revisao.dataCriacao).getTime();
  const agoraMs = agora.getTime();

  if (
    !Number.isFinite(finalizadaEm) ||
    !Number.isFinite(criadaEm) ||
    finalizadaEm < criadaEm ||
    finalizadaEm > agoraMs ||
    agoraMs - finalizadaEm > JANELA_RECUPERACAO_REVISAO_MS
  ) {
    return false;
  }

  const materiaCompativel =
    sessao.materiaId && revisao.materiaId
      ? sessao.materiaId === revisao.materiaId
      : normalizarComparacao(sessao.materia) ===
        normalizarComparacao(revisao.materia);
  const assuntoCompativel =
    sessao.assuntoId && revisao.assuntoId
      ? sessao.assuntoId === revisao.assuntoId
      : normalizarComparacao(sessao.assunto) ===
        normalizarComparacao(revisao.assunto);
  const moduloCompativel =
    !sessao.moduloId ||
    !revisao.moduloId ||
    sessao.moduloId === revisao.moduloId;

  if (!revisaoVinculada && (!materiaCompativel || !assuntoCompativel || !moduloCompativel)) {
    return false;
  }

  // Se o ID explícito da revisão foi preservado, a conclusão pode ser
  // restaurada sem depender da observação textual da sessão.
  if (revisaoVinculada) return true;

  const objetivoEsperado = normalizarComparacao(
    `Revisar ${revisao.assunto}`
  );
  const observacaoEsperada = `revisao etapa ${revisao.etapa}`;

  return (
    normalizarComparacao(sessao.objetivo) === objetivoEsperado &&
    normalizarComparacao(sessao.observacao).startsWith(
      observacaoEsperada
    )
  );
}

export function recuperarConclusoesRevisaoPorSessoesOrfas(params: {
  revisoes: Revisao[];
  sessoes: SessaoEstudo[];
  limiteDiario: number;
  agora?: Date;
}) {
  const agora = params.agora ?? new Date();
  const sessoesDisponiveis = [...params.sessoes]
    .sort(
      (a, b) =>
        new Date(b.finalizadaEm ?? b.data).getTime() -
        new Date(a.finalizadaEm ?? a.data).getTime()
    );
  const sessoesUsadas = new Set<string>();
  const recuperadas: Array<{
    revisaoId: string;
    sessaoId: string;
  }> = [];
  let revisoesAtualizadas = params.revisoes;

  for (const revisao of params.revisoes.filter(
    (item) => !item.concluida
  )) {
    const sessao = sessoesDisponiveis.find(
      (item) =>
        !sessoesUsadas.has(item.id) &&
        sessaoOrfaCorrespondeARevisao(revisao, item, agora)
    );

    if (!sessao) continue;

    const desempenho =
      sessao.tipo === "revisao" && sessao.formatoRevisao !== "questoes"
        ? sessao.avaliacaoRevisao ?? null
        : avaliarRevisaoPorQuestoes(
            sessao.quantidadeQuestoes,
            sessao.quantidadeAcertos
          );

    if (!desempenho) continue;

    const proximaId =
      `${sessao.id}:revisao:${revisao.id}:recuperada`;

    revisoesAtualizadas = concluirRevisaoNaLista({
      revisoes: revisoesAtualizadas,
      revisaoId: revisao.id,
      desempenho,
      limiteDiario: params.limiteDiario,
      agora: new Date(sessao.finalizadaEm ?? sessao.data),
      proximaId,
      ...(Number.isInteger(sessao.quantidadeQuestoes)
        ? { resultadoMedido: {
            certas: sessao.quantidadeAcertos as number,
            erradas: sessao.quantidadeErros as number,
            sessaoId: sessao.id,
          } }
        : { resultadoMedido: {
            certas: 0,
            erradas: 0,
            sessaoId: sessao.id,
          } }),
    });

    const concluida = revisoesAtualizadas.find(
      (item) => item.id === revisao.id
    );

    if (concluida?.concluida) {
      sessoesUsadas.add(sessao.id);
      recuperadas.push({
        revisaoId: revisao.id,
        sessaoId: sessao.id,
      });
    }
  }

  return {
    revisoes: revisoesAtualizadas,
    recuperadas,
  };
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
  const ocupacao = new Map<string, number>();

  /*
   * A reorganização só empurra pendências para a frente quando o dia atingiu
   * o limite. Revisões futuras nunca são antecipadas e conclusões nunca mudam.
   * Itens atrasados entram a partir de hoje, preservando a ordem original.
   */
  const reorganizadas = pendentes.map((revisao) => {
    const original = inicioDoDia(new Date(revisao.dataPrevista));
    const candidatoInicial =
      original.getTime() < hoje.getTime()
        ? new Date(hoje)
        : new Date(original);
    const candidato = new Date(candidatoInicial);
    candidato.setHours(12, 0, 0, 0);

    for (let tentativa = 0; tentativa < 365; tentativa += 1) {
      const chave = chaveData(candidato);
      const quantidade = ocupacao.get(chave) ?? 0;
      if (quantidade < limiteDiario) {
        ocupacao.set(chave, quantidade + 1);
        break;
      }
      candidato.setDate(candidato.getDate() + 1);
    }

    return {
      ...revisao,
      dataPrevista: candidato.toISOString(),
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
