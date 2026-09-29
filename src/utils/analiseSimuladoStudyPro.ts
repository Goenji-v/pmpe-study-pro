export type MarcacaoQuestaoSimulado =
  | "normal"
  | "nao_sei"
  | "nao_estudado"
  | "chutei";

export type MotivoErroSimulado =
  | "nao_sabia"
  | "confundi_regra"
  | "interpretei_errado"
  | "falta_atencao"
  | "chutei";

export type StatusQuestaoAnaliseSimulado =
  | "acerto"
  | "erro"
  | "acerto_chute"
  | "nao_respondida"
  | "nao_estudado"
  | "anulada";

export type DificuldadeQuestaoAnalise = "Fácil" | "Média" | "Difícil";

export type QuestaoAnaliseSimulado = {
  id: string;
  numero: number;
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  subassunto?: string;
  dificuldade: DificuldadeQuestaoAnalise;
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  gabarito: string;
  explicacao?: string;
  norma?: string;
  dispositivo?: string;
  anulada?: boolean;
};

export type HistoricoAnaliseSimulado = {
  tentativaId: string;
  data: string;
  dificuldadeGeral: string;
  materias: Array<{
    materia: string;
    aproveitamento: number;
  }>;
  assuntos: Array<{
    chave: string;
    percentual: number;
    erros: number;
    naoRespondidas: number;
    acertosPorChute: number;
  }>;
};

export type CorrecaoQuestaoSimulado = {
  id: string;
  numero: number;
  materia: string;
  modulo?: string;
  assunto: string;
  subassunto?: string;
  assuntoEspecifico: string;
  dificuldade: DificuldadeQuestaoAnalise;
  respostaAluno: string | null;
  gabarito: string;
  marcacao: MarcacaoQuestaoSimulado;
  motivoErro?: MotivoErroSimulado;
  status: StatusQuestaoAnaliseSimulado;
};

export type ResumoMateriaSimulado = {
  materia: string;
  total: number;
  avaliadas: number;
  acertos: number;
  acertosPorChute: number;
  erros: number;
  naoRespondidas: number;
  naoEstudadas: number;
  aproveitamento: number;
  impactoNota: number;
};

export type ClassificacaoDominio =
  | "Teoria + questões"
  | "Revisão curta + questões"
  | "Questões + revisão espaçada"
  | "Assunto consolidado — manter revisão"
  | "Ainda não estudado — manter cronograma";

export type NivelPrioridadeRevisao = "alta" | "media" | "baixa";

export type AnaliseAssuntoSimulado = {
  chave: string;
  materia: string;
  materiaId?: string;
  modulo?: string;
  moduloId?: string;
  assunto: string;
  assuntoId?: string;
  subassunto?: string;
  assuntoEspecifico: string;
  total: number;
  avaliadas: number;
  acertos: number;
  acertosPorChute: number;
  erros: number;
  naoRespondidas: number;
  naoEstudadas: number;
  percentual: number;
  dominio: ClassificacaoDominio;
  prioridade: NivelPrioridadeRevisao;
  prioridadeIndice: number;
  reincidencias: number;
  quantidadeQuestoesRecomendada: number;
  orientacao: string;
};

export type ItemCadernoErrosSimulado = {
  questaoId: string;
  numero: number;
  materia: string;
  assunto: string;
  assuntoEspecifico: string;
  enunciado: string;
  alternativas: Array<{ id: string; texto: string }>;
  respostaAluno: string | null;
  gabarito: string;
  status: "erro" | "acerto_chute";
  comentario: string;
  motivoProvavel: string;
  bizu: string;
  mnemonico?: string;
  oQueRevisar: string;
};

export type QuestaoNaoEstudadaSimulado = {
  questaoId: string;
  numero: number;
  materia: string;
  assunto: string;
  assuntoEspecifico: string;
};

export type PlanoRevisaoAssuntoSimulado = {
  chave: string;
  materia: string;
  assunto: string;
  assuntoEspecifico: string;
  prioridade: NivelPrioridadeRevisao;
  prioridadeIndice: number;
  acao: string;
  quantidadeQuestoes: number;
  agendaDias: number[];
  reincidencia: boolean;
};

export type EvolucaoMateriaSimulado = {
  materia: string;
  anterior: number;
  atual: number;
  variacaoPp: number;
  rotulo: string;
  dificuldadeAnterior?: string;
  dificuldadeAtual: string;
  observacao?: string;
};

export type DistribuicaoDificuldadeSimulado = {
  facil: { quantidade: number; percentual: number };
  media: { quantidade: number; percentual: number };
  dificil: { quantidade: number; percentual: number };
  geral: string;
};

