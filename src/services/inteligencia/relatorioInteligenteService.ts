import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../../types";

export type Tendencia = "subindo" | "caindo" | "estavel";

export type ResumoPeriodo = {
  minutos: number;
  sessoes: number;
  diasAtivos: number;
  questoes: number;
  certas: number;
  erradas: number;
  aproveitamento: number;
  revisoesConcluidas: number;
  simulados: number;
};

export type ComparacaoIndicador = {
  atual: number;
  anterior: number;
  diferenca: number;
  variacaoPercentual: number;
  tendencia: Tendencia;
};

export type DesempenhoMateriaInteligente = {
  materia: string;
  questoes: number;
  certas: number;
  erradas: number;
  aproveitamento: number;
  minutos: number;
  ultimaAtividade: string | null;
  diasSemEstudar: number | null;
};

export type RecomendacaoInteligente = {
  id: string;
  prioridade: "alta" | "media" | "baixa";
  titulo: string;
  descricao: string;
  rota: string;
};

export type RelatorioInteligente = {
  semanaAtual: ResumoPeriodo;
  semanaAnterior: ResumoPeriodo;
  comparacoes: {
    minutos: ComparacaoIndicador;
    questoes: ComparacaoIndicador;
    aproveitamento: ComparacaoIndicador;
    diasAtivos: ComparacaoIndicador;
  };
  materias: DesempenhoMateriaInteligente[];
  melhorMateria: DesempenhoMateriaInteligente | null;
  materiaCritica: DesempenhoMateriaInteligente | null;
  materiaEsquecida: DesempenhoMateriaInteligente | null;
  revisoesAtrasadas: number;
  indiceConsistencia: number;
  recomendacoes: RecomendacaoInteligente[];
  resumoExecutivo: string;
};

type EntradaRelatorio = {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
  metaMinutosDiaria: number;
};

export function gerarRelatorioInteligente({
  questoes,
  sessoes,
  revisoes,
  simulados,
  metaMinutosDiaria,
}: EntradaRelatorio): RelatorioInteligente {
  const hoje = inicioDoDia(new Date());
  const inicioSemanaAtual = adicionarDias(hoje, -6);
  const fimSemanaAnterior = adicionarDias(inicioSemanaAtual, -1);
  const inicioSemanaAnterior = adicionarDias(fimSemanaAnterior, -6);

  const semanaAtual = resumirPeriodo({
    inicio: inicioSemanaAtual,
    fim: fimDoDia(hoje),
    questoes,
    sessoes,
    revisoes,
    simulados,
  });

  const semanaAnterior = resumirPeriodo({
    inicio: inicioSemanaAnterior,
    fim: fimDoDia(fimSemanaAnterior),
    questoes,
    sessoes,
    revisoes,
    simulados,
  });

  const materias = calcularMaterias(questoes, sessoes);
  const materiasComBase = materias.filter((item) => item.questoes >= 5);

  const melhorMateria =
    [...materiasComBase].sort(
      (a, b) => b.aproveitamento - a.aproveitamento
    )[0] ?? null;

  const materiaCritica =
    [...materiasComBase].sort(
      (a, b) => a.aproveitamento - b.aproveitamento
    )[0] ?? null;

  const materiaEsquecida =
    [...materias]
      .filter((item) => item.diasSemEstudar !== null)
      .sort(
        (a, b) =>
          (b.diasSemEstudar ?? 0) - (a.diasSemEstudar ?? 0)
      )[0] ?? null;

  const revisoesAtrasadas = revisoes.filter(
    (revisao) =>
      !revisao.concluida &&
      dataSegura(revisao.dataPrevista) < hoje
  ).length;

  const comparacoes = {
    minutos: comparar(semanaAtual.minutos, semanaAnterior.minutos),
    questoes: comparar(semanaAtual.questoes, semanaAnterior.questoes),
    aproveitamento: comparar(
      semanaAtual.aproveitamento,
      semanaAnterior.aproveitamento
    ),
    diasAtivos: comparar(
      semanaAtual.diasAtivos,
      semanaAnterior.diasAtivos
    ),
  };

  const metaSemanal = Math.max(metaMinutosDiaria * 6, 1);
  const notaTempo = limitar(
    Math.round((semanaAtual.minutos / metaSemanal) * 100),
    0,
    100
  );
  const notaFrequencia = limitar(
    Math.round((semanaAtual.diasAtivos / 6) * 100),
    0,
    100
  );
  const notaQuestoes = semanaAtual.questoes > 0
    ? semanaAtual.aproveitamento
    : 0;
  const penalidadeRevisoes = Math.min(revisoesAtrasadas * 3, 25);

  const indiceConsistencia = limitar(
    Math.round(
      notaTempo * 0.35 +
        notaFrequencia * 0.35 +
        notaQuestoes * 0.3 -
        penalidadeRevisoes
    ),
    0,
    100
  );

  const recomendacoes = montarRecomendacoes({
    comparacoes,
    materiaCritica,
    materiaEsquecida,
    revisoesAtrasadas,
    semanaAtual,
    metaMinutosDiaria,
  });

  return {
    semanaAtual,
    semanaAnterior,
    comparacoes,
    materias,
    melhorMateria,
    materiaCritica,
    materiaEsquecida,
    revisoesAtrasadas,
    indiceConsistencia,
    recomendacoes,
    resumoExecutivo: gerarResumoExecutivo({
      comparacoes,
      materiaCritica,
      revisoesAtrasadas,
      indiceConsistencia,
    }),
  };
}

