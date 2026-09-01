import type { AuditoriaResultadoIA, QuestaoIA } from "../types";
import type { CadernoSimuladoIA } from "../services/cadernosSimuladosIAService";
import { calcularResultadoQuestoesIA, type RespostasQuestoesIA } from "./resultadoQuestoesIA";

export type TentativaRevisaoIA = {
  id: string;
  cadernoId?: string;
  data: string;
  total: number;
  certas: number;
  erradas: number;
  emBranco: number;
  percentual: number;
  questoes?: QuestaoIA[];
  respostas?: RespostasQuestoesIA;
  auditoria?: AuditoriaResultadoIA;
  recuperada?: boolean;
};

export type LinhaRespostaIA = { questao_id: string; resposta: string | null; respondida_em: string };

export function pertenceAoCaderno(tentativa: TentativaRevisaoIA, caderno: CadernoSimuladoIA) {
  if (tentativa.cadernoId) return tentativa.cadernoId === caderno.id;
  const questoes = tentativa.auditoria?.questoesValidas ?? tentativa.questoes;
  if (questoes?.length) {
    const ids = new Set(caderno.questoes.map((q) => q.id));
    return questoes.length === ids.size && questoes.every((q) => ids.has(q.id));
  }
  const ultima = caderno.estatisticas?.ultimaTentativaEm;
  return Boolean(ultima) && new Date(tentativa.data).getTime() === new Date(ultima!).getTime();
}

export function normalizarTentativaRevisao(valor: unknown): TentativaRevisaoIA | null {
  if (!valor || typeof valor !== "object") return null;
  const r = valor as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.data !== "string" || !Number.isFinite(Date.parse(r.data))) return null;
  const certas = Number(r.certas), erradas = Number(r.erradas), emBranco = Number(r.emBranco ?? 0);
  if (![certas, erradas, emBranco].every((n) => Number.isInteger(n) && n >= 0)) return null;
  return {
    id: r.id,
    data: r.data,
    cadernoId: typeof r.cadernoId === "string" ? r.cadernoId : undefined,
    total: certas + erradas + emBranco,
    certas, erradas, emBranco,
    percentual: Number(r.percentual) || 0,
    questoes: Array.isArray(r.questoes) ? r.questoes as QuestaoIA[] : undefined,
    respostas: r.respostas && typeof r.respostas === "object" && !Array.isArray(r.respostas)
      ? filtrarRespostas(r.respostas as Record<string, unknown>) : undefined,
    auditoria: r.auditoria as AuditoriaResultadoIA | undefined,
  };
}

export function consolidarTentativasRevisao(
  caderno: CadernoSimuladoIA,
  locais: TentativaRevisaoIA[],
  remotas: TentativaRevisaoIA[]
) {
  const mapa = new Map<string, TentativaRevisaoIA>();
  for (const tentativa of [...locais, ...remotas]) {
    if (!pertenceAoCaderno(tentativa, caderno)) continue;
    const anterior = mapa.get(tentativa.id);
    const proxima = {
      ...tentativa,
      questoes: tentativa.questoes ?? anterior?.questoes,
      respostas: tentativa.respostas ?? anterior?.respostas,
      auditoria: tentativa.auditoria ?? anterior?.auditoria,
    };
    if (proxima.auditoria) {
      proxima.questoes = proxima.auditoria.questoesValidas;
      proxima.respostas = filtrarRespostas(proxima.auditoria.respostas);
    }
    mapa.set(proxima.id, proxima);
  }
  return [...mapa.values()].sort((a, b) => Date.parse(b.data) - Date.parse(a.data));
}

export function possuiCorrecaoCompleta(tentativa: TentativaRevisaoIA) {
  if (!tentativa.questoes || !tentativa.respostas || tentativa.questoes.length !== tentativa.total) return false;
  if (new Set(tentativa.questoes.map((q) => q.id)).size !== tentativa.total) return false;
  const resultado = calcularResultadoQuestoesIA(tentativa.questoes, tentativa.respostas);
  return resultado.certas === tentativa.certas && resultado.erradas === tentativa.erradas && resultado.emBranco === tentativa.emBranco;
}

// Respostas antigas não tinham tentativaId. Só recuperamos um lote inteiro,
// próximo da finalização, único e compatível com a nota salva.
export function recuperarRespostasDaTentativa(
  tentativa: TentativaRevisaoIA,
  questoes: QuestaoIA[],
  linhas: LinhaRespostaIA[]
): RespostasQuestoesIA | null {
  if (questoes.length !== tentativa.total) return null;
  if (tentativa.certas + tentativa.erradas === 0) return {};
  const ids = new Set(questoes.map((q) => q.id));
  const grupos = new Map<string, LinhaRespostaIA[]>();
  for (const linha of linhas) {
    if (!ids.has(linha.questao_id) || Math.abs(Date.parse(linha.respondida_em) - Date.parse(tentativa.data)) > 120000) continue;
    grupos.set(linha.respondida_em, [...(grupos.get(linha.respondida_em) ?? []), linha]);
  }
  const candidatos: RespostasQuestoesIA[] = [];
  for (const grupo of grupos.values()) {
    if (new Set(grupo.map((r) => r.questao_id)).size !== grupo.length) continue;
    const respostas = filtrarRespostas(Object.fromEntries(grupo.map((r) => [r.questao_id, r.resposta])));
    if (possuiCorrecaoCompleta({ ...tentativa, questoes, respostas })) candidatos.push(respostas);
  }
  return candidatos.length === 1 ? candidatos[0] : null;
}

export function numerarQuestoesRevisao(tentativa: TentativaRevisaoIA) {
  const excluidas = new Set(tentativa.auditoria?.excluidas.map((q) => q.numero) ?? []);
  let numero = 0;
  return (tentativa.questoes ?? []).map((questao) => {
    do { numero += 1; } while (excluidas.has(numero));
    const resposta = tentativa.respostas?.[questao.id];
    return {
      questao,
      numero,
      resposta,
      status: !resposta ? "branco" as const : resposta === questao.respostaCorreta ? "acerto" as const : "erro" as const,
    };
  });
}

function filtrarRespostas(respostas: Record<string, unknown>): RespostasQuestoesIA {
  return Object.fromEntries(Object.entries(respostas).filter(([, r]) => typeof r === "string" && /^[A-E]$/.test(r))) as RespostasQuestoesIA;
}
