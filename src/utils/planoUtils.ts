import { armazenamentoLocalDaConta as localStorage } from "../services/armazenamentoConta";
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

function inferirSemanaComProgresso(
  concluidas: Set<string>,
  plano: SemanaPlano[]
): number {
  const primeiraSemana = plano[0]?.numero ?? 1;
  let semanaMaisAvancada = primeiraSemana;
  let encontrouProgresso = false;

  for (const semana of plano) {
    const possuiConclusao = semana.dias.some((dia) =>
      dia.missoes.some((missao) => concluidas.has(missao.id))
    );

    if (possuiConclusao) {
      encontrouProgresso = true;
      semanaMaisAvancada = Math.max(semanaMaisAvancada, semana.numero);
    }
  }

  return encontrouProgresso ? semanaMaisAvancada : primeiraSemana;
}

export function getProximaMissao(
  concluidasInformadas?: string[],
  plano: SemanaPlano[] = planoPMPE,
  semanaMinimaInformada?: number
): ProximaMissaoPlano | null {
  const concluidas = new Set(
    concluidasInformadas ?? getMissoesConcluidas()
  );

  // A semana atual é referência do calendário, não um corte das pendências.
  // Nunca deixar matérias antigas desaparecerem nem declarar plano concluído
  // apenas porque uma semana futura foi selecionada.
  void semanaMinimaInformada;
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

/**
 * Semana pelo calendário, independente de tarefas feitas.
 * A data de início é configurada pelo titular. Sem data confiável,
 * preservamos o modo legado, sem inventar início de estudos.
 */
export function semanaPorDataInicio(
  dataInicio: string | undefined,
  agora = new Date()
): number | null {
  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(dataInicio ?? "")) return null;
  const [ano, mes, dia] = dataInicio!.split("-").map(Number);
  const data = new Date(ano, mes - 1, dia, 12);
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null;
  const diaSemana = (data.getDay() + 6) % 7; // segunda é zero
  const inicioSegunda = Date.UTC(ano, mes - 1, dia - diaSemana);
  const hojeSegunda = Date.UTC(
    agora.getFullYear(), agora.getMonth(), agora.getDate() - (agora.getDay() + 6) % 7
  );
  return Math.max(1, Math.floor((hojeSegunda - inicioSegunda) / (7 * 86400000)) + 1);
}

export function listarPendenciasAteSemana(
  concluidasInformadas: string[],
  plano: SemanaPlano[],
  semanaAtual: number
): ProximaMissaoPlano[] {
  const concluidas = new Set(concluidasInformadas);
  return plano.flatMap((semana) =>
    semana.numero >= semanaAtual ? [] : semana.dias.flatMap((dia) =>
      dia.missoes.filter((missao) => !concluidas.has(missao.id)).map((missao) => ({
        semana: semana.numero, dia: dia.numero, missao,
      }))
    )
  );
}

export function getSemanaAtual(
  concluidasInformadas?: string[],
  plano: SemanaPlano[] = planoPMPE,
  semanaMinimaInformada?: number,
  dataInicioPlano?: string,
  agora = new Date()
): number {
  const peloCalendario = semanaPorDataInicio(dataInicioPlano, agora);
  const minimo = Number.isFinite(semanaMinimaInformada)
    ? Math.max(1, Math.floor(semanaMinimaInformada!))
    : 1;
  if (peloCalendario !== null) return Math.max(minimo, peloCalendario);
  if (plano.length === 0) return minimo;
  const concluidas = new Set(concluidasInformadas ?? getMissoesConcluidas());
  return Math.max(minimo, inferirSemanaComProgresso(concluidas, plano));
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
