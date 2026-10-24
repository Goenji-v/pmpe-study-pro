import type { SessaoEstudo } from "../types";
import type { ProximaMissaoPlano } from "./planoUtils";
import type { SemanaPlano } from "../data/planoPMPE";

/**
 * O avanço de semana é cronológico, e não depende de marcar tarefas como feitas.
 * Sessões são evidência de quando o aluno começou; nenhuma conclusão é inferida.
 */
export function calcularSemanaCorrida(
  sessoes: readonly SessaoEstudo[],
  semanaMinima = 1,
  agora = new Date(),
  inicioInformado?: string
): number {
  // Datas YYYY-MM-DD são civis locais, não UTC (evita recuar um dia no Brasil).
  const marco = inicioInformado
    ? /^\d{4}-\d{2}-\d{2}$/.test(inicioInformado)
      ? new Date(...(inicioInformado.split("-").map(Number).map((valor, i) => i === 1 ? valor - 1 : valor) as [number, number, number]))
      : new Date(inicioInformado)
    : null;
  const datas = sessoes
    .map((sessao) => new Date(sessao.data))
    .filter((data) => Number.isFinite(data.getTime()) && data.getTime() <= agora.getTime());
  const inicio = marco && Number.isFinite(marco.getTime()) && marco.getTime() <= agora.getTime()
    ? marco
    : datas.sort((a, b) => a.getTime() - b.getTime())[0];

  const minima = Number.isFinite(semanaMinima)
    ? Math.max(1, Math.floor(semanaMinima))
    : 1;
  if (!inicio || !Number.isFinite(agora.getTime())) return minima;

  const segunda = (dia: Date) => {
    const diaDaSemana = (dia.getDay() + 6) % 7;
    const diasUtc = Date.UTC(dia.getFullYear(), dia.getMonth(), dia.getDate()) / 86400000;
    return diasUtc - diaDaSemana;
  };
  return Math.max(minima, Math.floor((segunda(agora) - segunda(inicio)) / 7) + 1);
}

/** Nunca redistribui, conclui ou duplica missões antigas. Semanas futuras
 * sem novos conteúdos só representam o tempo, e mantêm as pendências à vista. */
export function criarSemanasContinuas(plano: readonly SemanaPlano[], semanaAtual: number): SemanaPlano[] {
  if (!plano.length) return [];
  const saida = [...plano];
  const ultimoNumero = Math.max(0, ...plano.map((semana) => semana.numero));
  const limite = Math.max(ultimoNumero, semanaAtual);
  for (let numero = ultimoNumero + 1; numero <= limite; numero += 1) {
    saida.push({
      numero,
      nome: `Semana ${String(numero).padStart(2, "0")}`,
      dias: Array.from({ length: 7 }, (_, i) => ({ numero: i + 1, missoes: [] })),
    });
  }
  return saida;
}

/** Pendências anteriores à semana/dia atual são visíveis, mas não
 * são contabilizadas como realizadas nem regravadas em outra semana. */
export function listarPendenciasAnteriores(
  plano: readonly SemanaPlano[],
  concluidas: readonly string[],
  semanaAtual: number,
  diaAtual: number
): ProximaMissaoPlano[] {
  const feitas = new Set(concluidas);
  return plano.flatMap((semana) =>
    semana.dias.flatMap((dia) =>
      (semana.numero < semanaAtual || (semana.numero === semanaAtual && dia.numero < diaAtual))
        ? dia.missoes.filter((missao) => !feitas.has(missao.id)).map((missao) => ({
            semana: semana.numero, dia: dia.numero, missao,
          }))
        : []
    )
  );
}

export function obterMissaoHoje(
  plano: readonly SemanaPlano[],
  concluidas: readonly string[],
  semanaAtual: number,
  diaAtual: number
): ProximaMissaoPlano | null {
  const dia = plano.find((item) => item.numero === semanaAtual)
    ?.dias.find((item) => item.numero === diaAtual);
  const feitas = new Set(concluidas);
  const missao = dia?.missoes.find((item) => !feitas.has(item.id));
  return missao ? { semana: semanaAtual, dia: diaAtual, missao } : null;
}

/** Toda a fila antiga tem prioridade antes dos estudos futuros,
 * inclusive se o usuário avançou manualmente a semana. */
export function obterProximaMissaoContinua(
  plano: readonly SemanaPlano[],
  concluidas: readonly string[],
  semanaAtual: number,
  diaAtual: number
): ProximaMissaoPlano | null {
  const atrasadas = listarPendenciasAnteriores(plano, concluidas, semanaAtual, diaAtual);
  if (atrasadas.length) return atrasadas[0];
  const feitas = new Set(concluidas);
  for (const semana of plano) {
    if (semana.numero < semanaAtual) continue;
    for (const dia of semana.dias) {
      if (semana.numero === semanaAtual && dia.numero < diaAtual) continue;
      const missao = dia.missoes.find((item) => !feitas.has(item.id));
      if (missao) return { semana: semana.numero, dia: dia.numero, missao };
    }
  }
  return null;
}
