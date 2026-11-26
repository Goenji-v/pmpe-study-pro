import type { Materia, Revisao } from "../../types";
import type { AnaliseEdital } from "../../types/editalInteligente";
import { referenciaDoEdital, resolverUnidade } from "../conteudos/identidadeAprendizagem";
import { orientar } from "./avaliacao";
import { diaEstudo, distribuir, projetar, somarDia, type Candidato, type Compromisso, type Limites } from "./agenda";
import { instanteValido, reconciliarLegado } from "./eventos";
import { carregarMemoria, type DiarioMemoria } from "./memoria";

export type EntradaPlano = {
  materias: readonly Materia[];
  revisoes: readonly Revisao[];
  diario: DiarioMemoria;
  compromissos: readonly Compromisso[];
  limites: Limites;
  agora: Date;
  prova?: string;
  edital?: AnaliseEdital;
  preferenciaDatas?: Readonly<Record<string, string>>;
};

export async function planejarRevisoes(e: EntradaPlano) {
  const memoria = await carregarMemoria(e.materias, e.diario, e.agora);
  const hoje = diaEstudo(e.agora);
  const legado = reconciliarLegado(e.materias, e.revisoes);
  const pendentes = new Map<string, Revisao>();
  for (const { revisao, vinculo } of legado) {
    if (vinculo?.status !== "validado" || revisao.concluida || revisao.integradaEmId ||
        revisao.origemSimulado || !instanteValido(revisao.dataPrevista)) continue;
    const anterior = pendentes.get(vinculo.unidadeId);
    if (!anterior || Date.parse(revisao.dataPrevista) < Date.parse(anterior.dataPrevista) ||
        (revisao.dataPrevista === anterior.dataPrevista && revisao.id < anterior.id))
      pendentes.set(vinculo.unidadeId, revisao);
  }
  const relevancia = new Map<string, { peso: number; incidencia: number }>();
  for (const materia of e.edital?.materias ?? []) for (const assunto of materia.assuntos) {
    const referencia = referenciaDoEdital(materia, assunto);
    if (!referencia) continue;
    const vinculo = resolverUnidade(e.materias, referencia);
    if (vinculo.status !== "validado") continue;
    relevancia.set(vinculo.unidadeId, { peso: { alta: 12, media: 6, baixa: 0 }[assunto.prioridade],
      incidencia: Math.min(15, Math.max(0, Number(materia.incidenciaEstimada) || 0)) });
  }
  const estados = [...memoria.estados.values()];
  if (new Set(estados.map(estado => estado.usuarioId)).size > 1)
    throw new Error("Planeje uma conta de cada vez.");
  const dados = new Map(estados.flatMap(estado => {
    if (!estado.primeiraAprendizagem) return [];
    const [, materiaId, moduloId, assuntoId, , aulaId] = JSON.parse(estado.unidadeId) as string[];
    const materia = e.materias.find(m => m.id === materiaId);
    const assunto = materia?.modulos?.length
      ? materia.modulos.find(m => m.id === moduloId)?.assuntos.find(a => a.id === assuntoId)
      : materia?.assuntos.find(a => a.id === assuntoId);
    const dataLegada = pendentes.get(estado.unidadeId);
    const primeira = !estado.cartao;
    const ideal = primeira ? somarDia(diaEstudo(new Date(estado.primeiraAprendizagem)), 1) : diaEstudo(estado.cartao!.dueAt);
    const avaliacao = estado.historico.findLast(h => h.log)?.avaliacao;
    const importancia = relevancia.get(estado.unidadeId) ?? relevancia.get(JSON.stringify(["memoria-v1", materiaId, moduloId, assuntoId]));
    const candidato: Candidato = { unidadeId: estado.unidadeId, materia: materia?.nome ?? materiaId,
      assunto: assunto?.aulas?.find(a => a.id === aulaId)?.nome ?? assunto?.nome ?? assuntoId,
      ideal, limite: somarDia(ideal, primeira || avaliacao?.recorrente ? 2 : 5),
      minutos: avaliacao?.recorrente || avaliacao?.nota === "Again" ? 18 : 12,
      primeira, retencao: memoria.recuperar(estado), desempenho: avaliacao?.percentual,
      recorrente: avaliacao?.recorrente, ...importancia, prova: e.prova,
      compromisso: e.preferenciaDatas?.[estado.unidadeId] || (dataLegada && diaEstudo(new Date(dataLegada.dataPrevista))) };
    return [[estado.unidadeId, { candidato, estado, orientacao: orientar(avaliacao), revisaoLegadaId: dataLegada?.id }] as const];
  }));
  const fixos = [...e.compromissos];
  for (const { revisao, vinculo } of legado) {
    if (revisao.concluida || revisao.integradaEmId || revisao.origemSimulado ||
        !instanteValido(revisao.dataPrevista) || (vinculo?.status === "validado" && dados.has(vinculo.unidadeId))) continue;
    const dia = diaEstudo(new Date(revisao.dataPrevista));
    fixos.push({ id: JSON.stringify(["revisao", revisao.id]), dia: dia < hoje ? hoje : dia,
      titulo: revisao.assunto + " (agenda oficial)", tipo: "revisao", minutos: 12 });
  }
  const agenda = distribuir([...dados.values()].map(d => d.candidato), fixos, hoje, e.limites);
  const dias = new Map(agenda.dias.map(d => [d.dia, d]));
  for (const item of agenda.agenda) {
    if (!item.agendada) continue;
    const estimada = memoria.estimarSeguinte(dados.get(item.unidadeId)!.estado, new Date(Math.max(+e.agora, Date.parse(item.agendada + "T15:00:00Z"))));
    const dia = dias.get(diaEstudo(estimada));
    if (dia && dia.dia > item.agendada) dia.estimadas++;
  }
  return { ...agenda, dados, estadosMemoria: memoria.estados, legado, reconciliacao: memoria.reconciliacao,
    previsoes: ([7, 15, 30] as const).map(horizonte => ({ horizonte, ...projetar(agenda, horizonte) })) };
}
export type PlanoAdaptativo = Awaited<ReturnType<typeof planejarRevisoes>>;