export type AnaliseSimuladoStudyPro = {
  versao: 1;
  tentativaId: string;
  nome: string;
  data: string;
  correcao: CorrecaoQuestaoSimulado[];
  resumo: {
    totalQuestoes: number;
    totalValidas: number;
    totalAcertos: number;
    totalErros: number;
    totalNaoRespondidas: number;
    totalNaoEstudadas: number;
    totalAcertosPorChute: number;
    aproveitamentoGeral: number;
    melhorMateria: ResumoMateriaSimulado | null;
    piorMateria: ResumoMateriaSimulado | null;
    materiasMaisDerrubaram: ResumoMateriaSimulado[];
  };
  materias: ResumoMateriaSimulado[];
  assuntos: AnaliseAssuntoSimulado[];
  cadernoErros: ItemCadernoErrosSimulado[];
  aindaNaoEstudado: QuestaoNaoEstudadaSimulado[];
  planoRevisao: PlanoRevisaoAssuntoSimulado[];
  dificuldade: DistribuicaoDificuldadeSimulado;
  evolucao: EvolucaoMateriaSimulado[];
  recomendacaoFinal: string;
};

export type EntradaAnaliseSimulado = {
  tentativaId: string;
  nome: string;
  data: string;
  questoes: QuestaoAnaliseSimulado[];
  respostas: Record<string, string | undefined>;
  marcacoes?: Record<string, MarcacaoQuestaoSimulado | undefined>;
  motivosErro?: Record<string, MotivoErroSimulado | undefined>;
  historico?: HistoricoAnaliseSimulado[];
};

const AGENDA_REVISAO_DIAS = [1, 5, 7, 14, 30];
const MAX_PRIORIDADES_REVISAO = 8;
const MAX_PRIORIDADES_POR_MATERIA = 2;

export function analisarSimuladoStudyPro(
  entrada: EntradaAnaliseSimulado
): AnaliseSimuladoStudyPro {
  const marcacoes = entrada.marcacoes ?? {};
  const motivosErro = entrada.motivosErro ?? {};
  const historico = (entrada.historico ?? []).filter(
    (item) => item.tentativaId !== entrada.tentativaId
  );
  const questoes = entrada.questoes.map(normalizarTaxonomiaQuestao);

  const correcao = questoes.map((questao) => {
    const respostaAluno = normalizarResposta(entrada.respostas[questao.id]);
    const marcacao = marcacoes[questao.id] ?? "normal";
    const motivoErro = motivosErro[questao.id];
    const status = classificarQuestao({
      questao,
      respostaAluno,
      marcacao,
    });

    return {
      id: questao.id,
      numero: questao.numero,
      materia: questao.materia || "Sem matéria",
      modulo: questao.modulo,
      assunto: questao.assunto || "Sem assunto",
      subassunto: questao.subassunto,
      assuntoEspecifico: assuntoEspecifico(questao),
      dificuldade: questao.dificuldade,
      respostaAluno,
      gabarito: questao.gabarito,
      marcacao,
      motivoErro,
      status,
    } satisfies CorrecaoQuestaoSimulado;
  });

  const materias = calcularMaterias(correcao);
  const materiasComMaisErros = new Set(
    [...materias]
      .filter((item) => item.impactoNota > 0)
      .sort(
        (a, b) =>
          b.impactoNota - a.impactoNota ||
          a.aproveitamento - b.aproveitamento
      )
      .slice(0, 3)
      .map((item) => normalizarTexto(item.materia))
  );

  const assuntos = calcularAssuntos(
    questoes,
    correcao,
    historico,
    materiasComMaisErros
  );

  const resumo = calcularResumo(materias, correcao);
  const cadernoErros = gerarCadernoErros(
    questoes,
    correcao,
    motivosErro
  );
  const aindaNaoEstudado = gerarAindaNaoEstudado(correcao);
  const planoRevisao = gerarPlanoRevisao(assuntos);
  const dificuldade = calcularDificuldade(questoes);
  const evolucao = calcularEvolucao(materias, historico, dificuldade.geral);
  const recomendacaoFinal = gerarRecomendacaoFinal(
    materias,
    assuntos,
    aindaNaoEstudado
  );

  return {
    versao: 1,
    tentativaId: entrada.tentativaId,
    nome: entrada.nome,
    data: entrada.data,
    correcao,
    resumo,
    materias,
    assuntos,
    cadernoErros,
    aindaNaoEstudado,
    planoRevisao,
    dificuldade,
    evolucao,
    recomendacaoFinal,
  };
}

export function resumirAnaliseParaHistorico(
  analise: AnaliseSimuladoStudyPro
): HistoricoAnaliseSimulado {
  return {
    tentativaId: analise.tentativaId,
    data: analise.data,
    dificuldadeGeral: analise.dificuldade.geral,
    materias: analise.materias.map((item) => ({
      materia: item.materia,
      aproveitamento: item.aproveitamento,
    })),
    assuntos: analise.assuntos.map((item) => ({
      chave: item.chave,
      percentual: item.percentual,
      erros: item.erros,
      naoRespondidas: item.naoRespondidas,
      acertosPorChute: item.acertosPorChute,
    })),
  };
}

