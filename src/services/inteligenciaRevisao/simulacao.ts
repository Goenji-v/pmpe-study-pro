import type { Materia, Revisao } from "../../types";
import { criarProximaRevisao } from "../../utils/revisoes";
import { diaEstudo, somarDia, type Limites } from "./agenda";
import type { Observacao } from "./eventos";
import { carregarMemoria, versaoMemoria } from "./memoria";
import { planejarRevisoes } from "./plano";

export const perfisSimulacao = [
  { nome: "Iniciante", acertos: 7, vagas: 4 },
  { nome: "Intermediário", acertos: 8, vagas: 5 },
  { nome: "Avançado", acertos: 9, vagas: 6 },
  { nome: "Baixo desempenho", acertos: 4, vagas: 4 },
  { nome: "Alto desempenho", acertos: 10, vagas: 5 },
  { nome: "Pouca disponibilidade", acertos: 8, vagas: 1 },
  { nome: "Fila acumulada", acertos: 7, vagas: 3, atraso: 9 },
  { nome: "Prova próxima", acertos: 8, vagas: 3, prova: true },
  { nome: "Mudança de edital", acertos: 8, vagas: 4, edital: true },
  { nome: "Atrasos recorrentes", acertos: 7, vagas: 3, faltas: true },
  { nome: "Eventos duplicados", acertos: 8, vagas: 4, duplicar: true },
  { nome: "Revisões críticas", acertos: 3, vagas: 2, atraso: 12 },
] as const;

type Perfil = typeof perfisSimulacao[number];
const inicio = "2027-01-01";
const noDia = (dia: string) => new Date(dia + "T16:00:00Z");

