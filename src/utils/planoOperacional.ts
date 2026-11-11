import type { ConfiguracoesApp, Materia } from "../types";
import type { SemanaPlano } from "../data/planoPMPE";

import {
  criarPlanoCalendario,
  normalizarMissoesPorDia,
} from "./planoCalendario";
import { listarModulosDaMateria } from "../services/conteudos/navegarConteudos";
import {
  aplicarDiasAtividadesSemanais,
} from "./atividadesSemanaisPlano";
import {
  projetarPlanoCompactado,
} from "./projecaoCronogramaIndividual";
import {
  ampliarPlanoAteSemana,
  semanaPorDataInicio,
} from "./planoUtils";

export function obterConclusoesPlanoOperacional(
  materias: Materia[],
  concluidasInformadas: readonly string[],
  plano?: SemanaPlano[]
): string[] {
  const concluidas = new Set(concluidasInformadas);

  for (const materia of materias) {
    for (const modulo of listarModulosDaMateria(materia)) {
      for (const assunto of modulo.assuntos) {
        if (assunto.concluido) {
          concluidas.add(
            `conteudo-${materia.id}-${assunto.id}`
          );
        }
      }
    }
  }

  if (plano) {
    // IDs históricos de domingo continuam guardados no estado bruto,
    // mas saem da régua lógica antes da compactação para não contar
    // o mesmo simulado/redação duas vezes (ex.: semana 20 + semana 2).
    for (const id of [...concluidas]) {
      if (ehConclusaoDomingoTipada(id)) {
        concluidas.delete(id);
      }
    }

    compactarConclusoesDomingo(
      concluidas,
      concluidasInformadas,
      plano
    );
  }

  return [...concluidas];
}

function ehConclusaoDomingoTipada(id: string) {
  return /^(?:runtime-|cal-)?s\d+-d7-(redacao|simulado)$/.test(id);
}

function compactarConclusoesDomingo(
  destino: Set<string>,
  concluidasInformadas: readonly string[],
  plano: SemanaPlano[]
) {
  const semanasRedacao = new Set<number>();
  const semanasSimulado = new Set<number>();

  for (const id of concluidasInformadas) {
    const match = id.match(
      /^(?:runtime-|cal-)?s(\d+)-d7-(redacao|simulado)$/
    );

    if (!match) continue;

    const semana = Number(match[1]);
    if (!Number.isFinite(semana)) continue;

    if (match[2] === "redacao") {
      semanasRedacao.add(semana);
    } else {
      semanasSimulado.add(semana);
    }
  }

  aplicarCreditosDomingo(
    destino,
    plano,
    "redacao",
    semanasRedacao.size
  );
  aplicarCreditosDomingo(
    destino,
    plano,
    "simulado",
    semanasSimulado.size
  );
}

function aplicarCreditosDomingo(
  destino: Set<string>,
  plano: SemanaPlano[],
  tipo: "redacao" | "simulado",
  quantidade: number
) {
  if (quantidade <= 0) return;

  let restantes = quantidade;

  for (const semana of plano) {
    const domingo = semana.dias.find(
      (dia) => dia.numero === 7
    );
    const missao = domingo?.missoes.find(
      (item) => item.tipo === tipo
    );

    if (!missao) continue;

    destino.add(missao.id);
    restantes -= 1;

    if (restantes <= 0) break;
  }
}

export function criarPlanoOperacional(
  materias: Materia[],
  concluidasInformadas: readonly string[],
  configuracoes: ConfiguracoesApp
): SemanaPlano[] {
  const base = aplicarDiasAtividadesSemanais(
    criarPlanoCalendario(
      normalizarMissoesPorDia(configuracoes.missoesPorDia ?? 1),
      configuracoes.planoPadraoAtivo !== false,
      configuracoes.materiasPorDiaSemana,
      materias
    ),
    {
      diaRedacaoSemanal: configuracoes.diaRedacaoSemanal ?? "dom",
      diaSimuladoSemanal: configuracoes.diaSimuladoSemanal ?? "dom",
    }
  );

  const concluidas = obterConclusoesPlanoOperacional(
    materias,
    concluidasInformadas,
    base
  );

  const organizado =
    concluidas.length > 0
      ? projetarPlanoCompactado(base, concluidas)
      : base;

  // Revisões ficam na fila própria. No plano tático, segunda a sábado
  // mostram apenas conteúdo/questões. Domingo continua intocável.
  const grade = organizado.map((semana) => ({
    ...semana,
    dias: semana.dias.map((dia) => ({
      ...dia,
      missoes:
        dia.numero === 7
          ? [...dia.missoes]
          : dia.missoes.filter((missao) => !ehRevisaoOperacional(missao)),
    })),
  }));

  const semanaCalendario =
    semanaPorDataInicio(configuracoes.dataInicioPlano) ?? 1;

  return ampliarPlanoAteSemana(
    grade,
    semanaCalendario
  );
}

function ehRevisaoOperacional(
  missao: SemanaPlano["dias"][number]["missoes"][number]
) {
  if (missao.tipo === "revisao") return true;

  return /revis[aã]o|erros dos simulados/i.test(
    `${missao.materia} ${missao.assunto}`
  );
}
