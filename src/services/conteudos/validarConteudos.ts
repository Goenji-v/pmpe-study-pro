import type { Materia } from "../../types";

import {
  listarModulosDaMateria,
} from "./navegarConteudos";

export type ErroConteudo = {
  caminho: string;
  mensagem: string;
};

export function validarEstruturaConteudos(
  materias: Materia[]
): ErroConteudo[] {
  const erros: ErroConteudo[] = [];
  const idsMaterias = new Set<string>();

  materias.forEach((materia) => {
    if (idsMaterias.has(materia.id)) {
      erros.push({
        caminho: materia.nome,
        mensagem: `ID de matéria duplicado: ${materia.id}`,
      });
    }

    idsMaterias.add(materia.id);

    const idsModulos = new Set<string>();
    const idsAssuntos = new Set<string>();

    listarModulosDaMateria(materia).forEach(
      (modulo) => {
        if (idsModulos.has(modulo.id)) {
          erros.push({
            caminho: `${materia.nome} > ${modulo.nome}`,
            mensagem: `ID de módulo duplicado: ${modulo.id}`,
          });
        }

        idsModulos.add(modulo.id);

        modulo.assuntos.forEach((assunto) => {
          if (idsAssuntos.has(assunto.id)) {
            erros.push({
              caminho: `${materia.nome} > ${modulo.nome} > ${assunto.nome}`,
              mensagem: `ID de assunto duplicado na matéria: ${assunto.id}`,
            });
          }

          idsAssuntos.add(assunto.id);

          const idsAulas = new Set<string>();
          (assunto.aulas ?? []).forEach((aula) => {
            if (idsAulas.has(aula.id)) {
              erros.push({
                caminho: `${materia.nome} > ${modulo.nome} > ${assunto.nome} > ${aula.nome}`,
                mensagem: `ID de aula duplicado no assunto: ${aula.id}`,
              });
            }
            idsAulas.add(aula.id);
          });

          const idsTarefas = new Set<string>();
          (assunto.tarefas ?? []).forEach((tarefa) => {
            if (idsTarefas.has(tarefa.id)) {
              erros.push({
                caminho: `${materia.nome} > ${modulo.nome} > ${assunto.nome} > ${tarefa.nome}`,
                mensagem: `ID de tarefa duplicado no assunto: ${tarefa.id}`,
              });
            }
            idsTarefas.add(tarefa.id);
          });
        });
      }
    );
  });

  return erros;
}
