import type { Assunto, Materia, Revisao, SessaoEstudo } from "../types";
import { listarAssuntosDaMateria } from "../services/conteudos/navegarConteudos";
import {
  identificarConteudoCatalogo,
  identificarDisciplinaCatalogo,
  normalizarNomeCatalogo,
} from "./catalogoAssuntosCentral";

type ReferenciaConteudo = {
  materia: Pick<Materia, "id" | "nome">;
  assunto: Pick<Assunto, "id" | "nome" | "concluido">;
};

/** Somente o MESMO subassunto, nunca uma família inteira (ex.: conectivos != tabela-verdade). */
export function mesmoSubassuntoComprovado(
  anterior: Pick<ReferenciaConteudo, "materia" | "assunto">,
  atual: Pick<ReferenciaConteudo, "materia" | "assunto">
): boolean {
  const d1 = identificarDisciplinaCatalogo(anterior.materia.nome)?.id;
  const d2 = identificarDisciplinaCatalogo(atual.materia.nome)?.id;
  if (d1 && d2 ? d1 !== d2
    : normalizarNomeCatalogo(anterior.materia.nome) !== normalizarNomeCatalogo(atual.materia.nome)) {
    return false;
  }

  if (anterior.materia.id === atual.materia.id &&
      anterior.assunto.id === atual.assunto.id) return true;

  if (normalizarNomeCatalogo(anterior.assunto.nome) ===
      normalizarNomeCatalogo(atual.assunto.nome)) return true;

  const um = identificarConteudoCatalogo(anterior.materia.nome, anterior.assunto.nome);
  const dois = identificarConteudoCatalogo(atual.materia.nome, atual.assunto.nome);
  return um.tipo === "subassunto" && dois.tipo === "subassunto" &&
    um.idsSubassuntos.length === 1 &&
    um.idsSubassuntos[0] === dois.idsSubassuntos[0];
}

/**
 * Uma nota em questões é um diagnóstico, não prova de conclusão da aula.
 * Consideramos apenas: assunto concluído, revisão concluída ou sessão cujo
 * conteúdo foi explicitamente concluído no MESMO subassunto. Não inferir
 * estudo pela mera proximidade dentro da mesma família pedagógica.
 */
export function existeEstudoConcluido(params: {
  materias: readonly Materia[];
  revisoes: readonly Revisao[];
  sessoes?: readonly SessaoEstudo[];
  materia: Materia;
  assunto: Assunto;
}): boolean {
  const alvo = {materia: params.materia, assunto: params.assunto};
  if (params.assunto.concluido) return true;

  for (const materia of params.materias) {
    for (const assunto of listarAssuntosDaMateria(materia)) {
      if (assunto.concluido &&
          mesmoSubassuntoComprovado({materia, assunto}, alvo)) return true;
    }
  }

  if (params.revisoes.some((revisao) =>
    revisao.concluida && !revisao.origemSimulado &&
    mesmoSubassuntoComprovado({
      materia: {id: revisao.materiaId, nome: revisao.materia},
      assunto: {id: revisao.assuntoId, nome: revisao.assunto, concluido: true},
    }, alvo)
  )) return true;

  return (params.sessoes ?? []).some((sessao) =>
    sessao.conteudoConcluido === true &&
    Boolean(sessao.assunto) &&
    mesmoSubassuntoComprovado({
      materia: {id: sessao.materiaId ?? "", nome: sessao.materia},
      assunto: {id: sessao.assuntoId ?? "", nome: sessao.assunto, concluido: true},
    }, alvo)
  );
}