function resumirPeriodo({
  inicio,
  fim,
  questoes,
  sessoes,
  revisoes,
  simulados,
}: {
  inicio: Date;
  fim: Date;
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
}): ResumoPeriodo {
  const sessoesPeriodo = sessoes.filter((sessao) =>
    estaNoPeriodo(sessao.data, inicio, fim)
  );
  const questoesPeriodo = questoes.filter((registro) =>
    estaNoPeriodo(registro.data, inicio, fim)
  );
  const simuladosPeriodo = simulados.filter((simulado) =>
    estaNoPeriodo(simulado.data, inicio, fim)
  );
  const revisoesConcluidas = revisoes.filter(
    (revisao) =>
      revisao.concluida &&
      revisao.dataConclusao &&
      estaNoPeriodo(revisao.dataConclusao, inicio, fim)
  ).length;

  const certas = questoesPeriodo.reduce(
    (total, registro) => total + numeroSeguro(registro.certas),
    0
  );
  const erradas = questoesPeriodo.reduce(
    (total, registro) => total + numeroSeguro(registro.erradas),
    0
  );
  const totalQuestoes = certas + erradas;

  return {
    minutos: sessoesPeriodo.reduce(
      (total, sessao) => total + numeroSeguro(sessao.minutos),
      0
    ),
    sessoes: sessoesPeriodo.length,
    diasAtivos: new Set(
      sessoesPeriodo.map((sessao) => chaveData(sessao.data))
    ).size,
    questoes: totalQuestoes,
    certas,
    erradas,
    aproveitamento:
      totalQuestoes === 0
        ? 0
        : Math.round((certas / totalQuestoes) * 100),
    revisoesConcluidas,
    simulados: simuladosPeriodo.length,
  };
}