function classificarQuestao({
  questao,
  respostaAluno,
  marcacao,
}: {
  questao: QuestaoAnaliseSimulado;
  respostaAluno: string | null;
  marcacao: MarcacaoQuestaoSimulado;
}): StatusQuestaoAnaliseSimulado {
  if (questao.anulada) return "anulada";
  if (marcacao === "nao_estudado") return "nao_estudado";
  if (!respostaAluno) return "nao_respondida";

  const acertou =
    normalizarResposta(respostaAluno) === normalizarResposta(questao.gabarito);

  if (acertou && (marcacao === "chutei" || marcacao === "nao_sei")) {
    return "acerto_chute";
  }

  return acertou ? "acerto" : "erro";
}

function calcularMaterias(
  correcao: CorrecaoQuestaoSimulado[]
): ResumoMateriaSimulado[] {
  const mapa = new Map<
    string,
    Omit<ResumoMateriaSimulado, "aproveitamento" | "impactoNota">
  >();

  for (const item of correcao) {
    if (item.status === "anulada") continue;

    const chave = normalizarTexto(item.materia);
    const atual = mapa.get(chave) ?? {
      materia: item.materia,
      total: 0,
      avaliadas: 0,
      acertos: 0,
      acertosPorChute: 0,
      erros: 0,
      naoRespondidas: 0,
      naoEstudadas: 0,
    };

    atual.total += 1;

    if (item.status === "nao_estudado") {
      atual.naoEstudadas += 1;
    } else {
      atual.avaliadas += 1;

      if (item.status === "acerto" || item.status === "acerto_chute") {
        atual.acertos += 1;
      }
      if (item.status === "acerto_chute") atual.acertosPorChute += 1;
      if (item.status === "erro") atual.erros += 1;
      if (item.status === "nao_respondida") atual.naoRespondidas += 1;
    }

    mapa.set(chave, atual);
  }

  return [...mapa.values()]
    .map((item) => ({
      ...item,
      aproveitamento:
        item.avaliadas > 0
          ? Math.round((item.acertos / item.avaliadas) * 100)
          : 0,
      impactoNota: item.erros + item.naoRespondidas,
    }))
    .sort(
      (a, b) =>
        a.aproveitamento - b.aproveitamento ||
        b.impactoNota - a.impactoNota ||
        a.materia.localeCompare(b.materia, "pt-BR")
    );
}

function calcularAssuntos(
  questoes: QuestaoAnaliseSimulado[],
  correcao: CorrecaoQuestaoSimulado[],
  historico: HistoricoAnaliseSimulado[],
  materiasComMaisErros: Set<string>
): AnaliseAssuntoSimulado[] {
  const questaoPorId = new Map(questoes.map((item) => [item.id, item]));
  const mapa = new Map<
    string,
    Omit<
      AnaliseAssuntoSimulado,
      | "percentual"
      | "dominio"
      | "prioridade"
      | "prioridadeIndice"
      | "reincidencias"
      | "quantidadeQuestoesRecomendada"
      | "orientacao"
    >
  >();

  for (const item of correcao) {
    if (item.status === "anulada") continue;
    const questao = questaoPorId.get(item.id);
    if (!questao) continue;

    const especifico =
      questao.assunto?.trim() || assuntoEspecifico(questao);
    const chave = criarChaveAssunto(questao);
    const atual = mapa.get(chave) ?? {
      chave,
      materia: item.materia,
      materiaId: questao.materiaId,
      modulo: questao.modulo,
      moduloId: questao.moduloId,
      assunto: item.assunto,
      assuntoId: questao.assuntoId,
      subassunto: undefined,
      assuntoEspecifico: especifico,
      total: 0,
      avaliadas: 0,
      acertos: 0,
      acertosPorChute: 0,
      erros: 0,
      naoRespondidas: 0,
      naoEstudadas: 0,
    };

    atual.total += 1;

    if (item.status === "nao_estudado") {
      atual.naoEstudadas += 1;
    } else {
      atual.avaliadas += 1;
      if (item.status === "acerto" || item.status === "acerto_chute") {
        atual.acertos += 1;
      }
      if (item.status === "acerto_chute") atual.acertosPorChute += 1;
      if (item.status === "erro") atual.erros += 1;
      if (item.status === "nao_respondida") atual.naoRespondidas += 1;
    }

    mapa.set(chave, atual);
  }

  return [...mapa.values()]
    .map((item) => {
      const percentual =
        item.avaliadas > 0
          ? Math.round((item.acertos / item.avaliadas) * 100)
          : 0;

      const falhaAtual =
        item.erros + item.naoRespondidas + item.acertosPorChute > 0;
      const reincidencias = falhaAtual
        ? historico.filter((anterior) =>
            anterior.assuntos.some(
              (assunto) =>
                assunto.chave === item.chave &&
                assunto.erros +
                  assunto.naoRespondidas +
                  assunto.acertosPorChute >
                  0
            )
          ).length
        : 0;

      const dominio = classificarDominio(
        percentual,
        item.acertosPorChute,
        item.avaliadas
      );
      const prioridadeIndice = calcularIndicePrioridade({
        percentual,
        erros: item.erros,
        naoRespondidas: item.naoRespondidas,
        acertosPorChute: item.acertosPorChute,
        reincidencias,
        materiaComMuitosErros: materiasComMaisErros.has(
          normalizarTexto(item.materia)
        ),
        avaliadas: item.avaliadas,
      });
      const prioridade = nivelPrioridade(prioridadeIndice);
      const quantidadeQuestoesRecomendada =
        quantidadeQuestoesPorPercentual(percentual, item.avaliadas);
      const orientacao = orientarAssunto(
        percentual,
        item.acertosPorChute,
        item.avaliadas
      );

      return {
        ...item,
        percentual,
        dominio,
        prioridade,
        prioridadeIndice,
        reincidencias,
        quantidadeQuestoesRecomendada,
        orientacao,
      };
    })
    .sort(
      (a, b) =>
        b.prioridadeIndice - a.prioridadeIndice ||
        a.percentual - b.percentual ||
        b.erros - a.erros
    );
}

