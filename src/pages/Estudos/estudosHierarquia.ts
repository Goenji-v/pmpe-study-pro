import type { Materia, Modulo } from "../../types";
import {
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
  return ehModuloVisaoCurso(modulo.id);
}

export function materiaTemCursoImportado(materia: Materia) {
  return (materia.modulos ?? []).some((modulo) =>
    moduloGerenciadoPorCurso(modulo)
  );
}
