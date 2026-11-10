import type { ConfiguracoesApp, Materia } from "../types";
import type { SemanaPlano } from "../data/planoPMPE";

import {
  criarPlanoCalendario,
  normalizarMissoesPorDia,
} from "./planoCalendario";
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

export function criarPlanoOperacional(
  materias: Materia[],
  concluidas: readonly string[],
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
