import type {
  RegistroQuestao,
  SessaoEstudo,
  Simulado,
} from "../types";

export type MetricasConsolidadas = {
  questoesRespondidas: number;
  certas: number;
  erradas: number;
  emBranco: number;
  anuladas: number;
  totalOriginal: number;
  aproveitamento: number;
  minutos: number;
  sessoes: number;
  simulados: number;
};

type EntradaMetricas = {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  simulados: Simulado[];
  inicio?: Date;
  fim?: Date;
};

export function calcularMetricasConsolidadas({
  questoes,
  sessoes,
  simulados,
  inicio,
  fim,
}: EntradaMetricas): MetricasConsolidadas {
  const questoesPeriodo = questoes.filter((item) =>
    estaNoPeriodo(item.data, inicio, fim)
  );
  const sessoesPeriodo = sessoes.filter((item) =>
    estaNoPeriodo(item.data, inicio, fim)
  );
  const simuladosPeriodo = simulados.filter((item) =>
    estaNoPeriodo(item.data, inicio, fim)
  );

  const simuladosSemEspelho = filtrarSimuladosSemEspelhoQuestoes(
    simuladosPeriodo,
    questoesPeriodo
  );

  const certasRegistros = questoesPeriodo.reduce(
    (total, item) => total + numeroSeguro(item.certas),
    0
  );
  const erradasRegistros = questoesPeriodo.reduce(
    (total, item) => total + numeroSeguro(item.erradas),
    0
  );
  const brancasRegistros = questoesPeriodo.reduce(
    (total, item) => total + numeroSeguro(item.emBranco),
    0
  );

  const certasSimulados = simuladosSemEspelho.reduce(
    (total, item) => total + numeroSeguro(item.certas),
    0
  );
  const erradasSimulados = simuladosSemEspelho.reduce(
    (total, item) => total + numeroSeguro(item.erradas),
    0
  );
  const brancasSimulados = simuladosSemEspelho.reduce(
    (total, item) => total + numeroSeguro(item.emBranco),
    0
  );
  const anuladas = simuladosSemEspelho.reduce(
    (total, item) => total + numeroSeguro(item.anuladas),
    0
  );

  const certas = certasRegistros + certasSimulados;
  const erradas = erradasRegistros + erradasSimulados;
  const emBranco = brancasRegistros + brancasSimulados;
  const questoesRespondidas = certas + erradas;
  const totalOriginal = questoesRespondidas + emBranco + anuladas;

  const minutosSessoes = sessoesPeriodo.reduce(
    (total, item) => total + numeroSeguro(item.minutos),
    0
  );

  const minutosQuestoes = questoesPeriodo.reduce((total, registro) => {
    const duplicadoPorSessao = sessoesPeriodo.some((sessao) =>
      sessao.tipo === "questoes" &&
      mesmoTexto(sessao.materia, registro.materia) &&
      mesmoTexto(sessao.assunto, registro.assunto) &&
      diferencaMs(sessao.data, registro.data) < 5000
    );

    return total + (duplicadoPorSessao ? 0 : numeroSeguro(registro.minutos));
  }, 0);

  const minutosSimulados = simuladosSemEspelho.reduce(
    (total, item) => total + numeroSeguro(item.minutos),
    0
  );

  return {
    questoesRespondidas,
    certas,
    erradas,
    emBranco,
    anuladas,
    totalOriginal,
    aproveitamento:
      questoesRespondidas === 0
        ? 0
        : Math.round((certas / questoesRespondidas) * 100),
    minutos: minutosSessoes + minutosQuestoes + minutosSimulados,
    sessoes: sessoesPeriodo.length,
    simulados: simuladosPeriodo.length,
  };
}

export function filtrarSimuladosSemEspelhoQuestoes(
  simulados: Simulado[],
  questoes: RegistroQuestao[]
): Simulado[] {
  const tentativasJaContabilizadas = new Set(
    questoes
      .map((registro) => registro.tentativaId)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0)
  );

  return simulados.filter((simulado) => {
    const tentativaId = simulado.tentativaId?.trim();
    return !tentativaId || !tentativasJaContabilizadas.has(tentativaId);
  });
}

export function calcularAproveitamentoSimulado(simulado: Simulado) {
  const certas = numeroSeguro(simulado.certas);
  const erradas = numeroSeguro(simulado.erradas);
  const respondidasValidas = certas + erradas;

  return respondidasValidas === 0
    ? 0
    : Math.round((certas / respondidasValidas) * 100);
}

export function obterTotalOriginalSimulado(simulado: Simulado) {
  const informado = numeroSeguro(simulado.totalQuestoes);
  if (informado > 0) return informado;

  return (
    numeroSeguro(simulado.certas) +
    numeroSeguro(simulado.erradas) +
    numeroSeguro(simulado.emBranco) +
    numeroSeguro(simulado.anuladas)
  );
}

function estaNoPeriodo(
  valor: string,
  inicio?: Date,
  fim?: Date
) {
  const tempo = new Date(valor).getTime();
  if (!Number.isFinite(tempo)) return false;
  if (inicio && tempo < inicio.getTime()) return false;
  if (fim && tempo > fim.getTime()) return false;
  return true;
}

function diferencaMs(a: string, b: string) {
  const ta = new Date(a).getTime();
  const tb = new Date(b).getTime();
  if (!Number.isFinite(ta) || !Number.isFinite(tb)) return Number.POSITIVE_INFINITY;
  return Math.abs(ta - tb);
}

function mesmoTexto(a: string, b: string) {
  return normalizar(a) === normalizar(b);
}

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function numeroSeguro(valor: unknown) {
  const numero = Number(valor ?? 0);
  return Number.isFinite(numero) && numero > 0 ? numero : 0;
}
