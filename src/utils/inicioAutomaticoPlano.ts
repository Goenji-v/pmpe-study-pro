import type { ConfiguracoesApp, Materia } from '../types';
import { criarPlanoOperacional, obterConclusoesPlanoOperacional } from './planoOperacional';
import { getSemanaOperacional } from './planoUtils';

/** Migra contas antigas sem deslocar a semana operacional nem alterar conclusões. */
export function inferirInicioAutomaticoPlano(config: ConfiguracoesApp, materias: Materia[], concluidas: string[], agora = new Date()): string {
  if (config.dataInicioPlano) return config.dataInicioPlano;
  const plano = criarPlanoOperacional(materias, concluidas, config);
  const feitas = obterConclusoesPlanoOperacional(materias, concluidas, plano);
  const semana = getSemanaOperacional(feitas, plano, config.semanaAtualPlano, undefined, agora);
  const inicio = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate(), 12);
  inicio.setDate(inicio.getDate() - ((inicio.getDay() + 6) % 7) - 7 * (semana - 1));
  return `${inicio.getFullYear()}-${String(inicio.getMonth()+1).padStart(2,'0')}-${String(inicio.getDate()).padStart(2,'0')}`;
}
