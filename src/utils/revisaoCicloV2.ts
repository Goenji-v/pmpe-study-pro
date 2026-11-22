/**
 * Review Cycle V2 (staging prototype, deliberately not connected to the
 * official review UI). A lesson produces one chain, never parallel queues.
 *
 * 4-hour recall is recorded as already completed when the lesson ends.
 * The remaining checkpoints are D+1, D+7 and D+14 from the lesson date.
 * A result below 60% repeats the SAME checkpoint in four days; it never
 * creates an additional pending review.
 */
export type MarcoRevisao = "d1" | "d7" | "d14";
export type FormatoRevisaoV2 = "teoria" | "questoes";
export type ResultadoRevisaoV2 = {
  em: string;
  marco: MarcoRevisao;
  percentual?: number;
  resultado: "concluida" | "reforco";
  sessaoId?: string;
};
export type CicloRevisaoV2 = {
  aulaId: string;
  materiaId: string;
  aulaConcluidaEm: string;
  quatroHorasRegistrada: true;
  marco: MarcoRevisao | null;
  proximaData: string | null;
  historico: ResultadoRevisaoV2[];
};
export const MARCOS_REVISAO_V2: ReadonlyArray<MarcoRevisao> = ["d1", "d7", "d14"];
export const LIMIAR_APROVACAO_REVISAO = 60;
const DIA_MS = 24 * 60 * 60 * 1000;

function diaLocal(base: string, dias: number): string {
  // Dates stay as YYYY-MM-DD: don't shift the local study calendar on UTC offset.
  if (!/^\d{4}-\d{2}-\d{2}$/.test(base)) throw new Error("invalid study date");
  const [ano, mes, dia] = base.split("-").map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (data.toISOString().slice(0,10) !== base) throw new Error("invalid study date");
  return new Date(data.getTime() + dias * DIA_MS).toISOString().slice(0, 10);
}

function validarIdentidade(materiaId: string, aulaId: string) {
  if (!materiaId.trim() || !aulaId.trim()) throw new Error("lesson identity required");
}

export function iniciarCicloRevisaoV2(params: {
  materiaId: string;
  aulaId: string;
  dataAula: string;
}): CicloRevisaoV2 {
  validarIdentidade(params.materiaId, params.aulaId);
  return {
    materiaId: params.materiaId,
    aulaId: params.aulaId,
    aulaConcluidaEm: params.dataAula,
    quatroHorasRegistrada: true,
    marco: "d1",
    proximaData: diaLocal(params.dataAula, 1),
    historico: [],
  };
}

export function obterFormatoRevisaoV2(marco: MarcoRevisao): FormatoRevisaoV2 {
  return marco === "d1" ? "teoria" : "questoes";
}

/** Mutates nothing; caller replaces a single cycle by (materiaId,aulaId). */
export function concluirEtapaRevisaoV2(
  ciclo: CicloRevisaoV2,
  params: { dataConclusao: string; percentual?: number; sessaoId?: string }
): CicloRevisaoV2 {
  if (!ciclo.marco || !ciclo.proximaData) throw new Error("cycle is finished");
  const formato = obterFormatoRevisaoV2(ciclo.marco);
  if (formato === "questoes" && (params.percentual === undefined ||
    !Number.isFinite(params.percentual) ||
    params.percentual < 0 || params.percentual > 100)) {
    throw new Error("question review requires a valid percentage");
  }
  if (params.sessaoId && ciclo.historico.some(e => e.sessaoId === params.sessaoId)) {
    return ciclo; // same session: idempotent, cannot generate another review
  }

  const precisaReforco = formato === "questoes" &&
    (params.percentual as number) < LIMIAR_APROVACAO_REVISAO;
  const evento: ResultadoRevisaoV2 = {
    em: params.dataConclusao,
    marco: ciclo.marco,
    resultado: precisaReforco ? "reforco" : "concluida",
    ...(params.percentual === undefined ? {} : { percentual: params.percentual }),
    ...(params.sessaoId ? { sessaoId: params.sessaoId } : {}),
  };
  if (precisaReforco) {
    return { ...ciclo, proximaData: diaLocal(params.dataConclusao, 4),
      historico: [...ciclo.historico, evento] };
  }
  const indice = MARCOS_REVISAO_V2.indexOf(ciclo.marco);
  const proximo = MARCOS_REVISAO_V2[indice+1] ?? null;
  const diasDesdeAula = proximo === "d7" ? 7 : proximo === "d14" ? 14 : 0;
  const dataIdeal = proximo ? diaLocal(ciclo.aulaConcluidaEm, diasDesdeAula) : null;
  // Never schedule in the past after a delayed or repeated checkpoint.
  const data = dataIdeal && dataIdeal < params.dataConclusao
    ? params.dataConclusao
    : dataIdeal;
  return { ...ciclo, marco: proximo, proximaData: data,
    historico: [...ciclo.historico, evento] };
}

export type RevisaoLegadaV2 = {
  id: string;
  materiaId?: string;
  materia?: string;
  assuntoId?: string;
  assunto?: string;
  etapa?: number;
  concluida?: boolean;
  dataPrevista?: string;
  dataConclusao?: string;
};
export type GrupoHistoricoLegadoV2 = {
  identidade: string;
  materia: string;
  assunto: string;
  total: number;
  concluidas: number;
  pendentes: number;
  etapasRegistradas: number[];
  idsLegados: string[];
  exigeMapeamento: boolean;
};

/** Read-only inventory. No automatic conversion of old stage numbers. */
export function inventariarRevisoesLegadasV2(
  revisoes: readonly RevisaoLegadaV2[]
): GrupoHistoricoLegadoV2[] {
  const grupos = new Map<string, GrupoHistoricoLegadoV2>();
  for (const item of revisoes) {
    // Legacy records without IDs require manual canonicalization.
    const chave = [item.materiaId ?? item.materia ?? "",
      item.assuntoId ?? item.assunto ?? ""].join("::");
    const anterior = grupos.get(chave) ?? {
      identidade: chave, materia: item.materia ?? "", assunto: item.assunto ?? "",
      total: 0, concluidas: 0, pendentes: 0,
      etapasRegistradas: [], idsLegados: [],
      exigeMapeamento: !item.materiaId || !item.assuntoId,
    };
    anterior.total += 1;
    anterior.concluidas += item.concluida ? 1 : 0;
    anterior.pendentes += item.concluida ? 0 : 1;
    if (Number.isInteger(item.etapa) && !anterior.etapasRegistradas.includes(item.etapa as number)) {
      anterior.etapasRegistradas.push(item.etapa as number);
    }
    anterior.idsLegados.push(item.id);
    grupos.set(chave, anterior);
  }
  return [...grupos.values()].sort((a,b) => a.materia.localeCompare(b.materia) ||
    a.assunto.localeCompare(b.assunto));
}
