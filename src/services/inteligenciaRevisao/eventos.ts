import type { Materia, RegistroQuestao, Revisao, SessaoEstudo } from "../../types";
import { resolverUnidade } from "../conteudos/identidadeAprendizagem";
import { chaveEvento, registrarEvento, type EventoAprendizagem } from "../conteudos/eventoAprendizagem";
import type { Evidencia } from "./avaliacao";

export function instanteValido(valor: string) {
  const partes = /^(\d{4}-\d{2}-\d{2})T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.exec(valor);
  if (!partes || !Number.isFinite(Date.parse(valor))) return false;
  const data = new Date(partes[1] + "T00:00:00Z");
  return Number.isFinite(+data) && data.toISOString().slice(0, 10) === partes[1];
}
export type Observacao = { evento: EventoAprendizagem; evidencia: Evidencia };
export type EventoResolvido = Observacao & { chave: string; unidadeId: string };

export function reconciliar(materias: readonly Materia[], observacoes: readonly Observacao[]) {
  const unidades = new Map<string, ReturnType<typeof resolverUnidade>>();
  const aceitos = new Map<string, EventoResolvido>();
  const conflitos = new Set<string>();
  const pendentes: Array<{ observacao: Observacao; motivo: string }> = [];
  const chavesPendentes = new Set<string>();
  let repetidos = 0;
  for (const observacao of observacoes) {
    const { evento, evidencia } = observacao;
    const identidade = chaveEvento(evento);
    if (!evento.usuarioId.trim() || !evento.ocorrenciaId.trim() ||
        (evento.itemId !== undefined && !evento.itemId.trim()) || !instanteValido(evento.ocorridoEm) ||
        (evento.tipo === "recuperacao") !== (evidencia.modo === "recuperacao")) {
      chavesPendentes.add(identidade);
      if (aceitos.has(identidade)) conflitos.add(identidade);
      pendentes.push({ observacao, motivo: "Identidade ou instante inválido" });
      continue;
    }
    const { materiaId, moduloId, assuntoId, aulaId, topicoId } = evento.conteudo;
    const referencia = JSON.stringify([materiaId, moduloId, assuntoId, aulaId, topicoId]);
    const vinculo = unidades.get(referencia) ?? resolverUnidade(materias, evento.conteudo);
    unidades.set(referencia, vinculo);
    const registro = registrarEvento(aceitos, evento, vinculo);
    if (registro.status === "pendente") {
      chavesPendentes.add(identidade);
      if (aceitos.has(registro.chave)) conflitos.add(registro.chave);
      pendentes.push({ observacao, motivo: vinculo.status });
      continue;
    }
    const anterior = aceitos.get(registro.chave);
    if (registro.status === "novo" && "registro" in registro) {
      if (chavesPendentes.has(identidade)) conflitos.add(registro.chave);
      aceitos.set(registro.chave, { ...observacao, chave: registro.chave, unidadeId: registro.registro.unidadeId });
    } else if (registro.status === "repetido" && anterior && mesmaEvidencia(anterior.evidencia, evidencia)) {
      repetidos++;
    } else {
      conflitos.add(registro.chave);
      pendentes.push({ observacao, motivo: "Conflito na mesma ocorrência" });
    }
  }
  for (const chave of conflitos) {
    const anterior = aceitos.get(chave);
    if (anterior) pendentes.push({ observacao: anterior, motivo: "Conflito na mesma ocorrência" });
    aceitos.delete(chave);
  }
  return { aceitos: [...aceitos.values()].sort((a, b) =>
    Date.parse(a.evento.ocorridoEm) - Date.parse(b.evento.ocorridoEm) || comparar(a.chave, b.chave)),
    pendentes, repetidos, conflitos: conflitos.size };
}

function mesmaEvidencia(a: Evidencia, b: Evidencia) {
  return a.modo === b.modo && a.certas === b.certas && a.erradas === b.erradas &&
    a.anuladas === b.anuladas && a.dificuldade === b.dificuldade;
}
export function comparar(a: string, b: string) { return a < b ? -1 : a > b ? 1 : 0; }

// Uma tentativa é representada pela sessão consolidada. A cópia em RegistroQuestao
// e a conclusão espelhada em Revisao permanecem para o histórico legado.
export function observarSessoes(usuarioId: string, sessoes: readonly SessaoEstudo[]): Observacao[] {
  return sessoes.flatMap(sessao => {
    if (sessao.objetivo?.startsWith("[Questões IA]")) return [];
    const ativa = sessao.tipo === "questoes" || (sessao.tipo === "revisao" && sessao.formatoRevisao === "questoes");
    if (!ativa && !sessao.conteudoConcluido) return [];
    return [{ evento: {
      usuarioId, origem: "sessao", ocorrenciaId: sessao.id, tipo: ativa ? "recuperacao" : "estudo",
      ocorridoEm: sessao.finalizadaEm || sessao.data,
      conteudo: { materiaId: sessao.materiaId || "", moduloId: sessao.moduloId, assuntoId: sessao.assuntoId || "", aulaId: sessao.aulaId },
    }, evidencia: { modo: ativa ? "recuperacao" : "passivo", dificuldade: sessao.dificuldade,
      certas: sessao.quantidadeAcertos, erradas: sessao.quantidadeErros } }];
  });
}

export function observarQuestoesIA(usuarioId: string, registros: readonly RegistroQuestao[]): Observacao[] {
  return registros.flatMap(registro => {
    if (registro.origem !== "questoes-ia" || !registro.tentativaId) return [];
    return [{ evento: { usuarioId, origem: "tentativa", ocorrenciaId: registro.tentativaId, itemId: registro.id,
      tipo: "recuperacao", ocorridoEm: registro.data,
      conteudo: { materiaId: registro.materiaId || "", moduloId: registro.moduloId, assuntoId: registro.assuntoId || "" } },
    evidencia: { modo: "recuperacao", certas: registro.certas, erradas: registro.erradas } }];
  });
}

export function reconciliarLegado(materias: readonly Materia[], revisoes: readonly Revisao[]) {
  return revisoes.map(revisao => ({
    revisao,
    vinculo: revisao.escopoGrupo ? null : resolverUnidade(materias, revisao),
  }));
}
