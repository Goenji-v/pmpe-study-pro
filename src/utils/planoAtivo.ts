import type { Materia, ConfiguracoesApp } from '../types';
import type { SemanaPlano } from '../data/planoPMPE';
import { encontrarAulasNosConteudos } from './relacionarCursoEdital';
import type { ConfiguracoesComCursos } from '../types/cursos';
import { materiasEquivalentes } from './uniaoGradeEstudos';
import type { ConfiguracoesComEdital } from '../types/editalInteligente';
import { gerarPlanoEdital, preservarIdsPlanoAnterior } from './planoEdital';
import { criarPlanoCalendario } from './planoCalendario';
import { aplicarDiasAtividadesSemanais } from './atividadesSemanaisPlano';
import { semanaPorDataInicio } from './planoUtils';

/** A mesma grade e os mesmos IDs em todas as telas. Não grava nem reordena conclusões. */
export function criarPlanoAtivo(config: ConfiguracoesApp, materias: Materia[], _agora = new Date()): SemanaPlano[] {
  const edital = (config as ConfiguracoesComEdital).editalAtivo;
  let base: SemanaPlano[];
  if (edital?.analise) {
    const plano = preservarIdsPlanoAnterior(gerarPlanoEdital(edital.analise, config, materias), edital.plano);
    base = plano.semanas.map(s => ({numero: s.numero, nome: `Semana ${String(s.numero).padStart(2, '0')}`, dias: s.dias.map(d => ({
      numero: ['seg','ter','qua','qui','sex','sab','dom'].indexOf(d.diaSemana) + 1,
      missoes: d.missoes.map((m, i) => {
        const aula = !m.tipo || m.tipo === 'conteudo'
          ? encontrarAulasNosConteudos(materias, (config as ConfiguracoesComCursos).cursosAtivosIds ?? [], m.materia, m.assunto, 1)[0]
          : undefined;
        const materia = aula && materias.find(item => materiasEquivalentes(item.nome, aula.materia));
        return {id: m.id, numero: i + 1, materia: m.materia, assunto: m.assunto, tipo: m.tipo ?? 'conteudo',
          urlAula: aula?.url,
          conteudo: aula && materia ? {materiaId: materia.id, moduloId: aula.moduloId, assuntoId: aula.assuntoId, aulaId: aula.aulaId} : undefined,
        };
      }),
    }))}));
  } else {
    base = aplicarDiasAtividadesSemanais(criarPlanoCalendario(config.missoesPorDia ?? 1, config.planoPadraoAtivo !== false, config.materiasPorDiaSemana), config);
  }
  const grade = base.map(s => ({...s, dias: s.dias.map(d => ({...d, missoes: d.missoes.filter(m => m.tipo !== 'revisao')}))}));
  return grade;
}

/** Usa datas locais e o mesmo início de semana do painel, inclusive na virada do ano. */
export function indexarPlanoPorData(plano: SemanaPlano[], dataInicio?: string) {
  const resultado = new Map<string, {semana: number; dia: number; missoes: SemanaPlano['dias'][number]['missoes']}>();
  if (semanaPorDataInicio(dataInicio) === null) return resultado;
  const [ano, mes, dia] = dataInicio!.split('-').map(Number);
  const inicio = new Date(ano, mes - 1, dia, 12);
  inicio.setDate(inicio.getDate() - (inicio.getDay() + 6) % 7);
  for (const semana of plano) for (const diaPlano of semana.dias) {
    const data = new Date(inicio);
    data.setDate(inicio.getDate() + (semana.numero - 1) * 7 + diaPlano.numero - 1);
    const chave = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`;
    resultado.set(chave, {semana: semana.numero, dia: diaPlano.numero, missoes: diaPlano.missoes});
  }
  return resultado;
}
