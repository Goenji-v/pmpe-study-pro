import type { AulaAssunto, Materia, Revisao, SessaoEstudo } from "../types";
import type { CronogramaGeradoIA, PeriodoCronogramaIA, TarefaCronogramaIA } from "../services/cronogramaIAService";

function normalizar(valor: string) {
  return valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}

export function ehRedacaoNoTatico(materia: string) {
  return /^(?:(?:tecnica de )?redacao|producao textual)\b/.test(normalizar(materia));
}

type Vinculo = Required<Pick<TarefaCronogramaIA, "materiaId" | "assuntoId">> &
  Pick<TarefaCronogramaIA, "materia" | "assunto" | "moduloId">;

type AssuntoDoPlano = Vinculo & { aulas: AulaAssunto[] };

function diaLocal(data: Date) {
  return [data.getFullYear(), data.getMonth() + 1, data.getDate()]
    .map((parte) => String(parte).padStart(2, "0")).join("-");
}

function listarAssuntos(materias: Materia[]): AssuntoDoPlano[] {
  return materias.filter((materia) => !ehRedacaoNoTatico(materia.nome)).flatMap((materia) => {
    const modulos = materia.modulos?.length
      ? materia.modulos
      : [{ id: undefined, assuntos: materia.assuntos }];
    return modulos.flatMap((modulo) => modulo.assuntos
      .filter((assunto) => !assunto.foraDoEditalAtual && assunto.aulas?.length)
      .map((assunto) => ({
        materia: materia.nome,
        materiaId: materia.id,
        moduloId: modulo.id,
        assunto: assunto.nome,
        assuntoId: assunto.id,
        aulas: assunto.concluido ? [] : [...(assunto.aulas ?? [])].sort((a, b) => a.ordem - b.ordem),
      })));
  });
}

type Entrada = {
  materias: Materia[];
  revisoes: Revisao[];
  periodo: PeriodoCronogramaIA;
  diasPorSemana: number;
  minutos: number;
  questoesPorSessao: number;
  agora?: Date;
};

type Atividade = Omit<TarefaCronogramaIA, "id" | "ordem" | "dia" | "duracaoMinutos">;

