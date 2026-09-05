import {
  planoPMPE,
  type DiaPlano,
  type MissaoPlano,
  type SemanaPlano,
} from "../data/planoPMPE";
import { criarPlanoMateriasRuntime } from "./planoMateriasRuntime";

export const NOMES_DIAS_PLANO: Record<number, string> = {
  1: "Segunda",
  2: "Terça",
  3: "Quarta",
  4: "Quinta",
  5: "Sexta",
  6: "Sábado",
  7: "Domingo",
};

type EntradaFila = {
  missao: MissaoPlano;
  revisao?: string;
  atividadeExtra?: string;
};


export function obterDiaAtualPlano(data = new Date()): number {
  const diaJs = data.getDay();
  return diaJs === 0 ? 7 : diaJs;
}

export function normalizarMissoesPorDia(valor: number | undefined): number {
  if (!Number.isFinite(valor)) return 1;
  return Math.max(1, Math.min(6, Math.floor(valor as number)));
}

/**
 * Reorganiza apenas a apresentação do plano. Os IDs e a ordem das missões
 * de segunda a sábado são preservados; só muda em qual dia do calendário
 * cada missão aparece, conforme o ritmo configurado pelo usuário.
 *
 * Contas sem o plano PMPE padrão usam os conteúdos realmente cadastrados
 * (curso importado ou cadastro manual) como fonte do cronograma.
 */
export function criarPlanoCalendario(missoesPorDiaInformadas = 1, planoPadraoAtivo = true): SemanaPlano[] {
  const missoesPorDia = normalizarMissoesPorDia(missoesPorDiaInformadas);

  if (!planoPadraoAtivo) {
    return criarPlanoMateriasRuntime(missoesPorDia);
  }

  const fila: EntradaFila[] = [];

  planoPMPE.forEach((semana) => {
    semana.dias
      .filter((dia) => dia.numero !== 7)
      .forEach((dia) => {
        dia.missoes.forEach((missao, indice) => {
          const ultimaMissaoDoBloco = indice === dia.missoes.length - 1;
          fila.push({
            missao,
            revisao: ultimaMissaoDoBloco ? dia.revisao : undefined,
            atividadeExtra: ultimaMissaoDoBloco ? dia.atividadeExtra : undefined,
          });
        });
      });
  });

  const semanas: SemanaPlano[] = [];
  let indice = 0;
  let numeroSemana = 1;

  while (indice < fila.length) {
    const dias: DiaPlano[] = [];

    for (let numeroDia = 1; numeroDia <= 6; numeroDia += 1) {
      const entradas = fila.slice(indice, indice + missoesPorDia);
      if (entradas.length === 0) break;
      indice += entradas.length;

      const revisoes = Array.from(
        new Set(entradas.map((item) => item.revisao).filter((item): item is string => Boolean(item)))
      );
      const atividades = Array.from(
        new Set(entradas.map((item) => item.atividadeExtra).filter((item): item is string => Boolean(item)))
      );

      dias.push({
        numero: numeroDia,
        missoes: entradas.map((item, posicao) => ({
          ...item.missao,
          numero: posicao + 1,
        })),
        revisao: revisoes.length > 0 ? revisoes.join(" · ") : undefined,
        atividadeExtra: atividades.length > 0 ? atividades.join(" · ") : undefined,
      });
    }

    dias.push(criarDomingoCalendario(numeroSemana));
    semanas.push({
      numero: numeroSemana,
      nome: `Semana ${String(numeroSemana).padStart(2, "0")}`,
      dias,
    });
    numeroSemana += 1;
  }

  return semanas;
}

function criarDomingoCalendario(numeroSemana: number): DiaPlano {
  const domingoExistente = planoPMPE
    .find((semana) => semana.numero === numeroSemana)
    ?.dias.find((dia) => dia.numero === 7);

  if (domingoExistente) {
    return {
      ...domingoExistente,
      missoes: domingoExistente.missoes.map((missao) => ({ ...missao })),
    };
  }

  return {
    numero: 7,
    missoes: [
      {
        id: `cal-s${numeroSemana}-d7-redacao`,
        numero: 1,
        materia: "Redação",
        assunto: "Redação semanal",
        tipo: "redacao",
      },
      {
        id: `cal-s${numeroSemana}-d7-simulado`,
        numero: 2,
        materia: "Simulado",
        assunto: "Simulado semanal",
        tipo: "simulado",
      },
    ],
  };
}
