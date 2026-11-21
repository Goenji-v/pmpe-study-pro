import type { Revisao, SessaoEstudo } from "../types";
import { chaveAssuntoPrincipal } from "./revisoesAssuntoPrincipal";

export type ItemHistoricoRevisao = {
  revisao: Revisao;
  sessao?: SessaoEstudo;
};

function normalizar(valor: string): string {
  return String(valor).normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/\s+/g," ").trim();
}

function chaveHistoricoIntegrado(revisao: Revisao): string | null {
  // "integradaEmId" só oculta a pendência antiga da agenda; ela precisa
  // continuar participando do histórico auditável da mesma família.
  return chaveAssuntoPrincipal({
    id: revisao.id,
    materia: revisao.materia,
    assunto: revisao.assunto,
    escopoGrupo: revisao.escopoGrupo,
    origemSimulado: revisao.origemSimulado,
  });
}

export function pertenceAoMesmoHistorico(a: Revisao, b: Revisao): boolean {
  if (a.id === b.id) return true;
  const familiaA = chaveHistoricoIntegrado(a);
  const familiaB = chaveHistoricoIntegrado(b);
  if (familiaA && familiaB && familiaA === familiaB) return true;
  // Para conteúdos fora do catálogo piloto, manter associação estrita,
  // sem agregar matérias ou aulas apenas por nomes semelhantes.
  if (a.materiaId === b.materiaId && a.assuntoId === b.assuntoId &&
      (!a.moduloId || !b.moduloId || a.moduloId === b.moduloId)) return true;
  return normalizar(a.materia) === normalizar(b.materia) &&
    normalizar(a.assunto) === normalizar(b.assunto);
}

function dataOrdenacao(revisao: Revisao): number {
  const texto = revisao.dataConclusao ?? revisao.dataCriacao ?? revisao.dataPrevista;
  const valor = new Date(texto).getTime();
  return Number.isFinite(valor) ? valor : 0;
}

/**
 * Projeção apenas de leitura: une os registros antigos da mesma família
 * mesmo quando o edital/curso usou nomes ou IDs diferentes. As conclusões,
 * datas e resultados NÃO são alterados.
 */
export function montarHistoricoRevisaoIntegrado(
  atual: Revisao,
  revisoes: readonly Revisao[],
  sessoes: readonly SessaoEstudo[]
): ItemHistoricoRevisao[] {
  const porId = new Map<string, SessaoEstudo>();
  const porRevisaoId = new Map<string, SessaoEstudo>();
  for (const sessao of sessoes) {
    porId.set(sessao.id, sessao);
    if (sessao.revisaoId) porRevisaoId.set(sessao.revisaoId, sessao);
  }
  return revisoes
    .filter((revisao) => pertenceAoMesmoHistorico(revisao, atual))
    .sort((a,b) => dataOrdenacao(a) - dataOrdenacao(b) || a.id.localeCompare(b.id))
    .map((revisao) => ({
      revisao,
      sessao: (revisao.sessaoId ? porId.get(revisao.sessaoId) : undefined) ??
        porRevisaoId.get(revisao.id),
    }));
}