function calcularMaterias(
  questoes: RegistroQuestao[],
  sessoes: SessaoEstudo[]
): DesempenhoMateriaInteligente[] {
  const mapa = new Map<string, DesempenhoMateriaInteligente>();

  function obter(materiaOriginal: string) {
    const materia = materiaOriginal.trim() || "Sem matéria";
    const chave = normalizar(materia);
    const atual = mapa.get(chave) ?? {
      materia,
      questoes: 0,
      certas: 0,
      erradas: 0,
      aproveitamento: 0,
      minutos: 0,
      ultimaAtividade: null,
      diasSemEstudar: null,
    };
    mapa.set(chave, atual);
    return atual;
  }

  questoes.forEach((registro) => {
    const atual = obter(registro.materia);
    atual.certas += numeroSeguro(registro.certas);
    atual.erradas += numeroSeguro(registro.erradas);
    atual.questoes = atual.certas + atual.erradas;
    atual.aproveitamento = atual.questoes === 0
      ? 0
      : Math.round((atual.certas / atual.questoes) * 100);
    atual.minutos += numeroSeguro(registro.minutos);
    atualizarUltimaAtividade(atual, registro.data);
  });

  sessoes.forEach((sessao) => {
    const atual = obter(sessao.materia);
    atual.minutos += numeroSeguro(sessao.minutos);
    atualizarUltimaAtividade(atual, sessao.data);
  });

  return Array.from(mapa.values())
    .map((item) => ({
      ...item,
      diasSemEstudar: item.ultimaAtividade
        ? diasDesde(item.ultimaAtividade)
        : null,
    }))
    .sort((a, b) => b.questoes - a.questoes || b.minutos - a.minutos);
}

function atualizarUltimaAtividade(
  item: DesempenhoMateriaInteligente,
  data: string
) {
  if (
    !item.ultimaAtividade ||
    dataSegura(data) > dataSegura(item.ultimaAtividade)
  ) {
    item.ultimaAtividade = data;
  }
}

function comparar(atual: number, anterior: number): ComparacaoIndicador {
  const diferenca = atual - anterior;
  const variacaoPercentual = anterior === 0
    ? atual === 0
      ? 0
      : 100
    : Math.round((diferenca / anterior) * 100);

  let tendencia: Tendencia = "estavel";
  if (diferenca > 0) tendencia = "subindo";
  if (diferenca < 0) tendencia = "caindo";

  return {
    atual,
    anterior,
    diferenca,
    variacaoPercentual,
    tendencia,
  };
}

function montarRecomendacoes({
  comparacoes,
  materiaCritica,
  materiaEsquecida,
  revisoesAtrasadas,
  semanaAtual,
  metaMinutosDiaria,
}: {
  comparacoes: RelatorioInteligente["comparacoes"];
  materiaCritica: DesempenhoMateriaInteligente | null;
  materiaEsquecida: DesempenhoMateriaInteligente | null;
  revisoesAtrasadas: number;
  semanaAtual: ResumoPeriodo;
  metaMinutosDiaria: number;
}): RecomendacaoInteligente[] {
  const recomendacoes: RecomendacaoInteligente[] = [];

  if (revisoesAtrasadas > 0) {
    recomendacoes.push({
      id: "revisoes-atrasadas",
      prioridade: "alta",
      titulo: `Regularizar ${revisoesAtrasadas} revisão(ões) atrasada(s)`,
      descricao:
        "Revisões vencidas reduzem retenção e também penalizam seu índice de consistência.",
      rota: "/revisoes",
    });
  }

  if (materiaCritica && materiaCritica.aproveitamento < 70) {
    recomendacoes.push({
      id: `materia-critica-${normalizar(materiaCritica.materia)}`,
      prioridade: "alta",
      titulo: `Reforçar ${materiaCritica.materia}`,
      descricao: `Seu aproveitamento está em ${materiaCritica.aproveitamento}% após ${materiaCritica.questoes} questões. Faça revisão curta e novo bloco de questões.`,
      rota: "/questoes",
    });
  }

  if (
    materiaEsquecida &&
    (materiaEsquecida.diasSemEstudar ?? 0) >= 7
  ) {
    recomendacoes.push({
      id: `materia-esquecida-${normalizar(materiaEsquecida.materia)}`,
      prioridade: "media",
      titulo: `Retomar ${materiaEsquecida.materia}`,
      descricao: `A matéria está sem atividade há ${materiaEsquecida.diasSemEstudar} dias.`,
      rota: "/central-estudos",
    });
  }

  const metaSemanal = metaMinutosDiaria * 6;
  if (semanaAtual.minutos < metaSemanal * 0.7) {
    recomendacoes.push({
      id: "tempo-semanal",
      prioridade: "media",
      titulo: "Aumentar constância semanal",
      descricao: `Você acumulou ${formatarMinutos(semanaAtual.minutos)} nesta semana. A meta proporcional é ${formatarMinutos(metaSemanal)}.`,
      rota: "/central-estudos",
    });
  }

  if (comparacoes.aproveitamento.tendencia === "caindo") {
    recomendacoes.push({
      id: "queda-aproveitamento",
      prioridade: "alta",
      titulo: "Interromper queda no aproveitamento",
      descricao: `O aproveitamento caiu ${Math.abs(comparacoes.aproveitamento.diferenca)} ponto(s) em relação à semana anterior. Priorize correção de erros antes de aumentar o volume.`,
      rota: "/historico",
    });
  }

  if (recomendacoes.length === 0) {
    recomendacoes.push({
      id: "manter-ritmo",
      prioridade: "baixa",
      titulo: "Manter o ritmo atual",
      descricao:
        "Não há alerta crítico. Continue registrando atividades e preserve a frequência semanal.",
      rota: "/plano",
    });
  }

  return recomendacoes.slice(0, 5);
}

