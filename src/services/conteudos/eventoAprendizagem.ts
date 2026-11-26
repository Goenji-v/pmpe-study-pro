import type { ReferenciaConteudo, resolverUnidade } from "./identidadeAprendizagem";

export interface EventoAprendizagem {
  usuarioId: string;
  origem: "sessao" | "tentativa" | "flashcard";
  ocorrenciaId: string;
  // ID persistido da resposta para tentativas com várias observações.
  itemId?: string;
  tipo: "estudo" | "recuperacao";
  ocorridoEm: string;
  conteudo: ReferenciaConteudo;
}

export function registrarEvento(
  eventos: ReadonlyMap<string, { unidadeId: string; evento: EventoAprendizagem }>,
  evento: EventoAprendizagem,
  vinculo: ReturnType<typeof resolverUnidade>,
) {
  if (!evento.usuarioId.trim() || !evento.ocorrenciaId.trim() ||
      (evento.itemId !== undefined && !evento.itemId.trim()) ||
      !/(Z|[+-]\d\d:\d\d)$/i.test(evento.ocorridoEm) || !Number.isFinite(Date.parse(evento.ocorridoEm)))
    throw new Error("Identidade ou instante inválido");
  const chave = JSON.stringify(["evento-v1", evento.usuarioId, evento.origem, evento.ocorrenciaId, evento.itemId ?? null]);
  const campos = ["materiaId", "moduloId", "assuntoId", "aulaId", "topicoId"] as const;
  if (vinculo.status !== "validado" || campos.some(c => vinculo.referencia[c] !== evento.conteudo[c]))
    return { status: "pendente", chave, evento } as const;
  const anterior = eventos.get(chave);
  if (anterior) {
    const igual = anterior.unidadeId === vinculo.unidadeId && anterior.evento.tipo === evento.tipo &&
      Date.parse(anterior.evento.ocorridoEm) === Date.parse(evento.ocorridoEm);
    return { status: igual ? "repetido" : "conflito", chave, anterior, evento } as const;
  }
  return { status: "novo", chave, registro: { unidadeId: vinculo.unidadeId, evento } } as const;
}
