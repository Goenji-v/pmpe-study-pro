import {
  planoPMPE,
  type MissaoPlano,
  type SemanaPlano,
} from "../data/planoPMPE";

export const CHAVE_MISSOES_CONCLUIDAS =
  "pmpe_plano_missoes_concluidas";

export type ProximaMissaoPlano = {
  semana: number;
  dia: number;
  missao: MissaoPlano;
};

export function getMissoesConcluidas(): string[] {
  const salvo = localStorage.getItem(
    CHAVE_MISSOES_CONCLUIDAS
  );

  if (!salvo) {
    return [];
  }

  try {
    const valor: unknown = JSON.parse(salvo);

    if (!Array.isArray(valor)) {
      return [];
    }

    return valor.filter(
      (item): item is string =>
        typeof item === "string"
    );
  } catch {
    return [];
  }
}

export function getTodosIdsMissoes(plano: SemanaPlano[] = planoPMPE): string[] {
  return plano.flatMap((semana) =>
    semana.dias.flatMap((dia) =>
      dia.missoes.map((missao) => missao.id)
    )
  );
}

export function getTotalMissoes(plano: SemanaPlano[] = planoPMPE): number {
  return getTodosIdsMissoes(plano).length;
}

export function getTotalConcluidas(concluidasInformadas?: string[], plano: SemanaPlano[] = planoPMPE): number {
  const idsValidos = new Set(
    getTodosIdsMissoes(plano)
  );

  const concluidas = concluidasInformadas ?? getMissoesConcluidas();

  return concluidas.filter((id) =>
    idsValidos.has(id)
  ).length;
}

export function getTotalPendentes(concluidasInformadas?: string[], plano: SemanaPlano[] = planoPMPE): number {
  return Math.max(
    0,
    getTotalMissoes(plano) -
      getTotalConcluidas(concluidasInformadas, plano)
  );
}

export function getProgressoPlano(concluidasInformadas?: string[], plano: SemanaPlano[] = planoPMPE): number {
  const total = getTotalMissoes(plano);

  if (total === 0) {
    return 0;
  }

  return Math.round(
    (getTotalConcluidas(concluidasInformadas, plano) / total) * 100
  );
}

export function getProximaMissao(
  concluidasInformadas?: string[],
  plano: SemanaPlano[] = planoPMPE
): ProximaMissaoPlano | null {
  const concluidas = new Set(
    concluidasInformadas ?? getMissoesConcluidas()
  );

  for (const semana of plano) {
    for (const dia of semana.dias) {
      for (const missao of dia.missoes) {
        if (!concluidas.has(missao.id)) {
          return {
            semana: semana.numero,
            dia: dia.numero,
            missao,
          };
        }
      }
    }
  }

  return null;
}

export function getProgressoSemana(
  numeroSemana: number,
  concluidasInformadas?: string[],
  plano: SemanaPlano[] = planoPMPE
): number {
  const semana = plano.find(
    (item) => item.numero === numeroSemana
  );

  if (!semana) {
    return 0;
  }

  const idsSemana = semana.dias.flatMap(
    (dia) =>
      dia.missoes.map(
        (missao) => missao.id
      )
  );

  if (idsSemana.length === 0) {
    return 0;
  }

  const concluidas = new Set(
    concluidasInformadas ?? getMissoesConcluidas()
  );

  const realizadas = idsSemana.filter(
    (id) => concluidas.has(id)
  ).length;

  return Math.round(
    (realizadas / idsSemana.length) * 100
  );
}

export function getSemanaAtual(concluidasInformadas?: string[], plano: SemanaPlano[] = planoPMPE): number {
  const proxima = getProximaMissao(concluidasInformadas, plano);

  if (!proxima) {
    return plano.length;
  }

  return proxima.semana;
}

export function concluirMissaoPlano(
  missaoId: string
): void {
  const concluidas =
    getMissoesConcluidas();

  if (concluidas.includes(missaoId)) {
    return;
  }

  const novaLista = [
    ...concluidas,
    missaoId,
  ];

  localStorage.setItem(
    CHAVE_MISSOES_CONCLUIDAS,
    JSON.stringify(novaLista)
  );

  window.dispatchEvent(
    new Event("pmpe-plano-atualizado")
  );
}

export function desmarcarMissaoPlano(
  missaoId: string
): void {
  const novaLista =
    getMissoesConcluidas().filter(
      (id) => id !== missaoId
    );

  localStorage.setItem(
    CHAVE_MISSOES_CONCLUIDAS,
    JSON.stringify(novaLista)
  );

  window.dispatchEvent(
    new Event("pmpe-plano-atualizado")
  );
}