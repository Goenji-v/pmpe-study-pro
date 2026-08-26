import type { ConfiguracoesApp } from "./index";

export type ItemCapturaCurso = {
  tipo: "titulo" | "cabecalho" | "link" | "texto";
  texto: string;
  href?: string;
  nivel?: number;
};

export type CapturaCurso = {
  versao: 1;
  titulo?: string;
  urlOrigem?: string;
  capturadoEm?: string;
  itens: ItemCapturaCurso[];
};

export type CursoAula = {
  id: string;
  nome: string;
  url?: string;
  ordem: number;
  concluida?: boolean;
  concluidaEm?: string;
};

export type CursoModulo = {
  id: string;
  nome: string;
  ordem: number;
  aulas: CursoAula[];
};

export type CursoMateria = {
  id: string;
  nome: string;
  ordem: number;
  modulos: CursoModulo[];
};

export type CursoImportado = {
  id: string;
  nome: string;
  origem: "html" | "mhtml" | "captura-json" | "texto";
  nomeArquivo?: string;
  urlOrigem?: string;
  criadoEm: string;
  atualizadoEm: string;
  materias: CursoMateria[];
};

export type ConfiguracoesCursosExtras = {
  cursos?: CursoImportado[];
  cursosAtivosIds?: string[];
};

export type ConfiguracoesComCursos = ConfiguracoesApp & ConfiguracoesCursosExtras;
