import { comparar, instanteValido } from "./eventos";

export type Compromisso = { id: string; dia: string; minutos: number; titulo: string;
  tipo: "revisao" | "aula" | "questoes" | "simulado" | "descanso" | "compromisso" };
export type Limites = { semana: readonly number[]; minutos: number; revisoes: number; inicio?: string; fim?: string };
export type Candidato = { unidadeId: string; materia: string; assunto: string; ideal: string; limite: string;
  minutos: number; primeira: boolean; retencao?: number; recorrente?: boolean; desempenho?: number;
  peso?: number; incidencia?: number; prova?: string; compromisso?: string; dueAt?: string };
export type Agendamento = Candidato & { agendada?: string; agendadaEm?: string; motivo: string; prioridade: number; horarioSugerido?: string };
export const fusoEstudo = "America/Sao_Paulo";
const formatador = new Intl.DateTimeFormat("sv-SE", { timeZone: fusoEstudo, year: "numeric", month: "2-digit", day: "2-digit" });
const formatadorHora = new Intl.DateTimeFormat("pt-BR", { timeZone: fusoEstudo, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const formatadorOffset = new Intl.DateTimeFormat("en", { timeZone: fusoEstudo, timeZoneName: "longOffset" });
const minuto = 60_000;

export function diaEstudo(data: Date) { return formatador.format(data); }
export function instanteEstudo(dia: string, hora: string) {
  const civil = `${dia}T${hora}:00`;
  const offset = (data: Date) => formatadorOffset.formatToParts(data).find(p => p.type === "timeZoneName")!.value.slice(3) || "+00:00";
  const aproximado = new Date(civil + offset(new Date(civil + "Z")));
  return new Date(civil + offset(aproximado));
}
function diaValido(valor: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const dia = new Date(valor + "T00:00:00Z");
  return Number.isFinite(+dia) && dia.toISOString().slice(0, 10) === valor;
}
export function somarDia(dia: string, n: number) {
  const data = new Date(dia + "T00:00:00Z");
  data.setUTCDate(data.getUTCDate() + n);
  return data.toISOString().slice(0, 10);
}
function distancia(a: string, b: string) { return (Date.parse(b) - Date.parse(a)) / 86_400_000; }

export function priorizar(c: Candidato, hoje: string) {
  const atraso = Math.max(0, distancia(c.ideal, hoje));
  const risco = c.retencao === undefined ? 0 : Math.round((1 - c.retencao) * 55);
  const prova = c.prova ? distancia(hoje, c.prova) : Infinity;
  const pontos = atraso * 3 + risco + (c.primeira ? 12 : 0) + (c.recorrente ? 18 : 0) +
    (c.desempenho === undefined ? 0 : Math.max(0, 80 - c.desempenho) / 4) +
    (c.peso ?? 0) + (c.incidencia ?? 0) + (prova >= 0 && prova <= 14 ? 15 - prova : 0);
  const motivos = [atraso ? `${atraso} dia(s) de atraso` : "", risco >= 15 ? "risco de esquecimento" : "",
    c.primeira ? "primeira revisão" : "", c.recorrente ? "dificuldade recorrente" : "",
    c.peso || c.incidencia ? "relevância no edital" : "", prova >= 0 && prova <= 14 ? "prova próxima" : ""].filter(Boolean);
  return { pontos, motivo: motivos.join(", ") || "ordem de vencimento" };
}

export function distribuir(candidatos: readonly Candidato[], compromissos: readonly Compromisso[], data: string | Date, limites: Limites) {
  if (data instanceof Date && !Number.isFinite(+data)) throw new Error("Relógio inválido.");
  const hoje = typeof data === "string" ? data : diaEstudo(data);
  if (!Number.isInteger(limites.revisoes) || limites.revisoes < 0 ||
      !Number.isInteger(limites.minutos) || limites.minutos < 0)
    throw new Error("Limites diários inválidos.");
  if (!diaValido(hoje) || limites.semana.some(d => !Number.isInteger(d) || d < 0 || d > 6))
    throw new Error("Data ou disponibilidade inválida.");
  const agora = typeof data === "string" ? +instanteEstudo(hoje, "00:00") : +data;
  const horaEmMinutos = (hora: string | undefined) => {
    if (!hora || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(hora)) return undefined;
    const [h, m] = hora.split(":").map(Number);
    return h * 60 + m;
  };
  const inicio = horaEmMinutos(limites.inicio);
  const fim = horaEmMinutos(limites.fim);
  if ((limites.inicio || limites.fim) && (inicio === undefined || fim === undefined || fim <= inicio))
    throw new Error("Janela de estudo inválida.");
  const teto = inicio !== undefined && fim !== undefined ? Math.min(fim - inicio, limites.minutos) : limites.minutos;
  const fixosPorDia = new Map<string, Map<string, Compromisso>>();
  const compromissosPorId = new Map<string, Compromisso>();
  for (const c of compromissos) {
    if (!Number.isSafeInteger(c.minutos) || c.minutos < 0 || !diaValido(c.dia))
      throw new Error("Data ou duração de compromisso inválida.");
    const anterior = compromissosPorId.get(c.id);
    if (anterior && (anterior.dia !== c.dia || anterior.minutos !== c.minutos || anterior.tipo !== c.tipo || anterior.titulo !== c.titulo))
      throw new Error("Compromissos conflitantes.");
    compromissosPorId.set(c.id, c);
    const fixos = fixosPorDia.get(c.dia) ?? new Map();
    fixos.set(c.id, c);
    fixosPorDia.set(c.dia, fixos);
  }
  const ids = new Set<string>();
  const agenda: Agendamento[] = [];
  const dias = Array.from({ length: 30 }, (_, i) => {
    const dia = somarDia(hoje, i);
    const semana = new Date(dia + "T00:00:00Z").getUTCDay();
    const fixos = [...(fixosPorDia.get(dia)?.values() ?? [])];
    const cargaFixa = fixos.reduce((n, c) => n + c.minutos, 0);
    const disponivel = limites.semana.includes(semana) && !fixos.some(c => c.tipo === "descanso");
    const abre = +instanteEstudo(dia, limites.inicio || "00:00");
    const fecha = limites.fim ? +instanteEstudo(dia, limites.fim) : +instanteEstudo(somarDia(dia, 1), "00:00");
    const bruto = disponivel ? teto : 0;
    const revisoesFixas = fixos.filter(c => c.tipo === "revisao").length;
    return { dia, fixos, cargaFixa, revisoesFixas, disponivel, abre, fecha, intervalos: [] as { inicio: number; fim: number }[],
      capacidade: Math.max(0, Math.min(bruto - cargaFixa, Math.floor((fecha - Math.max(agora, abre + cargaFixa * minuto)) / minuto))),
      excessoFixo: cargaFixa > bruto || revisoesFixas > (bruto > 0 ? limites.revisoes : 0),
      minutos: 0, revisoes: 0, limiteRevisoes: bruto > 0 ? limites.revisoes : 0, estimadas: 0, vencimentos: 0, materias: new Map<string, number>() };
  });
  const ordem = candidatos.map(c => {
    const vence = c.dueAt === undefined ? -Infinity : Date.parse(c.dueAt);
    if (!diaValido(c.ideal) || !diaValido(c.limite) || c.limite < c.ideal || !Number.isSafeInteger(c.minutos) || c.minutos <= 0 ||
        (c.dueAt !== undefined && (!instanteValido(c.dueAt) || diaEstudo(new Date(vence)) !== c.ideal)))
      throw new Error("Data, prazo ou duração de revisão inválidos.");
    return { c, vence, ...priorizar(c, hoje) };
  }).sort((a, b) =>
    comparar(a.c.limite, b.c.limite) || b.pontos - a.pontos || comparar(a.c.unidadeId, b.c.unidadeId) ||
    comparar(b.c.dueAt ?? "", a.c.dueAt ?? "") || comparar(JSON.stringify(a.c), JSON.stringify(b.c)));
  const fila = ordem.filter(({ c }) => {
    if (ids.has(c.unidadeId)) return false;
    ids.add(c.unidadeId);
    const dia = dias.find(d => d.dia >= c.ideal);
    if (dia) dia.vencimentos++;
    return true;
  });
  const preferenciasRecusadas = new Map<string, string>();
  function encontrarHorario(item: typeof fila[number], dia: typeof dias[number]) {
    let inicio = Math.ceil(Math.max(agora, item.vence, dia.abre + dia.cargaFixa * minuto) / minuto) * minuto;
    const duracao = item.c.minutos * minuto;
    for (const ocupado of dia.intervalos) {
      if (inicio + duracao <= ocupado.inicio) break;
      inicio = Math.max(inicio, ocupado.fim);
    }
    return inicio + duracao <= dia.fecha ? inicio : undefined;
  }
  function explicarPreferencia(unidadeId: string) {
    const motivo = preferenciasRecusadas.get(unidadeId);
    return motivo ? ` Preferência de data não atendida: ${motivo}.` : "";
  }
  function alocar(item: typeof fila[number], dia: typeof dias[number], hora: number) {
    const { c, pontos, motivo } = item;
    const agendadaEm = new Date(hora).toISOString();
    const horarioSugerido = inicio === undefined ? undefined : formatadorHora.format(hora);
    dia.intervalos.push({ inicio: hora, fim: hora + c.minutos * minuto });
    dia.intervalos.sort((a, b) => a.inicio - b.inicio);
    dia.revisoes++;
    dia.minutos += c.minutos;
    dia.materias.set(c.materia, (dia.materias.get(c.materia) ?? 0) + 1);
    const justificativa = dia.dia === c.compromisso ? " Preferência de data atendida." :
      dia.dia > c.limite ? " Vaga de recuperação após o prazo." : dia.dia === c.ideal ? "" : " Vaga encontrada após a data ideal.";
    agenda.push({ ...c, agendada: dia.dia, agendadaEm, horarioSugerido, prioridade: pontos,
      motivo: motivo + "." + justificativa + explicarPreferencia(c.unidadeId) });
  }
  const feitos = new Set<string>();
  for (const item of fila) {
    const { c } = item;
    if (!c.compromisso) continue;
    const dia = dias.find(d => d.dia === c.compromisso);
    const hora = dia && encontrarHorario(item, dia);
    const recusa = c.compromisso < hoje ? "data já passou" : !dia ? "data fora do horizonte" : dia.dia < c.ideal ? "data anterior ao vencimento" :
      dia.dia > c.limite ? "data posterior ao prazo" : !dia.disponivel ? "dia de descanso ou indisponível" :
      dia.revisoes + dia.revisoesFixas >= dia.limiteRevisoes ? "limite diário de revisões atingido" :
      hora === undefined ? "sem janela livre a partir do horário atual e do vencimento" :
      dia.minutos + c.minutos > dia.capacidade ? "minutos disponíveis insuficientes" : undefined;
    if (recusa) preferenciasRecusadas.set(c.unidadeId, recusa);
    else if (dia && hora !== undefined) {
      alocar(item, dia, hora);
      feitos.add(c.unidadeId);
    }
  }
  const recuperacao = somarDia(hoje, 2);
  for (const dia of dias) {
    const disponiveis = fila.filter(({ c }) => !feitos.has(c.unidadeId) && c.ideal <= dia.dia &&
      (dia.dia <= c.limite || (c.limite < hoje && dia.dia <= recuperacao)));
    while (disponiveis.length && dia.revisoes + dia.revisoesFixas < dia.limiteRevisoes) {
      disponiveis.sort((a, b) => comparar(a.c.limite, b.c.limite) ||
        (b.pontos - 4 * (dia.materias.get(b.c.materia) ?? 0)) - (a.pontos - 4 * (dia.materias.get(a.c.materia) ?? 0)) ||
        comparar(a.c.unidadeId, b.c.unidadeId));
      let hora: number | undefined;
      const indice = disponiveis.findIndex(item => item.c.minutos + dia.minutos <= dia.capacidade &&
        (hora = encontrarHorario(item, dia)) !== undefined);
      if (indice < 0) break;
      const [item] = disponiveis.splice(indice, 1);
      alocar(item, dia, hora!);
      feitos.add(item.c.unidadeId);
    }
  }
  for (const { c, pontos, motivo } of fila) if (!feitos.has(c.unidadeId)) {
    const justificativa = c.ideal > dias[29].dia ? "Vencimento após o horizonte atual." :
      `${motivo}. Sem vaga no prazo. Reveja a disponibilidade ou reduza novas aulas.`;
    agenda.push({ ...c, agendada: undefined, prioridade: pontos, motivo: justificativa + explicarPreferencia(c.unidadeId) });
  }
  return { agenda, dias };
}

export function projetar(agenda: ReturnType<typeof distribuir>, horizonte: 7 | 15 | 30) {
  const dias = agenda.dias.slice(0, horizonte);
  const somar = (valor: (dia: typeof dias[number]) => number) => dias.reduce((n, d) => n + valor(d), 0);
  const semVaga = agenda.agenda.filter(c => !c.agendada && c.ideal <= dias.at(-1)!.dia).length;
  const capacidade = somar(d => d.capacidade);
  const confirmadas = somar(d => d.revisoes + d.revisoesFixas);
  const estimadas = somar(d => d.estimadas);
  const excesso = dias.filter(d => d.excessoFixo || d.vencimentos > d.revisoes || d.revisoes + d.revisoesFixas + d.estimadas > d.limiteRevisoes || d.minutos + d.estimadas * 12 > d.capacidade).length;
  const estado = semVaga || dias.some(d => d.excessoFixo) ? "Sobrecarga" : agenda.agenda.some(c => c.agendada && c.ideal < dias[0].dia) ?
    "Recuperação" : excesso || (capacidade > 0 && somar(d => d.minutos) >= capacidade * 0.8) ? "Preventivo" : "Normal";
  const recomendacao = { Sobrecarga: "Reduza aulas novas ou libere horários antes de adicionar conteúdo.",
    Recuperação: "Priorize as pendências antigas e mantenha intervalos de descanso.",
    Preventivo: "Reserve vagas para revisões estimadas e reavalie a carga semanal.", Normal: "Mantenha a disponibilidade atual." }[estado];
  return { capacidade, confirmadas, estimadas, semVaga, excesso, estado, recomendacao };
}