export async function simular(perfil: Perfil, horizonte: 30 | 60 | 90, motor: "legado" | "adaptativo", minutosPorAula = 0) {
  const inicioExecucao = performance.now();
  const materias: Materia[] = ["Português", "Direito", "Informática"].map((nome, m) => ({
    id: String(m), nome, assuntos: Array.from({ length: 6 }, (_, a) =>
      ({ id: String(a), nome: `Tópico ${a + 1}`, prioridade: "alta", concluido: false })),
  }));
  const unidades = materias.flatMap((materia, m) => materia.assuntos.map((assunto, a) =>
    ({ materia, assunto, entrada: "atraso" in perfil ? -perfil.atraso : a * 2 + m })));
  const revisoes = new Map<string, Revisao>();
  const observacoes: Observacao[] = [];
  const diario = { versao: versaoMemoria, retencao: 0.9, observacoes } as const;
  const limites: Limites = { semana: [1, 2, 3, 4, 5, 6], revisoes: perfil.vagas, minutos: perfil.vagas * 18 };
  const carga: number[] = [];
  const cargaMinutos: number[] = [];
  const cargaAulas: number[] = [];
  const margem: number[] = [];
  const ensinadas = new Set<typeof unidades[number]>();
  if (!Number.isSafeInteger(minutosPorAula) || minutosPorAula < 0) throw new Error("Duração de aula inválida.");
  let atrasadas = 0;
  let semVaga = 0;
  const registrar = (u: typeof unidades[number], dia: string, ativas: boolean, certas = 0, ocorridoEm = noDia(dia).toISOString()) => {
    const observacao: Observacao = { evento: { usuarioId: "simulacao", origem: "sessao",
      ocorrenciaId: JSON.stringify([u.materia.id, u.assunto.id, dia, ativas]),
      tipo: ativas ? "recuperacao" : "estudo", ocorridoEm,
      conteudo: { materiaId: u.materia.id, assuntoId: u.assunto.id } },
    evidencia: ativas ? { modo: "recuperacao", certas, erradas: 10 - certas } : { modo: "passivo" } };
    observacoes.push(observacao);
    if ("duplicar" in perfil) observacoes.push(observacao);
  };
  for (let i = 0; i < horizonte; i++) {
    const dia = somarDia(inicio, i);
    const agora = noDia(dia);
    const ausente = !limites.semana.includes(agora.getUTCDay()) || ("faltas" in perfil && i % 4 === 0);
    const disponiveis = ausente ? 0 : limites.minutos;
    let aulasHoje = 0;
    for (const u of unidades) {
      if (u.entrada > i || ensinadas.has(u)) continue;
      if (minutosPorAula && u.entrada >= 0 && aulasHoje + minutosPorAula > disponiveis) continue;
      const estudo = somarDia(inicio, minutosPorAula && u.entrada >= 0 ? i : u.entrada);
      ensinadas.add(u);
      if (u.entrada >= 0) aulasHoje += minutosPorAula;
      registrar(u, estudo, false);
      const id = JSON.stringify([u.materia.id, u.assunto.id]);
      revisoes.set(id, { id, materiaId: u.materia.id, assuntoId: u.assunto.id, materia: u.materia.nome,
        assunto: u.assunto.nome, etapa: 1, concluida: false, dataCriacao: noDia(estudo).toISOString(),
        dataPrevista: noDia(somarDia(estudo, 1)).toISOString() });
    }
    const edital = "edital" in perfil && i >= 15 ? { concursoDetectado: perfil.nome, analisadoEm: agora.toISOString(),
      materias: materias.slice(1).map(m => ({ id: m.id, nome: m.nome, conteudoCanonicoId: m.id, incidenciaEstimada: 15,
        assuntos: m.assuntos.map(a => ({ id: a.id, nome: a.nome, conteudoCanonicoId: a.id, prioridade: a.prioridade })) })) } : undefined;
    const plano = motor === "adaptativo" ? await planejarRevisoes({ materias, revisoes: [], diario, agora, edital,
      prova: "prova" in perfil ? somarDia(inicio, 12) : undefined, compromissos: ausente ?
        [{ id: dia, dia, titulo: "Indisponível", minutos: 0, tipo: "descanso" }] : aulasHoje ?
        [{ id: "aulas-" + dia, dia, titulo: "Aulas novas", minutos: aulasHoje, tipo: "aula" }] : [], limites }) : undefined;
    if (plano) semVaga = plano.previsoes[0].semVaga;
    const fila = ausente ? [] : plano ? plano.agenda.filter(r => r.agendada === dia).map(r => {
      const [, m, , a] = JSON.parse(r.unidadeId) as string[];
      return { id: JSON.stringify([m, a]), atraso: r.ideal < dia, minutos: r.minutos, agendadaEm: r.agendadaEm };
    }) : [...revisoes].filter(([, r]) => diaEstudo(new Date(r.dataPrevista)) <= dia)
      .sort(([, a], [, b]) => a.dataPrevista.localeCompare(b.dataPrevista)).slice(0, Math.min(perfil.vagas, Math.floor((disponiveis - aulasHoje) / 12)))
      .map(([id, r]) => ({ id, atraso: diaEstudo(new Date(r.dataPrevista)) < dia, minutos: 12, agendadaEm: undefined }));
    carga.push(fila.length);
    const minutos = fila.reduce((total, item) => total + item.minutos, 0);
    cargaMinutos.push(minutos);
    cargaAulas.push(aulasHoje);
    margem.push(disponiveis - minutos - aulasHoje);
    for (const { id, atraso, minutos, agendadaEm } of fila) {
      const [m, a] = JSON.parse(id) as string[];
      const u = unidades.find(x => x.materia.id === m && x.assunto.id === a)!;
      const certas = Math.max(0, perfil.acertos - (i % 5 === 0 ? 1 : 0));
      const concluidaEm = agendadaEm && new Date(Date.parse(agendadaEm) + minutos * 60_000).toISOString();
      registrar(u, dia, true, certas, concluidaEm);
      if (atraso) atrasadas++;
      const atual = revisoes.get(id);
      if (motor === "legado" && atual) {
        const proxima = criarProximaRevisao({ ...atual, desempenho: certas < 6 ? "dificil" : certas < 8 ? "media" : "facil" },
          [], 0, agora, id);
        if (proxima) revisoes.set(id, proxima);
        else revisoes.delete(id);
      }
    }
  }
  const avaliado = await carregarMemoria(materias, diario, noDia(somarDia(inicio, horizonte)));
  const retencoes = [...avaliado.estados.values()].flatMap(e => avaliado.recuperar(e) ?? []);
  return { retencao: retencoes.length ? retencoes.reduce((a, b) => a + b, 0) / retencoes.length : null,
    unidadesMedidas: retencoes.length, carga, cargaMinutos, cargaAulas, margem, aulasRealizadas: ensinadas.size, concluidas: carga.reduce((a, b) => a + b, 0), atrasadas, semVaga,
    duplicadas: avaliado.reconciliacao.repetidos, ms: Math.round(performance.now() - inicioExecucao) };
}