function calcularResumo(
  materias: ResumoMateriaSimulado[],
  correcao: CorrecaoQuestaoSimulado[]
): AnaliseSimuladoStudyPro["resumo"] {
  const validas = correcao.filter((item) => item.status !== "anulada");
  const avaliadas = validas.filter((item) => item.status !== "nao_estudado");
  const totalAcertos = avaliadas.filter(
    (item) => item.status === "acerto" || item.status === "acerto_chute"
  ).length;
  const totalErros = avaliadas.filter((item) => item.status === "erro").length;
  const totalNaoRespondidas = avaliadas.filter(
    (item) => item.status === "nao_respondida"
  ).length;
  const totalNaoEstudadas = validas.filter(
    (item) => item.status === "nao_estudado"
  ).length;
  const totalAcertosPorChute = avaliadas.filter(
    (item) => item.status === "acerto_chute"
  ).length;

  const comparaveis = materias.filter((item) => item.avaliadas > 0);
  const melhorMateria =
    comparaveis.length > 0
      ? [...comparaveis].sort(
          (a, b) =>
            b.aproveitamento - a.aproveitamento ||
            a.impactoNota - b.impactoNota
        )[0]
      : null;
  const piorMateria =
    comparaveis.length > 0
      ? [...comparaveis].sort(
          (a, b) =>
            a.aproveitamento - b.aproveitamento ||
            b.impactoNota - a.impactoNota
        )[0]
      : null;
  const materiasMaisDerrubaram = [...comparaveis]
    .filter((item) => item.impactoNota > 0)
    .sort(
      (a, b) =>
        b.impactoNota - a.impactoNota ||
        a.aproveitamento - b.aproveitamento
    )
    .slice(0, 3);

  return {
    totalQuestoes: correcao.length,
    totalValidas: validas.length,
    totalAcertos,
    totalErros,
    totalNaoRespondidas,
    totalNaoEstudadas,
    totalAcertosPorChute,
    aproveitamentoGeral:
      avaliadas.length > 0
        ? Math.round((totalAcertos / avaliadas.length) * 100)
        : 0,
    melhorMateria,
    piorMateria,
    materiasMaisDerrubaram,
  };
}

function gerarCadernoErros(
  questoes: QuestaoAnaliseSimulado[],
  correcao: CorrecaoQuestaoSimulado[],
  motivosErro: Record<string, MotivoErroSimulado | undefined>
): ItemCadernoErrosSimulado[] {
  const questaoPorId = new Map(questoes.map((item) => [item.id, item]));

  return correcao.flatMap((item) => {
    if (item.status !== "erro" && item.status !== "acerto_chute") return [];
    const questao = questaoPorId.get(item.id);
    if (!questao) return [];

    return [
      {
        questaoId: item.id,
        numero: item.numero,
        materia: item.materia,
        assunto: item.assunto,
        assuntoEspecifico: item.assuntoEspecifico,
        enunciado: questao.enunciado,
        alternativas: questao.alternativas,
        respostaAluno: item.respostaAluno,
        gabarito: item.gabarito,
        status: item.status,
        comentario: comentarioDaQuestao(questao),
        motivoProvavel: motivoProvavel(
          item,
          motivosErro[item.id]
        ),
        bizu: criarBizu(questao),
        mnemonico: extrairMnemonico(questao.explicacao),
        oQueRevisar: montarOQueRevisar(questao),
      } satisfies ItemCadernoErrosSimulado,
    ];
  });
}

function gerarAindaNaoEstudado(
  correcao: CorrecaoQuestaoSimulado[]
): QuestaoNaoEstudadaSimulado[] {
  return correcao
    .filter((item) => item.status === "nao_estudado")
    .map((item) => ({
      questaoId: item.id,
      numero: item.numero,
      materia: item.materia,
      assunto: item.assunto,
      assuntoEspecifico: item.assuntoEspecifico,
    }));
}