function gerarResumoExecutivo({
  comparacoes,
  materiaCritica,
  revisoesAtrasadas,
  indiceConsistencia,
}: {
  comparacoes: RelatorioInteligente["comparacoes"];
  materiaCritica: DesempenhoMateriaInteligente | null;
  revisoesAtrasadas: number;
  indiceConsistencia: number;
}) {
  const partes: string[] = [];

  if (comparacoes.minutos.tendencia === "subindo") {
    partes.push(
      `Seu tempo de estudo aumentou ${comparacoes.minutos.variacaoPercentual}% em relação à semana anterior.`
    );
  } else if (comparacoes.minutos.tendencia === "caindo") {
    partes.push(
      `Seu tempo de estudo caiu ${Math.abs(comparacoes.minutos.variacaoPercentual)}% em relação à semana anterior.`
    );
  } else {
    partes.push("Seu volume de estudo permaneceu estável.");
  }

  if (materiaCritica) {
    partes.push(
      `A principal fragilidade atual é ${materiaCritica.materia}, com ${materiaCritica.aproveitamento}% de aproveitamento.`
    );
  }

  if (revisoesAtrasadas > 0) {
    partes.push(`Existem ${revisoesAtrasadas} revisões atrasadas.`);
  }

  partes.push(`Seu índice de consistência está em ${indiceConsistencia}%.`);
  return partes.join(" ");
}

function estaNoPeriodo(valor: string, inicio: Date, fim: Date) {
  const data = dataSegura(valor);
  return data >= inicio && data <= fim;
}

function dataSegura(valor?: string) {
  if (!valor) return new Date(0);
  const data = new Date(valor);
  return Number.isNaN(data.getTime()) ? new Date(0) : data;
}

function inicioDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(0, 0, 0, 0);
  return copia;
}

function fimDoDia(data: Date) {
  const copia = new Date(data);
  copia.setHours(23, 59, 59, 999);
  return copia;
}

function adicionarDias(data: Date, dias: number) {
  const copia = new Date(data);
  copia.setDate(copia.getDate() + dias);
  return copia;
}

function chaveData(valor: string) {
  const data = dataSegura(valor);
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}-${String(data.getDate()).padStart(2, "0")}`;
}

function diasDesde(valor: string) {
  const inicio = inicioDoDia(dataSegura(valor));
  const hoje = inicioDoDia(new Date());
  return Math.max(0, Math.floor((hoje.getTime() - inicio.getTime()) / 86400000));
}

function numeroSeguro(valor: number) {
  return Number.isFinite(valor) ? valor : 0;
}

function normalizar(texto: string) {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function limitar(valor: number, minimo: number, maximo: number) {
  return Math.min(maximo, Math.max(minimo, valor));
}

export function formatarMinutos(minutosTotais: number) {
  const minutos = Math.max(0, Math.round(minutosTotais));
  const horas = Math.floor(minutos / 60);
  const restantes = minutos % 60;
  if (horas === 0) return `${restantes}min`;
  if (restantes === 0) return `${horas}h`;
  return `${horas}h ${restantes}min`;
}
