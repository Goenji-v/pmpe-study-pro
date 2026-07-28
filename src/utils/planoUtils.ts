import {
  planoPMPE,
  type MissaoPlano,
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

export function getTodosIdsMissoes(): string[] {
  return planoPMPE.flatMap((semana) =>
    semana.dias.flatMap((dia) =>
      dia.missoes.map((missao) => missao.id)
    )
  );
}

export function getTotalMissoes(): number {
  return getTodosIdsMissoes().length;
}

export function getTotalConcluidas(): number {
  const idsValidos = new Set(
    getTodosIdsMissoes()
  );

  return getMissoesConcluidas().filter((id) =>
    idsValidos.has(id)
  ).length;
}

export function getTotalPendentes(): number {
  return Math.max(
    0,
    getTotalMissoes() -
      getTotalConcluidas()
  );
}

export function getProgressoPlano(): number {
  const total = getTotalMissoes();

  if (total === 0) {
    return 0;
  }

  return Math.round(
    (getTotalConcluidas() / total) * 100
  );
}

export function getProximaMissao():
  | ProximaMissaoPlano
  | null {
  const concluidas = new Set(
    getMissoesConcluidas()
  );

  for (const semana of planoPMPE) {
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
  numeroSemana: number
): number {
  const semana = planoPMPE.find(
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
    getMissoesConcluidas()
  );

  const realizadas = idsSemana.filter(
    (id) => concluidas.has(id)
  ).length;

  return Math.round(
    (realizadas / idsSemana.length) * 100
  );
}

export function getSemanaAtual(): number {
  const proxima = getProximaMissao();

  if (!proxima) {
    return planoPMPE.length;
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