function gerarPlanoRevisao(
  assuntos: AnaliseAssuntoSimulado[]
): PlanoRevisaoAssuntoSimulado[] {
  const candidatos = assuntos
    .filter(
      (item) =>
        item.avaliadas > 0 &&
        (item.erros > 0 ||
          item.naoRespondidas > 0 ||
          item.acertosPorChute > 0 ||
          item.percentual < 80)
    )
    .map((item) => ({
      chave: item.chave,
      materia: item.materia,
      assunto: item.assunto,
      assuntoEspecifico: item.assuntoEspecifico,
      prioridade: item.prioridade,
      prioridadeIndice: item.prioridadeIndice,
      acao: item.orientacao,
      quantidadeQuestoes: item.quantidadeQuestoesRecomendada,
      agendaDias: AGENDA_REVISAO_DIAS,
      reincidencia: item.reincidencias > 0,
    }))
    .sort(
      (a, b) =>
        b.prioridadeIndice - a.prioridadeIndice ||
        a.materia.localeCompare(b.materia, "pt-BR")
    );

  const selecionados: PlanoRevisaoAssuntoSimulado[] = [];
  const porMateria = new Map<string, number>();

  const tentarAdicionar = (
    item: PlanoRevisaoAssuntoSimulado,
    respeitarLimiteMateria: boolean
  ) => {
    if (selecionados.length >= MAX_PRIORIDADES_REVISAO) return;

    const materia = normalizarTexto(item.materia);
    const quantidadeMateria = porMateria.get(materia) ?? 0;

    if (
      respeitarLimiteMateria &&
      quantidadeMateria >= MAX_PRIORIDADES_POR_MATERIA
    ) {
      return;
    }

    const repetida = selecionados.some(
      (selecionado) =>
        normalizarTexto(selecionado.materia) === materia &&
        assuntosSemelhantes(
          selecionado.assuntoEspecifico,
          item.assuntoEspecifico
        )
    );

    if (repetida) return;

    selecionados.push(item);
    porMateria.set(materia, quantidadeMateria + 1);
  };

  for (const item of candidatos) {
    tentarAdicionar(item, true);
  }

  if (selecionados.length < MAX_PRIORIDADES_REVISAO) {
    for (const item of candidatos) {
      if (selecionados.some((selecionado) => selecionado.chave === item.chave)) {
        continue;
      }
      tentarAdicionar(item, false);
    }
  }

  return selecionados;
}

function calcularDificuldade(
  questoes: QuestaoAnaliseSimulado[]
): DistribuicaoDificuldadeSimulado {
  const validas = questoes.filter((item) => !item.anulada);
  const total = validas.length;
  const quantidade = (nivel: DificuldadeQuestaoAnalise) =>
    validas.filter((item) => item.dificuldade === nivel).length;

  const facil = quantidade("Fácil");
  const media = quantidade("Média");
  const dificil = quantidade("Difícil");
  const percentual = (valor: number) =>
    total > 0 ? Math.round((valor / total) * 100) : 0;

  const pFacil = percentual(facil);
  const pMedia = percentual(media);
  const pDificil = percentual(dificil);

  let geral = "Média";
  if (total === 0) {
    geral = "Não classificada";
  } else if (pDificil >= 50) {
    geral = "Difícil";
  } else if (pDificil >= 25 && pMedia >= 35) {
    geral = "Média para difícil";
  } else if (pFacil >= 70) {
    geral = "Fácil";
  } else if (pFacil >= 55 && pDificil < 20) {
    geral = "Fácil para média";
  }

  return {
    facil: { quantidade: facil, percentual: pFacil },
    media: { quantidade: media, percentual: pMedia },
    dificil: { quantidade: dificil, percentual: pDificil },
    geral,
  };
}

function calcularEvolucao(
  materias: ResumoMateriaSimulado[],
  historico: HistoricoAnaliseSimulado[],
  dificuldadeAtual: string
): EvolucaoMateriaSimulado[] {
  const anterioresOrdenados = [...historico].sort(
    (a, b) => Date.parse(b.data) - Date.parse(a.data)
  );

  return materias.flatMap((materia) => {
    if (materia.avaliadas === 0) return [];

    const anterior = anterioresOrdenados.find((analise) =>
      analise.materias.some(
        (item) =>
          normalizarTexto(item.materia) === normalizarTexto(materia.materia)
      )
    );
    if (!anterior) return [];

    const materiaAnterior = anterior.materias.find(
      (item) =>
        normalizarTexto(item.materia) === normalizarTexto(materia.materia)
    );
    if (!materiaAnterior) return [];

    const variacaoPp = materia.aproveitamento - materiaAnterior.aproveitamento;
    const rotulo =
      variacaoPp > 0
        ? `Evolução: +${variacaoPp} p.p.`
        : variacaoPp < 0
          ? `Queda: ${variacaoPp} p.p.`
          : "Estável: 0 p.p.";
    const dificuldadeMudou = anterior.dificuldadeGeral !== dificuldadeAtual;

    return [
      {
        materia: materia.materia,
        anterior: materiaAnterior.aproveitamento,
        atual: materia.aproveitamento,
        variacaoPp,
        rotulo,
        dificuldadeAnterior: anterior.dificuldadeGeral,
        dificuldadeAtual,
        observacao: dificuldadeMudou
          ? "A dificuldade dos simulados mudou; a variação não significa, sozinha, ganho ou perda de conhecimento."
          : variacaoPp < 0
            ? "Uma queda isolada não significa perda automática de conhecimento."
            : undefined,
      },
    ];
  });
}

