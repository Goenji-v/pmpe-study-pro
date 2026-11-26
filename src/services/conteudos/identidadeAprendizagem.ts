import type { Materia } from "../../types";
import type { AssuntoEdital, MateriaEdital } from "../../types/editalInteligente";
import { topicosDoAssunto } from "../../utils/topicosIndividuais";
import { criarIdModuloGeral } from "./navegarConteudos";

export interface ReferenciaConteudo {
  materiaId: string;
  assuntoId: string;
  moduloId?: string;
  aulaId?: string;
  topicoId?: string;
}

export function referenciaDoEdital(materia: MateriaEdital, assunto: AssuntoEdital): ReferenciaConteudo | undefined {
  if (!materia.assuntos.some(item => item.id === assunto.id) ||
      !materia.conteudoCanonicoId || !assunto.conteudoCanonicoId) return;
  return { materiaId: materia.conteudoCanonicoId, assuntoId: assunto.conteudoCanonicoId };
}

export function resolverUnidade(materias: readonly Materia[], referencia: ReferenciaConteudo) {
  const candidatos: string[] = [];
  let incerto = false;
  for (const materia of materias) {
    if (![materia.id, ...(materia.idsLegados ?? [])].includes(referencia.materiaId)) continue;
    const modulos = materia.modulos?.length ? materia.modulos : [{
      id: criarIdModuloGeral(materia.id), nome: "Geral", ordem: 0, assuntos: materia.assuntos,
    }];
    for (const modulo of modulos) {
      if (referencia.moduloId !== undefined && modulo.id !== referencia.moduloId) continue;
      for (const assunto of modulo.assuntos) {
        if (![assunto.id, ...(assunto.idsLegados ?? [])].includes(referencia.assuntoId)) continue;
        const base = ["memoria-v1", materia.id, modulo.id, assunto.id];
        const assuntoIncerto = assunto.vinculoCurso?.status === "ambiguo";
        if (referencia.aulaId === undefined && referencia.topicoId === undefined) {
          candidatos.push(JSON.stringify(base));
          incerto ||= assuntoIncerto;
          continue;
        }
        for (const topico of topicosDoAssunto(modulo, assunto)) {
          if (referencia.topicoId !== undefined && topico.id !== referencia.topicoId) continue;
          if (referencia.aulaId !== undefined && topico.aula?.id !== referencia.aulaId) continue;
          const individual = topico.id !== assunto.id && topico.aula;
          candidatos.push(JSON.stringify(individual ? [...base, "aula", individual.id] : base));
          incerto ||= assuntoIncerto || topico.aula?.vinculoCurso?.status === "ambiguo";
        }
      }
    }
  }
  if (candidatos.length === 1 && !incerto) return { status: "validado", unidadeId: candidatos[0], referencia } as const;
  return { status: candidatos.length ? "ambiguo" : "sem_vinculo", candidatos, referencia } as const;
}
