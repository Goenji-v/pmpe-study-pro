import { ehModuloOficialPortugues, ehTrilhaOficialPortugues } from "../../data/cursoPortugues";
import type { Assunto, Materia, Modulo } from "../../types";
import {
  criarIdModuloGeral,
  ehModuloVisaoCurso,
  listarModulosDaMateria,
} from "../../services/conteudos/navegarConteudos";

export function prepararMateriaParaConteudos(materia: Materia): Materia {
  const modulos = listarModulosDaMateria(materia);
  return {
    ...materia,
    modulos,
    assuntos: modulos.flatMap((modulo) => modulo.assuntos),
  };
}

export function moduloGerenciadoPorCurso(modulo: Pick<Modulo, "id">) {
  return ehModuloVisaoCurso(modulo.id) || modulo.id.startsWith("curso:");
}

export function materiaTemCursoImportado(materia: Materia) {
  return (materia.modulos ?? []).some(
    (modulo) =>
      moduloGerenciadoPorCurso(modulo) ||
      modulo.assuntos.some((assunto) =>
        (assunto.aulas ?? []).some((aula) => Boolean(aula.origemCurso))
      )
  );
}

export function moduloProtegido(materia: Materia, modulo: Modulo) {
  return moduloGerenciadoPorCurso(modulo) ||
    (ehModuloOficialPortugues(modulo.id) && ehTrilhaOficialPortugues(materia));
}

export function assuntoTemAulaImportada(assunto: Assunto) {
  return (assunto.aulas ?? []).some(aula => Boolean(aula.origemCurso));
}

export function materiaPermiteRenomear(materia: Materia) {
  return !ehTrilhaOficialPortugues(materia) &&
    (!materiaTemCursoImportado(materia) || (materia.modulos ?? []).some(modulo => !moduloProtegido(materia, modulo)));
}

export function criarMateriaManual(id: string, nome: string): Materia {
  return {
    id,
    nome,
    origemConteudo: "manual",
    modulos: [{ id: criarIdModuloGeral(id), nome: "Geral", ordem: 0, assuntos: [] }],
    assuntos: [],
  };
}