function classificarDominio(
  percentual: number,
  acertosPorChute: number,
  avaliadas: number
): ClassificacaoDominio {
  if (avaliadas === 0) return "Ainda não estudado — manter cronograma";
  if (percentual < 50) return "Teoria + questões";
  if (percentual < 70) return "Revisão curta + questões";
  if (percentual < 80 || acertosPorChute > 0) {
    return "Questões + revisão espaçada";
  }
  return "Assunto consolidado — manter revisão";
}

function calcularIndicePrioridade(params: {
  percentual: number;
  erros: number;
  naoRespondidas: number;
  acertosPorChute: number;
  reincidencias: number;
  materiaComMuitosErros: boolean;
  avaliadas: number;
}) {
  if (params.avaliadas === 0) return 0;

  let indice =
    params.percentual < 50
      ? 75
      : params.percentual < 70
        ? 50
        : 20;

  indice += Math.min(10, (params.erros + params.naoRespondidas) * 2);
  if (params.acertosPorChute > 0) indice += 20;
  if (params.reincidencias > 0) indice += Math.min(20, 10 + params.reincidencias * 3);
  if (params.materiaComMuitosErros) indice += 5;

  if (params.acertosPorChute > 0 || params.reincidencias > 0) {
    indice = Math.max(indice, 65);
  }

  if (
    params.materiaComMuitosErros &&
    params.erros + params.naoRespondidas >= 2
  ) {
    indice = Math.max(indice, 65);
  }

  // Uma única questão não é evidência suficiente para rotular um assunto
  // como prioridade alta, salvo quando há chute ou reincidência histórica.
  if (
    params.avaliadas === 1 &&
    params.acertosPorChute === 0 &&
    params.reincidencias === 0
  ) {
    indice = Math.min(indice, 58);
  }

  return Math.max(0, Math.min(100, indice));
}

function nivelPrioridade(indice: number): NivelPrioridadeRevisao {
  if (indice >= 65) return "alta";
  if (indice >= 40) return "media";
  return "baixa";
}

function quantidadeQuestoesPorPercentual(
  percentual: number,
  avaliadas: number
) {
  if (avaliadas === 0) return 0;
  if (percentual < 50) return 12;
  if (percentual < 70) return 8;
  return 5;
}

function orientarAssunto(
  percentual: number,
  acertosPorChute: number,
  avaliadas: number
) {
  if (avaliadas === 0) {
    return "Manter no cronograma normal até o conteúdo ser estudado.";
  }
  if (percentual < 50) {
    return "Teoria do assunto + 10 a 15 questões do mesmo conteúdo.";
  }
  if (percentual < 70) {
    return "Revisão curta dos pontos errados + 5 a 10 questões.";
  }
  if (percentual < 80 || acertosPorChute > 0) {
    return "Resolver novas questões e manter a revisão espaçada.";
  }
  return "Manter revisão espaçada e usar questões para confirmação.";
}

function gerarRecomendacaoFinal(
  materias: ResumoMateriaSimulado[],
  assuntos: AnaliseAssuntoSimulado[],
  aindaNaoEstudado: QuestaoNaoEstudadaSimulado[]
) {
  const prioridades = assuntos
    .filter((item) => item.prioridade !== "baixa" && item.avaliadas > 0)
    .slice(0, 3);

  const materiasPrioritarias = Array.from(
    new Set(prioridades.map((item) => item.materia))
  );

  const partes = ["Continue seu cronograma normalmente."];

  if (materiasPrioritarias.length > 0) {
    partes.push(
      `Nesta semana, priorize ${materiasPrioritarias.join(" e ")} nas revisões.`
    );
  } else if (materias.some((item) => item.impactoNota > 0)) {
    const maisFraca = [...materias]
      .filter((item) => item.avaliadas > 0)
      .sort((a, b) => a.aproveitamento - b.aproveitamento)[0];
    if (maisFraca) {
      partes.push(
        `Use ${maisFraca.materia} como primeira revisão, sem interromper o conteúdo novo do edital.`
      );
    }
  } else {
    partes.push(
      "Mantenha o avanço no edital e use as revisões espaçadas para confirmar o domínio."
    );
  }

  const temTeoria = prioridades.some((item) => item.percentual < 50);
  const temCurta = prioridades.some(
    (item) => item.percentual >= 50 && item.percentual < 70
  );

  if (temTeoria) {
    partes.push(
      "Nos assuntos abaixo de 50%, faça teoria e depois um bloco de questões."
    );
  }
  if (temCurta) {
    partes.push(
      "Entre 50% e 69%, faça revisão curta e confirme com novas questões."
    );
  }
  if (aindaNaoEstudado.length > 0) {
    partes.push(
      "Os assuntos marcados como ainda não estudados permanecem no cronograma normal."
    );
  }

  return partes.join(" ");
}

