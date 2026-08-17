import type { RegistroQuestao, Revisao, SessaoEstudo, Simulado } from "../types";

export type RelatorioMensalCronograma = {
  mes: string;
  minutosPlanejados: number;
  minutosRealizados: number;
  percentualTempo: number;
  questoes: number;
  aproveitamento: number;
  simulados: number;
  redacoes: number;
  revisoes: number;
  materiaDestaque?: string;
  materiaCritica?: string;
  proposta: string;
};

export type AjusteControlado = {
  id: string;
  semana: string;
  criadoEm: string;
  materiaAnterior: string;
  materiaPrioritaria: string;
  motivo: string;
  ativo: boolean;
  desfeitoEm?: string;
};

const chaveMes = (data: string) => data.slice(0, 7);
const numero = (valor: unknown) => Number(valor) || 0;

export function chaveSemana(data = new Date()) {
  const base = new Date(Date.UTC(data.getFullYear(), data.getMonth(), data.getDate()));
  const dia = base.getUTCDay() || 7;
  base.setUTCDate(base.getUTCDate() + 4 - dia);
  const inicioAno = new Date(Date.UTC(base.getUTCFullYear(), 0, 1));
  const semana = Math.ceil((((base.getTime() - inicioAno.getTime()) / 86400000) + 1) / 7);
  return `${base.getUTCFullYear()}-S${String(semana).padStart(2, "0")}`;
}

export function gerarRelatorioMensal(params: {
  questoes: RegistroQuestao[];
  sessoes: SessaoEstudo[];
  revisoes: Revisao[];
  simulados: Simulado[];
  minutosMetaDia: number;
  diasSemana: number;
  agora?: Date;
}): RelatorioMensalCronograma {
  const agora = params.agora ?? new Date();
  const mes = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, "0")}`;
  const diasDecorridos = agora.getDate();
  const diasPlanejados = Math.max(1, Math.round(diasDecorridos / 7 * Math.min(7, Math.max(1, params.diasSemana))));
  const minutosPlanejados = diasPlanejados * Math.max(0, params.minutosMetaDia);
  const sessoes = params.sessoes.filter((item) => chaveMes(item.data) === mes);
  const questoes = params.questoes.filter((item) => chaveMes(item.data) === mes);
  const revisoes = params.revisoes.filter((item) => item.concluida && chaveMes(item.dataConclusao || item.dataPrevista) === mes);
  const simulados = params.simulados.filter((item) => chaveMes(item.data) === mes);
  const porMateria = new Map<string, { certas: number; erradas: number }>();
  questoes.forEach((item) => {
    const atual = porMateria.get(item.materia) ?? { certas: 0, erradas: 0 };
    porMateria.set(item.materia, { certas: atual.certas + numero(item.certas), erradas: atual.erradas + numero(item.erradas) });
  });
  const ranking = Array.from(porMateria.entries()).map(([materia, valor]) => ({ materia, total: valor.certas + valor.erradas, percentual: valor.certas + valor.erradas ? Math.round(valor.certas / (valor.certas + valor.erradas) * 100) : 0 })).filter((item) => item.total >= 5).sort((a, b) => b.percentual - a.percentual);
  const certas = questoes.reduce((total, item) => total + numero(item.certas), 0);
  const erradas = questoes.reduce((total, item) => total + numero(item.erradas), 0);
  const total = certas + erradas;
  const minutosRealizados = sessoes.reduce((soma, item) => soma + numero(item.minutos), 0);
  const materiaCritica = ranking.at(-1)?.materia;
  return {
    mes,
    minutosPlanejados,
    minutosRealizados,
    percentualTempo: minutosPlanejados ? Math.round(minutosRealizados / minutosPlanejados * 100) : 0,
    questoes: total,
    aproveitamento: total ? Math.round(certas / total * 100) : 0,
    simulados: simulados.length,
    redacoes: sessoes.filter((item) => item.tipo === "redacao").length,
    revisoes: revisoes.length,
    materiaDestaque: ranking[0]?.materia,
    materiaCritica,
    proposta: materiaCritica ? `Priorizar ${materiaCritica} na próxima semana, mantendo todas as demais matérias.` : "Registre pelo menos 5 questões por matéria para liberar uma proposta confiável.",
  };
}

export function criarAjusteControlado(relatorio: RelatorioMensalCronograma, materiaAtual: string): AjusteControlado | null {
  if (!relatorio.materiaCritica || relatorio.questoes < 10) return null;
  return {
    id: crypto.randomUUID(),
    semana: chaveSemana(),
    criadoEm: new Date().toISOString(),
    materiaAnterior: materiaAtual,
    materiaPrioritaria: relatorio.materiaCritica,
    motivo: `${relatorio.materiaCritica} apresentou o menor aproveitamento no mês. Nenhuma matéria foi removida.`,
    ativo: true,
  };
}