export function montarTaticoSoldadoPMPE({
  materias, revisoes, periodo, diasPorSemana, minutos, questoesPorSessao, agora = new Date(),
}: Entrada): CronogramaGeradoIA {
  const assuntos = listarAssuntos(materias);
  const portugues = assuntos.filter((item) => /^(?:lingua )?portugues(?:a)?$/.test(normalizar(item.materia)));
  const quantidadeDias = periodo === "hoje" ? 1 : Math.min(7, Math.max(portugues.length ? 3 : 1, diasPorSemana));
  const dias = Array.from({ length: quantidadeDias }, (_, indice) =>
    quantidadeDias === 1 ? 1 : 1 + Math.round(indice * 6 / (quantidadeDias - 1)));
  const diasPortugues = new Set(periodo === "hoje"
    ? []
    : [dias[0], dias[Math.floor((dias.length - 1) / 2)], dias[dias.length - 1]]);
  const limite = Math.max(20, Math.min(600, Math.floor(minutos)));
  const filaRevisoes = revisoes.filter((revisao) =>
    !revisao.concluida && !revisao.integradaEmId && !ehRedacaoNoTatico(revisao.materia))
    .sort((a, b) => a.dataPrevista.localeCompare(b.dataPrevista));
  const tarefas: TarefaCronogramaIA[] = [];
  const aulasAlocadas = new Set<string>();
  const revisoesAlocadas = new Set<string>();
  const materiasDoPlano = [...new Set(assuntos.map((assunto) => assunto.materiaId))];

  function prepararAula(assunto: AssuntoDoPlano): Atividade | undefined {
    const { aulas, ...vinculo } = assunto;
    const aula = aulas.find((item) => !item.concluida && !aulasAlocadas.has(item.url || item.id));
    if (!aula) return undefined;
    aulasAlocadas.add(aula.url || aula.id);
    return {
      ...vinculo,
      aulaId: aula.id,
      tipo: "teoria",
      titulo: aula.nome,
      quantidadeQuestoes: 0,
      justificativa: "Aula pendente no seu progresso.",
    };
  }

  for (const [indice, dia] of dias.entries()) {
    const data = new Date(agora);
    data.setDate(data.getDate() + dia - 1);
    const dataDia = diaLocal(data);
    let restantes = limite;
    const adicionar = (atividade: Atividade, duracaoMinutos: number) => {
      const ordem = tarefas.length + 1;
      tarefas.push({ ...atividade, id: `tatico:${dataDia}:${ordem}`, ordem, dia, duracaoMinutos });
      restantes -= duracaoMinutos;
    };

    const reservarPortugues = diasPortugues.has(dia) && portugues.length > 0;
    const revisao = filaRevisoes.find((item) =>
      !revisoesAlocadas.has(item.id) && item.dataPrevista.slice(0, 10) <= dataDia);
    if (revisao) {
      revisoesAlocadas.add(revisao.id);
      adicionar({
        materia: revisao.materia,
        materiaId: revisao.materiaId,
        moduloId: revisao.moduloId,
        assunto: revisao.assunto,
        assuntoId: revisao.assuntoId,
        revisaoId: revisao.id,
        tipo: "revisao",
        titulo: `Revisão de ${revisao.assunto}`,
        quantidadeQuestoes: 0,
        justificativa: "Revisão prevista na sua agenda.",
      }, Math.min(15, restantes - (reservarPortugues ? 10 : 5)));
    }

    if (reservarPortugues) {
      const aula = portugues.find((assunto) =>
        assunto.aulas.some((item) => !item.concluida && !aulasAlocadas.has(item.url || item.id)));
      const atividade = aula ? prepararAula(aula) : undefined;
      const reforco = portugues[indice % portugues.length];
      adicionar(atividade ?? {
        materia: reforco.materia,
        materiaId: reforco.materiaId,
        moduloId: reforco.moduloId,
        assunto: reforco.assunto,
        assuntoId: reforco.assuntoId,
        tipo: "questoes",
        titulo: `Questões de ${reforco.assunto}`,
        quantidadeQuestoes: Math.max(1, questoesPorSessao || 5),
        justificativa: "Bloco de reforço de Português.",
      }, Math.min(30, restantes));
    }

    const inicioRodizio = indice % Math.max(1, materiasDoPlano.length);
    const rodizio = [...materiasDoPlano.slice(inicioRodizio), ...materiasDoPlano.slice(0, inicioRodizio)];
    if (restantes >= 10) {
      for (const materiaId of rodizio) {
        if (reservarPortugues && materiaId === portugues[0].materiaId) continue;
        const assunto = assuntos.find((item) => item.materiaId === materiaId &&
          item.aulas.some((aula) => !aula.concluida && !aulasAlocadas.has(aula.url || aula.id)));
        if (!assunto) continue;
        const atividade = prepararAula(assunto);
        if (atividade) adicionar(atividade, Math.min(45, restantes));
        break;
      }
    }
  }

  return {
    titulo: periodo === "hoje" ? "Plano tático de hoje" : "Plano tático da semana",
    periodo,
    resumo: "Aulas pendentes do RDC e revisões da sua agenda.",
    objetivoPrincipal: "Continuar do ponto em que você parou.",
    tempoTotalMinutos: tarefas.reduce((total, tarefa) => total + tarefa.duracaoMinutos, 0),
    tarefas,
    geradoEm: agora.toISOString(),
  };
}

export function atividadeTaticaConcluida(
  tarefa: TarefaCronogramaIA,
  materias: Materia[],
  revisoes: Revisao[],
  sessoes: SessaoEstudo[],
  missoesConcluidas: string[],
  geradoEm?: string
): boolean {
  if (tarefa.revisaoId) {
    return revisoes.some((item) => item.id === tarefa.revisaoId && (item.concluida || Boolean(item.integradaEmId)));
  }
  if (tarefa.aulaId) {
    const materia = materias.find((item) => item.id === tarefa.materiaId);
    const assuntos = materia?.modulos?.length
      ? materia.modulos.flatMap((modulo) => modulo.assuntos)
      : materia?.assuntos ?? [];
    const assunto = assuntos.find((item) => item.id === tarefa.assuntoId);
    return Boolean(assunto?.concluido || assunto?.aulas?.find((aula) => aula.id === tarefa.aulaId)?.concluida);
  }
  if (tarefa.missaoId) return missoesConcluidas.includes(tarefa.missaoId);
  if (tarefa.tipo !== "questoes" || !tarefa.assuntoId || !geradoEm) return false;
  const dataTarefa = new Date(geradoEm);
  dataTarefa.setDate(dataTarefa.getDate() + tarefa.dia - 1);
  return sessoes.some((sessao) => sessao.tipo === "questoes" && sessao.assuntoId === tarefa.assuntoId &&
    sessao.data.slice(0, 10) === diaLocal(dataTarefa) &&
    (!sessao.finalizadaEm || sessao.finalizadaEm >= geradoEm));
}
