import type { Assunto, Materia, Modulo } from "../types";
import { agruparAssuntosParaExibicao } from "./auditoriaAgrupamentoAssuntos";

/** Mantém as aulas/assuntos originais intactos; só muda a unidade de revisão.
 * O bloco de Classes de palavras é revisado após concluir suas partes.
 * Nenhuma revisão antiga ou registro de progresso é reescrito aqui.
 */
export function planejarEscopoRevisao(params: {
  materia: Materia;
  modulo: Modulo;
  assunto: Assunto;
  concluido: boolean;
}) {
  const { materia, modulo, assunto, concluido } = params;
  const grupos = agruparAssuntosParaExibicao(materia.nome, modulo.id, modulo.assuntos);
  const grupo = grupos.find((item) =>
    item.tipo === "tema" &&
    normalizar(item.titulo) === "classes de palavras" &&
    item.assuntos.length >= 2 &&
    item.assuntos.some((parte) => parte.id === assunto.id)
  );

  if (!grupo) {
    return {
      assuntoId: assunto.id,
      assunto: assunto.nome,
      modulo: modulo.nome,
      completo: concluido,
      escopoGrupo: false,
      grupoAssuntosIds: [] as string[],
    };
  }

  return {
    // ID sintético determinístico: uma agenda por bloco, não por videoaula.
    assuntoId: "grupo-revisao:" + materia.id + ":" + modulo.id + ":classes-de-palavras",
    assunto: "Classes de palavras",
    modulo: grupo.titulo,
    completo: grupo.assuntos.every((parte) =>
      parte.id === assunto.id ? concluido : parte.concluido
    ),
    escopoGrupo: true,
    grupoAssuntosIds: grupo.assuntos.map((parte) => parte.id),
  };
}

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .trim().toLowerCase().replace(/\s+/g, " ");
}