function comentarioDaQuestao(questao: QuestaoAnaliseSimulado) {
  const explicacao = limparTexto(questao.explicacao);
  if (explicacao) return limitarTexto(explicacao, 560);

  const referencia = [questao.norma, questao.dispositivo]
    .filter(Boolean)
    .join(" · ");

  return referencia
    ? `O gabarito é ${questao.gabarito}. Confira a regra indicada em ${referencia} e compare cada alternativa com o texto aplicável.`
    : `O gabarito é ${questao.gabarito}. Revise a regra central de ${assuntoEspecifico(questao)} e refaça a questão sem consultar a resposta.`;
}

function motivoProvavel(
  item: CorrecaoQuestaoSimulado,
  motivo?: MotivoErroSimulado
) {
  if (motivo) return rotuloMotivoErro(motivo);
  if (item.marcacao === "chutei") {
    return "Chute: faltou segurança para aplicar a regra sem depender da sorte.";
  }
  if (item.marcacao === "nao_sei") {
    return "Não sabia: faltou domínio suficiente do conteúdo cobrado.";
  }
  if (item.status === "acerto_chute") {
    return "Acerto sem segurança: o conteúdo ainda precisa ser confirmado por novas questões.";
  }
  return "Motivo ainda não informado. Marque a causa do erro para deixar a próxima revisão mais precisa.";
}

export function rotuloMotivoErro(motivo: MotivoErroSimulado) {
  switch (motivo) {
    case "nao_sabia":
      return "Não sabia o conteúdo.";
    case "confundi_regra":
      return "Confundi a regra ou uma exceção.";
    case "interpretei_errado":
      return "Interpretei o enunciado ou as alternativas de forma incorreta.";
    case "falta_atencao":
      return "Falta de atenção na leitura ou na marcação.";
    case "chutei":
      return "Chutei sem segurança suficiente.";
  }
}

function criarBizu(questao: QuestaoAnaliseSimulado) {
  const referencia = [questao.norma, questao.dispositivo]
    .filter(Boolean)
    .join(" · ");

  if (referencia) {
    return `Bizu: destaque a palavra-chave do comando e confira o texto seco de ${referencia} antes de aceitar uma alternativa parecida.`;
  }

  return `Bizu: identifique exatamente o que o comando pede em ${assuntoEspecifico(questao)} e elimine alternativas que troquem regra, exceção ou condição.`;
}

function extrairMnemonico(explicacao?: string) {
  const texto = limparTexto(explicacao);
  if (!texto) return undefined;

  const sentenca = texto
    .split(/(?<=[.!?])\s+/)
    .find((item) => /mnem[oô]nico|macete|bizu/i.test(item));

  return sentenca ? limitarTexto(sentenca, 220) : undefined;
}

function montarOQueRevisar(questao: QuestaoAnaliseSimulado) {
  return [
    questao.materia,
    questao.modulo,
    questao.assunto,
    questao.subassunto,
  ]
    .filter(Boolean)
    .join(" → ");
}

function assuntoEspecifico(questao: QuestaoAnaliseSimulado) {
  return questao.subassunto?.trim() || questao.assunto?.trim() || "Sem assunto";
}

function criarChaveAssunto(questao: QuestaoAnaliseSimulado) {
  return normalizarTexto(
    [
      questao.materia,
      questao.modulo || "Geral",
      questao.assunto,
    ].join("::")
  );
}

function normalizarTaxonomiaQuestao(
  questao: QuestaoAnaliseSimulado
): QuestaoAnaliseSimulado {
  const materiaOriginal = limparTexto(questao.materia) || "Sem matéria";
  const modulo = limparTexto(questao.modulo) || undefined;
  const assunto = limparTexto(questao.assunto) || "Sem assunto";
  const subassuntoOriginal = limparTexto(questao.subassunto) || undefined;
  const subassunto =
    subassuntoOriginal &&
    normalizarTexto(subassuntoOriginal) !== normalizarTexto(assunto)
      ? subassuntoOriginal
      : undefined;

  return {
    ...questao,
    materia: questao.materiaId
      ? materiaOriginal
      : materiaCanonica({
          ...questao,
          materia: materiaOriginal,
          modulo,
          assunto,
          subassunto,
        }),
    modulo,
    assunto,
    subassunto,
  };
}

