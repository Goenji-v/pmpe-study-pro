import type { Revisao } from "../types";
import { pendentesUnicasPorAssunto } from "./revisoesAssuntoPrincipal";

/**
 * Agenda de reforço adaptativo, usando a mesma lista de pendências da agenda.
 *
 * Prioridade conservadora:
 * - revisões existentes (inclusive atrasadas) ocupam vagas primeiro;
 * - novas notas baixas não deslocam nem antecipam tarefas que já existem;
 * - reforços novos usam no máximo metade das vagas diárias, reservando
 *   capacidade para revisões regulares;
 * - nada neste cálculo reescreve datas ou registros anteriores.
 */
export function encontrarDataDisponivelParaReforco(params: {
  dataIdeal: Date;
  agora: Date;
  revisoes: readonly Revisao[];
  limiteDiario: number;
  /** Mesma agenda para revisões normais e reforços; a reserva se aplica só aos reforços. */
  categoria?: "regular" | "reforco";
}): Date | null {
  const { dataIdeal, agora, revisoes, limiteDiario, categoria = "reforco" } = params;
  if (!Number.isFinite(dataIdeal.getTime()) || !Number.isFinite(agora.getTime())) {
    return null;
  }
  if (!Number.isFinite(limiteDiario) || limiteDiario <= 0) {
    const ideal = new Date(dataIdeal);
    ideal.setHours(12, 0, 0, 0);
    return ideal;
  }

  const capacidade = Math.max(1, Math.floor(limiteDiario));
  const vagasAdaptativas = Math.max(1, Math.floor(capacidade / 2));
  const inicio = new Date(agora);
  inicio.setHours(0, 0, 0, 0);
  const diaIdeal = new Date(dataIdeal);
  diaIdeal.setHours(0, 0, 0, 0);

  // Conclusões já realizadas HOJE também gastaram parte da meta diária.
  // Não se contam resultados de questões como revisão concluída.
  const concluidasHoje = revisoes.filter((revisao) => {
    if (!revisao.concluida || !revisao.dataConclusao) return false;
    const data = new Date(revisao.dataConclusao);
    return Number.isFinite(data.getTime()) &&
      data.getFullYear() === inicio.getFullYear() &&
      data.getMonth() === inicio.getMonth() &&
      data.getDate() === inicio.getDate();
  });
  const realizadasHoje = concluidasHoje.length;
  const adaptativasConcluidasHoje = concluidasHoje.filter(
    (revisao) => (revisao.motivoAdaptativo === "baixo_desempenho" ||
      revisao.motivoAdaptativo === "duvida")
  ).length;

  const existentes = pendentesUnicasPorAssunto(revisoes)
    .map((revisao) => ({
      revisao,
      data: new Date(revisao.dataPrevista).getTime(),
    }))
    .filter(({data}) => Number.isFinite(data))
    .sort((a,b) => a.data - b.data || a.revisao.id.localeCompare(b.revisao.id));

  // Projeta a ocupação, sem salvar a redistribuição: atrasadas consomem
  // as primeiras vagas antes de receber um reforço novo.
  let proxima = 0;
  const fila: Array<(typeof existentes)[number]> = [];
  const dia = new Date(inicio);
  for (let passo = 0; passo < 730; passo += 1) {
    const fimDia = new Date(dia);
    fimDia.setDate(fimDia.getDate() + 1);
    while (proxima < existentes.length &&
      existentes[proxima].data < fimDia.getTime()) {
      fila.push(existentes[proxima]);
      proxima += 1;
    }
    // Datas passadas e revisões já agendadas entram antes do reforço novo.
    const eHoje = passo === 0;
    const capacidadeRestante = eHoje
      ? Math.max(0, capacidade - realizadasHoje) : capacidade;
    const ocupadas = fila.splice(0, capacidadeRestante);
    const adaptativas = ocupadas.filter(
      ({revisao}) => (revisao.motivoAdaptativo === "baixo_desempenho" ||
      revisao.motivoAdaptativo === "duvida")
    ).length + (eHoje ? adaptativasConcluidasHoje : 0);
    const totalOcupado = ocupadas.length + (eHoje ? realizadasHoje : 0);
    if (dia.getTime() >= diaIdeal.getTime() &&
        totalOcupado < capacidade &&
        (categoria === "regular" || adaptativas < vagasAdaptativas) &&
        fila.length === 0) {
      const disponivel = new Date(dia);
      disponivel.setHours(12, 0, 0, 0);
      // Urgência no próprio dia não pode nascer às 12h se a pessoa
      // terminou o treino às 15h: isso criaria uma revisão "atrasada"
      // antes mesmo de ela existir.
      if (passo === 0 && disponivel.getTime() < agora.getTime()) {
        return new Date(agora);
      }
      return disponivel;
    }
    dia.setDate(dia.getDate() + 1);
  }
  // Caso extremo: manter nota no histórico, sem criar tarefa com data falsa.
  return null;
}
