import type { Materia } from "../../types";
import type { AssuntoEdital, MateriaEdital } from "../../types/editalInteligente";
import { topicosDoAssunto } from "../../utils/topicosIndividuais";
import { criarIdModuloGeral, ehModuloVisaoCurso, listarModulosDaMateria,
  obterOrigemDaAulaVisaoCurso, obterOrigemDoAssuntoVisaoCurso } from "./navegarConteudos";

export interface ReferenciaConteudo {
  materiaId: string;
  assuntoId: string;
  moduloId?: string;
  aulaId?: string;
  topicoId?: string;
}

export function referenciaDoEdital(materia: MateriaEdital, assunto: AssuntoEdital): ReferenciaConteudo | undefined {
  const oficiais = materia.assuntos.filter(item => item.id === assunto.id);
  if (oficiais.length !== 1 || !materia.conteudoCanonicoId || !oficiais[0].conteudoCanonicoId) return;
  return { materiaId: materia.conteudoCanonicoId, assuntoId: oficiais[0].conteudoCanonicoId };
}

export function resolverUnidade(materias: readonly Materia[], referencia: ReferenciaConteudo) {
  const candidatos: string[] = [];
  let incerto = false;
  for (const materia of materias) {
    if (![materia.id, ...(materia.idsLegados ?? [])].includes(referencia.materiaId)) continue;
    const modulos = materia.modulos?.length ? materia.modulos : [{
      id: criarIdModuloGeral(materia.id), nome: "Geral", ordem: 0, assuntos: materia.assuntos,
    }];
    let destino = referencia;
    const origemVisao = obterOrigemDoAssuntoVisaoCurso(referencia.assuntoId);
    if (origemVisao) {
      const visoes = listarModulosDaMateria(materia)
        .filter(m => !ehModuloVisaoCurso(referencia.moduloId) || m.id === referencia.moduloId)
        .flatMap(m => m.assuntos.filter(a => a.id === referencia.assuntoId));
      if (visoes.length !== 1 || (referencia.moduloId && !ehModuloVisaoCurso(referencia.moduloId) &&
        referencia.moduloId !== origemVisao.moduloId)) continue;
      const origemAula = referencia.aulaId && visoes[0].aulas?.some(a => a.id === referencia.aulaId)
        ? obterOrigemDaAulaVisaoCurso(referencia.aulaId) : undefined;
      if (referencia.aulaId && !origemAula) continue;
      const assuntoId = origemAula?.assuntoId ?? origemVisao.assuntoId;
      const originais = modulos.filter(m => m.id === origemVisao.moduloId)
        .flatMap(m => m.assuntos.filter(a => !assuntoId || a.id === assuntoId));
      if (originais.length !== 1) {
        incerto ||= originais.length > 1;
        continue;
      }
      destino = { ...referencia, moduloId: origemVisao.moduloId, assuntoId: originais[0].id, aulaId: origemAula?.aulaId };
    }
    for (const modulo of modulos) {
      if (destino.moduloId !== undefined && modulo.id !== destino.moduloId) continue;
      for (const assunto of modulo.assuntos) {
        if (![assunto.id, ...(assunto.idsLegados ?? [])].includes(destino.assuntoId)) continue;
        const base = ["memoria-v1", materia.id, modulo.id, assunto.id];
        const assuntoIncerto = assunto.vinculoCurso?.status === "ambiguo";
        if (destino.aulaId === undefined && destino.topicoId === undefined) {
          candidatos.push(JSON.stringify(base));
          incerto ||= assuntoIncerto;
          continue;
        }
        for (const topico of topicosDoAssunto(modulo, assunto)) {
          if (destino.topicoId !== undefined && topico.id !== destino.topicoId) continue;
          if (destino.aulaId !== undefined && topico.aula?.id !== destino.aulaId) continue;
          const individual = topico.id !== assunto.id && topico.aula;
          candidatos.push(JSON.stringify(individual ? [...base, "aula", individual.id] : base));
          incerto ||= assuntoIncerto || topico.aula?.vinculoCurso?.status === "ambiguo";
        }
      }
    }
  }
  if (candidatos.length === 1 && !incerto) return { status: "validado", unidadeId: candidatos[0], referencia } as const;
  return { status: candidatos.length || incerto ? "ambiguo" : "sem_vinculo", candidatos, referencia } as const;
}