function materiaCanonica(
  questao: Pick<
    QuestaoAnaliseSimulado,
    "materia" | "modulo" | "assunto" | "subassunto" | "enunciado"
  >
) {
  const materia = normalizarTexto(questao.materia);
  const contexto = normalizarTexto(
    [
      questao.materia,
      questao.modulo,
      questao.assunto,
      questao.subassunto,
      questao.enunciado,
    ]
      .filter(Boolean)
      .join(" ")
  );

  if (/lingua portuguesa|portugues/.test(materia)) {
    return "Língua Portuguesa";
  }
  if (/informatica|tecnologia da informacao|computacao/.test(materia)) {
    return "Informática";
  }
  if (/raciocinio logico|logica proposicional|logica matematica/.test(materia)) {
    return "Raciocínio Lógico";
  }
  if (/^matematica\b/.test(materia)) {
    return "Matemática";
  }
  if (/direitos humanos/.test(materia)) {
    return "Direitos Humanos";
  }
  if (/direito penal militar/.test(materia)) {
    return "Direito Penal Militar";
  }
  if (/processo penal militar/.test(materia)) {
    return "Processo Penal Militar";
  }
  if (/processo penal/.test(materia)) {
    return "Processo Penal";
  }
  if (/direito penal/.test(materia)) {
    return "Direito Penal";
  }
  if (/legislacao.*(extravagante|especial)/.test(materia)) {
    return "Legislação Extravagante";
  }

  const misturaDireito =
    /administrativ/.test(materia) && /constitucional/.test(materia);

  if (misturaDireito) {
    if (
      /constitu|direitos fundamentais|direitos e garantias|habeas corpus|habeas data|mandado de seguranca|mandado de injuncao|poder constituinte|controle de constitucionalidade|organizacao do estado/.test(
        contexto
      )
    ) {
      return "Direito Constitucional";
    }

    if (
      /ato administrativ|licitac|contrato administrativ|agente publico|servidor publico|poder administrativ|servico publico|responsabilidade civil do estado|administracao publica|improbidade/.test(
        contexto
      )
    ) {
      return "Direito Administrativo";
    }

    return "Direito Público";
  }

  if (/direito constitucional|constitucional/.test(materia)) {
    return "Direito Constitucional";
  }
  if (/direito administrativo|administrativ/.test(materia)) {
    return "Direito Administrativo";
  }

  if (/historia/.test(materia)) {
    if (
      /pernambuc|guerra dos mascates|confederacao do equador|revolucao pernambucana|revolucao de 1817|quilombo dos palmares/.test(
        contexto
      )
    ) {
      return "História de Pernambuco";
    }

    if (
      /historia e cultura brasileira|historia do brasil|brasileir|era vargas|estado novo|republica velha|primeira republica|brasil imperio|ditadura militar|colonizacao portuguesa/.test(
        contexto
      )
    ) {
      return "História do Brasil";
    }

    return "História";
  }

  return questao.materia;
}

function assuntosSemelhantes(a: string, b: string) {
  const normalizadoA = normalizarTexto(a);
  const normalizadoB = normalizarTexto(b);

  if (normalizadoA === normalizadoB) return true;
  if (
    normalizadoA.length >= 8 &&
    normalizadoB.length >= 8 &&
    (normalizadoA.includes(normalizadoB) ||
      normalizadoB.includes(normalizadoA))
  ) {
    return true;
  }

  const tokensA = tokensRelevantes(normalizadoA);
  const tokensB = tokensRelevantes(normalizadoB);
  if (tokensA.size === 0 || tokensB.size === 0) return false;

  const intersecao = [...tokensA].filter((token) =>
    tokensB.has(token)
  ).length;
  const uniao = new Set([...tokensA, ...tokensB]).size;

  return uniao > 0 && intersecao / uniao >= 0.6;
}

function tokensRelevantes(valor: string) {
  const ignorar = new Set([
    "de",
    "da",
    "do",
    "das",
    "dos",
    "e",
    "em",
    "para",
    "com",
    "sem",
    "geral",
    "gerais",
    "aspecto",
    "aspectos",
  ]);

  return new Set(
    valor
      .split(/[^a-z0-9]+/)
      .map((token) =>
        token.length > 4 && token.endsWith("s")
          ? token.slice(0, -1)
          : token
      )
      .filter((token) => token.length >= 3 && !ignorar.has(token))
  );
}

function normalizarResposta(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpa = valor.trim().toUpperCase();
  return limpa || null;
}

function limparTexto(valor?: string) {
  return typeof valor === "string"
    ? valor.replace(/\s+/g, " ").trim()
    : "";
}

function limitarTexto(valor: string, limite: number) {
  if (valor.length <= limite) return valor;
  return `${valor.slice(0, limite - 1).trimEnd()}…`;
}

function normalizarTexto(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
