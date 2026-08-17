import type {
  Assunto,
  Materia,
  Modulo,
} from "../../types";

export type MateriaLegada = {
  id: string;
  nome: string;
  assuntos: Assunto[];
  modulos?: never;
};

export type MateriaComModulos = {
  id: string;
  nome: string;
  modulos: Modulo[];
  /**
   * Espelho temporário para as telas ainda não migradas.
   * Será removido após todas as páginas usarem módulos.
   */
  assuntos: Assunto[];
};

export type MateriaCompatibilidade =
  | Materia
  | MateriaLegada
  | MateriaComModulos;
