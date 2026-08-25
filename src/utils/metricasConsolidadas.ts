import type {
  RegistroQuestao,
  Revisao,
  SessaoEstudo,
  Simulado,
} from "../types";

export type ResumoSimuladoConsolidado = {
  total: number;
  certas: number;
  erradas: number;
  emBranco: number;
  anuladas: number;
  validas: number;
  aproveitamento: number;
};

export type MetricasConsolidadas = {
  questoes: number;
  certas: number;
  erradas: number;
  emBranco: number;
  anuladas: number;
  aproveitamento: number;
  minutos: number;
  sessoes: number;
  simulados: number;
  revisoesConcluidas: number;
  diasAtivos: number;
};

export type EntradaMetricasConsolidadas = {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  simulados: Simulado[];
  revisoes?: Revisao[];
  inicio?: Date;
  fim?: Date;
};

export function calcularMetricasConsolidadas(
  entrada: EntradaMetricasConsolidadas
): MetricasConsolidadas {
  const questoesPeriodo = entrada.questoes.filter((item) =>
    estaNoPeriodo(item.data, entrada.inicio, entrada.fim)
  );
  const sessoesPeriodo = entrada.sessoes.filter((item) =>
    estaNoPeriodo(item.data, entrada.inicio, entrada.fim)
  );
  const simuladosPeriodo = entrada.simulados.filter((item) =>
    estaNoPeriodo(item.data, entrada.inicio, entrada.fim)
  );
  const revisoesConcluidas = (entrada.revisoes ?? []).filter(
    (item) =>
      item.concluida &&
      Boolean(item.dataConclusao) &&
      estaNoPeriodo(item.dataConclusao as string, entrada.inicio, entrada.fim)
  );

  const simuladosPorTentativa = new Set<string>();
  simuladosPeriodo.forEach((simulado) => {
    if (simulado.id) simuladosPorTentativa.add(simulado.id);
    if (simulado.tentativaId) simuladosPorTentativa.add(simulado.tentativaId);
  });

  // Um Simulado IA gera registros por assunto e também um registro de simulado.
  // Para a métrica global usamos o simulado como fonte canônica e ignoramos apenas
  // os registros-espelho dessa mesma tentativa. Questões IA avulsas continuam normais.
  const registrosContabilizaveis = questoesPeriodo.filter(
    (registro) =>
      !(
        registro.origem === "simulado-ia" &&
        registro.tentativaId &&
        simuladosPorTentativa.has(registro.tentativaId)
      )
  );

  let certas = 0;
  let erradas = 0;
  let emBranco = 0;
  let anuladas = 0;
  let questoes = 0;

  registrosContabilizaveis.forEach((registro) => {
    const certasRegistro = numeroSeguro(registro.certas);
    const erradasRegistro = numeroSeguro(registro.erradas);
    const brancasRegistro = numeroSeguro(registro.emBranco);
    certas += certasRegistro;
    erradas += erradasRegistro;
    emBranco += brancasRegistro;
    questoes += certasRegistro + erradasRegistro + brancasRegistro;
  });

  simuladosPeriodo.forEach((simulado) => {
    const resumo = resumirSimulado(simulado);
    certas += resumo.certas;
    erradas += resumo.erradas;
    emBranco += resumo.emBranco;
    anuladas += resumo.anuladas;
    questoes += resumo.total;
  });

  const minutosSessoes = sessoesPeriodo.reduce(
    (total, sessao) => total + numeroSeguro(sessao.minutos),
    0
  );

  const minutosQuestoes = registrosContabilizaveis.reduce((total, registro) => {
    const minutos = numeroSeguro(registro.minutos);
    if (minutos <= 0) return total;

    const duplicadoPorSessao = sessoesPeriodo.some(
      (sessao) =>
        sessao.tipo === "questoes" &&
        normalizar(sessao.materia) === normalizar(registro.materia) &&
        normalizar(sessao.assunto) === normalizar(registro.assunto) &&
        datasProximas(sessao.data, registro.data, 5000)
    );

    return total + (duplicadoPorSessao ? 0 : minutos);
  }, 0);

  const minutosSimulados = simuladosPeriodo.reduce((total, simulado) => {
    const minutos = numeroSeguro(simulado.minutos);
    if (minutos <= 0) return total;

    const duplicadoPorSessao = sessoesPeriodo.some(
      (sessao) =>
        sessao.tipo === "simulado" &&
        datasProximas(sessao.data, simulado.data, 5000)
    );

    return total + (duplicadoPorSessao ? 0 : minutos);
  }, 0);

  const diasAtivos = new Set<string>();
  sessoesPeriodo.forEach((item) => adicionarDia(diasAtivos, item.data));
  registrosContabilizaveis.forEach((item) => adicionarDia(diasAtivos, item.data));
  simuladosPeriodo.forEach((item) => adicionarDia(diasAtivos, item.data));
  revisoesConcluidas.forEach((item) =>
    adicionarDia(diasAtivos, item.dataConclusao as string)
  );

  const validas = certas + erradas + emBranco;

  return {
    questoes,
    certas,
    erradas,
    emBranco,
    anuladas,
    aproveitamento: validas === 0 ? 0 : Math.round((certas / validas) * 100),
    minutos: minutosSessoes + minutosQuestoes + minutosSimulados,
    sessoes: sessoesPeriodo.length,
    simulados: simuladosPeriodo.length,
    revisoesConcluidas: revisoesConcluidas.length,
    diasAtivos: diasAtivos.size,
  };
}

export function resumirSimulado(
  simulado: Simulado
): ResumoSimuladoConsolidado {
  const certas = numeroSeguro(simulado.certas);
  const erradas = numeroSeguro(simulado.erradas);
  const anuladas = numeroSeguro(simulado.anuladas);
  const brancasInformadas = numeroSeguro(simulado.emBranco);
  const somaInformada = certas + erradas + anuladas + brancasInformadas;
  const totalDeclarado = numeroSeguro(simulado.totalQuestoes);
  const total = Math.max(somaInformada, totalDeclarado);
  const emBranco = Math.max(
    brancasInformadas,
    total - certas - erradas - anuladas
  );
  const validas = certas + erradas + emBranco;

  return {
    total,
    certas,
    erradas,
    emBranco,
    anuladas,
    validas,
    aproveitamento:
      validas === 0 ? 0 : Math.round((certas / validas) * 100),
  };
}

export function calcularAproveitamentoSimulado(
  simulado: Simulado
) {
  return resumirSimulado(simulado).aproveitamento;
}

function estaNoPeriodo(
  valor: string | undefined,
  inicio?: Date,
  fim?: Date
) {
  if (!valor) return false;
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return false;
  if (inicio && data.getTime() < inicio.getTime()) return false;
  if (fim && data.getTime() > fim.getTime()) return false;
  return true;
}

function datasProximas(
  a: string,
  b: string,
  toleranciaMs: number
) {
  const dataA = new Date(a).getTime();
  const dataB = new Date(b).getTime();
  return (
    Number.isFinite(dataA) &&
    Number.isFinite(dataB) &&
    Math.abs(dataA - dataB) <= toleranciaMs
  );
}

function adicionarDia(
  destino: Set<string>,
  valor: string
) {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return;
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");
  destino.add(`${ano}-${mes}-${dia}`);
}

function numeroSeguro(valor: unknown) {
  const numero = Number(valor);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}
